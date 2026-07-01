/**
 * This mirrors the logic currently used in rewrite.ts, but uses dynajs hooks directly.
 */

declare const D$: any;

const hash = require('immutable').hash;

const Base = require('./Base');
const Config = require('./Config');
const GhostFunction = require('./GhostFunction');
const { getValue } = require('./Taint');

const config = new Config.Config();
function getEnvArgs(): string[] {
    const rawArgs = process.env.NODEMEDIC_ANALYSIS_ARGS ?? '';
    if (rawArgs.trim() === '') {
        return [];
    }
    try {
        const parsed = JSON.parse(rawArgs);
        if (Array.isArray(parsed)) {
            return parsed;
        }
    } catch (_err) {
    }
    return rawArgs.split(' ').filter(Boolean);
}
const envArgs = getEnvArgs();
config.setFromArgs([...process.argv, ...envArgs]);
GhostFunction.globalizeGhostFunctions();

const instrumentation = new Base.Instrumentation(config);
const sidByPath = new Map<string, number>();
const functionSidMap = new WeakMap<Function, number>();
const declaredClassNames = new Set<string>();
const internalClassConstructors = new WeakSet<Function>();
const superMethodByIid = new Map<number, Function>();
// Iids of super() calls that go to native parent classes (e.g. Array, Error).
// Populated lazily on first call; used to unwrap args on subsequent calls.
const nativeSuperCallIids = new Set<number>();
const smap: Record<number, { originalCodeFileName: string, instrumentedCodeFileName: string }> = {};

// --- SID tracking ---
//
// Two SID concepts, each modeled on one aspect of Jalangi's sandbox.sid:
//
// 1. scriptSid — the SID of the currently executing *script*. Pushed on
//    scriptEnter, popped on scriptExit. Used for source locations, branch
//    tracking, and uniqueID hashing (which the taint state machine keys on).
//
// 2. ownerSid — the SID of the *defining module* of the currently executing
//    function. Mirrors Jalangi's updateSid(f)/rollBackSid(): pushed on both
//    scriptEnter AND functionEnter, popped on scriptExit AND functionExit.
//    Used solely for resolving originalScriptPath so that require() calls
//    inside a function resolve relative to the module that *defined* the
//    function, not the module that *called* it.
//
//    Jalangi reads f[SPECIAL_PROP_SID] in Fe() via arguments.callee. DynaJS
//    can't (strict mode), so it passes null for anonymous function expressions.
//    calleeSidStack (set by invokeFunPre, which does see the real function)
//    bridges the gap.
const scriptSidStack: number[] = [];
const ownerSidStack: number[] = [];
let ownerSid = 0;
// Paired stack between invokeFunPre and invokeFun.
const isExternalStack: boolean[] = [];
const superMethodExternalStack: boolean[] = [];
// invokeFunPre stashes the callee's defining SID so functionEnter can read it.
const calleeSidStack: (number | undefined)[] = [];
// invokeFunPre saves raw args so that declare can simulate getField for
// parameter destructuring (DynaJS preserves native destructuring, so no
// getField hooks fire — Babel desugars it for Jalangi).
const pendingInvokeArgsStack: any[][] = [];
// Set by functionEnter from the top of pendingInvokeArgsStack so declare
// can access the current function's arguments.
const currentFunctionArgsStack: (any[] | undefined)[] = [];
let nextSid = 1;
let executionBegun = false;

function isLikelyDestructuringDefaultValue(val: any): boolean {
    const raw = getValue(instrumentation.s, val);
    if (raw !== val) {
        return isLikelyDestructuringDefaultValue(raw);
    }
    return val === undefined
        || val === null
        || typeof val === 'string'
        || typeof val === 'number'
        || typeof val === 'boolean'
        || typeof val === 'bigint'
        || typeof val === 'symbol';
}

function isDeclareKind(kind: any, name: string, code: number): boolean {
    return kind === name || kind === code;
}

function getScriptSid(): number {
    if (scriptSidStack.length === 0) {
        return 1;
    }
    return scriptSidStack[scriptSidStack.length - 1];
}

function getOwnerSid(): number {
    return ownerSid || 1;
}

function pushOwnerSid(newSid: number) {
    ownerSidStack.push(ownerSid);
    ownerSid = newSid;
}

