import * as fs from "fs";
import { promisify } from "node:util";
import type { Analysis } from "@/types/analysis.js";
import { FlowAnalysis, type Valued, type InfoDomain, type Site } from "../../lib/dynajs/analyses/flow/index.js";
import {
  NmInfo, PathNode,
  anyTainted, newNode,
} from "./provenance.js";
import { installPrelude } from "./prelude.js";
import { SINKS, sinkName, registerDynamicSink } from "./sinks.js";
import {
  buildTaintPathJSON,
  get_number_of_nodes,
  get_tainted_vals,
  get_untainted_vals,
  recordFlowTelemetry,
  stringifyTaintPathJSON,
} from "./report.js";
import { taintPathsJson, abortOnFlow } from "./config.js";
import { TraceProperty, FlowError } from "./trace.js";

declare const D$: { analysis: Analysis } & Record<string, any>;

const GHOSTS = installPrelude();
// Names of every ghost function we install. The generated fuzzer drivers define
// their OWN local dummy stubs (e.g. `function __fuzzer_get_trace_properties__(e){return e}`)
// and rely on the analysis intercepting them BY NAME (as the legacy engine does
// via isGhostFunction(f.name)). We dispatch by identity (our installed globals),
// so a driver's local stub would otherwise run unintercepted and return garbage —
// crashing the fuzzer's feed_cov. GHOST_NAMES lets invokeFunPre redirect any
// same-named callee to our real global implementation.
const GHOST_NAMES = new Set<string>(
  Array.from(GHOSTS, (fn) => (fn as { name?: string }).name).filter(
    (n): n is string => typeof n === "string" && n.length > 0,
  ),
);

function isPrimitive(value: unknown): value is string | number | boolean | bigint | symbol | null | undefined {
  return value === null || (typeof value !== "object" && typeof value !== "function");
}

function functionNameMatches(pendingName: string, actualName: string): boolean {
  return pendingName === actualName || pendingName.replace(/^(bound )+/, "") === actualName;
}

function isNativeFunction(value: Function): boolean {
  try {
    return /\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(value));
  } catch {
    return false;
  }
}

function isCommonJSRequire(value: Function): boolean {
  const maybeRequire = value as Function & {
    resolve?: unknown;
    cache?: unknown;
    extensions?: unknown;
  };
  return value.name === "require" &&
    typeof maybeRequire.resolve === "function" &&
    maybeRequire.cache !== undefined &&
    maybeRequire.extensions !== undefined;
}

function isArgumentsObject(value: unknown): value is IArguments {
  return Object.prototype.toString.call(value) === "[object Arguments]";
}

function arrayLikeEntries(value: unknown, concrete: ArrayLike<unknown>): unknown[] {
  const length = Number((value as { length?: unknown } | null | undefined)?.length ?? concrete.length);
  return Array.from({ length }, (_, i) => (value as ArrayLike<unknown>)[i]);
}

export class NodeMedicAnalysis extends FlowAnalysis<NmInfo | undefined> {
  protected transparentCalls = GHOSTS;

  domain: InfoDomain<NmInfo | undefined> = {
    getBottom: () => undefined,
    isBottom: (info) => !anyTainted(info),
  };

  // --- flow verdict state ---
  flowFound = false;
  flowSink: string | undefined = undefined;
  flowNode: PathNode | undefined = undefined;

  // --- taint-path output location (set via __set_taint_flow_path__) ---
  taintPath = "./";

  // --- TraceProperty: holds exploit metrics + branch/field coverage ---
  traceProp = new TraceProperty();

  // --- exploit metrics: getters backed by traceProp (prelude reads these as fields) ---
  get provenanceComplexity(): number { return this.traceProp.provenance_complexity; }
  get attackerControlledData(): string { return this.traceProp.attacker_controlled_data; }
  get prefixAce(): string { return this.traceProp.prefix_ace; }
  get triggersFlow(): number { return this.traceProp.triggers_flow; }

  // --- taint-path JSON file counter ---
  private _taintFileCounter = 0;

  private pendingCallArgs: Array<{
    f: unknown;
    args: unknown[];
    forwarded: boolean;
    infos: Array<NmInfo | undefined>;
  }> = [];
  private pendingBindCalls = new Map<number, { target: Function; args: unknown[] }>();
  private boundFunctions = new WeakMap<Function, { target: Function; args: unknown[] }>();
  private boundTargets = new WeakMap<Function, Array<{ args: unknown[] }>>();
  private lastPrimitiveRead: { name: string; value: unknown; info?: NmInfo } | undefined;
  private primitiveVariableInfos = new Map<string, { value: unknown; info: NmInfo }>();
  private fieldFrames: Array<{
    name: string;
    argsTainted: boolean;
    args: Valued<NmInfo | undefined>[];
    nodes: PathNode[];
    paramNames: Set<string>;
    paramFields: Map<string, { value: unknown; info: NmInfo }>;
    paramInfos: Array<NmInfo | undefined>;
    allowParamNameFeedback: boolean;
    nextParamIndex: number;
  }> = [];
  private pendingFieldReturn: { name: string; node: PathNode; value: unknown } | undefined;

  // --- propagation hooks ---

  private operandNode(v: Valued<NmInfo | undefined>): PathNode {
    return v.info?.node ?? newNode("Untainted", [], v.value, this.currentSite());
  }

  private matchingBoundTargetArgs(target: Function, runtimeArgs: unknown[]): unknown[] | undefined {
    const candidates = this.boundTargets.get(target);
    if (candidates === undefined) return undefined;
    for (let i = candidates.length - 1; i >= 0; i--) {
      const boundArgs = candidates[i].args;
      if (boundArgs.length > runtimeArgs.length) continue;
      let matches = true;
      for (let j = 0; j < boundArgs.length; j++) {
        if (!Object.is(this.valued(boundArgs[j]).value, this.valued(runtimeArgs[j]).value)) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return [...boundArgs, ...runtimeArgs.slice(boundArgs.length)];
      }
    }
    return undefined;
  }

  private pendingArgsMatchRuntime(pendingArgs: unknown[], runtimeArgs: unknown[]): boolean {
    if (pendingArgs.length !== runtimeArgs.length) return false;
    for (let i = 0; i < pendingArgs.length; i++) {
      if (!Object.is(this.valued(pendingArgs[i]).value, this.valued(runtimeArgs[i]).value)) {
        return false;
      }
    }
    return true;
  }

  private shouldTreatOpaqueCallAsForwarding(f: unknown, args: unknown[]): boolean {
    if (typeof f !== "function" || !this.policy.isOpaque(f)) return false;
    if (isNativeFunction(f) || isCommonJSRequire(f)) return false;
    return args.some((arg) => {
      const tainted = this.findTaintedSinkValue(arg);
      return tainted !== undefined && anyTainted(tainted.info);
    });
  }

  private propagateArrayElementInfo(sourceArg: unknown, targetArg: unknown): boolean {
    const source = this.valued(sourceArg).value;
    const target = this.valued(targetArg).value;
    if (!Array.isArray(source) || !Array.isArray(target)) return false;

    let propagated = false;
    const elementParents: PathNode[] = [];
    const limit = Math.min(source.length, target.length);
    for (let i = 0; i < limit; i++) {
      const sourceElement = this.valued(source[i]) as Valued<NmInfo | undefined>;
      if (!anyTainted(sourceElement.info)) continue;
      if (!Object.is(sourceElement.value, this.valued(target[i]).value)) continue;
      elementParents.push(sourceElement.info!.node);
      const wrappedElement = this.lift(target[i], sourceElement.info);
      target[i] = wrappedElement;
      if (Array.isArray(targetArg)) {
        targetArg[i] = wrappedElement;
      }
      propagated = true;
    }
    if (elementParents.length > 0) {
      this.setInfo(targetArg, {
        bit: true,
        node: newNode("flow", elementParents, this.valued(targetArg).value, this.currentSite()),
      });
    }
    return propagated;
  }

