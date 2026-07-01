import * as graphviz from 'graphviz';
import { Maybe, F } from './Flib';
import { inspect } from './Trace';
import { taintEntry, TextualContext } from './State';
import { copyFile, writeFileSync } from 'fs';
import * as cloneDeep from 'lodash.clonedeep';


// Generate taint flow paths
let TAINTPATHS: boolean = false;
// JSON output of taint flow paths
let TAINTPATHSJSON: boolean = false;

export function setTAINTPATHS(v: boolean) {
    TAINTPATHS = v;
}

export function setTAINTPATHSJSON(v: boolean) {
    TAINTPATHSJSON = v;
}

export interface PathNode {
    label: string,
    parents: Set<PathNode>
    value: string,
    tainted: boolean,
    textualContext: TextualContext,
    sinkType: string,
}

export function emptyPathNode(value: any, tc: TextualContext): PathNode {
    return {
        label: 'Untainted',
        parents: new Set(),
        value: value,
        tainted: false,
        textualContext: tc,
        sinkType: '',
    };
}

export function joinTEPaths(taintEntries: taintEntry[]): PathNode[] {
    let resultPaths = [];
    for (let i in taintEntries) {
        let tE: taintEntry = taintEntries[i];
        resultPaths.push(tE.path);
    }
    return resultPaths;
}

export function newPathNode(
    label: string,
    parents: PathNode[],
    value: any,
    textualContext: TextualContext,
    sinkType?: string | null,
): PathNode {
    sinkType = (sinkType) ? sinkType : '';
    if (parents.length == 0) {
        // If there are no parents then this is not tainted
        return {
            label: label,
            parents: new Set([emptyPathNode(value, textualContext)]),
            value: value,
            tainted: false,
            textualContext: textualContext,
            sinkType: sinkType,
        }
    } else {
        let anyTainted = false;
        for (let i in parents) {
            if (!F.isUndefinedOrNull(parents[i])) {
                let parent = parents[i];
                anyTainted = anyTainted || parent.tainted;
            }
        }
        anyTainted = anyTainted || (label == 'Tainted');
        return {
            label: label,
            parents: new Set(parents),
            value: value,
            tainted: anyTainted,
            textualContext: textualContext,
            sinkType: sinkType,
        }
    }
}

export function get_untainted_vals(pn: PathNode): string {
    var result = "";

    if (!pn){
        return result;
    }

    if (pn.label === "Tainted"){
        return result;
    }

    if (!pn.tainted){
        if (pn.value){
            return pn.value.toString();
        }
        else{
            return "";
        }
    }

    for (const parent of Array.from(pn.parents)) {
        result += get_untainted_vals(parent);
        if (parent.tainted) break;
    }

    return result;

}

export function get_tainted_vals_aux(pn: PathNode, sink: string): string[] {
    var result = [];

    if (!pn){
        return result;
    }

    if (pn.label === "Tainted"){
        return result;
    }

    if (pn.tainted && !((pn.label === "call:stringify" || pn.label === "imprecise:stringify") && sink == 'eval') && !((pn.label === "call:encodeURIComponent" || pn.label === "call:escape" || pn.label === "imprecise:escape" || pn.label === "imprecise:encodeURIComponent") && (sink == 'exec' || sink == 'spawn') )){

        for (const parent of Array.from(pn.parents)) {
            var sub_list = get_tainted_vals_aux(parent, sink);
            result.push(...sub_list);
        }
    }
    else{
        if (pn.value){
            result.push(pn.value);
        }
    }


    return result;
    
}

export function get_tainted_vals(pn: PathNode, sink: string): string {    
    var result = "";

    if (!pn){
        return result;
    }

    if (pn.label === "Tainted"){
        return result;
    }

    if (pn.label === "call:stringify" && sink == 'eval'){
        return result;
    }
    if ((pn.label === "call:encodeURIComponent" || pn.label === "call:escape") && (sink == 'exec' || sink == 'spawn') )  {
        return result;
    }

    if (pn.tainted){
        if (!pn.value){
            return result;
        }

        var tainted_val = pn.value.toString();
        if (tainted_val === ""){
            return result;
        }

        var all_untainted_vals = get_tainted_vals_aux(pn, sink);
        for (var val of all_untainted_vals){
            if (tainted_val.includes(val.toString())){
                tainted_val = tainted_val.replace(val, "");   
            }
        }

        tainted_val = tainted_val.replaceAll('undefined','');
        return tainted_val;

    }
    else{
        return result;
    }
}

