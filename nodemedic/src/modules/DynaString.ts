import { State, taintEntry, PropMap, ID, setMt, getTc } from '../State';
import { newPathNode, PathNode } from '../TaintPaths';
import { Wrapped } from '../Wrapper';
import { F, NativeFunction } from '../Flib';
import { getTaintEntry, getValue, getPropTaint, oid, initPropMap } from '../Taint';

declare const require: any;

const { StringModel } = require("../vendor/dynajs-model.cjs");

interface DynaTaintInfo {
    bit: boolean;
    chars?: boolean[];
}

interface DynaWrapped<T = unknown> {
    value: T;
    info: DynaTaintInfo;
}

export interface DynaStringCallResult {
    methodName: string;
    value: any;
    taint: taintEntry;
    elementTaints?: taintEntry[];
}

interface DynaStringOptions {
    arrayPrecision: string;
}

interface DynaStringMethodSpec {
    name: string;
    native: NativeFunction;
    invoke(model: any, base: DynaWrapped<string>, args: DynaWrapped[]): DynaWrapped | DynaWrapped[];
}

function isDynaWrapped(value: unknown): value is DynaWrapped {
    return typeof value == 'object'
        && value !== null
        && Object.prototype.hasOwnProperty.call(value, 'value')
        && Object.prototype.hasOwnProperty.call(value, 'info');
}

function allCharsTainted(chars: boolean[]): boolean {
    return chars.length > 0 && chars.every((tainted) => tainted);
}

function anyCharTainted(chars: boolean[]): boolean {
    return chars.some((tainted) => tainted);
}

function wrap<T>(value: T, info: DynaTaintInfo): DynaWrapped<T> {
    return { value, info };
}

function taintEntryToInfo(value: string, entry: taintEntry): DynaTaintInfo {
    return F.matchMaybe(entry.map, {
        Just: (_map: PropMap): DynaTaintInfo => {
            let chars: boolean[] = [];
            for (let i = 0; i < value.length; i++) {
                chars.push(getPropTaint(entry, i.toString()));
            }
            return {
                bit: entry.taintBit,
                chars,
            };
        },
        Nothing: (): DynaTaintInfo => ({
            bit: entry.taintBit,
            chars: Array(value.length).fill(entry.taintBit),
        }),
    });
}

function valueToInfo(value: any, entry: taintEntry): DynaTaintInfo {
    if (F.isString(value)) {
        return taintEntryToInfo(String(value), entry);
    }
    return { bit: entry.taintBit };
}

function infoForBase<T>(value: T, parents: DynaWrapped[]): DynaTaintInfo {
    let parentHasTaint = parents.some((parent) =>
        parent.info.bit || (parent.info.chars !== undefined && anyCharTainted(parent.info.chars))
    );

    if (typeof value == 'string') {
        if (parents.length == 1 && parents[0].info.chars !== undefined
            && parents[0].info.chars.length == value.length) {
            let chars = parents[0].info.chars.slice();
            return {
                bit: allCharsTainted(chars),
                chars,
            };
        }
        return {
            bit: parentHasTaint,
            chars: Array(value.length).fill(parentHasTaint),
        };
    }

    return { bit: parentHasTaint };
}

function toIntegerOrInfinity(value: unknown): number {
    let number = Number(value);
    if (Number.isNaN(number) || number == 0) {
        return 0;
    }
    if (number == Infinity || number == -Infinity) {
        return number;
    }
    return Math.trunc(number);
}

function substringBounds(raw: string, start: unknown, end: unknown): [number, number] {
    let len = raw.length;
    let intStart = toIntegerOrInfinity(start);
    let intEnd = end === undefined ? len : toIntegerOrInfinity(end);
    let finalStart = Math.max(0, Math.min(intStart, len));
    let finalEnd = Math.max(0, Math.min(intEnd, len));
    return [Math.min(finalStart, finalEnd), Math.max(finalStart, finalEnd)];
}