function popOwnerSid() {
    ownerSid = ownerSidStack.pop() ?? 0;
}

function getOrCreateSid(instrumentedPath: string, originalPath: string): number {
    const existing = sidByPath.get(originalPath);
    if (existing !== undefined) {
        return existing;
    }
    const sid = nextSid++;
    sidByPath.set(originalPath, sid);
    smap[sid] = {
        originalCodeFileName: originalPath,
        instrumentedCodeFileName: instrumentedPath,
    };
    return sid;
}

function createFallbackFunction() {
    return function __dynajs_unknown__() {
        return undefined;
    };
}

function rememberFunctionSid(value: any) {
    if (typeof value === 'function') {
        functionSidMap.set(value, getOwnerSid());
    }
}

function rememberDeclaredClassConstructor(name: string, value: any) {
    if (!declaredClassNames.has(name) || typeof value !== 'function') {
        return;
    }
    rememberFunctionSid(value);
    internalClassConstructors.add(value);
}

function isMethodOnInternalClass(base: any, value: any): boolean {
    if (typeof value !== 'function') {
        return false;
    }

    if (base === undefined || base === null) {
        return false;
    }

    if (typeof base === 'function') {
        return internalClassConstructors.has(base);
    }

    const ctor = base.constructor;
    return typeof ctor === 'function' && internalClassConstructors.has(ctor);
}

function getFunctionSid(value: any): number | undefined {
    if (typeof value !== 'function') {
        return undefined;
    }
    return functionSidMap.get(value);
}

function isDynaJsInstrumented(f: Function): boolean {
    try {
        const src = Function.prototype.toString.call(f);
        return src.includes('D$.Fe(');
    } catch {
        return false;
    }
}

function getCallInfo(iid: number, f: any) {
    const sid = getScriptSid();
    let functionSid = getFunctionSid(f);
    // DynaJS hoisted function declarations are only registered in functionSidMap
    // when functionEnter fires (inside the call). On the first call, invokeFunPre
    // runs before functionEnter, so the function isn't registered yet. Detect
    // instrumented functions by checking for DynaJS markers in the function body
    // and eagerly register them.
    if (functionSid === undefined && typeof f === 'function' && isDynaJsInstrumented(f)) {
        functionSidMap.set(f, sid);
        functionSid = sid;
    }
    const isExternal = functionSid === null || functionSid === undefined;
    // For external/native functions (like require), resolve relative to
    // ownerSid — the defining module of the currently executing function —
    // so that relative require() paths resolve correctly.
    const originalScriptPath = isExternal
        ? smap[getOwnerSid()]?.originalCodeFileName
        : smap[functionSid as number]?.originalCodeFileName;

    if (originalScriptPath === null || originalScriptPath === undefined) {
        throw Error(`Failed to set original script path. sid is ${sid}, functionSid is ${functionSid}`);
    }

    return {
        sid,
        functionSid,
        isExternal,
        originalScriptPath,
        uniqueID: hash(`${sid}${iid}`),
    };
}

function sourceLocation(iid: number): string {
    const sid = getScriptSid();
    const scriptName = smap[sid]?.originalCodeFileName || 'UNKNOWN';
    let raw = '';
    try {
        raw = String(D$.idToLoc(iid));
    } catch {
        return `(${scriptName}:-1:-1:-1:-1)`;
    }
    const m = /^(\d+):(\d+)-(\d+):(\d+)$/.exec(raw);
    if (!m) {
        return `(${scriptName}:-1:-1:-1:-1)`;
    }
    return `(${scriptName}:${m[1]}:${m[2]}:${m[3]}:${m[4]})`;
}

function getBranchInfo() {
    const sid = getScriptSid();
    let branchInfo = instrumentation.trace_prop.branches[sid - 1];
    if (!branchInfo) {
        branchInfo = {};
        instrumentation.trace_prop.branches[sid - 1] = branchInfo;
    }
    return branchInfo;
}

function getGlobalBranchInfo() {
    const sid = getScriptSid();
    let branchInfo = instrumentation.trace_prop.global_branches[sid - 1];
    if (!branchInfo) {
        branchInfo = {};
        instrumentation.trace_prop.global_branches[sid - 1] = branchInfo;
    }
    return branchInfo;
}

