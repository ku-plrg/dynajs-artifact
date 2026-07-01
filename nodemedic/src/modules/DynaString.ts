import { State, taintEntry, PropMap, ID, setMt, getTc } from '../State';
import { newPathNode, PathNode } from '../TaintPaths';
import { Wrapped } from '../Wrapper';
import { F, NativeFunction } from '../Flib';
import { getTaintEntry, getValue, getPropTaint, oid } from '../Taint';

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

export interface DynaStringResult {
    value: string;
    taint: taintEntry;
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

    concatenate: function(): DynaWrapped<string> {
        throw Error("DynaString substring-only policy unexpectedly used concatenate");
    },
};

function infoToTaintEntry(s: State, resultValue: string, info: DynaTaintInfo, paths: PathNode[]): taintEntry {
    let chars = info.chars !== undefined
        ? info.chars.slice(0, resultValue.length)
        : Array(resultValue.length).fill(info.bit);

    while (chars.length < resultValue.length) {
        chars.push(false);
    }

    let propMap = new PropMap(resultValue);
    for (let i = 0; i < resultValue.length; i++) {
        propMap = propMap.set(i.toString(), chars[i] === true) as PropMap;
    }
    if (anyCharTainted(chars)) {
        propMap = propMap.set('length', true) as PropMap;
    }

    return {
        taintBit: allCharsTainted(chars),
        map: F.Just(propMap),
        path: newPathNode('dynajs:string.substring', paths, resultValue, getTc(s)),
    };
}

export function isDynajsSubstringResult(s: State, result: Wrapped): boolean {
    let id: Object | ID = F.eitherThrow(oid(s, result));
    return F.matchMaybe(s.Mt.get(id), {
        Just: (entry: taintEntry): boolean => entry.path.label == 'dynajs:string.substring',
        Nothing: (): boolean => false,
    });
}

export function installDynajsStringResult(
    s: State,
    result: Wrapped,
    modeledResult: DynaStringResult,
): State {
    let resultId: Object | ID = F.eitherThrow(oid(s, result));
    return setMt(s, s.Mt.set(resultId, modeledResult.taint));
}

export function produceDynajsSubstringResult(
    s: State,
    f: NativeFunction,
    base: Wrapped,
    args: Wrapped[],
): DynaStringResult {
    F.assert(f === String.prototype.substring, "DynaString policy only supports String.prototype.substring");
    F.assert(args.length == 1 || args.length == 2, "String.prototype.substring expects one or two args");

    let rawBase = String(getValue(s, base));
    let baseTaint = F.eitherThrow(getTaintEntry(s, base));
    let argTaints: taintEntry[] = [];
    let parentPaths: PathNode[] = [baseTaint.path];

    for (let i = 0; i < args.length; i++) {
        let argTaint = F.eitherThrow(getTaintEntry(s, args[i]));
        argTaints.push(argTaint);
        parentPaths.push(argTaint.path);
    }

    let wBase = wrap(rawBase, taintEntryToInfo(rawBase, baseTaint));
    let wStart = wrap(getValue(s, args[0]), { bit: argTaints[0].taintBit });
    let wEnd = args.length == 2
        ? wrap(getValue(s, args[1]), { bit: argTaints[1].taintBit })
        : undefined;

    let model = new StringModel(specOps);
    let dynResult = model.substring(wBase, wStart, wEnd);
    let dynValue = specOps.peek(dynResult);

    return {
        value: dynValue,
        taint: infoToTaintEntry(s, dynValue, dynResult.info, parentPaths),
    };
}