const specOps = {
    base: function<T>(value: T, parents: DynaWrapped[]): DynaWrapped<T> {
        return wrap(value, infoForBase(value, parents || []));
    },

    peek: function<T>(wrapped: DynaWrapped<T> | T): T {
        if (isDynaWrapped(wrapped)) {
            return wrapped.value as T;
        }
        return wrapped as T;
    },

    substring: function(
        source: DynaWrapped<string>,
        start: DynaWrapped<number>,
        end: DynaWrapped<number>,
    ): DynaWrapped<string> {
        let raw = this.peek(source);
        let rawStart = this.peek(start);
        let rawEnd = this.peek(end);
        let concrete = raw.substring(rawStart, rawEnd);
        let [from] = substringBounds(raw, rawStart, rawEnd);
        let sourceChars = source.info.chars || Array(raw.length).fill(source.info.bit);
        let chars: boolean[] = [];

        for (let i = 0; i < concrete.length; i++) {
            chars.push(sourceChars[from + i] === true);
        }

        return wrap(concrete, {
            bit: allCharsTainted(chars),
            chars,
        });
    },

    concatenate: function(left: DynaWrapped<string>, right: DynaWrapped<string>): DynaWrapped<string> {
        let leftRaw = String(this.peek(left));
        let rightRaw = String(this.peek(right));
        let leftChars = left.info.chars || Array(leftRaw.length).fill(left.info.bit);
        let rightChars = right.info.chars || Array(rightRaw.length).fill(right.info.bit);
        let chars = leftChars.concat(rightChars);

        return wrap(leftRaw + rightRaw, {
            bit: allCharsTainted(chars),
            chars,
        });
    },
};

function infoToTaintEntry(s: State, resultValue: any, info: DynaTaintInfo, paths: PathNode[], label: string): taintEntry {
    if (!F.isString(resultValue)) {
        return {
            taintBit: info.bit,
            map: initPropMap(resultValue, info.bit),
            path: newPathNode(label, paths, resultValue, getTc(s)),
        };
    }

    let resultString = String(resultValue);
    let chars = info.chars !== undefined
        ? info.chars.slice(0, resultString.length)
        : Array(resultString.length).fill(info.bit);

    while (chars.length < resultString.length) {
        chars.push(false);
    }

    let propMap = new PropMap(resultString);
    for (let i = 0; i < resultString.length; i++) {
        propMap = propMap.set(i.toString(), chars[i] === true) as PropMap;
    }
    if (anyCharTainted(chars)) {
        propMap = propMap.set('length', true) as PropMap;
    }

    return {
        taintBit: allCharsTainted(chars),
        map: F.Just(propMap),
        path: newPathNode(label, paths, resultString, getTc(s)),
    };
}

function anyInfoTainted(info: DynaTaintInfo): boolean {
    return info.bit || (info.chars !== undefined && anyCharTainted(info.chars));
}

function allInfoTainted(info: DynaTaintInfo): boolean {
    if (info.chars !== undefined) {
        return allCharsTainted(info.chars);
    }
    return info.bit;
}

function resultArrayTaint(
    s: State,
    value: any[],
    elements: DynaWrapped[],
    paths: PathNode[],
    label: string,
    arrayPrecision: string,
): [taintEntry, taintEntry[]] {
    let elementTaints = elements.map((element) =>
        infoToTaintEntry(s, specOps.peek(element), element.info, paths, label)
    );
    let tainted = arrayPrecision == 'imprecise'
        ? elements.some((element) => anyInfoTainted(element.info))
        : elements.length > 0 && elements.every((element) => allInfoTainted(element.info));
    return [{
        taintBit: tainted,
        map: initPropMap(value, tainted),
        path: newPathNode(label, paths, value, getTc(s)),
    }, elementTaints];
}

