import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import type { PathNode } from "./provenance.js";
import type { Site } from "@/model/site.js";

const FLOW_FINGERPRINT_PATH = process.env.NODEMEDIC_FP_PATH ?? "flow_fingerprints.jsonl";

function siteToLoc(site: Site): {
  scriptName: string; startLineNumber: number; startColumnNumber: number;
  endLineNumber: number; endColumnNumber: number;
} {
  if (site.kind === "code") {
    return {
      scriptName: site.file,
      startLineNumber: site.start.line, startColumnNumber: site.start.column,
      endLineNumber: site.end.line, endColumnNumber: site.end.column,
    };
  }
  return {
    scriptName: "UNKNOWN", startLineNumber: -1, startColumnNumber: -1,
    endLineNumber: -1, endColumnNumber: -1,
  };
}

// ---------------------------------------------------------------------------
// Exploit-metric helpers — verbatim port from src/TaintPaths.ts:89-260.
// Adaptations (only):
//   - pn.parents is PathNode[] (array), not Set; Array.from() / .forEach() work
//     unchanged; loops simplified to `for (const x of pn.parents)`.
//   - pn.value is unknown; pn.value.toString() replaced with String(pn.value)
//     where the legacy did toString(); surrounding value-truthiness guards kept.
// ---------------------------------------------------------------------------

export function get_untainted_vals(pn: PathNode): string {
  var result = "";

  if (!pn) {
    return result;
  }

  if (pn.label === "Tainted") {
    return result;
  }

  if (!pn.tainted) {
    if (pn.value) {
      return String(pn.value);
    } else {
      return "";
    }
  }

  for (const parent of pn.parents) {
    result += get_untainted_vals(parent);
    if (parent.tainted) break;
  }

  return result;
}

export function get_tainted_vals_aux(pn: PathNode, sink: string): unknown[] {
  var result: unknown[] = [];

  if (!pn) {
    return result;
  }

  if (pn.label === "Tainted") {
    return result;
  }

  if (
    pn.tainted &&
    !(
      (pn.label === "call:stringify" || pn.label === "imprecise:stringify") &&
      sink == "eval"
    ) &&
    !(
      (pn.label === "call:encodeURIComponent" ||
        pn.label === "call:escape" ||
        pn.label === "imprecise:escape" ||
        pn.label === "imprecise:encodeURIComponent") &&
      (sink == "exec" || sink == "spawn")
    )
  ) {
    for (const parent of pn.parents) {
      var sub_list = get_tainted_vals_aux(parent, sink);
      result.push(...sub_list);
    }
  } else {
    if (pn.value) {
      result.push(pn.value);
    }
  }

  return result;
}

export function get_tainted_vals(pn: PathNode, sink: string): string {
  var result = "";

  if (!pn) {
    return result;
  }

  if (pn.label === "Tainted") {
    return result;
  }

  if (pn.label === "call:stringify" && sink == "eval") {
    return result;
  }
  if (
    (pn.label === "call:encodeURIComponent" || pn.label === "call:escape") &&
    (sink == "exec" || sink == "spawn")
  ) {
    return result;
  }

  if (pn.tainted) {
    if (!pn.value) {
      return result;
    }

    var tainted_val = String(pn.value);
    if (tainted_val === "") {
      return result;
    }

    var all_untainted_vals = get_tainted_vals_aux(pn, sink);
    for (var val of all_untainted_vals) {
      if (tainted_val.includes(String(val))) {
        tainted_val = tainted_val.replace(String(val), "");
      }
    }

    tainted_val = tainted_val.replaceAll("undefined", "");
    return tainted_val;
  } else {
    return result;
  }
}

// Verbatim copy from TaintPaths.ts:191-238.
export const map_expl: Record<string, [number, number]> = {
  "imprecise:concat": [0.03, 0.03],
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
  "call:assign": [0.42, 0.34],
};