  private arrayConcatResult(f: unknown, base: unknown, args: unknown, result: unknown): unknown | undefined {
    const concreteBase = this.valued(base).value;
    const concreteResult = this.valued(result).value;
    if (
      !Array.isArray(concreteBase) ||
      !Array.isArray(concreteResult) ||
      (f !== Array.prototype.concat && !(typeof f === "function" && f.name === "concat"))
    ) {
      return undefined;
    }

    const parents: PathNode[] = [];
    let resultIndex = 0;
    const appendElement = (element: unknown) => {
      if (resultIndex >= concreteResult.length) return;
      const sourceElement = this.valued(element) as Valued<NmInfo | undefined>;
      const resultElement = this.valued(concreteResult[resultIndex]);
      if (anyTainted(sourceElement.info) && Object.is(sourceElement.value, resultElement.value)) {
        concreteResult[resultIndex] = this.lift(resultElement.value, sourceElement.info);
        parents.push(sourceElement.info!.node);
      }
      resultIndex++;
    };
    const appendPart = (part: unknown) => {
      const concrete = this.valued(part).value;
      if (Array.isArray(concrete)) {
        for (const element of arrayLikeEntries(part, concrete)) appendElement(element);
      } else {
        appendElement(part);
      }
    };

    appendPart(base);
    for (const arg of Array.from(args ?? [])) appendPart(arg);
    if (parents.length === 0) return undefined;
    return this.lift(concreteResult, {
      bit: true,
      node: newNode("flow", parents, concreteResult, this.currentSite()),
    });
  }

  private objectAssignInfo(entries: unknown[], result: unknown): NmInfo | undefined {
    if (entries.length < 2) return undefined;
    const parents = entries.map((entry) => this.valued(entry) as Valued<NmInfo | undefined>);
    if (!parents.some((parent) => anyTainted(parent.info))) return undefined;
    return {
      bit: true,
      node: newNode(
        "call:assign",
        parents.map((parent) => this.operandNode(parent)),
        this.valued(result).value,
        this.currentSite(),
      ),
    };
  }

  private materializeArrayElementInfo(arg: Valued<NmInfo | undefined>): unknown {
    if (!Array.isArray(arg.value)) return arg.value;
    let changed = false;
    const copy = arg.value.slice();
    for (let i = 0; i < copy.length; i++) {
      const element = this.valued(copy[i]) as Valued<NmInfo | undefined>;
      let info = element.info;
      if (!anyTainted(info) && anyTainted(arg.info)) {
        const propNode = newNode("Untainted", [], i, this.currentSite());
        info = {
          bit: true,
          node: newNode("object.GetField", [this.operandNode(arg), propNode], element.value, this.currentSite()),
        };
        if (typeof element.value === "string") {
          info.chars = Array.from({ length: element.value.length }, () => true);
        }
      }
      if (!anyTainted(info)) continue;
      copy[i] = this.lift(element.value, info);
      changed = true;
    }
    return changed ? copy : arg.value;
  }

  // The framework Site for the current instruction; stored verbatim on PathNodes
  // and mapped to the legacy JSON field names only in report.ts.
  protected currentSite(): Site {
    return this.site();
  }

  protected defaultInfo(value: unknown, parents: Valued<NmInfo | undefined>[]): NmInfo | undefined {
    if (!parents.some((p) => anyTainted(p.info))) return undefined;
    const parentNodes = parents.map((p) => this.operandNode(p));
    const node = newNode("flow", parentNodes, value, this.currentSite());
    if (typeof value === "string") {
      return { bit: true, chars: Array.from({ length: value.length }, () => true), node };
    }
    return { bit: true, node };
  }

  protected opaqueCallInfo(f: unknown, entries: unknown[], result: unknown): NmInfo | undefined {
    if (f === Object.assign) {
      return this.objectAssignInfo(entries, result);
    }
    return undefined;
  }

  protected concatenateInfo(left: Valued<NmInfo | undefined, string>, leftLength: number,
                            right: Valued<NmInfo | undefined, string>, rightLength: number): NmInfo | undefined {
    const chars: boolean[] = [];
    const push = (n: number, info: NmInfo | undefined) => {
      for (let i = 0; i < n; i++) {
        chars.push(info?.chars !== undefined ? info.chars[i] === true : (info?.bit ?? false));
      }
    };
    push(leftLength, left.info);
    push(rightLength, right.info);
    const parents = [this.operandNode(left), this.operandNode(right)];
    const value = String(left.value) + String(right.value);
    return { bit: anyTainted(left.info) || anyTainted(right.info) || chars.some((c) => c), chars,
      node: newNode("precise:string.concat", parents, value, this.currentSite()) };
  }

  private coercedObjectConcatInfo(
    left: unknown,
    right: unknown,
    result: unknown,
  ): NmInfo | undefined {
    if (typeof result !== "string") return undefined;
    const leftValue = this.valued(left) as Valued<NmInfo | undefined>;
    const rightValue = this.valued(right) as Valued<NmInfo | undefined>;
    const leftObjectTainted = leftValue.value !== null &&
      (typeof leftValue.value === "object" || typeof leftValue.value === "function") &&
      anyTainted(leftValue.info);
    const rightObjectTainted = rightValue.value !== null &&
      (typeof rightValue.value === "object" || typeof rightValue.value === "function") &&
      anyTainted(rightValue.info);
    if (!leftObjectTainted && !rightObjectTainted) return undefined;

    const chars = Array.from({ length: result.length }, () => false);
    const leftPrimitiveString = isPrimitive(leftValue.value) ? String(leftValue.value) : undefined;
    const rightPrimitiveString = isPrimitive(rightValue.value) ? String(rightValue.value) : undefined;
    if (leftObjectTainted && rightPrimitiveString !== undefined && result.endsWith(rightPrimitiveString)) {
      chars.fill(true, 0, result.length - rightPrimitiveString.length);
    } else if (rightObjectTainted && leftPrimitiveString !== undefined && result.startsWith(leftPrimitiveString)) {
      chars.fill(true, leftPrimitiveString.length);
    } else {
      chars.fill(true);
    }
    const parents = [this.operandNode(leftValue), this.operandNode(rightValue)];
    return {
      bit: chars.some((c) => c),
      chars,
      node: newNode("precise:string.concat", parents, result, this.currentSite()),
    };
  }

  // DynaJS a2e446e changed this hook's ABI: start/end now arrive as Valued
  // (carrying their own index taint), not raw numbers, and resultLength is the
  // 4th arg. We mirror the legacy numeric-offset behavior under the new ABI.
  protected substringInfo(src: Valued<NmInfo | undefined, string>,
                          start: Valued<NmInfo | undefined, number>,
                          _end: Valued<NmInfo | undefined, number>,
                          resultLength: number): NmInfo | undefined {
    const startN = Number(start.value);
    const chars: boolean[] = [];
    for (let i = 0; i < resultLength; i++) {
      if (src.info?.chars !== undefined) chars.push(src.info.chars[startN + i] === true);
      else chars.push(src.info?.bit ?? false);
    }
    const parents = [this.operandNode(src)];
    const value = String(src.value).substring(startN, startN + resultLength);
    return { bit: anyTainted(src.info) || chars.some((c) => c), chars,
      node: newNode("precise:string.substring", parents, value, this.currentSite()) };
  }

  protected getFieldInfo(base: Valued<NmInfo | undefined>,
                         prop: Valued<NmInfo | undefined>,
                         result: Valued<NmInfo | undefined>): NmInfo | undefined {
    if (!anyTainted(base.info) && !anyTainted(prop.info)) return undefined;
    if (typeof base.value === "string" && anyTainted(base.info)) {
      const node = newNode("string.GetField", [this.operandNode(base), this.operandNode(prop)], result.value, this.currentSite());
      if (typeof result.value === "string") {
        return { bit: true, chars: Array.from({ length: result.value.length }, () => true), node };
      }
      return { bit: true, node };
    }
    if (base.value !== null && typeof base.value === "object") {
      const propNode = this.operandNode(prop);
      const node = newNode("object.GetField", [this.operandNode(base), propNode], result.value, this.currentSite());
      this.fieldFrames.at(-1)?.nodes.push(node);
      return { bit: true, node };
    }
    return this.defaultInfo(result.value, [base, prop]);
  }