const DYNA_STRING_METHODS: DynaStringMethodSpec[] = [
    {
        name: 'at',
        native: String.prototype.at,
        invoke: (model, base, args) => model.at(base, args[0] || wrap(undefined, { bit: false })),
    },
    {
        name: 'charAt',
        native: String.prototype.charAt,
        invoke: (model, base, args) => model.charAt(base, args[0] || wrap(undefined, { bit: false })),
    },
    {
        name: 'slice',
        native: String.prototype.slice,
        invoke: (model, base, args) => model.slice(base, args[0] || wrap(undefined, { bit: false }), args[1]),
    },
    {
        name: 'substring',
        native: String.prototype.substring,
        invoke: (model, base, args) => model.substring(base, args[0] || wrap(undefined, { bit: false }), args[1]),
    },
    {
        name: 'repeat',
        native: String.prototype.repeat,
        invoke: (model, base, args) => model.repeat(base, args[0] || wrap(undefined, { bit: false })),
    },
    {
        name: 'replace',
        native: String.prototype.replace,
        invoke: (model, base, args) => model.replace(
            base,
            args[0] || wrap(undefined, { bit: false }),
            args[1] || wrap(undefined, { bit: false }),
        ),
    },
    {
        name: 'concat',
        native: String.prototype.concat,
        invoke: (model, base, args) => model.concat(base, ...args),
    },
    {
        name: 'split',
        native: String.prototype.split,
        invoke: (model, base, args) => model.split(
            base,
            args.length >= 1 ? args[0] : undefined,
            args[1] || wrap(undefined, { bit: false }),
        ),
    },
];

function getDynaStringMethod(f: NativeFunction): DynaStringMethodSpec | undefined {
    return DYNA_STRING_METHODS.find((method) => method.native === f);
}

export function isDynaStringMethod(f: Function): boolean {
    return getDynaStringMethod(f as NativeFunction) !== undefined;
}

export function isDynajsStringResult(s: State, result: Wrapped): boolean {
    let id: Object | ID = F.eitherThrow(oid(s, result));
    return F.matchMaybe(s.Mt.get(id), {
        Just: (entry: taintEntry): boolean => entry.path.label.indexOf('dynajs:string.') == 0,
        Nothing: (): boolean => false,
    });
}

export function installDynajsStringResult(
    s: State,
    result: Wrapped,
    modeledResult: DynaStringCallResult,
): State {
    let resultId: Object | ID = F.eitherThrow(oid(s, result));
    let stateP = setMt(s, s.Mt.set(resultId, modeledResult.taint));
    let resultValue = getValue(stateP, result);

    if (Array.isArray(resultValue) && modeledResult.elementTaints !== undefined) {
        let MtP = stateP.Mt;
        for (let i = 0; i < resultValue.length && i < modeledResult.elementTaints.length; i++) {
            let elementId: Object | ID = F.eitherThrow(oid(stateP, resultValue[i]));
            MtP = MtP.set(elementId, modeledResult.elementTaints[i]);
        }
        stateP = setMt(stateP, MtP);
    }

    return stateP;
}

export function produceDynajsStringResult(
    s: State,
    f: NativeFunction,
    base: Wrapped,
    args: Wrapped[],
    options: DynaStringOptions,
): DynaStringCallResult {
    let method = getDynaStringMethod(f);
    F.assert(method !== undefined, "DynaString policy only supports DynaJS StringModel methods");

    let rawBase = String(getValue(s, base));
    let baseTaint = F.eitherThrow(getTaintEntry(s, base));
    let argTaints: taintEntry[] = [];
    let parentPaths: PathNode[] = [baseTaint.path];
    let wrappedArgs: DynaWrapped[] = [];

    for (let i = 0; i < args.length; i++) {
        let rawArg = getValue(s, args[i]);
        let argTaint = F.eitherThrow(getTaintEntry(s, args[i]));
        argTaints.push(argTaint);
        parentPaths.push(argTaint.path);
        wrappedArgs.push(wrap(rawArg, valueToInfo(rawArg, argTaint)));
    }

    let wBase = wrap(rawBase, taintEntryToInfo(rawBase, baseTaint));

    let model = new StringModel(specOps);
    let dynResult = method.invoke(model, wBase, wrappedArgs);
    let label = `dynajs:string.${method.name}`;

    if (Array.isArray(dynResult)) {
        let values = dynResult.map((element) => specOps.peek(element));
        let [taint, elementTaints] = resultArrayTaint(
            s,
            values,
            dynResult,
            parentPaths,
            label,
            options.arrayPrecision,
        );
        return {
            methodName: method.name,
            value: values,
            taint,
            elementTaints,
        };
    }

    let dynValue = specOps.peek(dynResult);

    return {
        methodName: method.name,
        value: dynValue,
        taint: infoToTaintEntry(s, dynValue, dynResult.info, parentPaths, label),
    };
}