// Provenance-complexity score. Visits each unique PathNode once (visited-set
// guard). Index into map_expl: [0] when tainted, [1] when not tainted.
// Default weight 0.958 for labels not in map_expl.
export function get_number_of_nodes(
  pn: PathNode,
  visited = new Set<PathNode>()
): number {
  var result = 0;
  if (!pn) {
    return result;
  }
  if (visited.has(pn)) return 0;
  visited.add(pn);

  if (map_expl[pn.label] !== undefined) {
    result += 1 - map_expl[pn.label][1 - Number(pn.tainted)]; // P(not_exploitable | pn.label ∈ prov)
  } else {
    result += 0.958; // P(not_exploitable)
  }

  for (const parent of pn.parents) {
    result += get_number_of_nodes(parent, visited);
  }

  return result;
}

// ---------------------------------------------------------------------------

export interface TaintPathEntry {
  operation: string;
  value: unknown;
  file: string;
  startLineNumber: number;
  startColumnNumber: number;
  endLineNumber: number;
  endColumnNumber: number;
  tainted: boolean;
  flows_from: string[];
  sink_type: string;
}

export function circularReplacer(): (_key: string, value: unknown) => unknown {
  const seen = new WeakSet<object>();
  return function (_key: string, value: unknown): unknown {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  };
}

export function stringifyTaintPathJSON(json: Record<string, TaintPathEntry>): string {
  try {
    return JSON.stringify(json, null, 4);
  } catch {
    return JSON.stringify(json, circularReplacer(), 4);
  }
}

export interface FlowFingerprint {
  fp: string;
  sink: string;
  ops: number;
  sites: number;
}

export function flowFingerprint(root: PathNode): FlowFingerprint {
  const ops: string[] = [];
  const sites = new Set<string>();
  let sink = "";
  const seen = new Set<PathNode>();

  const visit = (node: PathNode): void => {
    if (seen.has(node)) return;
    seen.add(node);
    ops.push(node.label);
    if (node.sinkType) sink = node.sinkType;
    const loc = siteToLoc(node.site);
    if (loc.startLineNumber !== -1) {
      sites.add(`${loc.scriptName}:${loc.startLineNumber}:${loc.startColumnNumber}`);
    }
    for (const parent of node.parents) visit(parent);
  };

  visit(root);
  const sig = `${sink}|${ops.slice().sort().join(",")}|${Array.from(sites).sort().join(",")}`;
  return {
    fp: createHash("sha1").update(sig).digest("hex").slice(0, 12),
    sink,
    ops: ops.length,
    sites: sites.size,
  };
}

export function recordFlowTelemetry(root: PathNode): void {
  try {
    const g = globalThis as typeof globalThis & { __nm_first_flow_ms__?: number };
    const ts = Date.now();
    if (g.__nm_first_flow_ms__ == null) g.__nm_first_flow_ms__ = ts;
    const f = flowFingerprint(root);
    appendFileSync(
      FLOW_FINGERPRINT_PATH,
      JSON.stringify({ ts, fp: f.fp, sink: f.sink, ops: f.ops, sites: f.sites, tainted: root.tainted }) + "\n",
    );
  } catch (_err) {
    // Telemetry is best-effort and must not change taint-analysis behavior.
  }
}

// Build the legacy taint-path JSON object: keyed by node id (string), root = "1",
// ids assigned by pre-order DFS over parents. Mirrors TaintPaths.ts describePathInnerJSON.
export function buildTaintPathJSON(root: PathNode): Record<string, TaintPathEntry> {
  const out: Record<string, TaintPathEntry> = {};
  const walk = (pn: PathNode, id: number): number => {
    const thisId = id;
    const flows_from: string[] = [];
    for (const parent of pn.parents) {
      id = id + 1;
      flows_from.push(id.toString());
      id = walk(parent, id);
    }
    const loc = siteToLoc(pn.site);
    out[thisId] = {
      operation: pn.label,
      value: pn.value,
      file: loc.scriptName,
      startLineNumber: loc.startLineNumber,
      startColumnNumber: loc.startColumnNumber,
      endLineNumber: loc.endLineNumber,
      endColumnNumber: loc.endColumnNumber,
      tainted: pn.tainted,
      flows_from,
      sink_type: pn.sinkType,
    };
    return id;
  };
  walk(root, 1);
  return out;
}