  // --- branch coverage ---
  protected conditionInfo(id: number, _cond: Valued<NmInfo | undefined>, taken: boolean): void {
    this.traceProp.coverBranch(id, taken);
  }

  // --- field access recording ---
  getField(
    id: number,
    base: any,
    prop: any,
    result: any,
    isPrivateOrFrame: boolean | unknown,
    maybeFrame?: unknown,
  ) {
    const isPrivate = typeof isPrivateOrFrame === "boolean" ? isPrivateOrFrame : false;
    const frame = typeof isPrivateOrFrame === "boolean" ? maybeFrame : isPrivateOrFrame;
    const valuedBase = this.valued(base);
    const valuedProp = this.valued(prop);
    const concreteBase = valuedBase.value;
    const concreteProp = valuedProp.value;
    if (anyTainted(valuedBase.info) || anyTainted(valuedProp.info)) {
      this.traceProp.add_field(String(concreteProp));
    }
    if (Array.isArray(concreteBase)) {
      const index = typeof concreteProp === "number"
        ? concreteProp
        : typeof concreteProp === "symbol"
          ? NaN
          : Number(concreteProp);
      if (Number.isInteger(index) && index >= 0 && index < concreteBase.length) {
        result = concreteBase[index];
      }
    }
    return super.getField(id, base, prop, result, isPrivate, frame);
  }

  forInOfObject(id: number, value: any, isForIn: boolean) {
    const source = this.valued(value);
    if (typeof source.value === "string") {
      const chars: unknown[] = [];
      for (let i = 0; i < source.value.length; i++) {
        const start = this.lift(i);
        const end = this.lift(i + 1);
        const ch = source.value[i];
        const info = this.substringInfo(
          source as Valued<NmInfo | undefined, string>,
          this.valued(start),
          this.valued(end),
          ch.length,
        );
        chars.push(this.lift(ch, info));
      }
      return { result: chars };
    }
    return super.forInOfObject(id, value, isForIn);
  }

  functionEnter(_id: number, f: any, _base: any, args: any, _isAsync: boolean, _isGenerator: boolean): void {
    const runtimeArgs = Array.from(args ?? []);
    let pendingArgs: unknown[] | undefined;
    let pendingInfos: Array<NmInfo | undefined> | undefined;
    let pendingForwarded = false;
    const concreteF = this.valued(f).value;
    for (let i = this.pendingCallArgs.length - 1; i >= 0; i--) {
      if (this.pendingCallArgs[i].f === concreteF) {
        pendingArgs = this.pendingCallArgs[i].args;
        pendingInfos = this.pendingCallArgs[i].infos;
        pendingForwarded = this.pendingCallArgs[i].forwarded;
        this.pendingCallArgs.splice(i, 1);
        break;
      }
    }
    if (pendingArgs === undefined && typeof concreteF === "function" && concreteF.name) {
      for (let i = this.pendingCallArgs.length - 1; i >= 0; i--) {
        const pending = this.pendingCallArgs[i];
        if (!pending.forwarded || typeof pending.f !== "function" || !functionNameMatches(pending.f.name, concreteF.name)) continue;
        pendingArgs = pending.args;
        pendingInfos = pending.infos;
        pendingForwarded = true;
        this.pendingCallArgs.splice(i, 1);
        break;
      }
    }
    if (pendingArgs === undefined) {
      for (let i = this.pendingCallArgs.length - 1; i >= 0; i--) {
        const pending = this.pendingCallArgs[i];
        if (!pending.forwarded || !this.pendingArgsMatchRuntime(pending.args, runtimeArgs)) continue;
        pendingArgs = pending.args;
        pendingInfos = pending.infos;
        pendingForwarded = true;
        this.pendingCallArgs.splice(i, 1);
        break;
      }
    }
    if (pendingArgs === undefined && typeof concreteF === "function") {
      const matchedBoundArgs = this.matchingBoundTargetArgs(concreteF, runtimeArgs);
      if (matchedBoundArgs !== undefined) {
        pendingArgs = matchedBoundArgs;
        pendingForwarded = true;
      }
    }
    const provenanceArgs = pendingForwarded || (pendingArgs !== undefined && runtimeArgs.length === 0)
      ? (pendingArgs ?? runtimeArgs)
      : runtimeArgs;
    const argArr = runtimeArgs.length > 0 ? runtimeArgs : provenanceArgs;
    const allowParamNameFeedback = pendingArgs !== undefined && runtimeArgs.length === 0;
    const name = (typeof concreteF === "function" && concreteF.name) ? concreteF.name : "Anonymous Function";
    const paramInfos: Array<NmInfo | undefined> = [];
    for (let i = 0; i < provenanceArgs.length; i++) {
      const sourceArg = provenanceArgs[i];
      const targetArg = argArr[i] ?? sourceArg;
      this.propagateArrayElementInfo(sourceArg, targetArg);
      const info = pendingInfos?.[i] ?? this.getInfo(sourceArg) as NmInfo | undefined;
      if (pendingForwarded) paramInfos.push(undefined);
      if (!anyTainted(info)) continue;
      const valued = this.valued(targetArg);
      const callInfo = {
        ...info!,
        node: newNode(`call:${name}`, [info!.node], valued.value, this.currentSite()),
      };
      if (pendingForwarded) paramInfos[i] = callInfo;
      this.setInfo(targetArg, callInfo);
    }
    const callValuedArgs = argArr.map((arg, i) => {
      const valued = this.valued(arg) as Valued<NmInfo | undefined>;
      const forwardedInfo = paramInfos[i];
      if (!anyTainted(valued.info) && anyTainted(forwardedInfo)) {
        return { value: valued.value, info: forwardedInfo } as Valued<NmInfo | undefined>;
      }
      return valued;
    });
    const argsTainted = callValuedArgs.some((arg) => anyTainted(arg.info));
    this.fieldFrames.push({
      name,
      argsTainted: argsTainted || paramInfos.some((info) => anyTainted(info)),
      args: callValuedArgs,
      nodes: [],
      paramNames: new Set(),
      paramFields: new Map(),
      paramInfos,
      allowParamNameFeedback,
      nextParamIndex: 0,
    });
  }

  _return(_id: number, value: any) {
    const frame = this.fieldFrames.at(-1);
    if (frame === undefined) return undefined;
    if (!["toString", "valueOf", "[Symbol.toPrimitive]"].includes(frame.name)) return undefined;

    const concrete = this.valued(value).value;
    if (!isPrimitive(concrete)) return undefined;
    return { result: concrete };
  }

  functionExit(_id: number, returnValue: any, exception: { exception: any } | undefined,
               _isAsync: boolean, _isGenerator: boolean): void {
    const frame = this.fieldFrames.pop();
    if (frame === undefined || exception !== undefined || !frame.argsTainted || frame.nodes.length === 0) {
      return;
    }
    if (anyTainted(this.getInfo(returnValue))) return;
    const fieldNode = frame.nodes[frame.nodes.length - 1];
    this.pendingFieldReturn = { name: frame.name, node: fieldNode, value: this.valued(returnValue).value };
  }