D$.analysis = {
    scriptEnter(iid: number, instrumentedFileName: string, originalFileName: string) {
        if (!executionBegun) {
            executionBegun = true;
            instrumentation.trace_prop.branches = [];
            instrumentation.trace_prop.global_branches = [];
            instrumentation.trace_prop.code_coverage = 0;
            instrumentation.trace_prop.global_code_coverage = 0;
        }

        const sid = getOrCreateSid(instrumentedFileName, originalFileName);
        scriptSidStack.push(sid);
        pushOwnerSid(sid);
        instrumentation.scriptEnter(originalFileName);
    },

    scriptExit(_iid: number, _wrappedExceptionVal?: { exception: any }) {
        if (scriptSidStack.length > 0) {
            scriptSidStack.pop();
        }
        popOwnerSid();
    },

    invokeFunPre(iid: number, f: any, base: any, args: any, isConstructor: boolean, isMethod: boolean) {
        const { isExternal, originalScriptPath, uniqueID, functionSid } = getCallInfo(iid, f);
        const normalizedBase = (!isMethod && (base === undefined || base === null)) ? globalThis : base;

        if (f === undefined) {
            throw Error(`Attempted to call an undefined function in ${originalScriptPath}; IID: ${iid}`);
        }

        // f is not callable: return a no-op and let the concrete runtime throw naturally.
        // Do NOT push to isExternalStack here — DynaJS will not call invokeFun when the
        // concrete call throws (no try/catch in DynaJS's invokeFun helper), so the stack
        // must stay balanced.
        if (typeof f !== 'function') {
            return { f, base: normalizedBase, args, skip: false };
        }

        // Push so that invokeFun uses the same isExternal value.
        // functionEnter (which registers hoisted function declarations) fires
        // between invokeFunPre and invokeFun, so recomputing isExternal in
        // invokeFun would give a different answer for the first call to any
        // hoisted function — causing WInvokeFun's IDS assertion to fail.
        isExternalStack.push(isExternal);
        calleeSidStack.push(functionSid as number | undefined);
        pendingInvokeArgsStack.push(Array.from(args));

        let ret;
        try {
            ret = instrumentation.invokeFunPre(
                f,
                normalizedBase,
                args,
                isMethod,
                isConstructor,
                isExternal,
                uniqueID,
                originalScriptPath,
                sourceLocation(iid)
            );
        } catch (err) {
            isExternalStack.pop();
            calleeSidStack.pop();
            pendingInvokeArgsStack.pop();
            throw err;
        }

        if (ret.reset_branches) {
            instrumentation.trace_prop.branches = [];
            instrumentation.trace_prop.code_coverage = 0;
        }

        return { f: ret.f, base: ret.base, args: ret.args, skip: ret.skip === true };
    },

    invokeFun(iid: number, f: any, base: any, args: any, result: any, isConstructor: boolean, isMethod: boolean) {
        // If f is not a function, invokeFunPre returned early without pushing to
        // isExternalStack.  DynaJS does not call invokeFun after a thrown concrete
        // call, so this guard is defensive — but it prevents F.isNativeFunction from
        // asserting if this path is ever reached unexpectedly.
        if (typeof f !== 'function') {
            return { result };
        }
        // Use the isExternal decision that was made in invokeFunPre, not a fresh
        // computation — functionEnter may have registered the function in between.
        const isExternal = isExternalStack.pop() ?? (getFunctionSid(f) === undefined || getFunctionSid(f) === null);
        calleeSidStack.pop();
        pendingInvokeArgsStack.pop();
        const uniqueID = hash(`${getScriptSid()}${iid}`);
        const normalizedBase = (!isMethod && (base === undefined || base === null)) ? globalThis : base;

        const ret = instrumentation.invokeFun(f, normalizedBase, args, result, isConstructor, isMethod, isExternal, uniqueID);
        return { result: ret.result };
    },

    instrumentCodePre(iid: number, code: string, isDirect: boolean) {
        // DynaJS always handles code instrumentation itself, so treat every
        // instrumentCodePre as internal.  With isInternal=true, WEvalPre
        // immediately balances its unwrap — preventing a stale ID on the IDS
        // stack when the eval/new-Function call throws before instrumentCode
        // (WEval) can consume it.
        const ret = instrumentation.instrumentCodePre(code, true);
        // DynaJS parses dynamic code in strict mode (ESM).  Code containing
        // `with` (e.g. underscore templates) will fail to parse.  Tell DynaJS
        // to skip instrumentation so the code reaches the real Function
        // constructor unmodified.
        if (typeof ret.code === 'string' && ret.code.includes('with(')) {
            return { code: ret.code, skip: true };
        }

        return { code: ret.code };
    },
    instrumentCode(iid: number, code: string, isDirect: boolean) {
        const ret = instrumentation.instrumentCode(code);
        return { result: ret.newCode };
    },

    literal(_iid: number, val: any) {
        const ret = instrumentation.literal(val);
        rememberFunctionSid(ret.value);
        return { result: ret.value };
    },

    forInOfObject(iid: number, val: any, _isForIn: boolean) {
        // DynaJS iterates wrapped strings as boxed objects, but the native
        // string iterator yields raw one-character strings. Rebuilding a code
        // string via `for...of` would therefore drop taint before a later
        // sink like eval. Materialize per-character values through getField so
        // the existing string policy can preserve character taint.
        const primitive = (val !== null && val !== undefined && typeof val.valueOf === 'function')
            ? val.valueOf()
            : undefined;
        if (typeof primitive === 'string') {
            const chars: any[] = [];
            for (let i = 0; i < primitive.length; i++) {
                const ret = instrumentation.getField(val, String(i), primitive[i], sourceLocation(iid));
                chars.push(ret.result);
            }
            return { result: chars };
        }
        return { result: val };
    },

    declare(_iid: number, _name: string, _kind: any, _init: boolean, val: any) {
        if (isDeclareKind(_kind, 'function', 3)) {
            rememberFunctionSid(val);
        } else if (isDeclareKind(_kind, 'class', 7)) {
            declaredClassNames.add(_name);
            rememberDeclaredClassConstructor(_name, val);
        } else if (isDeclareKind(_kind, 'param', 4)) {
            if (isLikelyDestructuringDefaultValue(val)) {
                instrumentation.trace_prop.add_field(_name);
            }
            // DynaJS preserves native parameter destructuring, so no getField
            // hooks fire for `({a, b} = obj) => ...`.  Babel desugars this for
            // Jalangi into explicit property accesses.  Simulate getField here
            // to propagate taint from the source argument to each parameter.
            const currentArgs = currentFunctionArgsStack.length > 0
                ? currentFunctionArgsStack[currentFunctionArgsStack.length - 1]
                : undefined;
            if (currentArgs) {
                for (const arg of currentArgs) {
                    if (arg == null || typeof arg !== 'object') continue;
                    // Direct name match (e.g. {compress} → arg.compress)
                    if (_name in arg) {
                        const pre = instrumentation.getFieldPre(arg, _name);
                        const gf = instrumentation.getField(pre.base, pre.offset, val, sourceLocation(_iid));
                        const wr = instrumentation.write(undefined, gf.result);
                        return { result: wr.val };
                    }
                    if (isLikelyDestructuringDefaultValue(val)) {
                        const pre = instrumentation.getFieldPre(arg, _name);
                        const gf = instrumentation.getField(pre.base, pre.offset, undefined, sourceLocation(_iid));
                        const wr = instrumentation.write(undefined, gf.result);
                        return { result: val === undefined ? wr.val : val };
                    }
                    // Value match for renamed destructuring (e.g. {in: pathIn})
                    if (val !== undefined && val !== false && val !== true && val !== 0 && val !== '') {
                        for (const prop of Object.keys(arg)) {
                            if (arg[prop] === val) {
                                const pre = instrumentation.getFieldPre(arg, prop);
                                const gf = instrumentation.getField(pre.base, pre.offset, val, sourceLocation(_iid));
                                const wr = instrumentation.write(undefined, gf.result);
                                return { result: wr.val };
                            }
                        }
                    }
                }
            }
        }
        return { result: val };
    },

    getFieldPre(_iid: number, base: any, prop: any) {
        const ret = instrumentation.getFieldPre(base, prop);
        return { base: ret.base, prop: ret.offset, skip: false };
    },

    getField(iid: number, base: any, prop: any, val: any) {
        const ret = instrumentation.getField(base, prop, val, sourceLocation(iid));
        // Symbol primitives wrapped in a SafeProxy can't be used as property keys in
        // native JS code (e.g. yield* protocol internals) — SafeProxy creates
        // new Proxy(Object(sym), ...) which fails Symbol.prototype[@@toPrimitive] checks.
        // Symbols don't carry meaningful taint, so unwrapping is safe.
        const rawResult = getValue(instrumentation.s, ret.result);
        if (typeof rawResult === 'symbol') {
            return { result: rawResult };
        }
        if (isMethodOnInternalClass(base, ret.result)) {
            rememberFunctionSid(ret.result);
        }
        return { result: ret.result };
    },

    putFieldPre(_iid: number, base: any, prop: any, val: any) {
        const ret = instrumentation.putFieldPre(base, prop, val);
        return { base: ret.base, prop: ret.offset, value: ret.value, skip: false };
    },

    putField(iid: number, base: any, prop: any, val: any) {
        const ret = instrumentation.putField(base, prop, val, sourceLocation(iid));
        return { result: ret.val };
    },

    read(_iid: number, _name: string, val: any) {
        // undefined and null have no unique identity as primitives — two unrelated
        // variables both holding undefined/null would share the same taint map key,
        // causing taint to bleed between them.  Jalangi avoids this by tagging them
        // with a literal wrapper; so we run them
        // through the literal hook, which gives each read site its own SafeProxy ID.
        if (val === undefined || val === null) {
            const ret = instrumentation.literal(val);
            return { result: ret.value };
        }

        if (_name === 'require' && typeof val === 'function') {
            functionSidMap.set(val, getOwnerSid());
        }
        rememberDeclaredClassConstructor(_name, val);
        return { result: val };
    },

    // Dynajs does not receive lhs as argument in write so we pass undefined to the instrumentation
    write(iid: number, names: string[], val: any) {
        if (Array.isArray(names) && names.length > 1) {
            // Destructuring pattern (e.g. `const {a, b} = obj` or `let [a, b] = arr`).
            // DynaJS does not generate getField hooks for destructured
            // property accesses, so we simulate them here to propagate
            // taint from the source object to each extracted property.
            const isArrayDestructuring = Array.isArray(val);
            const result: any = isArrayDestructuring ? [] : {};
            for (let i = 0; i < names.length; i++) {
                const key = isArrayDestructuring ? i : names[i];
                const pre = instrumentation.getFieldPre(val, key);
                const rawVal = (val != null && val !== undefined) ? val[key] : undefined;
                const gf = instrumentation.getField(pre.base, pre.offset, rawVal, sourceLocation(iid));
                const wr = instrumentation.write(undefined, gf.result);
                if (isArrayDestructuring) {
                    result.push(wr.val);
                } else {
                    result[names[i]] = wr.val;
                }
            }
            return { result };
        }

        let cur = val;
        if (Array.isArray(names) && names.length > 0) {
            for (const _name of names) {
                const ret = instrumentation.write(undefined, cur);
                cur = ret.val;
            }
        } else {
            const ret = instrumentation.write(undefined, cur);
            cur = ret.val;
        }
        return { result: cur };
    },

    _return(_iid: number, val: any) {
        return { result: val };
    },

    _throw(_iid: number, val: any) {
        return { result: val };
    },

    _yield(_iid: number, val: any, _isDelegate: boolean) {
        return { result: val };
    },

    _resume(_iid: number, val: any) {
        const ret = instrumentation.resume(val);
        return { result: ret.result };
    },

    _await(_iid: number, val: any) {
        const ret = instrumentation.suspend(val);
        return { result: ret.result };
    },

    _awaitResult(_iid: number, val: any) {
        const ret = instrumentation.resume(val);
        return { result: ret.result };
    },

    fieldInit(iid: number, obj: any, key: any, _isStatic: boolean, val: any) {
        const ret = instrumentation.putField(obj, key, val, sourceLocation(iid));
        return { result: ret.val };
    },

    superCallPre(iid: number, args: any[]) {
        if (nativeSuperCallIids.has(iid)) {
            const unwrappedArgs = args.map((a: any) => getValue(instrumentation.s, a));
            return { args: unwrappedArgs };
        }
        return { args };
    },

    superCall(iid: number, args: any[], thisVal: any) {
        // Detect super() to a native Array-like parent: if a single numeric arg was
        // wrapped as a SafeProxy the Array constructor treats it as an element instead
        // of a length, producing a 1-element array.  Detect and fix in-place, then
        // register the iid so superCallPre unwraps on all subsequent calls.
        if (Array.isArray(thisVal) && args.length >= 1) {
            const rawFirst = getValue(instrumentation.s, args[0]);
            if (typeof rawFirst === 'number' && typeof args[0] !== 'number') {
                // The first arg was a wrapped number — Array constructor misinterpreted it.
                // Delete the spurious element and set the correct length.
                delete thisVal[0];
                thisVal.length = rawFirst;
                nativeSuperCallIids.add(iid);
            }
        }
        return { result: thisVal };
    },

    superMethodCallPre(iid: number, thisVal: any, prop: any, args: any[]) {
        const f = superMethodByIid.get(iid);
        if (typeof f !== 'function') {
            return { prop, args };
        }

        const { isExternal, originalScriptPath, uniqueID } = getCallInfo(iid, f);
        superMethodExternalStack.push(isExternal);
        pendingInvokeArgsStack.push(Array.from(args));

        const ret = instrumentation.invokeFunPre(
            f,
            thisVal,
            args,
            true,
            false,
            isExternal,
            uniqueID,
            originalScriptPath,
            sourceLocation(iid)
        );

        if (ret.reset_branches) {
            instrumentation.trace_prop.branches = [];
            instrumentation.trace_prop.code_coverage = 0;
        }

        return { prop, args: ret.args };
    },

    superMethodCall(iid: number, thisVal: any, prop: any, args: any[], result: any) {
        const f = superMethodByIid.get(iid);
        if (typeof f !== 'function') {
            return { result };
        }

        const isExternal = superMethodExternalStack.pop() ?? (getFunctionSid(f) === undefined || getFunctionSid(f) === null);
        pendingInvokeArgsStack.pop();
        const uniqueID = hash(`${getScriptSid()}${iid}`);
        const ret = instrumentation.invokeFun(f, thisVal, args, result, false, true, isExternal, uniqueID);
        return { result: ret.result };
    },

    superGetFieldPre(_iid: number, _thisVal: any, prop: any) {
        const ret = instrumentation.getFieldPre(globalThis, prop);
        return { prop: ret.offset };
    },

    superGetField(iid: number, thisVal: any, prop: any, val: any) {
        if (typeof val === 'function') {
            superMethodByIid.set(iid, val);
        } else {
            superMethodByIid.delete(iid);
        }
        const ret = instrumentation.getField(thisVal, prop, val, sourceLocation(iid));
        if (isMethodOnInternalClass(thisVal, ret.result)) {
            rememberFunctionSid(ret.result);
        }
        return { result: ret.result };
    },

    superPutFieldPre(_iid: number, _thisVal: any, prop: any, val: any) {
        const ret = instrumentation.putFieldPre(globalThis, prop, val);
        return { prop: ret.offset, value: ret.value };
    },

    superPutField(iid: number, thisVal: any, prop: any, val: any) {
        instrumentation.putField(thisVal, prop, val, sourceLocation(iid));
    },

    functionEnter(_iid: number, f: any, _dis: any, _args: any) {
        // Mirrors Jalangi's updateSid(f): switch ownerSid to the function's
        // defining module so that require() calls inside resolve correctly.
        //
        // Jalangi reads f[SPECIAL_PROP_SID] here, but DynaJS passes null for
        // anonymous function expressions.  calleeSidStack (populated by
        // invokeFunPre, which *does* see the real function) bridges the gap.
        const calleeSid = calleeSidStack.length > 0
            ? calleeSidStack[calleeSidStack.length - 1]
            : undefined;

        let functionSid: number | undefined;
        if (typeof f !== 'function') {
            const fallbackFunction = createFallbackFunction();
            functionSid = calleeSid ?? getOwnerSid();
            functionSidMap.set(fallbackFunction, functionSid);
            pushOwnerSid(functionSid);
            currentFunctionArgsStack.push(undefined);
            instrumentation.functionEnter(fallbackFunction);
            return;
        }

        functionSid = functionSidMap.get(f);
        if (functionSid === undefined) {
            functionSid = calleeSid ?? getOwnerSid();
            functionSidMap.set(f, functionSid);
        }

        pushOwnerSid(functionSid);
        const savedArgs = pendingInvokeArgsStack.length > 0
            ? pendingInvokeArgsStack[pendingInvokeArgsStack.length - 1]
            : undefined;
        currentFunctionArgsStack.push(savedArgs);
        instrumentation.functionEnter(f);
    },

    functionExit(_iid: number, _returnVal: any, wrappedExceptionVal?: { exception: any }) {
        popOwnerSid();
        currentFunctionArgsStack.pop();
        const threwException = wrappedExceptionVal !== undefined;
        instrumentation.functionExit(threwException);
        // DynaJS wraps every function body in try/catch/finally, so a FlowError
        // thrown inside a Promise executor becomes a rejection instead of
        // propagating to the driver's catch block.  Schedule a re-throw in the
        // global (macrotask) context so the driver's uncaughtException handler
        // sees it, then force-exit so active timers (setInterval, etc.) don't
        // keep the process alive indefinitely.
        if (wrappedExceptionVal?.exception?.found_flow) {
            const err = wrappedExceptionVal.exception;
            setTimeout(() => {
                process.emit('uncaughtException', err);
                const backupExit = (process as any).backup_exit;
                if (typeof backupExit === 'function') {
                    backupExit(0);
                } else {
                    process.exit(0);
                }
            }, 0);
        }
    },

    binaryPre(_iid: number, op: string, left: any, right: any) {
        const ret = instrumentation.binaryPre(op, left, right);
        return { op: op, left: ret.left, right: ret.right, skip: false };
    },

    binary(iid: number, op: string, left: any, right: any, result: any) {
        const ret = instrumentation.binary(op, left, right, result, sourceLocation(iid));
        return { result: ret.result };
    },

    templateConcatPre(_iid: number, left: any, right: any) {
        const ret = instrumentation.binaryPre('+', left, right);
        return { left: ret.left, right: ret.right, skip: false };
    },

    templateConcat(iid: number, left: any, right: any, result: any) {
        const ret = instrumentation.binary('+', left, right, result, sourceLocation(iid));
        return { result: ret.result };
    },

    unaryPre(_iid: number, op: string, _prefix: boolean, operand: any) {
        if (op === '++' || op === '--') {
            return { op, operand, skip: false };
        }
        if (op === 'void') {
            return { op, operand, skip: false };
        }
        const ret = instrumentation.unaryPre(op, operand);
        return { op: op, operand: ret.left, skip: false };
    },

    unary(iid: number, op: string, _prefix: boolean, operand: any, result: any) {
        if (op === '++' || op === '--') {
            return { result };
        }
        if (op === 'void') {
            return { result };
        }
        const ret = instrumentation.unary(op, operand, result, sourceLocation(iid));
        return { result: ret.result };
    },

    condition(iid: number, op: string, result: any) {
        const branchInfo = getBranchInfo();
        const globalBranchInfo = getGlobalBranchInfo();

        if (result) {
            if (!branchInfo.hasOwnProperty(iid)) {
                instrumentation.trace_prop.code_coverage++;
                branchInfo[iid] = 1;
            }

            if (!globalBranchInfo.hasOwnProperty(iid)) {
                instrumentation.trace_prop.global_code_coverage++;
                globalBranchInfo[iid] = 1;
            }
        } else {
            if (!branchInfo.hasOwnProperty(iid - 1)) {
                instrumentation.trace_prop.code_coverage++;
                branchInfo[iid - 1] = 1;
            }

            if (!globalBranchInfo.hasOwnProperty(iid - 1)) {
                instrumentation.trace_prop.global_code_coverage++;
                globalBranchInfo[iid - 1] = 1;
            }
        }

        const ret = instrumentation.conditional(result);
        const rawResult = ret.result;

        if (op === '||' || op === '&&') {
            return { result: rawResult ? result : rawResult };
        }
        if (op === '??') {
            return { result: (rawResult !== null && rawResult !== undefined) ? result : rawResult };
        }
        if (op === '?.') {
            return { result: (rawResult !== null && rawResult !== undefined) ? result : rawResult };
        }

        return { result: rawResult };
    },
    
    endExpression(_iid: number, _value: any) {
        instrumentation.endExpression();
    },

    endExecution() {
        // no-op
    },
};