const map_expl = {"imprecise:concat": [0.03, 0.03],
"model:string.split": [0.23, 0.92],
"object.GetField": [0.17, 0.03],
"call:isArray": [0.23, 0.16],
"call:existsSync": [0.45, 0.55],
"call:Anonymous Function": [0.21, 0.04],
"precise:string.substr": [0.1, 0.0],
"call:exec": [0.05, 0.01],
"call:compile": [0.08, 0.02],
"call:parse": [0.08, 0.0],
"call:substring": [0.21, 0.0],
"call:eval": [0.67, 0.0],
"string.GetField": [0.0, 0.0],
"call:Array": [0.01, 0.0],
"imprecise:stringify": [0.09, 0.0],
"imprecise:Array": [0.0, 0.0],
"|": [0.0, 0.4],
"model:array.join": [0.4, 0.5],
"call:add": [0.22, 0.64],
"call:hasOwnProperty": [0.03, 0.0],
"precise:string.substring": [0.09, 0.01],
"call:concat": [0.47, 0.67],
"precise:string.replace": [0.21, 0.05],
"call:indexOf": [0.12, 0.01],
"-": [0.0, 0.01],
"call:isObject": [0.0, 0.5],
"call:string": [0.0, 0.0],
"object.Unary": [0.0, 0.01],
">>>": [0.0, 1.0],
"call:log": [0.84, 0.71],
"imprecise:slice": [0.04, 0.0],
"precise:string.trim": [0.19, 0.75],
"model:array.map": [0.02, 0.26],
"call:debug": [0.67, 0.0],
"precise:string.concat": [0.11, 0.41],
"call:get": [0.55, 1.0],
"call:charAt": [0.0, 0.0],
"imprecise:filter": [0.0, 0.5],
"call:push": [0.08, 0.02],
"call:stringify": [0.08, 0.12],
"call:replace": [0.43, 0.13],
"imprecise:call": [0.62, 0.0],
"call:matchAll": [0.0, 0.0],
"+": [0.08, 0.01],
"precise:string.slice": [0.12, 0.0],
"call:isString": [0.1, 1.0],
"call:String": [0.26, 1.0],
"call:assign": [0.42, 0.34]};

export function get_number_of_nodes(pn: PathNode, visited = new Set<PathNode>()): number {
    var result = 0;
    if (!pn){
        return result;
    }
    if (visited.has(pn)) return 0;
    visited.add(pn);

    if  (map_expl[pn.label] !== undefined){
        result += (1-map_expl[pn.label][1-Number(pn.tainted)]); // P(not_exploitable | pn.label \in prov)
    }
    else{
        result += 0.958; // P(not_exploitable)
    }
    
    for (const parent of Array.from(pn.parents)) {
        result += get_number_of_nodes(parent, visited);
    }

    return result;
}

function describePathInner(g: any, pn: PathNode, childNode: Maybe<object>, id: number) {
    let sanitizedValue1 = `${inspect(pn.value)}`.split('"').join('');
    let sanitizedValue2 = sanitizedValue1.split('`').join('');
    let parentNode = g.addNode(`(${id}) ${pn.label}\n${sanitizedValue2}`);
    F.matchMaybe(childNode, {
        Just: (node: object) => {
            let e = g.addEdge(parentNode, node);
            if (pn.tainted) {
                e.set('color', 'red');
            }
        },
        Nothing: () => {}
    });
    pn.parents.forEach((parent: PathNode) => {
        id = describePathInner(g, parent, F.Just(parentNode), id + 1);
    });
    return id;
}

function describePathInnerJSON(out: any, pn: PathNode, id: number) {
    let this_id = id;
    let flows_from = [];
    pn.parents.forEach((parent: PathNode) => {
        id = id + 1;
        flows_from.push(id.toString());
        id = describePathInnerJSON(out, parent, id);
    });
    out[this_id] = {
        'operation': pn.label,
        'value': pn.value,
        'file': pn.textualContext.scriptName,
        'startLineNumber': pn.textualContext.startLineNumber,
        'startColumnNumber': pn.textualContext.startColumnNumber,
        'endLineNumber': pn.textualContext.endLineNumber,
        'endColumnNumber': pn.textualContext.endColumnNumber,
        'tainted': pn.tainted,
        'flows_from': flows_from,
        'sink_type': pn.sinkType,
    };
    return id;
}

export function circularReplacer() {
    const seen = new WeakSet();
    return function(key, value) {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                // Commented out due to:
                // Symbol.prototype.valueOf requires that 'this' be a Symbol
                // return cloneDeep(value);
                return '[Circular]';
            }
            seen.add(value);
        }
        return value;
    }
}

export function describePath(pn: PathNode, filename?: string) {
    if (filename !== undefined && filename.startsWith("none")){
        return;
    }
    
    if (TAINTPATHS) {
        // Create digraph G
        // @ts-ignore
        let g = graphviz.digraph("Taint_Paths");
        describePathInner(g, pn, F.Nothing(), 1);
        // Generate a PNG output
        let filePath = (filename == null) ? 'taint_0.pdf' : `taint_${filename}.pdf`;
        try {
            g.output('pdf', filePath);
        } catch(err) {
            throw Error(`Failed to output JSON taint path: ${err}`);
        }
    }
    if (TAINTPATHSJSON) {
        let out = {};
        describePathInnerJSON(out, pn, 1);
        let filePath = (filename == null) ? 'taint_0.json' : `taint_${filename}.json`;
        try {
            try{
                var j = JSON.stringify(out, null, 4);
                writeFileSync(filePath, j);
            }
            catch {
                writeFileSync(filePath, JSON.stringify(out, circularReplacer(), 4));
            }
        } catch(err) {
            throw Error(`Failed to output JSON taint path: ${err}`);
        }
    }
}