  private stringConcatInfo(f: any, base: any, args: any, result: unknown): NmInfo | undefined {
    const concreteBase = this.valued(base).value;
    if (
      concreteBase === null ||
      typeof concreteBase === "undefined" ||
      (f !== String.prototype.concat && !(typeof f === "function" && f.name === "concat" && typeof concreteBase === "string"))
    ) {
      return undefined;
    }

    const pieces = [this.valued(base), ...Array.from(args ?? [], (arg) => this.valued(arg))];
    if (!pieces.some((piece) => anyTainted(piece.info))) return undefined;

    let current: Valued<NmInfo | undefined, string> = {
      value: String(pieces[0].value),
      info: pieces[0].info,
    };
    for (const piece of pieces.slice(1)) {
      const next: Valued<NmInfo | undefined, string> = {
        value: String(piece.value),
        info: piece.info,
      };
      const info = this.concatenateInfo(current, current.value.length, next, next.value.length);
      current = { value: current.value + next.value, info };
    }

    return current.value === result ? current.info : undefined;
  }

  private arrayJoinInfo(f: any, base: any, result: unknown): NmInfo | undefined {
    const concreteBase = this.valued(base).value;
    if (
      !Array.isArray(concreteBase) ||
      (f !== Array.prototype.join && !(typeof f === "function" && f.name === "join"))
    ) {
      return undefined;
    }

    const baseValue = this.valued(base) as Valued<NmInfo | undefined>;
    const pieces = concreteBase.map((element) => this.valued(element) as Valued<NmInfo | undefined>);
    if (!anyTainted(baseValue.info) && !pieces.some((piece) => anyTainted(piece.info))) return undefined;

    const parents = anyTainted(baseValue.info)
      ? [this.operandNode(baseValue)]
      : pieces.map((piece) => this.operandNode(piece));
    const value = String(result);
    return {
      bit: true,
      chars: Array.from({ length: value.length }, () => true),
      node: newNode("model:array.join", parents, value, this.currentSite()),
    };
  }

  private stringReplaceInfo(f: any, base: any, args: any, result: unknown): NmInfo | undefined {
    const concreteBase = this.valued(base).value;
    if (
      concreteBase === null ||
      typeof concreteBase === "undefined" ||
      (f !== String.prototype.replace && !(typeof f === "function" && f.name === "replace" && typeof concreteBase === "string")) ||
      typeof result !== "string"
    ) {
      return undefined;
    }

    const argArr = Array.from(args ?? []);
    const source = this.valued(base) as Valued<NmInfo | undefined>;
    const searchValue = this.valued(argArr[0]) as Valued<NmInfo | undefined>;
    const replaceValue = this.valued(argArr[1]) as Valued<NmInfo | undefined>;
    const pieces = [source, searchValue, replaceValue];
    if (!pieces.some((piece) => anyTainted(piece.info))) return undefined;

    const chars = Array.from(
      { length: result.length },
      () => pieces.some((piece) => anyTainted(piece.info)),
    );
    return {
      bit: chars.some((c) => c),
      chars,
      node: newNode("precise:string.replace", pieces.map((piece) => this.operandNode(piece)), result, this.currentSite()),
    };
  }

  private normalizeSliceIndex(value: unknown, length: number, fallback: number): number {
    if (value === undefined) return fallback;
    const integer = Math.trunc(Number(value));
    if (!Number.isFinite(integer)) return 0;
    if (integer < 0) return Math.max(length + integer, 0);
    return Math.min(integer, length);
  }

  private argumentsSliceCallResult(f: any, base: any, args: any, result: unknown): unknown | undefined {
    const concreteF = this.valued(f).value;
    const concreteBase = this.valued(base).value;
    if (concreteF !== Function.prototype.call || concreteBase !== Array.prototype.slice || !Array.isArray(result)) {
      return undefined;
    }

    const argArr = Array.from(args ?? []);
    const source = this.valued(argArr[0]).value;
    if (Object.prototype.toString.call(source) !== "[object Arguments]") return undefined;

    const frame = this.fieldFrames.at(-1);
    if (frame === undefined) return undefined;

    const length = frame.args.length;
    const start = this.normalizeSliceIndex(this.valued(argArr[1]).value, length, 0);
    const end = this.normalizeSliceIndex(this.valued(argArr[2]).value, length, length);
    const copied = result as unknown[];
    let propagated = false;
    for (let sourceIndex = start, resultIndex = 0; sourceIndex < end && resultIndex < copied.length; sourceIndex++, resultIndex++) {
      const sourceArg = frame.args[sourceIndex];
      if (sourceArg === undefined || !anyTainted(sourceArg.info)) continue;
      copied[resultIndex] = this.lift(copied[resultIndex], sourceArg.info);
      propagated = true;
    }
    return propagated ? copied : undefined;
  }

  private objectEntriesResult(f: unknown, args: unknown, result: unknown): unknown[] | undefined {
    if (f !== Object.entries || !Array.isArray(result)) return undefined;
    const argArr = Array.from(args ?? []);
    if (argArr.length < 1) return undefined;

    const source = this.valued(argArr[0]) as Valued<NmInfo | undefined>;
    const sourceObject = source.value;
    if (sourceObject === null || (typeof sourceObject !== "object" && typeof sourceObject !== "function")) {
      return undefined;
    }

    let propagated = false;
    for (const entry of result) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const key = this.valued(entry[0]).value;
      if (typeof key !== "string") continue;
      if (!Object.prototype.hasOwnProperty.call(sourceObject, key)) continue;

      const sourceValue = (sourceObject as Record<string, unknown>)[key];
      const sourceValueInfo = (this.valued(sourceValue) as Valued<NmInfo | undefined>).info;
      const parentInfo = anyTainted(sourceValueInfo) ? sourceValueInfo : source.info;
      if (!anyTainted(parentInfo)) continue;

      const entryValue = this.valued(entry[1]).value;
      const propNode = newNode("Untainted", [], key, this.currentSite());
      const info: NmInfo = {
        bit: true,
        node: newNode(
          "object.GetField",
          [this.operandNode(source), propNode, parentInfo!.node],
          entryValue,
          this.currentSite(),
        ),
      };
      if (typeof entryValue === "string") {
        info.chars = Array.from({ length: entryValue.length }, () => true);
      }
      entry[1] = this.lift(entry[1], info);
      propagated = true;
    }

    return propagated ? result : undefined;
  }

  private objectKeysStringResult(f: unknown, args: unknown, result: unknown): unknown[] | undefined {
    if (f !== Object.keys || !Array.isArray(result)) return undefined;
    const argArr = Array.from(args ?? []);
    if (argArr.length < 1) return undefined;

    const source = this.valued(argArr[0]);
    let sourceString: string | undefined;
    if (typeof source.value === "string") {
      sourceString = source.value;
    } else if (source.value instanceof String) {
      try {
        const primitive = String.prototype.valueOf.call(source.value);
        if (typeof primitive === "string") sourceString = primitive;
      } catch {
        // Keep the modeled result unchanged if the source cannot be inspected safely.
      }
    }
    if (sourceString === undefined) return undefined;

    const keys = result.map((key) => {
      const valuedKey = this.valued(key) as Valued<NmInfo | undefined>;
      if (typeof valuedKey.value !== "string" || !/^\d+$/.test(valuedKey.value)) {
        return key;
      }
      return valuedKey.value;
    });
    return keys;
  }

  private registerReturnedSinkAlias(args: any, result: unknown): void {
    if (typeof result !== "function") return;
    for (const arg of Array.from(args ?? [])) {
      const name = sinkName(this.valued(arg).value);
      if (name !== undefined) {
        registerDynamicSink(result, name);
        return;
      }
    }
  }

  private abortWithFlow(err: FlowError): void {
    if (!abortOnFlow) return;
    setTimeout(() => {
      process.emit("uncaughtException", err);
      const backupExit = (process as unknown as { backup_exit?: unknown }).backup_exit;
      if (typeof backupExit === "function") {
        backupExit(0);
      } else {
        process.exit(0);
      }
    }, 0);
  }

  private findTaintedSinkValue(
    value: unknown,
    seen = new Set<object>(),
    options: { allowArrayContainer?: boolean } = {},
  ): Valued<NmInfo | undefined> | undefined {
    const valued = this.valued(value) as Valued<NmInfo | undefined>;
    const concrete = valued.value;
    if (concrete === null || (typeof concrete !== "object" && typeof concrete !== "function")) {
      return anyTainted(valued.info) ? valued : undefined;
    }

    if (seen.has(concrete)) return anyTainted(valued.info) ? valued : undefined;
    seen.add(concrete);

    const properties = Array.isArray(concrete)
      ? Array.from({ length: concrete.length }, (_, i) => i)
      : this.ownDataPropertyNames(concrete);

    for (const prop of properties) {
      const childValue = concrete[prop as keyof typeof concrete];
      const child = this.findTaintedSinkValue(childValue, seen, options);
      if (child === undefined || !anyTainted(child.info)) continue;
      const propNode = newNode("Untainted", [], prop, this.currentSite());
      const node = newNode(
        "object.GetField",
        [this.operandNode(valued), propNode, child.info!.node],
        child.value,
        this.currentSite(),
      );
      return { value: child.value, info: { bit: true, node } };
    }

    if (options.allowArrayContainer === false) return undefined;
    return anyTainted(valued.info) ? valued : undefined;
  }

  private ownDataPropertyNames(value: object): string[] {
    try {
      return Object.getOwnPropertyNames(value).filter((prop) => {
        if (prop === "caller" || prop === "callee" || prop === "arguments") return false;
        const descriptor = Object.getOwnPropertyDescriptor(value, prop);
        return descriptor !== undefined && "value" in descriptor;
      });
    } catch {
      return [];
    }
  }

  private canReachNativeSink(name: string, args: unknown[]): boolean {
    if (name !== "spawn") return true;
    if (args.length === 0) return false;
    if (typeof this.valued(args[0]).value !== "string") return false;
    if (args.length < 2) return true;
    const spawnArgs = this.valued(args[1]).value;
    return spawnArgs === undefined || Array.isArray(spawnArgs) || (spawnArgs !== null && typeof spawnArgs === "object");
  }

  write(_id: number, names: string[], value: any) {
    const source = this.valued(value);
    if (names.length === 1) {
      const name = names[0];
      const concrete = source.value;
      if (name !== "undefined" && isPrimitive(concrete)) {
        if (anyTainted(source.info)) {
          this.primitiveVariableInfos.set(name, { value: concrete, info: source.info! });
        } else {
          const lastRead = this.lastPrimitiveRead;
          const primitiveInfo = lastRead !== undefined && Object.is(lastRead.value, concrete)
            ? lastRead.info ?? this.primitiveVariableInfos.get(lastRead.name)?.info
            : undefined;
          if (primitiveInfo !== undefined) {
            this.primitiveVariableInfos.set(name, { value: concrete, info: primitiveInfo });
          } else {
            this.primitiveVariableInfos.delete(name);
          }
        }
      }
    }
    if (names.length <= 1 || source.value === null || typeof source.value !== "object" || !anyTainted(source.info)) {
      return undefined;
    }

    const destructured = new Set(names);
    const target = source.value as Record<PropertyKey, unknown>;
    const proxy = new Proxy(target, {
      get: (obj, prop, receiver) => {
        const propValue = Reflect.get(obj, prop, receiver);
        if (typeof prop !== "string" || !destructured.has(prop)) {
          return propValue;
        }
        this.traceProp.add_field(prop);
        const propNode = newNode("Untainted", [], prop, this.currentSite());
        const node = newNode("object.GetField", [this.operandNode(source), propNode], propValue, this.currentSite());
        return this.lift(propValue, { bit: true, node });
      },
    });
    return { result: proxy };
  }

  invokeFun(id: number, f: any, base: any, args: any, result: any, isConstructor: boolean, isMethod: boolean, frame: unknown) {
    const post = super.invokeFun(id, f, base, args, result, isConstructor, isMethod, frame);
    const concreteResult = post !== undefined ? this.valued((post as any).result).value : result;
    const concreteF = this.valued(f).value;
    const pendingBind = this.pendingBindCalls.get(id);
    this.pendingBindCalls.delete(id);
    if (pendingBind !== undefined && typeof concreteResult === "function") {
      this.boundFunctions.set(concreteResult, pendingBind);
      const bindings = this.boundTargets.get(pendingBind.target) ?? [];
      bindings.push({ args: pendingBind.args });
      this.boundTargets.set(pendingBind.target, bindings.slice(-32));
      const name = sinkName(pendingBind.target);
      if (name !== undefined) {
        registerDynamicSink(concreteResult, name);
      }
    }
    if (concreteF === promisify) {
      const [target] = Array.from(args ?? []);
      const name = sinkName(this.valued(target).value);
      if (name !== undefined && typeof concreteResult === "function") {
        registerDynamicSink(concreteResult, name);
      }
    }
    if (sinkName(concreteF) === "Function" && typeof concreteResult === "function") {
      registerDynamicSink(concreteResult, "Function");
    }
    this.registerReturnedSinkAlias(args, concreteResult);
    const objectKeysStringResult = this.objectKeysStringResult(concreteF, args, concreteResult);
    if (objectKeysStringResult !== undefined) {
      return { result: objectKeysStringResult };
    }
    const objectEntriesResult = this.objectEntriesResult(concreteF, args, concreteResult);
    if (objectEntriesResult !== undefined) {
      return { result: objectEntriesResult };
    }
    const argumentsSliceResult = this.argumentsSliceCallResult(concreteF, base, args, concreteResult);
    if (argumentsSliceResult !== undefined) {
      return { result: argumentsSliceResult };
    }
    const arrayConcatResult = this.arrayConcatResult(concreteF, base, args, concreteResult);
    if (arrayConcatResult !== undefined) {
      return { result: arrayConcatResult };
    }
    const replaceInfo = this.stringReplaceInfo(concreteF, base, args, concreteResult);
    if (replaceInfo !== undefined) {
      return { result: this.lift(concreteResult, replaceInfo) };
    }
    const joinInfo = this.arrayJoinInfo(concreteF, base, concreteResult);
    if (joinInfo !== undefined) {
      return { result: this.lift(concreteResult, joinInfo) };
    }
    const concatInfo = this.stringConcatInfo(concreteF, base, args, concreteResult);
    if (concatInfo !== undefined) {
      return { result: this.lift(concreteResult, concatInfo) };
    }
    const info = post !== undefined ? this.getInfo((post as any).result) : undefined;
    if (!anyTainted(info) && this.pendingFieldReturn !== undefined && this.pendingFieldReturn.value === concreteResult) {
      const pending = this.pendingFieldReturn;
      this.pendingFieldReturn = undefined;
      const node = newNode(`call:${pending.name}`, [pending.node], concreteResult, this.currentSite());
      return { result: this.lift(concreteResult, { bit: true, node }) };
    }
    if (info !== undefined && info.node.label === "flow") {
      const name = (typeof concreteF === "function" && concreteF.name) ? concreteF.name : "Anonymous Function";
      info.node.label = `call:${name}`;
    }
    return post;
  }

  // --- sink detection ---

  invokeFunPre(id: number, f: any, base: any, args: any, isConstructor: boolean, isMethod: boolean) {
    // Ghost interception BY NAME: generated fuzzer drivers define local dummy
    // ghost stubs (e.g. `function __fuzzer_get_trace_properties__(e){return e}`)
    // expecting the analysis to hijack them by name. We install real globals and
    // dispatch by identity, so the driver's local stub would run unintercepted
    // (e.g. returning its raw arg `[]`, which then crashes the fuzzer's feed_cov).
    // Redirect any same-named callee to our real global implementation, which is
    // transparent (in GHOSTS) and runs with the correct semantics.
    if (typeof f === "function" && f.name && GHOST_NAMES.has(f.name)) {
      const real = (globalThis as Record<string, unknown>)[f.name];
      if (typeof real === "function" && real !== f) {
        f = real;
      }
    }
    const concreteF = this.valued(f).value;
    const concreteBase = this.valued(base).value;
    if (
      (concreteF === Function.prototype.bind || (typeof concreteF === "function" && concreteF.name === "bind")) &&
      typeof concreteBase === "function"
    ) {
      this.pendingBindCalls.set(id, { target: concreteBase, args: Array.from(args ?? []).slice(1) });
    }
    let sinkTarget = concreteF;
    let sinkArgs = Array.from(args ?? []);
    let pendingTarget = concreteF;
    let pendingArgs = sinkArgs;
    let pendingForwarded = false;
    const opaqueForwarding = this.shouldTreatOpaqueCallAsForwarding(concreteF, sinkArgs);
    const bound = typeof concreteF === "function" ? this.boundFunctions.get(concreteF) : undefined;
    if (bound !== undefined) {
      sinkTarget = bound.target;
      sinkArgs = [...bound.args, ...sinkArgs];
      pendingTarget = concreteF;
      pendingArgs = sinkArgs;
      pendingForwarded = true;
    }
    if (concreteF === Function.prototype.apply || concreteF === Function.prototype.call) {
      sinkTarget = this.valued(base).value;
      if (concreteF === Function.prototype.apply && sinkArgs.length > 1) {
        const applyArg = this.valued(sinkArgs[1]) as Valued<NmInfo | undefined>;
        const applyArgs = applyArg.value;
        if (isArgumentsObject(applyArgs)) {
          const frameArgs = this.fieldFrames.at(-1)?.args;
          sinkArgs = frameArgs !== undefined
            ? frameArgs.map((arg) => this.materializeArrayElementInfo(arg))
            : arrayLikeEntries(sinkArgs[1], applyArgs as ArrayLike<unknown>);
        } else if (Array.isArray(applyArgs)) {
          const materialized = this.materializeArrayElementInfo(applyArg);
          sinkArgs = arrayLikeEntries(materialized, applyArgs as ArrayLike<unknown>);
        }
      } else if (concreteF === Function.prototype.call) {
        sinkArgs = sinkArgs.slice(1);
      }
      pendingTarget = sinkTarget;
      pendingArgs = sinkArgs;
      pendingForwarded = true;
    }
    const name = sinkName(sinkTarget);
    if (name !== undefined) {
      const argArr = sinkArgs;
      if (!this.canReachNativeSink(name, argArr)) {
        return super.invokeFunPre(id, f, base, args, isConstructor, isMethod);
      }
      // For the Function sink the dangerous argument is the last (the function body);
      // for exec/eval/spawn any tainted argument counts. (Mirrors src/Taint.ts.)
      const requiredFunctionIdx = argArr.length > 0 ? argArr.length - 1 : 0;
      const indices = name === "Function" && argArr.length > 0
        ? [requiredFunctionIdx, ...argArr.map((_, i) => i).filter((i) => i !== requiredFunctionIdx)]
        : argArr.map((_, i) => i);
      for (const i of indices) {
        const argValue = this.valued(argArr[i]).value;
        const taintedValue = this.findTaintedSinkValue(argArr[i], new Set(), {
          allowArrayContainer: !(name === "spawn" && i > 0 && Array.isArray(argValue)),
        });
        const info = taintedValue?.info;
        if (anyTainted(info)) {
          this.flowFound = true;
          this.flowSink = name;
          // Wrap the tainted argument's provenance in an explicit sink node
          // labeled `call:<sink>`, mirroring the legacy engine. The synthesizer
          // (NodeExploitSynthesis inference.py:729) only recognizes a sink when
          // the ROOT node's operation (after stripping the call:/precise: sign)
          // is in its sink set (exec/eval/Function/...). Without this wrapper the
          // root is the bare `precise:string.concat`, the sink is unrecognized,
          // and smt_generator builds a malformed (non-Boolean) Z3 formula.
          const node = newNode(`call:${name}`, [info!.node], taintedValue!.value, this.currentSite(), name);
          this.flowNode = node;
          // first-wins: only set if not yet computed (mirrors legacy provenance_complexity == 0 guard)
          if (this.traceProp.provenance_complexity === 0) this.traceProp.provenance_complexity = get_number_of_nodes(node);
          this.traceProp.attacker_controlled_data = get_tainted_vals(node, name);
          // prefix_ace: only for the Function sink, first-wins (mirrors _SINKS[0][0] guard)
          if (name === "Function" && this.traceProp.prefix_ace === "") this.traceProp.prefix_ace = get_untainted_vals(node);
          // triggersFlow: 1 if the arg we matched is the required one (or sink
          // accepts any arg); 0.3 if Function's required last-arg was NOT tainted
          // but some other arg was.
          if (name === "Function") {
            const requiredIdx = argArr.length > 0 ? argArr.length - 1 : 0;
            this.traceProp.triggers_flow = (i === requiredIdx) ? 1 : 0.3;
          } else {
            this.traceProp.triggers_flow = 1;
          }
          this.traceProp.called_sink = name;
          recordFlowTelemetry(node);

          // --- optional JSON file emission (gated by taint_paths_json=true) ---
          if (taintPathsJson) {
            const json = buildTaintPathJSON(node);
            const fname = `taint_${this._taintFileCounter++}.json`;
            fs.writeFileSync(fname, stringifyTaintPathJSON(json));
          }

          // --- throw FlowError so fuzzer driver can catch it ---
          const err = new FlowError(`Tainted argument reached sink ${name}`, this.traceProp.clone());
          this.abortWithFlow(err);
          throw err;
        }
      }
    }
    if (typeof pendingTarget === "function") {
      this.pendingCallArgs.push({
        f: pendingTarget,
        args: pendingArgs,
        infos: pendingArgs.map((arg) => (this.valued(arg) as Valued<NmInfo | undefined>).info),
        forwarded: pendingForwarded || pendingTarget !== concreteF || opaqueForwarding,
      });
    }
    return super.invokeFunPre(id, f, base, args, isConstructor, isMethod);
  }

  declare(_id: number, name: string, kind: string, _init: boolean, value: any, _isSpread: boolean): void {
    if (kind !== "param" || anyTainted(this.getInfo(value))) return;
    const frame = this.fieldFrames.at(-1);
    if (frame !== undefined) {
      const paramInfo = frame.paramInfos[frame.nextParamIndex++];
      if (anyTainted(paramInfo)) {
        const concrete = this.valued(value).value;
        const info: NmInfo = { ...paramInfo!, node: paramInfo!.node };
        if (typeof concrete === "string" && info.chars === undefined) {
          info.chars = Array.from({ length: concrete.length }, () => true);
        }
        frame.paramFields.set(name, { value: concrete, info });
        return;
      }
    }
    if (frame === undefined || !frame.argsTainted) return;
    frame.paramNames.add(name);
    const concrete = this.valued(value).value;
    let sawTaintedObjectArg = false;
    let matchedDirectArg = false;
    for (const arg of frame.args) {
      if (!anyTainted(arg.info) || arg.value === null) continue;
      if (Object.is(arg.value, concrete)) {
        matchedDirectArg = true;
      }
      if (typeof arg.value !== "object" && typeof arg.value !== "function") continue;
      sawTaintedObjectArg = true;
      const source = arg.value as Record<PropertyKey, unknown>;
      if (!Object.prototype.hasOwnProperty.call(source, name)) continue;
      const propValue = source[name];
      if (!Object.is(this.valued(propValue).value, concrete)) continue;
      this.traceProp.add_field(name);
      const propNode = newNode("Untainted", [], name, this.currentSite());
      const node = newNode("object.GetField", [this.operandNode(arg), propNode], concrete, this.currentSite());
      const info: NmInfo = { bit: true, node };
      if (typeof concrete === "string") {
        info.chars = Array.from({ length: concrete.length }, () => true);
      }
      frame.paramFields.set(name, { value: concrete, info });
      return;
    }
    if (frame.allowParamNameFeedback && sawTaintedObjectArg && !matchedDirectArg) {
      this.traceProp.add_field(name);
    }
  }

  read(_id: number, name: string, value: any): { result: any } | void {
    const valued = this.valued(value);
    const concreteValue = valued.value;
    const primitiveInfo = this.primitiveVariableInfos.get(name);
    if (primitiveInfo !== undefined && Object.is(primitiveInfo.value, concreteValue)) {
      if (name !== "undefined" && isPrimitive(concreteValue)) {
        this.lastPrimitiveRead = { name, value: concreteValue, info: primitiveInfo.info };
      }
      return { result: this.lift(concreteValue, primitiveInfo.info) };
    }
    for (let i = this.fieldFrames.length - 1; i >= 0; i--) {
      const field = this.fieldFrames[i].paramFields.get(name);
      if (field !== undefined && Object.is(field.value, concreteValue)) {
        return { result: this.lift(value, field.info) };
      }
    }
    const rememberPrimitiveRead = () => {
      if (name !== "undefined" && isPrimitive(concreteValue)) {
        this.lastPrimitiveRead = {
          name,
          value: concreteValue,
          info: anyTainted(valued.info) ? valued.info : undefined,
        };
      }
    };
    const frame = this.fieldFrames.at(-1);
    if (frame === undefined || !frame.paramNames.has(name)) {
      rememberPrimitiveRead();
      return undefined;
    }
    for (const arg of frame.args) {
      if (!anyTainted(arg.info) || arg.value === null) continue;
      if (typeof arg.value !== "object" && typeof arg.value !== "function") continue;
      const source = arg.value as Record<PropertyKey, unknown>;
      if (!Object.prototype.hasOwnProperty.call(source, name)) continue;
      const propValue = source[name];
      if (!Object.is(this.valued(propValue).value, concreteValue)) continue;
      this.traceProp.add_field(name);
      const propNode = newNode("Untainted", [], name, this.currentSite());
      const info: NmInfo = {
        bit: true,
        node: newNode("object.GetField", [this.operandNode(arg), propNode], concreteValue, this.currentSite()),
      };
      if (typeof concreteValue === "string") {
        info.chars = Array.from({ length: concreteValue.length }, () => true);
      }
      frame.paramFields.set(name, { value: concreteValue, info });
      return { result: this.lift(value, info) };
    }
    rememberPrimitiveRead();
    return undefined;
  }

  binary(id: number, op: string, left: any, right: any, result: any, frame?: unknown) {
    const ret = super.binary(id, op, left, right, result, frame);
    const f = frame as { op?: string; left?: unknown; right?: unknown } | undefined;
    if (ret === undefined || f?.op !== "+" || f.left === undefined || f.right === undefined) {
      return ret;
    }
    const concrete = this.valued(ret.result).value;
    const info = this.coercedObjectConcatInfo(f.left, f.right, concrete);
    if (info === undefined) return ret;
    return { result: this.lift(concrete, info) };
  }

  instrumentCodePre(_id: number, code: any, _isDirect: boolean) {
    const valuedCode = this.valued(code);
    const info = valuedCode.info as NmInfo | undefined;
    if (anyTainted(info)) {
      this.flowFound = true;
      this.flowSink = "eval";
      const node = newNode("call:eval", [info!.node], valuedCode.value, this.currentSite(), "eval");
      this.flowNode = node;
      if (this.traceProp.provenance_complexity === 0) this.traceProp.provenance_complexity = get_number_of_nodes(node);
      this.traceProp.attacker_controlled_data = get_tainted_vals(node, "eval");
      this.traceProp.triggers_flow = 1;
      this.traceProp.called_sink = "eval";
      recordFlowTelemetry(node);

      if (taintPathsJson) {
        const json = buildTaintPathJSON(node);
        const fname = `taint_${this._taintFileCounter++}.json`;
        fs.writeFileSync(fname, stringifyTaintPathJSON(json));
      }

      const err = new FlowError("Tainted argument reached sink eval", this.traceProp.clone());
      this.abortWithFlow(err);
      throw err;
    }
    return { code: valuedCode.value, skip: false };
  }

  // An array's `length` slot must hold a raw uint32. FlowAnalysis wraps stored
  // values to carry element taint, but `length` is array metadata, not an
  // element: assigning a wrapped value runs ToUint32(proxy) -> NaN and throws
  // "RangeError: Invalid array length". Unwrap it (length carries no taint).
  // Repro: q@1.x resetUnhandledRejections() `unhandledRejections.length = 0`
  // where the literal 0 arrives wrapped (python-virtualenv module load).
  // Belongs upstream in FlowAnalysis.putFieldPre; kept here so it survives DynaJS pulls.
  putFieldPre(id: number, base: any, prop: any, value: any, _isPrivate?: boolean) {
    const pre = super.putFieldPre(id, base, prop, value);
    if (pre && Array.isArray(pre.base) && pre.prop === "length") {
      pre.value = this.valued(pre.value).value;
    }
    return pre;
  }

  // --- taint queries (prelude entry points) ---

  isTainted(value: unknown): boolean { return anyTainted(this.getInfo(value)); }

  isTaintedAt(value: unknown, indexW: unknown): boolean {
    const raw = this.valued(indexW).value;
    const index = typeof raw === "number" ? raw : Number(raw);
    const info = this.getInfo(value);
    if (info === undefined) return false;
    if (info.chars !== undefined && index >= 0 && index < info.chars.length) {
      return info.chars[index] === true;
    }
    return info.bit;
  }

  assert(condW: unknown): void {
    if (this.valued(condW).value) return;
    throw new Error("Assertion failed");
  }

  // --- source marking ---

  setTaint(value: unknown, tainted: boolean): void {
    const concrete = this.valued(value).value;
    const site = this.currentSite();
    // A "Tainted" provenance node MUST have a parent: the synthesizer
    // (NodeExploitSynthesis inference.py:generate_operation_tree) reads
    // parents[0].id as the location where taint was applied and emits it as the
    // SymbolicInput. A childless Tainted node crashes synthesis with
    // `IndexError: list index out of range`. Mirror the legacy chain
    // (Tainted -> call:set_taint -> Untainted) with a minimal Untainted origin.
    const origin = newNode("Untainted", [], concrete, site);
    const node = tainted
      ? newNode("Tainted", [newNode("call:__jalangi_set_taint__", [origin], concrete, site)], concrete, site)
      : origin;
    const info = this.getOrCreateInfo(value, () => ({ bit: tainted, node }));
    if (info === undefined) {
      const lastRead = this.lastPrimitiveRead;
      if (lastRead !== undefined && isPrimitive(concrete) && Object.is(lastRead.value, concrete)) {
        if (tainted) {
          const primitiveInfo: NmInfo = { bit: true, node };
          if (typeof concrete === "string") {
            primitiveInfo.chars = Array.from({ length: concrete.length }, () => true);
          }
          this.primitiveVariableInfos.set(lastRead.name, { value: concrete, info: primitiveInfo });
        } else {
          this.primitiveVariableInfos.delete(lastRead.name);
        }
      }
      return;
    }
    info.bit = tainted;
    info.node = node;
    if (typeof concrete === "string") {
      info.chars = Array.from({ length: concrete.length }, () => tainted);
    }
  }

  taintLocLine(value: unknown): number {
    const site = this.getInfo(value)?.node.site;
    return site?.kind === "code" ? site.start.line : -1;
  }

  taintLabel(value: unknown): string {
    return this.getInfo(value)?.node.label ?? "";
  }

  flowSinkType(): string {
    return this.flowNode?.sinkType ?? "";
  }

  /** Returns the buildTaintPathJSON result for a value's provenance node (or {} if none). */
  taintJson(value: unknown): Record<string, unknown> {
    const info = this.getInfo(value) as NmInfo | undefined;
    if (!info?.node) return {};
    return buildTaintPathJSON(info.node) as unknown as Record<string, unknown>;
  }

  // --- __jalangi_clear_taint__ ---
  clearTaint(v: unknown): void {
    this.setTaint(v, false);
  }

  // --- __jalangi_get_taint__ (returns boolean taint bit) ---
  getTaint(v: unknown): boolean {
    return this.isTainted(v);
  }

  // --- __fuzzer__reset_state__ (per-iteration hygiene) ---
  resetState(): void {
    this.traceProp.reset_state();
    this.flowFound = false;
    this.flowNode = undefined;
    this.flowSink = undefined;
  }

  // --- __fuzzer_get_trace_properties__ ---
  getTraceProp(): TraceProperty {
    return this.traceProp;
  }

  // --- __set_taint_flow_path__ ---
  setTaintFlowPath(p: unknown): void {
    this.taintPath = String(this.valued(p).value);
  }

  // --- __get_taint_flow_idx__ ---
  getTaintFlowIdx(): number {
    return this._taintFileCounter - 1;
  }

  // --- __jalangi_assert_taint_true__ ---
  assertTaintTrue(v: unknown): void {
    if (!this.isTainted(v)) throw new Error("Argument expected to be tainted");
  }

  // --- __jalangi_assert_taint_false__ ---
  assertTaintFalse(v: unknown): void {
    if (this.isTainted(v)) throw new Error("Argument expected to be untainted");
  }

  // --- __jalangi_assert_wrapped__ ---
  // no-op for now, the new analysis does not expose API for this
  assertWrapped(_v: unknown): void {
    // no-op: wrap state not accessible through public FlowAnalysis API
  }

  // --- __jalangi_assert_not_wrapped__ ---
  // no-op for now, the new analysis does not expose API for this
  assertNotWrapped(_v: unknown): void {
    // no-op: wrap state not accessible through public FlowAnalysis API
  }

  // --- __jalangi_set_prop_taint__ ---
  // Sets taint on obj[key]. DynaJS propagates object-property taint by tracking
  // each property's wrapped value independently. We get the current info for `obj`
  // and set a per-property taint entry using setInfo on the concrete property value.
  // Limitation: we can only mark the current concrete value of obj[key]; if the
  // property is later reassigned the taint won't follow. Mirrors TSetProp semantics
  // as closely as possible within the public FlowAnalysis API.
  setPropTaint(obj: unknown, key: unknown, tainted: boolean): void {
    const concreteObj = this.valued(obj).value as Record<string, unknown>;
    const concreteKey = String(this.valued(key).value);
    if (concreteObj === null || typeof concreteObj !== "object" && typeof concreteObj !== "function") return;
    const propValue = concreteObj[concreteKey];
    if (propValue === undefined || propValue === null) return;
    this.setTaint(propValue, tainted);
  }

  // --- __jalangi_clear_prop_taint__ ---
  clearPropTaint(obj: unknown, key: unknown): void {
    this.setPropTaint(obj, key, false);
  }

  // --- __string_range_set_taint__ ---
  stringRangeSetTaint(str: unknown, lbW: unknown, ubW: unknown): void {
    const lb = Number(this.valued(lbW).value);
    const ub = Number(this.valued(ubW).value);
    const info = this.getOrCreateInfo(str, () => {
      const concrete = this.valued(str).value;
      const node = newNode("Untainted", [], concrete, this.currentSite());
      return { bit: false, chars: [], node } as NmInfo;
    }) as NmInfo | undefined;
    if (info === undefined) return;
    if (info.chars === undefined) {
      const concrete = this.valued(str).value;
      const len = typeof concrete === "string" ? concrete.length : 0;
      info.chars = Array.from({ length: len }, () => false);
    }
    for (let i = lb; i < ub; i++) {
      if (i >= 0 && i < info.chars.length) info.chars[i] = true;
    }
    info.bit = info.chars.some((c) => c);
  }

  // --- __string_range_clear_taint__ ---
  stringRangeClearTaint(str: unknown, lbW: unknown, ubW: unknown): void {
    const lb = Number(this.valued(lbW).value);
    const ub = Number(this.valued(ubW).value);
    const info = this.getInfo(str) as NmInfo | undefined;
    if (info === undefined || info.chars === undefined) return;
    for (let i = lb; i < ub; i++) {
      if (i >= 0 && i < info.chars.length) info.chars[i] = false;
    }
    info.bit = info.chars.some((c) => c);
  }

  // --- __assert_string_range_all_tainted__ ---
  assertStringRangeAllTainted(str: unknown, lbW: unknown, ubW: unknown): void {
    const lb = Number(this.valued(lbW).value);
    const ub = Number(this.valued(ubW).value);
    const untainted: number[] = [];
    for (let i = lb; i < ub; i++) {
      if (!this.isTaintedAt(str, i)) untainted.push(i);
    }
    if (untainted.length > 0) throw new Error(`Untainted indices: [${untainted}]`);
  }

  // --- __assert_string_range_all_untainted__ ---
  assertStringRangeAllUntainted(str: unknown, lbW: unknown, ubW: unknown): void {
    const lb = Number(this.valued(lbW).value);
    const ub = Number(this.valued(ubW).value);
    const tainted: number[] = [];
    for (let i = lb; i < ub; i++) {
      if (this.isTaintedAt(str, i)) tainted.push(i);
    }
    if (tainted.length > 0) throw new Error(`Tainted indices: [${tainted}]`);
  }

  // --- __assert_array_range_all_tainted__ ---
  assertArrayRangeAllTainted(arrW: unknown, lbW: unknown, ubW: unknown): void {
    const arr = this.valued(arrW).value as unknown[];
    const lb = Number(this.valued(lbW).value);
    const ub = Number(this.valued(ubW).value);
    const untainted: number[] = [];
    for (let i = lb; i < ub; i++) {
      if (!this.isTainted(arr[i])) untainted.push(i);
    }
    if (untainted.length > 0) throw new Error(`Untainted indices: [${untainted}]`);
  }

  // --- __assert_array_range_all_untainted__ ---
  assertArrayRangeAllUntainted(arrW: unknown, lbW: unknown, ubW: unknown): void {
    const arr = this.valued(arrW).value as unknown[];
    const lb = Number(this.valued(lbW).value);
    const ub = Number(this.valued(ubW).value);
    const tainted: number[] = [];
    for (let i = lb; i < ub; i++) {
      if (this.isTainted(arr[i])) tainted.push(i);
    }
    if (tainted.length > 0) throw new Error(`Tainted indices: [${tainted}]`);
  }

  // --- __jalangi_set_sink__ ---
  setSink(fW: unknown): void {
    const f = this.valued(fW).value;
    if (typeof f !== "function") throw new Error("Sink must be a function");
    registerDynamicSink(f);
  }

  // --- __jalangi_check_taint__ ---
  // If tainted: set flowFound, populate traceProp, throw FlowError.
  checkTaint(v: unknown): void {
    const info = this.getInfo(v) as NmInfo | undefined;
    if (!anyTainted(info)) return;
    this.flowFound = true;
    this.flowNode = info!.node;
    this.traceProp.called_sink = "__jalangi_check_taint__";
    throw new FlowError("check_taint reached tainted value", this.traceProp.clone());
  }

  // --- __jalangi_check_taint_string__ ---
  // Like checkTaint but also logs tainted char indices (mirrors GhostFunction.ts:163-180).
  checkTaintString(v: unknown): void {
    const concrete = this.valued(v).value;
    if (typeof concrete === "string") {
      const taintedIndices: number[] = [];
      for (let i = 0; i < concrete.length; i++) {
        if (this.isTaintedAt(v, i)) taintedIndices.push(i);
      }
      if (taintedIndices.length > 0) {
        console.log(`String has tainted indices: [${taintedIndices}]`);
      }
    }
    // Then do the standard check-taint flow
    this.checkTaint(v);
  }

  endExecution() {}
}

D$.analysis = new NodeMedicAnalysis();
