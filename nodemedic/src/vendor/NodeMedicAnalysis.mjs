import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// src/dynajs-analysis/index.ts
import * as fs from "fs";
import { promisify } from "node:util";

// lib/dynajs/analyses/flow/utils.ts
function required(condition, message) {
  if (!condition) {
    throw new Error(`[ERROR] ${message}`);
  }
}
function isInstrumentedFn(f) {
  return D$.isInstrumented?.(f) ?? false;
}
var CAPTURED = Object.freeze({
  FunctionConstructor: Function,
  FunctionToString: Function.prototype.toString,
  // Reflection used by framework internals (e.g. BoundaryEscape). User code can
  // override the Object/Reflect globals or their methods, so capture them up
  // front. (Array iteration uses index loops instead — `for…of` always
  // dispatches through the live, overridable Array.prototype[Symbol.iterator].)
  ReflectOwnKeys: Reflect.ownKeys,
  ObjectGetOwnPropertyDescriptor: Object.getOwnPropertyDescriptor,
  ObjectDefineProperty: Object.defineProperty,
  // [[DefineOwnProperty]] seam ($.defineOwnProperty): returns a boolean (false on
  // failure) rather than throwing like Object.defineProperty does.
  ReflectDefineProperty: Reflect.defineProperty,
  ObjectIs: Object.is,
  // Calls into native/user functions with an args *array* — CreateListFrom
  // ArrayLike (length+index), so unlike `fn.call(t, ...arr)` it never dispatches
  // through the (overridable) Array.prototype[Symbol.iterator].
  ReflectApply: Reflect.apply
});
function concatList(heads, tail) {
  const out = [];
  let n = 0;
  const put = (v) => CAPTURED.ObjectDefineProperty(out, n++, {
    value: v,
    writable: true,
    enumerable: true,
    configurable: true
  });
  for (let i = 0; i < heads.length; i++) put(heads[i]);
  for (let i = 0; i < tail.length; i++) put(tail[i]);
  return out;
}

// lib/dynajs/analyses/flow/spec/AO__ArrayCreate.manual.ts
function AO__ArrayCreate($, length, proto = $.default(void 0, [])) {
  const len = $.value(length);
  if (len > 2 ** 32 - 1) {
    throw new RangeError("AO__ArrayCreate : length is too large");
  }
  if ($.is(proto, $.default(void 0, []))) return $.default(new Array(len), []);
  const A = $.default(new Array(len), []);
  Object.setPrototypeOf($.value(A), $.value(proto));
  return A;
}

// lib/dynajs/analyses/flow/spec/AO__Get.manual.ts
function AO__Get($, O, P) {
  return $.get(O, P);
}

// lib/dynajs/src/captured.ts
var CAPTURED2 = Object.freeze({
  FunctionConstructor: Function,
  FunctionToString: Function.prototype.toString,
  IndirectEval: eval
});

// lib/dynajs/analyses/flow/spec/AO__IsConstructor.manual.ts
function AO__IsConstructor($, argument) {
  const f = $.value(argument);
  if (typeof f !== "function") {
    return $.default(false, []);
  }
  const stringified = CAPTURED2.FunctionToString.call(f).replaceAll(" ", "");
  if (stringified.startsWith("class") || stringified.startsWith("function")) {
    return $.default(true, []);
  }
  return $.default(false, []);
}

// lib/dynajs/analyses/flow/spec/AO__ArraySpeciesCreate.manual.ts
function AO__ArraySpeciesCreate($, originalArray, length) {
  const isArray = Array.isArray($.value(originalArray));
  if (!isArray) {
    return $.default(new Array($.value(length)), [length]);
  }
  let C = AO__Get($, originalArray, $.default("constructor", []));
  if ($.value(AO__IsConstructor($, C))) {
  }
  if ($.value($.isType(C, "object"))) {
    C = AO__Get($, C, $.default(Symbol.species, []));
    if ($.value(C) === null) C = $.default(void 0, []);
  }
  if ($.value($.isType(C, "undefined"))) {
    return AO__ArrayCreate($, length);
  }
  return AO__ArrayCreate($, length);
}

// lib/dynajs/analyses/flow/spec/AO__IsCallable.manual.ts
function AO__IsCallable($, argument) {
  "use strict";
  const arg = $.value(argument);
  return $.default(typeof arg === "function", []);
}

// lib/dynajs/analyses/flow/spec/AO__Call.manual.ts
function AO__Call($, F, V, argumentsList) {
  "use strict";
  if (argumentsList === void 0) argumentsList = [];
  if (AO__IsCallable($, F) === false)
    throw new TypeError("AO__Call : F is not callable");
  return $.apply(F, V, argumentsList);
}

// lib/dynajs/analyses/flow/spec/AO__RequireObjectCoercible.manual.ts
function AO__RequireObjectCoercible($, argument) {
  "use strict";
  const v = $.value(argument);
  if (v === void 0 || v === null) {
    throw new TypeError("Cannot convert undefined or null to object");
  }
  return argument;
}

// lib/dynajs/analyses/flow/spec/AO__ToObject.manual.ts
function AO__ToObject($, argument) {
  "use strict";
  AO__RequireObjectCoercible($, argument);
  if (typeof $.value(argument) === "object") return argument;
  return $.default(Object(argument), []);
}

// lib/dynajs/analyses/flow/spec/AO__GetV.manual.ts
function AO__GetV($, V, P) {
  const O = AO__ToObject($, V);
  return $.get(O, P);
}

// lib/dynajs/analyses/flow/spec/AO__GetMethod.ts
function AO__GetMethod($, V, P) {
  var func = AO__GetV($, V, P);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 66, $.is(func, $.default(void 0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 67, $.is(func, $.default(null, []))))) {
    return $.default(void 0, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 68, $.is(AO__IsCallable($, func), $.default(false, []))))) {
    throw new TypeError();
  }
  return func;
}

// lib/dynajs/analyses/flow/spec/AO__OrdinaryToPrimitive.manual.ts
function AO__OrdinaryToPrimitive($, O, hint) {
  const methodNames = hint === "string" ? ["toString", "valueOf"] : ["valueOf", "toString"];
  for (const name of methodNames) {
    const method = AO__Get($, O, $.default(name, []));
    if ($.value(AO__IsCallable($, method))) {
      const result = AO__Call($, method, O);
      if (!$.value($.isType(result, "object")))
        return result;
    }
  }
  throw new TypeError();
}

// lib/dynajs/analyses/flow/spec/AO__ToPrimitive.manual.ts
function AO__ToPrimitive($, arg, preferredType = $.default("default", [])) {
  if ($.value($.isType(arg, "object"))) {
    const exoticToPrim = AO__GetMethod($, arg, $.default(Symbol.toPrimitive, []));
    if ($.value(exoticToPrim) !== void 0) {
      const result = AO__Call($, exoticToPrim, arg, [preferredType]);
      if (!$.value($.isType(result, "object"))) return result;
      throw new TypeError();
    }
    const hint = $.value(preferredType) === "string" ? "string" : "number";
    return AO__OrdinaryToPrimitive($, arg, hint);
  }
  return arg;
}

// lib/dynajs/analyses/flow/spec/AO__ToNumber.manual.ts
function AO__ToNumber($, arg) {
  let argument = $.value(arg);
  if (argument !== null && (typeof argument === "object" || typeof argument === "function")) {
    arg = AO__ToPrimitive($, arg, $.default("number", []));
    argument = $.value(arg);
  }
  if (typeof argument === "number") {
    return arg;
  }
  return $.default(+argument, [arg]);
}

// lib/dynajs/analyses/flow/spec/AO__ToString.manual.ts
function AO__ToString($, argument) {
  "use strict";
  let unlifted = $.value(argument);
  if (unlifted !== null && (typeof unlifted === "object" || typeof unlifted === "function")) {
    argument = AO__ToPrimitive($, argument, $.default("string", []));
    unlifted = $.value(argument);
  }
  if (typeof unlifted === "symbol") throw new TypeError();
  if (typeof unlifted === "string") return argument;
  return $.default(String(unlifted), [argument]);
}

// lib/dynajs/analyses/flow/spec/AO__CanonicalNumericIndexString.ts
function AO__CanonicalNumericIndexString($, argument) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 13, $.is(argument, $.default("-0", []))))) {
    return $.default(0, []);
  }
  var n = AO__ToNumber($, argument);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 14, $.is(AO__ToString($, n), argument)))) {
    return n;
  }
  return $.default(void 0, []);
}

// lib/dynajs/analyses/flow/spec/AO__UTF16SurrogatePairToCodePoint.manual.ts
function AO__UTF16SurrogatePairToCodePoint($, lead, trail) {
  var leadCU = $.value(lead).charCodeAt(0);
  var trailCU = $.value(trail).charCodeAt(0);
  var cp = (leadCU - 55296) * 1024 + (trailCU - 56320) + 65536;
  return $.default(cp, [lead, trail]);
}

// lib/dynajs/analyses/flow/spec/AO__CodePointAt.manual.ts
function AO__CodePointAt($, string, position) {
  var size = $.length(string);
  var first = $.substring(string, position, $.add(position, $.default(1, [])));
  var firstUnlifted = $.value(first).charCodeAt(0);
  var cp = $.default(firstUnlifted, [first]);
  if (!(firstUnlifted >= 55296 && firstUnlifted <= 57343)) {
    return { "CodePoint": cp, "CodeUnitCount": $.default(1, []), "IsUnpairedSurrogate": $.default(false, []) };
  }
  if (firstUnlifted >= 56320 && firstUnlifted <= 57343 || $.value(position) + 1 === $.value(size)) {
    return { "CodePoint": cp, "CodeUnitCount": $.default(1, []), "IsUnpairedSurrogate": $.default(true, []) };
  }
  var second = $.substring(string, $.add(position, $.default(1, [])), $.add(position, $.default(2, [])));
  var secondUnlifted = $.value(second).charCodeAt(0);
  if (!(secondUnlifted >= 56320 && secondUnlifted <= 57343)) {
    return { "CodePoint": cp, "CodeUnitCount": $.default(1, []), "IsUnpairedSurrogate": $.default(true, []) };
  }
  cp = AO__UTF16SurrogatePairToCodePoint($, first, second);
  return { "CodePoint": cp, "CodeUnitCount": $.default(2, []), "IsUnpairedSurrogate": $.default(false, []) };
}

// lib/dynajs/analyses/flow/spec/AO__SameType.ts
function AO__SameType($, x, y) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 711, $.is(x, $.default(void 0, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 712, $.is(y, $.default(void 0, []))))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 713, $.is(x, $.default(null, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 714, $.is(y, $.default(null, []))))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 715, $.isType(x, "boolean"))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 716, $.isType(y, "boolean")))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 717, $.isType(x, "number"))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 718, $.isType(y, "number")))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 719, $.isType(x, "bigint"))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 720, $.isType(y, "bigint")))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 721, $.isType(x, "symbol"))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 722, $.isType(y, "symbol")))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 723, $.isType(x, "string"))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 724, $.isType(y, "string")))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 725, $.isType(x, "object"))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 726, $.isType(y, "object")))) {
    return $.default(true, []);
  }
  return $.default(false, []);
}

// lib/dynajs/analyses/flow/spec/AO__StringToBigInt.manual.ts
function AO__StringToBigInt($, string) {
  return $.default(BigInt($.value(string)), [string]);
}

// lib/dynajs/analyses/flow/spec/AO__ToNumeric.ts
function AO__ToNumeric($, value) {
  var primValue = AO__ToPrimitive($, value, $.default("number", []));
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 816, $.isType(primValue, "bigint")))) {
    return primValue;
  }
  return AO__ToNumber($, primValue);
}

// lib/dynajs/analyses/flow/spec/BigInt__lessThan.ts
function BigInt__lessThan($, x, y) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 7, $.lessThan(x, y)))) {
    return $.default(true, []);
  } else {
    return $.default(false, []);
  }
}

// lib/dynajs/analyses/flow/spec/Number__lessThan.ts
function Number__lessThan($, x, y) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 640, $.isNaN(x)))) {
    return $.default(void 0, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 641, $.isNaN(y)))) {
    return $.default(void 0, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 642, $.is(x, y)))) {
    return $.default(false, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 643, $.is(x, $.default(0, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 644, $.is(y, $.default(0, []))))) {
    return $.default(false, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 645, $.is(x, $.default(0, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 646, $.is(y, $.default(0, []))))) {
    return $.default(false, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 647, $.is(x, $.default(Infinity, []))))) {
    return $.default(false, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 648, $.is(y, $.default(Infinity, []))))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 649, $.is(y, $.default(-Infinity, []))))) {
    return $.default(false, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 650, $.is(x, $.default(-Infinity, []))))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 651, $.lessThan(x, y)))) {
    return $.default(true, []);
  } else {
    return $.default(false, []);
  }
}

// lib/dynajs/analyses/flow/spec/AO__IsLessThan.ts
function AO__IsLessThan($, x, y, LeftFirst) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 571, $.is(LeftFirst, $.default(true, []))))) {
    var px = AO__ToPrimitive($, x, $.default("number", []));
    var py = AO__ToPrimitive($, y, $.default("number", []));
  } else {
    var py = AO__ToPrimitive($, y, $.default("number", []));
    var px = AO__ToPrimitive($, x, $.default("number", []));
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 572, $.isType(px, "string"))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 573, $.isType(py, "string")))) {
    var lx = $.length(px);
    var ly = $.length(py);
    for (var i of $.range($.default(0, []), true, $.min(lx, ly), false, true, Number.MAX_SAFE_INTEGER - 576)) {
      var cx = $.codeUnitAt(px, i);
      var cy = $.codeUnitAt(py, i);
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 574, $.lessThan(cx, cy)))) {
        return $.default(true, []);
      }
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 575, $.greaterThan(cx, cy)))) {
        return $.default(false, []);
      }
    }
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 577, $.lessThan(lx, ly)))) {
      return $.default(true, []);
    } else {
      return $.default(false, []);
    }
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 578, $.isType(px, "bigint"))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 579, $.isType(py, "string")))) {
      var ny = AO__StringToBigInt($, py);
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 580, $.is(ny, $.default(void 0, []))))) {
        return $.default(void 0, []);
      }
      return BigInt__lessThan($, px, ny);
    }
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 581, $.isType(px, "string"))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 582, $.isType(py, "bigint")))) {
      var nx = AO__StringToBigInt($, px);
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 583, $.is(nx, $.default(void 0, []))))) {
        return $.default(void 0, []);
      }
      return BigInt__lessThan($, nx, py);
    }
    var nx = AO__ToNumeric($, px);
    var ny = AO__ToNumeric($, py);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 584, $.is(AO__SameType($, nx, ny), $.default(true, []))))) {
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 585, $.isType(nx, "number")))) {
        return Number__lessThan($, nx, ny);
      } else {
        return BigInt__lessThan($, nx, ny);
      }
    }
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 586, $.isNaN(nx))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 587, $.isNaN(ny)))) {
      return $.default(void 0, []);
    }
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 588, $.is(nx, $.default(-Infinity, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 589, $.is(ny, $.default(Infinity, []))))) {
      return $.default(true, []);
    }
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 590, $.is(nx, $.default(Infinity, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 591, $.is(ny, $.default(-Infinity, []))))) {
      return $.default(false, []);
    }
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 592, $.lessThan(nx, ny)))) {
      return $.default(true, []);
    } else {
      return $.default(false, []);
    }
  }
}

// lib/dynajs/analyses/flow/spec/AO__CompareArrayElements.ts
function AO__CompareArrayElements($, x, y, comparator) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 19, $.is(x, $.default(void 0, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 20, $.is(y, $.default(void 0, []))))) {
    return $.default(0, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 21, $.is(x, $.default(void 0, []))))) {
    return $.default(1, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 22, $.is(y, $.default(void 0, []))))) {
    return $.default(-1, []);
  }
  if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 23, $.is(comparator, $.default(void 0, []))))) {
    var v = AO__ToNumber($, AO__Call($, comparator, $.default(void 0, []), [x, y]));
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 24, $.isNaN(v)))) {
      return $.default(0, []);
    }
    return v;
  }
  var xString = AO__ToString($, x);
  var yString = AO__ToString($, y);
  var xSmaller = AO__IsLessThan($, xString, yString, $.default(true, []));
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 25, $.is(xSmaller, $.default(true, []))))) {
    return $.default(-1, []);
  }
  var ySmaller = AO__IsLessThan($, yString, xString, $.default(true, []));
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 26, $.is(ySmaller, $.default(true, []))))) {
    return $.default(1, []);
  }
  return $.default(0, []);
}

// lib/dynajs/analyses/flow/spec/AO__Construct.manual.ts
function AO__Construct($, F, argumentsList, newTarget) {
  const Fu = $.value(F);
  const argumentsListu = argumentsList ? $.value(argumentsList) : [];
  const newTargetu = newTarget ? $.value(newTarget) : Fu;
  const dependencies = [F, newTarget, ...argumentsList ?? []];
  return $.default(Reflect.construct(Fu, argumentsListu, newTargetu), dependencies);
}

// lib/dynajs/analyses/flow/spec/AO__CreateDataProperty.manual.ts
function AO__CreateDataProperty($, O, P, V) {
  var newDesc = { "value": V, "writable": true, "enumerable": true, "configurable": true };
  return $.default(Object.defineProperty($.value(O), $.value(P), newDesc) !== void 0, [O, P, V]);
}

// lib/dynajs/analyses/flow/spec/AO__CreateDataPropertyOrThrow.ts
function AO__CreateDataPropertyOrThrow($, O, P, V) {
  var success = AO__CreateDataProperty($, O, P, V);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 28, $.is(success, $.default(false, []))))) {
    throw new TypeError();
  }
  return $.default("unused", []);
}

// lib/dynajs/analyses/flow/spec/AO__CreateArrayFromList.ts
function AO__CreateArrayFromList($, elements) {
  var array = AO__ArrayCreate($, $.default(0, []));
  var n = $.default(0, []);
  for (var e of elements) {
    AO__CreateDataPropertyOrThrow($, array, AO__ToString($, n), e);
    n = $.add(n, $.default(1, []));
  }
  return array;
}

// lib/dynajs/analyses/flow/spec/AO__CreateHTML.ts
function AO__CreateHTML($, string, tag, attribute, value) {
  var str = AO__RequireObjectCoercible($, string);
  var S = AO__ToString($, str);
  var p1 = $.concatenate($.default("<", []), tag);
  if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 29, $.is(attribute, $.default("", []))))) {
    var V = AO__ToString($, value);
    var escapedV = $.default($.value(V).replaceAll(String.fromCharCode(34), "&quot;"), [V]);
    p1 = $.concatenate($.concatenate($.concatenate($.concatenate($.concatenate($.concatenate(p1, $.default(" ", [])), attribute), $.default("=", [])), $.default(String.fromCharCode(34), [])), escapedV), $.default(String.fromCharCode(34), []));
  }
  var p2 = $.concatenate(p1, $.default(">", []));
  var p3 = $.concatenate(p2, S);
  var p4 = $.concatenate($.concatenate($.concatenate(p3, $.default("</", [])), tag), $.default(">", []));
  return p4;
}

// lib/dynajs/analyses/flow/spec/AO__DeletePropertyOrThrow.manual.ts
function AO__DeletePropertyOrThrow($, O, P) {
  "use strict";
  const Ou = $.value(O);
  const Pu = $.value(P);
  var success = delete Ou[Pu];
  if (success === false) throw new TypeError();
}

// lib/dynajs/analyses/flow/spec/AO__ToBoolean.ts
function AO__ToBoolean($, argument) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 794, $.isType(argument, "boolean")))) {
    return argument;
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 795, $.is(argument, $.default(void 0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 796, $.is(argument, $.default(null, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 797, $.is(argument, $.default(0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 798, $.is(argument, $.default(0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 799, $.isNaN(argument))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 800, $.is(argument, $.default(0n, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 801, $.is(argument, $.default("", []))))) {
    return $.default(false, []);
  }
  return $.default(true, []);
}

// lib/dynajs/analyses/flow/spec/AO__FindViaPredicate.ts
function AO__FindViaPredicate($, O, len, direction, predicate, thisArg) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 50, $.is(AO__IsCallable($, predicate), $.default(false, []))))) {
    throw new TypeError();
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 51, $.is(direction, $.default("ascending", []))))) {
    var indices = $.range($.default(0, []), true, len, false, true, Number.MAX_SAFE_INTEGER - 52);
  } else {
    var indices = $.range($.default(0, []), true, len, false, false, Number.MAX_SAFE_INTEGER - 53);
  }
  for (var k of indices) {
    var Pk = AO__ToString($, k);
    var kValue = AO__Get($, O, Pk);
    var testResult = AO__Call($, predicate, thisArg, [kValue, k, O]);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 54, $.is(AO__ToBoolean($, testResult), $.default(true, []))))) {
      return { "Index": k, "Value": kValue };
    }
  }
  return { "Index": $.default(-1, []), "Value": $.default(void 0, []) };
}

// lib/dynajs/analyses/flow/spec/AO__HasProperty.manual.ts
function AO__HasProperty($, O, P) {
  "use strict";
  const o = $.value(O);
  const p = $.value(P);
  return $.default(p in o, [O, P]);
}

// lib/dynajs/analyses/flow/spec/AO__IsArray.manual.ts
function AO__IsArray($, argument) {
  if (!$.value($.isType(argument, "object"))) {
    return $.default(false, []);
  }
  if (Array.isArray($.value(argument))) {
    return $.default(true, []);
  }
  return $.default(false, []);
}

// lib/dynajs/analyses/flow/spec/AO__ToIntegerOrInfinity.manual.ts
function AO__ToIntegerOrInfinity($, argument) {
  "use strict";
  var number = AO__ToNumber($, argument);
  var n = $.value(number);
  if (isNaN(n)) {
    return $.default(0, []);
  }
  if (n === 0) {
    return number;
  }
  if (!isFinite(n)) {
    return $.default(n, []);
  }
  return $.truncate(number);
}

// lib/dynajs/analyses/flow/spec/AO__ToLength.ts
function AO__ToLength($, argument) {
  var len = AO__ToIntegerOrInfinity($, argument);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 807, $.lessThanEqual(len, $.default(0, []))))) {
    return $.default(0, []);
  }
  return $.min(len, $.subtract($.exponentiate($.default(2, []), $.default(53, [])), $.default(1, [])));
}

// lib/dynajs/analyses/flow/spec/AO__LengthOfArrayLike.ts
function AO__LengthOfArrayLike($, obj) {
  return AO__ToLength($, AO__Get($, obj, $.default("length", [])));
}

// lib/dynajs/analyses/flow/spec/AO__FlattenIntoArray.ts
function AO__FlattenIntoArray($, target, source, sourceLen, start, depth, mapperFunction = $.default(void 0, []), thisArg = $.default(void 0, [])) {
  var mapperFunctionIsPresent = arguments.length > 6;
  var targetIndex = start;
  var sourceIndex = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 55, $.lessThan(sourceIndex, sourceLen)))) {
    var P = AO__ToString($, sourceIndex);
    var exists = AO__HasProperty($, source, P);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 56, $.is(exists, $.default(true, []))))) {
      var element = AO__Get($, source, P);
      if (mapperFunctionIsPresent) {
        element = AO__Call($, mapperFunction, thisArg, [element, sourceIndex, source]);
      }
      var shouldFlatten = $.default(false, []);
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 57, $.greaterThan(depth, $.default(0, []))))) {
        shouldFlatten = AO__IsArray($, element);
      }
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 58, $.is(shouldFlatten, $.default(true, []))))) {
        if ($.value($.condition(Number.MAX_SAFE_INTEGER - 59, $.is(depth, $.default(Infinity, []))))) {
          var newDepth = $.default(Infinity, []);
        } else {
          var newDepth = $.subtract(depth, $.default(1, []));
        }
        var elementLen = AO__LengthOfArrayLike($, element);
        targetIndex = AO__FlattenIntoArray($, target, element, elementLen, targetIndex, newDepth);
      } else {
        if ($.value($.condition(Number.MAX_SAFE_INTEGER - 60, $.greaterThanEqual(targetIndex, $.subtract($.exponentiate($.default(2, []), $.default(53, [])), $.default(1, [])))))) {
          throw new TypeError();
        }
        AO__CreateDataPropertyOrThrow($, target, AO__ToString($, targetIndex), element);
        targetIndex = $.add(targetIndex, $.default(1, []));
      }
    }
    sourceIndex = $.add(sourceIndex, $.default(1, []));
  }
  return targetIndex;
}

// lib/dynajs/analyses/flow/spec/AO__GetPrototypeFromConstructor.manual.ts
function AO__GetPrototypeFromConstructor($, constructor, defaultProto) {
  var proto = $.get(constructor, $.default("prototype", []));
  if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 428, $.isType(proto, "object")))) {
    proto = defaultProto;
  }
  return proto;
}

// lib/dynajs/analyses/flow/spec/AO__StringIndexOf.ts
function AO__StringIndexOf($, string, searchValue, fromIndex) {
  var len = $.length(string);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 779, $.is(searchValue, $.default("", [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 780, $.lessThanEqual(fromIndex, len)))) {
    return fromIndex;
  }
  var searchLen = $.length(searchValue);
  for (var i of $.range(fromIndex, true, $.subtract(len, searchLen), true, true, Number.MAX_SAFE_INTEGER - 782)) {
    var candidate = $.substring(string, i, $.add(i, searchLen));
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 781, $.is(candidate, searchValue)))) {
      return i;
    }
  }
  return $.default("not-found", []);
}

// lib/dynajs/analyses/flow/spec/AO__StringToNumber.manual.ts
function AO__StringToNumber($, V) {
  return $.default(Number($.value(V)), [V]);
}

// lib/dynajs/analyses/flow/spec/AO__GetSubstitution.ts
function AO__GetSubstitution($, matched, str, position, captures, namedCaptures, replacementTemplate) {
  var stringLength = $.length(str);
  var result = $.default("", []);
  var templateRemainder = replacementTemplate;
  while (!$.value($.condition(Number.MAX_SAFE_INTEGER - 75, $.is(templateRemainder, $.default("", []))))) {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 76, $.is($.substring(templateRemainder, $.default(0, []), $.default(2, [])), $.default("$$", []))))) {
      var ref = $.default("$$", []);
      var refReplacement = $.default("$", []);
    } else {
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 77, $.is($.substring(templateRemainder, $.default(0, []), $.default(2, [])), $.default("$`", []))))) {
        var ref = $.default("$`", []);
        var refReplacement = $.substring(str, $.default(0, []), position);
      } else {
        if ($.value($.condition(Number.MAX_SAFE_INTEGER - 78, $.is($.substring(templateRemainder, $.default(0, []), $.default(2, [])), $.default("$&", []))))) {
          var ref = $.default("$&", []);
          var refReplacement = matched;
        } else {
          if ($.value($.condition(Number.MAX_SAFE_INTEGER - 79, $.is($.substring(templateRemainder, $.default(0, []), $.default(2, [])), $.default("$'", []))))) {
            var ref = $.default("$'", []);
            var matchLength = $.length(matched);
            var tailPos = $.add(position, matchLength);
            var refReplacement = $.substring(str, $.min(tailPos, stringLength), $.length(str));
          } else {
            if ($.value($.condition(Number.MAX_SAFE_INTEGER - 80, $.is($.substring(templateRemainder, $.default(0, []), $.default(1, [])), $.default("$", [])) && /[0-9]/.test($.value($.substring(templateRemainder, $.default(1, []), $.default(2, []))))))) {
              var digitCount = /[0-9]/.test($.value($.substring(templateRemainder, $.default(2, []), $.default(3, [])))) ? $.default(2, []) : $.default(1, []);
              var digits = $.substring(templateRemainder, $.default(1, []), $.add($.default(1, []), digitCount));
              var index = AO__StringToNumber($, digits);
              var captureLen = $.default(captures.length, []);
              if ($.value($.condition(Number.MAX_SAFE_INTEGER - 81, $.greaterThan(index, captureLen))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 82, $.is(digitCount, $.default(2, []))))) {
                digitCount = $.default(1, []);
                digits = $.substring(digits, $.default(0, []), $.default(1, []));
                index = AO__StringToNumber($, digits);
              }
              var ref = $.substring(templateRemainder, $.default(0, []), $.add($.default(1, []), digitCount));
              if ($.value($.condition(Number.MAX_SAFE_INTEGER - 83, $.greaterThanEqual(index, $.default(1, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 84, $.lessThanEqual(index, captureLen)))) {
                var capture = captures[$.subtract(index, $.default(1, []))];
                if ($.value($.condition(Number.MAX_SAFE_INTEGER - 85, $.is(capture, $.default(void 0, []))))) {
                  var refReplacement = $.default("", []);
                } else {
                  var refReplacement = capture;
                }
              } else {
                var refReplacement = ref;
              }
            } else {
              if ($.value($.condition(Number.MAX_SAFE_INTEGER - 86, $.is($.substring(templateRemainder, $.default(0, []), $.default(2, [])), $.default("$<", []))))) {
                var gtPos = AO__StringIndexOf($, templateRemainder, $.default(">", []), $.default(0, []));
                if ($.value($.condition(Number.MAX_SAFE_INTEGER - 87, $.is(gtPos, $.default("not-found", [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 88, $.is(namedCaptures, $.default(void 0, []))))) {
                  var ref = $.default("$<", []);
                  var refReplacement = ref;
                } else {
                  var ref = $.substring(templateRemainder, $.default(0, []), $.add(gtPos, $.default(1, [])));
                  var groupName = $.substring(templateRemainder, $.default(2, []), gtPos);
                  var capture = AO__Get($, namedCaptures, groupName);
                  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 89, $.is(capture, $.default(void 0, []))))) {
                    var refReplacement = $.default("", []);
                  } else {
                    var refReplacement = AO__ToString($, capture);
                  }
                }
              } else {
                var ref = $.substring(templateRemainder, $.default(0, []), $.default(1, []));
                var refReplacement = ref;
              }
            }
          }
        }
      }
    }
    var refLength = $.length(ref);
    templateRemainder = $.substring(templateRemainder, refLength, $.length(templateRemainder));
    result = $.concatenate(result, refReplacement);
  }
  return result;
}

// lib/dynajs/analyses/flow/spec/AO__IsConcatSpreadable.ts
function AO__IsConcatSpreadable($, O) {
  if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 564, $.isType(O, "object")))) {
    return $.default(false, []);
  }
  var spreadable = AO__Get($, O, $.default(Symbol.isConcatSpreadable, []));
  if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 565, $.is(spreadable, $.default(void 0, []))))) {
    return AO__ToBoolean($, spreadable);
  }
  return AO__IsArray($, O);
}

// lib/dynajs/analyses/flow/spec/AO__IsRegExp.manual.ts
function AO__IsRegExp($, argument) {
  if (!$.value($.isType(argument, "object"))) {
    return $.default(false, []);
  }
  return $.default($.value(argument) instanceof RegExp, []);
}

// lib/dynajs/analyses/flow/spec/BigInt__equal.ts
function BigInt__equal($, x, y) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 6, $.is(x, y)))) {
    return $.default(true, []);
  } else {
    return $.default(false, []);
  }
}

// lib/dynajs/analyses/flow/spec/AO__SameValueNonNumber.ts
function AO__SameValueNonNumber($, x, y) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 729, $.is(x, $.default(null, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 730, $.is(x, $.default(void 0, []))))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 731, $.isType(x, "bigint")))) {
    return BigInt__equal($, x, y);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 732, $.isType(x, "string")))) {
    return $.is(x, y);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 733, $.isType(x, "boolean")))) {
    return $.is(x, y);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 734, $.is(x, y)))) {
    return $.default(true, []);
  } else {
    return $.default(false, []);
  }
}

// lib/dynajs/analyses/flow/spec/Number__equal.ts
function Number__equal($, x, y) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 633, $.isNaN(x)))) {
    return $.default(false, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 634, $.isNaN(y)))) {
    return $.default(false, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 635, $.is(x, y)))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 636, $.is(x, $.default(0, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 637, $.is(y, $.default(0, []))))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 638, $.is(x, $.default(0, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 639, $.is(y, $.default(0, []))))) {
    return $.default(true, []);
  }
  return $.default(false, []);
}

// lib/dynajs/analyses/flow/spec/AO__IsStrictlyEqual.ts
function AO__IsStrictlyEqual($, x, y) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 596, $.is(AO__SameType($, x, y), $.default(false, []))))) {
    return $.default(false, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 597, $.isType(x, "number")))) {
    return Number__equal($, x, y);
  }
  return AO__SameValueNonNumber($, x, y);
}

// lib/dynajs/analyses/flow/spec/AO__IsStringWellFormedUnicode.ts
function AO__IsStringWellFormedUnicode($, string) {
  var len = $.length(string);
  var k = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 598, $.lessThan(k, len)))) {
    var cp = AO__CodePointAt($, string, k);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 599, $.is(cp[
      "IsUnpairedSurrogate"
      /* TODO INTERNAL : internal access */
    ], $.default(true, []))))) {
      return $.default(false, []);
    }
    k = $.add(k, cp[
      "CodeUnitCount"
      /* TODO INTERNAL : internal access */
    ]);
  }
  return $.default(true, []);
}

// lib/dynajs/analyses/flow/spec/Number__sameValueZero.ts
function Number__sameValueZero($, x, y) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 659, $.isNaN(x))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 660, $.isNaN(y)))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 661, $.is(x, $.default(0, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 662, $.is(y, $.default(0, []))))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 663, $.is(x, $.default(0, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 664, $.is(y, $.default(0, []))))) {
    return $.default(true, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 665, $.is(x, y)))) {
    return $.default(true, []);
  }
  return $.default(false, []);
}

// lib/dynajs/analyses/flow/spec/AO__SameValueZero.ts
function AO__SameValueZero($, x, y) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 735, $.is(AO__SameType($, x, y), $.default(false, []))))) {
    return $.default(false, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 736, $.isType(x, "number")))) {
    return Number__sameValueZero($, x, y);
  }
  return AO__SameValueNonNumber($, x, y);
}

// lib/dynajs/analyses/flow/spec/AO__Set.manual.ts
function AO__Set($, O, P, V, Throw) {
  "use strict";
  const Ou = $.value(O);
  const Pu = $.value(P);
  const storeRaw = ArrayBuffer.isView(Ou) || Pu === "length";
  try {
    Ou[Pu] = storeRaw ? $.value(V) : V;
  } catch (error) {
    if (Throw) throw error;
  }
}

// lib/dynajs/analyses/flow/spec/AO__SortIndexedProperties.ts
function AO__SortIndexedProperties($, obj, len, SortCompare, holes) {
  var items = [];
  var k = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 771, $.lessThan(k, len)))) {
    var Pk = AO__ToString($, k);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 772, $.is(holes, $.default("skip-holes", []))))) {
      var kRead = AO__HasProperty($, obj, Pk);
    } else {
      var kRead = $.default(true, []);
    }
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 773, $.is(kRead, $.default(true, []))))) {
      var kValue = AO__Get($, obj, Pk);
      $.append(items, kValue);
    }
    k = $.add(k, $.default(1, []));
  }
  items.sort((x, y) => $.value(SortCompare(x, y)));
  return items;
}

// lib/dynajs/analyses/flow/spec/AO__StringCreate.manual.ts
function AO__StringCreate($, value, prototype) {
  const S = new String($.value(value));
  Object.setPrototypeOf(S, prototype);
  return $.default(S, [value, prototype]);
}

// lib/dynajs/analyses/flow/spec/AO__StringLastIndexOf.ts
function AO__StringLastIndexOf($, string, searchValue, fromIndex) {
  var len = $.length(string);
  var searchLen = $.length(searchValue);
  for (var i of $.range($.default(0, []), true, fromIndex, true, false, Number.MAX_SAFE_INTEGER - 784)) {
    var candidate = $.substring(string, i, $.add(i, searchLen));
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 783, $.is(candidate, searchValue)))) {
      return i;
    }
  }
  return $.default("not-found", []);
}

// lib/dynajs/analyses/flow/spec/AO__StringPad.ts
function AO__StringPad($, S, maxLength, fillString, placement) {
  var stringLength = $.length(S);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 785, $.lessThanEqual(maxLength, stringLength)))) {
    return S;
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 786, $.is(fillString, $.default("", []))))) {
    return S;
  }
  var fillLen = $.subtract(maxLength, stringLength);
  var truncatedStringFiller = $.default(String($.value(fillString)).repeat(Math.ceil($.value(fillLen) / String($.value(fillString)).length)).slice(0, $.value(fillLen)), [fillString, fillLen]);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 787, $.is(placement, $.default("start", []))))) {
    return $.concatenate(truncatedStringFiller, S);
  } else {
    return $.concatenate(S, truncatedStringFiller);
  }
}

// lib/dynajs/analyses/flow/spec/AO__StringPaddingBuiltinsImpl.ts
function AO__StringPaddingBuiltinsImpl($, O, maxLength, fillString, placement) {
  var S = AO__ToString($, O);
  var intMaxLength = AO__ToLength($, maxLength);
  var stringLength = $.length(S);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 788, $.lessThanEqual(intMaxLength, stringLength)))) {
    return S;
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 789, $.is(fillString, $.default(void 0, []))))) {
    fillString = $.default(" ", []);
  } else {
    fillString = AO__ToString($, fillString);
  }
  return AO__StringPad($, S, intMaxLength, fillString, placement);
}

// lib/dynajs/analyses/flow/spec/AO__SymbolDescriptiveString.manual.ts
function AO__SymbolDescriptiveString($, sym) {
  var desc = $.default($.value(sym).description, []);
  if ($.value($.is(desc, $.default(void 0, [])))) {
    desc = $.default("", []);
  }
  return $.concatenate($.concatenate($.default("Symbol(", []), desc), $.default(")", []));
}

// lib/dynajs/analyses/flow/spec/AO__ThisStringValue.ts
function AO__ThisStringValue($, value) {
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 792, $.isType(value, "string")))) {
    return value;
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 793, $.isType(value, "object"))) && $.value(value) instanceof String) {
    var s = $.default($.value(value).valueOf(), [value]);
    return s;
  }
  throw new TypeError();
}

// lib/dynajs/analyses/flow/spec/AO__ToUint16.ts
function AO__ToUint16($, argument) {
  var number = AO__ToNumber($, argument);
  if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 830, $.isFinite(number))) || ($.value($.condition(Number.MAX_SAFE_INTEGER - 831, $.is(number, $.default(0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 832, $.is(number, $.default(0, [])))))) {
    return $.default(0, []);
  }
  var int = $.truncate(number);
  var int16bit = $.remainder(int, $.exponentiate($.default(2, []), $.default(16, [])));
  return int16bit;
}

// lib/dynajs/analyses/flow/spec/AO__ToUint32.manual.ts
function AO__ToUint32($, arg) {
  let number = AO__ToNumber($, arg);
  let numberUnlifted = $.value(number);
  if (!Number.isFinite(numberUnlifted) || numberUnlifted === 0) {
    return $.default(0, [arg]);
  }
  let int_ = Math.trunc(numberUnlifted);
  var MOD = 4294967296;
  let int32bit = (int_ % MOD + MOD) % MOD;
  return $.default(int32bit, [arg]);
}

// lib/dynajs/analyses/flow/spec/AO__TrimString.ts
function AO__TrimString($, string, where) {
  var str = AO__RequireObjectCoercible($, string);
  var S = AO__ToString($, str);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 836, $.is(where, $.default("start", []))))) {
    var T = $.trim(S, true, false);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 837, $.is(where, $.default("end", []))))) {
      var T = $.trim(S, false, true);
    } else {
      var T = $.trim(S, true, true);
    }
  }
  return T;
}

// lib/dynajs/analyses/flow/spec/AO__UTF16EncodeCodePoint.manual.ts
function AO__UTF16EncodeCodePoint($, cp) {
  return $.default(String.fromCodePoint(Number($.value(cp))), [cp]);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.isArray.ts
function INTRINSICS_Array_isArray($, $this, arg) {
  return AO__IsArray($, arg);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.of.ts
function INTRINSICS_Array_of($, $this, ...items) {
  var len = $.default(items.length, []);
  var lenNumber = len;
  var C = $this;
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 114, $.is(AO__IsConstructor($, C), $.default(true, []))))) {
    var A = AO__Construct($, C, [lenNumber]);
  } else {
    var A = AO__ArrayCreate($, len);
  }
  var k = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 115, $.lessThan(k, len)))) {
    var kValue = items[k];
    var Pk = AO__ToString($, k);
    AO__CreateDataPropertyOrThrow($, A, Pk, kValue);
    k = $.add(k, $.default(1, []));
  }
  AO__Set($, A, $.default("length", []), lenNumber, $.default(true, []));
  return A;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.at.ts
function INTRINSICS_Array_prototype_at($, $this, index) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var relativeIndex = AO__ToIntegerOrInfinity($, index);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 116, $.greaterThanEqual(relativeIndex, $.default(0, []))))) {
    var k = relativeIndex;
  } else {
    var k = $.add(len, relativeIndex);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 117, $.lessThan(k, $.default(0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 118, $.greaterThanEqual(k, len)))) {
    return $.default(void 0, []);
  }
  return AO__Get($, O, AO__ToString($, k));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.concat.ts
function INTRINSICS_Array_prototype_concat($, $this, ...items) {
  var O = AO__ToObject($, $this);
  var A = AO__ArraySpeciesCreate($, O, $.default(0, []));
  var n = $.default(0, []);
  $.prepend(items, O);
  for (var E of items) {
    var spreadable = AO__IsConcatSpreadable($, E);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 119, $.is(spreadable, $.default(true, []))))) {
      var len = AO__LengthOfArrayLike($, E);
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 120, $.greaterThan($.add(n, len), $.subtract($.exponentiate($.default(2, []), $.default(53, [])), $.default(1, [])))))) {
        throw new TypeError();
      }
      var k = $.default(0, []);
      while ($.value($.condition(Number.MAX_SAFE_INTEGER - 121, $.lessThan(k, len)))) {
        var Pk = AO__ToString($, k);
        var exists = AO__HasProperty($, E, Pk);
        if ($.value($.condition(Number.MAX_SAFE_INTEGER - 122, $.is(exists, $.default(true, []))))) {
          var subElement = AO__Get($, E, Pk);
          AO__CreateDataPropertyOrThrow($, A, AO__ToString($, n), subElement);
        }
        n = $.add(n, $.default(1, []));
        k = $.add(k, $.default(1, []));
      }
    } else {
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 123, $.greaterThanEqual(n, $.subtract($.exponentiate($.default(2, []), $.default(53, [])), $.default(1, [])))))) {
        throw new TypeError();
      }
      AO__CreateDataPropertyOrThrow($, A, AO__ToString($, n), E);
      n = $.add(n, $.default(1, []));
    }
  }
  AO__Set($, A, $.default("length", []), n, $.default(true, []));
  return A;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.copyWithin.ts
function INTRINSICS_Array_prototype_copyWithin($, $this, target, start, end = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var relativeTarget = AO__ToIntegerOrInfinity($, target);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 124, $.is(relativeTarget, $.default(-Infinity, []))))) {
    var to = $.default(0, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 125, $.lessThan(relativeTarget, $.default(0, []))))) {
      var to = $.max($.add(len, relativeTarget), $.default(0, []));
    } else {
      var to = $.min(relativeTarget, len);
    }
  }
  var relativeStart = AO__ToIntegerOrInfinity($, start);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 126, $.is(relativeStart, $.default(-Infinity, []))))) {
    var from = $.default(0, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 127, $.lessThan(relativeStart, $.default(0, []))))) {
      var from = $.max($.add(len, relativeStart), $.default(0, []));
    } else {
      var from = $.min(relativeStart, len);
    }
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 128, $.is(end, $.default(void 0, []))))) {
    var relativeEnd = len;
  } else {
    var relativeEnd = AO__ToIntegerOrInfinity($, end);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 129, $.is(relativeEnd, $.default(-Infinity, []))))) {
    var final = $.default(0, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 130, $.lessThan(relativeEnd, $.default(0, []))))) {
      var final = $.max($.add(len, relativeEnd), $.default(0, []));
    } else {
      var final = $.min(relativeEnd, len);
    }
  }
  var count = $.min($.subtract(final, from), $.subtract(len, to));
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 131, $.lessThan(from, to))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 132, $.lessThan(to, $.add(from, count))))) {
    var direction = $.negate($.default(1, []));
    from = $.subtract($.add(from, count), $.default(1, []));
    to = $.subtract($.add(to, count), $.default(1, []));
  } else {
    var direction = $.default(1, []);
  }
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 133, $.greaterThan(count, $.default(0, []))))) {
    var fromKey = AO__ToString($, from);
    var toKey = AO__ToString($, to);
    var fromPresent = AO__HasProperty($, O, fromKey);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 134, $.is(fromPresent, $.default(true, []))))) {
      var fromValue = AO__Get($, O, fromKey);
      AO__Set($, O, toKey, fromValue, $.default(true, []));
    } else {
      AO__DeletePropertyOrThrow($, O, toKey);
    }
    from = $.add(from, direction);
    to = $.add(to, direction);
    count = $.subtract(count, $.default(1, []));
  }
  return O;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.every.ts
function INTRINSICS_Array_prototype_every($, $this, callback, thisArg = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 135, $.is(AO__IsCallable($, callback), $.default(false, []))))) {
    throw new TypeError();
  }
  var k = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 136, $.lessThan(k, len)))) {
    var Pk = AO__ToString($, k);
    var kPresent = AO__HasProperty($, O, Pk);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 137, $.is(kPresent, $.default(true, []))))) {
      var kValue = AO__Get($, O, Pk);
      var testResult = AO__ToBoolean($, AO__Call($, callback, thisArg, [kValue, k, O]));
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 138, $.is(testResult, $.default(false, []))))) {
        return $.default(false, []);
      }
    }
    k = $.add(k, $.default(1, []));
  }
  return $.default(true, []);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.fill.ts
function INTRINSICS_Array_prototype_fill($, $this, value, start = $.default(void 0, []), end = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var relativeStart = AO__ToIntegerOrInfinity($, start);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 139, $.is(relativeStart, $.default(-Infinity, []))))) {
    var k = $.default(0, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 140, $.lessThan(relativeStart, $.default(0, []))))) {
      var k = $.max($.add(len, relativeStart), $.default(0, []));
    } else {
      var k = $.min(relativeStart, len);
    }
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 141, $.is(end, $.default(void 0, []))))) {
    var relativeEnd = len;
  } else {
    var relativeEnd = AO__ToIntegerOrInfinity($, end);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 142, $.is(relativeEnd, $.default(-Infinity, []))))) {
    var final = $.default(0, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 143, $.lessThan(relativeEnd, $.default(0, []))))) {
      var final = $.max($.add(len, relativeEnd), $.default(0, []));
    } else {
      var final = $.min(relativeEnd, len);
    }
  }
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 144, $.lessThan(k, final)))) {
    var Pk = AO__ToString($, k);
    AO__Set($, O, Pk, value, $.default(true, []));
    k = $.add(k, $.default(1, []));
  }
  return O;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.filter.ts
function INTRINSICS_Array_prototype_filter($, $this, callback, thisArg = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 145, $.is(AO__IsCallable($, callback), $.default(false, []))))) {
    throw new TypeError();
  }
  var A = AO__ArraySpeciesCreate($, O, $.default(0, []));
  var k = $.default(0, []);
  var to = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 146, $.lessThan(k, len)))) {
    var Pk = AO__ToString($, k);
    var kPresent = AO__HasProperty($, O, Pk);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 147, $.is(kPresent, $.default(true, []))))) {
      var kValue = AO__Get($, O, Pk);
      var selected = AO__ToBoolean($, AO__Call($, callback, thisArg, [kValue, k, O]));
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 148, $.is(selected, $.default(true, []))))) {
        AO__CreateDataPropertyOrThrow($, A, AO__ToString($, to), kValue);
        to = $.add(to, $.default(1, []));
      }
    }
    k = $.add(k, $.default(1, []));
  }
  return A;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.find.ts
function INTRINSICS_Array_prototype_find($, $this, predicate, thisArg = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var findRec = AO__FindViaPredicate($, O, len, $.default("ascending", []), predicate, thisArg);
  return findRec[
    "Value"
    /* TODO INTERNAL : internal access */
  ];
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.findIndex.ts
function INTRINSICS_Array_prototype_findIndex($, $this, predicate, thisArg = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var findRec = AO__FindViaPredicate($, O, len, $.default("ascending", []), predicate, thisArg);
  return findRec[
    "Index"
    /* TODO INTERNAL : internal access */
  ];
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.findLast.ts
function INTRINSICS_Array_prototype_findLast($, $this, predicate, thisArg = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var findRec = AO__FindViaPredicate($, O, len, $.default("descending", []), predicate, thisArg);
  return findRec[
    "Value"
    /* TODO INTERNAL : internal access */
  ];
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.findLastIndex.ts
function INTRINSICS_Array_prototype_findLastIndex($, $this, predicate, thisArg = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var findRec = AO__FindViaPredicate($, O, len, $.default("descending", []), predicate, thisArg);
  return findRec[
    "Index"
    /* TODO INTERNAL : internal access */
  ];
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.flat.ts
function INTRINSICS_Array_prototype_flat($, $this, depth = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var sourceLen = AO__LengthOfArrayLike($, O);
  var depthNum = $.default(1, []);
  if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 149, $.is(depth, $.default(void 0, []))))) {
    depthNum = AO__ToIntegerOrInfinity($, depth);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 150, $.lessThan(depthNum, $.default(0, []))))) {
      depthNum = $.default(0, []);
    }
  }
  var A = AO__ArraySpeciesCreate($, O, $.default(0, []));
  AO__FlattenIntoArray($, A, O, sourceLen, $.default(0, []), depthNum);
  return A;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.flatMap.ts
function INTRINSICS_Array_prototype_flatMap($, $this, mapperFunction, thisArg = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var sourceLen = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 151, $.is(AO__IsCallable($, mapperFunction), $.default(false, []))))) {
    throw new TypeError();
  }
  var A = AO__ArraySpeciesCreate($, O, $.default(0, []));
  AO__FlattenIntoArray($, A, O, sourceLen, $.default(0, []), $.default(1, []), mapperFunction, thisArg);
  return A;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.forEach.ts
function INTRINSICS_Array_prototype_forEach($, $this, callback, thisArg = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 152, $.is(AO__IsCallable($, callback), $.default(false, []))))) {
    throw new TypeError();
  }
  var k = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 153, $.lessThan(k, len)))) {
    var Pk = AO__ToString($, k);
    var kPresent = AO__HasProperty($, O, Pk);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 154, $.is(kPresent, $.default(true, []))))) {
      var kValue = AO__Get($, O, Pk);
      AO__Call($, callback, thisArg, [kValue, k, O]);
    }
    k = $.add(k, $.default(1, []));
  }
  return $.default(void 0, []);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.includes.ts
function INTRINSICS_Array_prototype_includes($, $this, searchElement, fromIndex = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 155, $.is(len, $.default(0, []))))) {
    return $.default(false, []);
  }
  var n = AO__ToIntegerOrInfinity($, fromIndex);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 156, $.is(n, $.default(Infinity, []))))) {
    return $.default(false, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 157, $.is(n, $.default(-Infinity, []))))) {
      n = $.default(0, []);
    }
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 158, $.greaterThanEqual(n, $.default(0, []))))) {
    var k = n;
  } else {
    var k = $.add(len, n);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 159, $.lessThan(k, $.default(0, []))))) {
      k = $.default(0, []);
    }
  }
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 160, $.lessThan(k, len)))) {
    var elementK = AO__Get($, O, AO__ToString($, k));
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 161, $.is(AO__SameValueZero($, searchElement, elementK), $.default(true, []))))) {
      return $.default(true, []);
    }
    k = $.add(k, $.default(1, []));
  }
  return $.default(false, []);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.indexOf.ts
function INTRINSICS_Array_prototype_indexOf($, $this, searchElement, fromIndex = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 162, $.is(len, $.default(0, []))))) {
    return $.default(-1, []);
  }
  var n = AO__ToIntegerOrInfinity($, fromIndex);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 163, $.is(n, $.default(Infinity, []))))) {
    return $.default(-1, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 164, $.is(n, $.default(-Infinity, []))))) {
      n = $.default(0, []);
    }
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 165, $.greaterThanEqual(n, $.default(0, []))))) {
    var k = n;
  } else {
    var k = $.add(len, n);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 166, $.lessThan(k, $.default(0, []))))) {
      k = $.default(0, []);
    }
  }
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 167, $.lessThan(k, len)))) {
    var Pk = AO__ToString($, k);
    var kPresent = AO__HasProperty($, O, Pk);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 168, $.is(kPresent, $.default(true, []))))) {
      var elementK = AO__Get($, O, Pk);
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 169, $.is(AO__IsStrictlyEqual($, searchElement, elementK), $.default(true, []))))) {
        return k;
      }
    }
    k = $.add(k, $.default(1, []));
  }
  return $.default(-1, []);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.join.ts
function INTRINSICS_Array_prototype_join($, $this, separator) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 170, $.is(separator, $.default(void 0, []))))) {
    var sep = $.default(",", []);
  } else {
    var sep = AO__ToString($, separator);
  }
  var R = $.default("", []);
  var k = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 171, $.lessThan(k, len)))) {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 172, $.greaterThan(k, $.default(0, []))))) {
      R = $.concatenate(R, sep);
    }
    var element = AO__Get($, O, AO__ToString($, k));
    if (!($.value($.condition(Number.MAX_SAFE_INTEGER - 173, $.is(element, $.default(void 0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 174, $.is(element, $.default(null, [])))))) {
      var S = AO__ToString($, element);
      R = $.concatenate(R, S);
    }
    k = $.add(k, $.default(1, []));
  }
  return R;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.lastIndexOf.ts
function INTRINSICS_Array_prototype_lastIndexOf($, $this, searchElement, fromIndex = $.default(void 0, [])) {
  var fromIndexIsPresent = arguments.length > 3;
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 175, $.is(len, $.default(0, []))))) {
    return $.default(-1, []);
  }
  if (fromIndexIsPresent) {
    var n = AO__ToIntegerOrInfinity($, fromIndex);
  } else {
    var n = $.subtract(len, $.default(1, []));
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 176, $.is(n, $.default(-Infinity, []))))) {
    return $.default(-1, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 177, $.greaterThanEqual(n, $.default(0, []))))) {
    var k = $.min(n, $.subtract(len, $.default(1, [])));
  } else {
    var k = $.add(len, n);
  }
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 178, $.greaterThanEqual(k, $.default(0, []))))) {
    var Pk = AO__ToString($, k);
    var kPresent = AO__HasProperty($, O, Pk);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 179, $.is(kPresent, $.default(true, []))))) {
      var elementK = AO__Get($, O, Pk);
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 180, $.is(AO__IsStrictlyEqual($, searchElement, elementK), $.default(true, []))))) {
        return k;
      }
    }
    k = $.subtract(k, $.default(1, []));
  }
  return $.default(-1, []);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.map.ts
function INTRINSICS_Array_prototype_map($, $this, callback, thisArg = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 181, $.is(AO__IsCallable($, callback), $.default(false, []))))) {
    throw new TypeError();
  }
  var A = AO__ArraySpeciesCreate($, O, len);
  var k = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 182, $.lessThan(k, len)))) {
    var Pk = AO__ToString($, k);
    var kPresent = AO__HasProperty($, O, Pk);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 183, $.is(kPresent, $.default(true, []))))) {
      var kValue = AO__Get($, O, Pk);
      var mappedValue = AO__Call($, callback, thisArg, [kValue, k, O]);
      AO__CreateDataPropertyOrThrow($, A, Pk, mappedValue);
    }
    k = $.add(k, $.default(1, []));
  }
  return A;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.pop.ts
function INTRINSICS_Array_prototype_pop($, $this) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 184, $.is(len, $.default(0, []))))) {
    AO__Set($, O, $.default("length", []), $.default(0, []), $.default(true, []));
    return $.default(void 0, []);
  } else {
    var newLen = $.subtract(len, $.default(1, []));
    var index = AO__ToString($, newLen);
    var element = AO__Get($, O, index);
    AO__DeletePropertyOrThrow($, O, index);
    AO__Set($, O, $.default("length", []), newLen, $.default(true, []));
    return element;
  }
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.push.ts
function INTRINSICS_Array_prototype_push($, $this, ...items) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var argCount = $.default(items.length, []);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 185, $.greaterThan($.add(len, argCount), $.subtract($.exponentiate($.default(2, []), $.default(53, [])), $.default(1, [])))))) {
    throw new TypeError();
  }
  for (var E of items) {
    AO__Set($, O, AO__ToString($, len), E, $.default(true, []));
    len = $.add(len, $.default(1, []));
  }
  AO__Set($, O, $.default("length", []), len, $.default(true, []));
  return len;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.reduce.ts
function INTRINSICS_Array_prototype_reduce($, $this, callback, initialValue = $.default(void 0, [])) {
  var initialValueIsPresent = arguments.length > 3;
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 186, $.is(AO__IsCallable($, callback), $.default(false, []))))) {
    throw new TypeError();
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 187, $.is(len, $.default(0, [])))) && !initialValueIsPresent) {
    throw new TypeError();
  }
  var k = $.default(0, []);
  var accumulator = $.default(void 0, []);
  if (initialValueIsPresent) {
    accumulator = initialValue;
  } else {
    var kPresent = $.default(false, []);
    while ($.value($.condition(Number.MAX_SAFE_INTEGER - 188, $.is(kPresent, $.default(false, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 189, $.lessThan(k, len)))) {
      var Pk = AO__ToString($, k);
      kPresent = AO__HasProperty($, O, Pk);
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 190, $.is(kPresent, $.default(true, []))))) {
        accumulator = AO__Get($, O, Pk);
      }
      k = $.add(k, $.default(1, []));
    }
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 191, $.is(kPresent, $.default(false, []))))) {
      throw new TypeError();
    }
  }
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 192, $.lessThan(k, len)))) {
    var Pk = AO__ToString($, k);
    var kPresent = AO__HasProperty($, O, Pk);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 193, $.is(kPresent, $.default(true, []))))) {
      var kValue = AO__Get($, O, Pk);
      accumulator = AO__Call($, callback, $.default(void 0, []), [accumulator, kValue, k, O]);
    }
    k = $.add(k, $.default(1, []));
  }
  return accumulator;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.reduceRight.ts
function INTRINSICS_Array_prototype_reduceRight($, $this, callback, initialValue = $.default(void 0, [])) {
  var initialValueIsPresent = arguments.length > 3;
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 194, $.is(AO__IsCallable($, callback), $.default(false, []))))) {
    throw new TypeError();
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 195, $.is(len, $.default(0, [])))) && !initialValueIsPresent) {
    throw new TypeError();
  }
  var k = $.subtract(len, $.default(1, []));
  var accumulator = $.default(void 0, []);
  if (initialValueIsPresent) {
    accumulator = initialValue;
  } else {
    var kPresent = $.default(false, []);
    while ($.value($.condition(Number.MAX_SAFE_INTEGER - 196, $.is(kPresent, $.default(false, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 197, $.greaterThanEqual(k, $.default(0, []))))) {
      var Pk = AO__ToString($, k);
      kPresent = AO__HasProperty($, O, Pk);
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 198, $.is(kPresent, $.default(true, []))))) {
        accumulator = AO__Get($, O, Pk);
      }
      k = $.subtract(k, $.default(1, []));
    }
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 199, $.is(kPresent, $.default(false, []))))) {
      throw new TypeError();
    }
  }
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 200, $.greaterThanEqual(k, $.default(0, []))))) {
    var Pk = AO__ToString($, k);
    var kPresent = AO__HasProperty($, O, Pk);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 201, $.is(kPresent, $.default(true, []))))) {
      var kValue = AO__Get($, O, Pk);
      accumulator = AO__Call($, callback, $.default(void 0, []), [accumulator, kValue, k, O]);
    }
    k = $.subtract(k, $.default(1, []));
  }
  return accumulator;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.reverse.ts
function INTRINSICS_Array_prototype_reverse($, $this) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var middle = $.floor($.divide(len, $.default(2, [])));
  var lower = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 202, $.isNot(lower, middle)))) {
    var upper = $.subtract($.subtract(len, lower), $.default(1, []));
    var upperP = AO__ToString($, upper);
    var lowerP = AO__ToString($, lower);
    var lowerExists = AO__HasProperty($, O, lowerP);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 203, $.is(lowerExists, $.default(true, []))))) {
      var lowerValue = AO__Get($, O, lowerP);
    }
    var upperExists = AO__HasProperty($, O, upperP);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 204, $.is(upperExists, $.default(true, []))))) {
      var upperValue = AO__Get($, O, upperP);
    }
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 205, $.is(lowerExists, $.default(true, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 206, $.is(upperExists, $.default(true, []))))) {
      AO__Set($, O, lowerP, upperValue, $.default(true, []));
      AO__Set($, O, upperP, lowerValue, $.default(true, []));
    } else {
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 207, $.is(lowerExists, $.default(false, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 208, $.is(upperExists, $.default(true, []))))) {
        AO__Set($, O, lowerP, upperValue, $.default(true, []));
        AO__DeletePropertyOrThrow($, O, upperP);
      } else {
        if ($.value($.condition(Number.MAX_SAFE_INTEGER - 209, $.is(lowerExists, $.default(true, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 210, $.is(upperExists, $.default(false, []))))) {
          AO__DeletePropertyOrThrow($, O, lowerP);
          AO__Set($, O, upperP, lowerValue, $.default(true, []));
        } else {
        }
      }
    }
    lower = $.add(lower, $.default(1, []));
  }
  return O;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.shift.ts
function INTRINSICS_Array_prototype_shift($, $this) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 211, $.is(len, $.default(0, []))))) {
    AO__Set($, O, $.default("length", []), $.default(0, []), $.default(true, []));
    return $.default(void 0, []);
  }
  var first = AO__Get($, O, $.default("0", []));
  var k = $.default(1, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 212, $.lessThan(k, len)))) {
    var from = AO__ToString($, k);
    var to = AO__ToString($, $.subtract(k, $.default(1, [])));
    var fromPresent = AO__HasProperty($, O, from);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 213, $.is(fromPresent, $.default(true, []))))) {
      var fromValue = AO__Get($, O, from);
      AO__Set($, O, to, fromValue, $.default(true, []));
    } else {
      AO__DeletePropertyOrThrow($, O, to);
    }
    k = $.add(k, $.default(1, []));
  }
  AO__DeletePropertyOrThrow($, O, AO__ToString($, $.subtract(len, $.default(1, []))));
  AO__Set($, O, $.default("length", []), $.subtract(len, $.default(1, [])), $.default(true, []));
  return first;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.slice.ts
function INTRINSICS_Array_prototype_slice($, $this, start, end) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var relativeStart = AO__ToIntegerOrInfinity($, start);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 214, $.is(relativeStart, $.default(-Infinity, []))))) {
    var k = $.default(0, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 215, $.lessThan(relativeStart, $.default(0, []))))) {
      var k = $.max($.add(len, relativeStart), $.default(0, []));
    } else {
      var k = $.min(relativeStart, len);
    }
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 216, $.is(end, $.default(void 0, []))))) {
    var relativeEnd = len;
  } else {
    var relativeEnd = AO__ToIntegerOrInfinity($, end);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 217, $.is(relativeEnd, $.default(-Infinity, []))))) {
    var final = $.default(0, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 218, $.lessThan(relativeEnd, $.default(0, []))))) {
      var final = $.max($.add(len, relativeEnd), $.default(0, []));
    } else {
      var final = $.min(relativeEnd, len);
    }
  }
  var count = $.max($.subtract(final, k), $.default(0, []));
  var A = AO__ArraySpeciesCreate($, O, count);
  var n = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 219, $.lessThan(k, final)))) {
    var Pk = AO__ToString($, k);
    var kPresent = AO__HasProperty($, O, Pk);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 220, $.is(kPresent, $.default(true, []))))) {
      var kValue = AO__Get($, O, Pk);
      AO__CreateDataPropertyOrThrow($, A, AO__ToString($, n), kValue);
    }
    k = $.add(k, $.default(1, []));
    n = $.add(n, $.default(1, []));
  }
  AO__Set($, A, $.default("length", []), n, $.default(true, []));
  return A;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.some.ts
function INTRINSICS_Array_prototype_some($, $this, callback, thisArg = $.default(void 0, [])) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 221, $.is(AO__IsCallable($, callback), $.default(false, []))))) {
    throw new TypeError();
  }
  var k = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 222, $.lessThan(k, len)))) {
    var Pk = AO__ToString($, k);
    var kPresent = AO__HasProperty($, O, Pk);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 223, $.is(kPresent, $.default(true, []))))) {
      var kValue = AO__Get($, O, Pk);
      var testResult = AO__ToBoolean($, AO__Call($, callback, thisArg, [kValue, k, O]));
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 224, $.is(testResult, $.default(true, []))))) {
        return $.default(true, []);
      }
    }
    k = $.add(k, $.default(1, []));
  }
  return $.default(false, []);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.sort.ts
function INTRINSICS_Array_prototype_sort($, $this, comparator) {
  if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 225, $.is(comparator, $.default(void 0, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 226, $.is(AO__IsCallable($, comparator), $.default(false, []))))) {
    throw new TypeError();
  }
  var obj = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, obj);
  var SortCompare = (() => {
    var _self = $.default(
      /* ABSTRACT_CLOSURE */
      (x, y) => {
        return AO__CompareArrayElements($, x, y, comparator);
      },
      [comparator]
    );
    return _self;
  })();
  var sortedList = AO__SortIndexedProperties($, obj, len, SortCompare, $.default("skip-holes", []));
  var itemCount = $.default(sortedList.length, []);
  var j = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 227, $.lessThan(j, itemCount)))) {
    AO__Set($, obj, AO__ToString($, j), sortedList[j], $.default(true, []));
    j = $.add(j, $.default(1, []));
  }
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 228, $.lessThan(j, len)))) {
    AO__DeletePropertyOrThrow($, obj, AO__ToString($, j));
    j = $.add(j, $.default(1, []));
  }
  return obj;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.splice.ts
function INTRINSICS_Array_prototype_splice($, $this, start, deleteCount, ...items) {
  var startIsPresent = arguments.length > 2;
  var deleteCountIsPresent = arguments.length > 3;
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var relativeStart = AO__ToIntegerOrInfinity($, start);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 229, $.is(relativeStart, $.default(-Infinity, []))))) {
    var actualStart = $.default(0, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 230, $.lessThan(relativeStart, $.default(0, []))))) {
      var actualStart = $.max($.add(len, relativeStart), $.default(0, []));
    } else {
      var actualStart = $.min(relativeStart, len);
    }
  }
  var itemCount = $.default(items.length, []);
  if (!startIsPresent) {
    var actualDeleteCount = $.default(0, []);
  } else {
    if (!deleteCountIsPresent) {
      var actualDeleteCount = $.subtract(len, actualStart);
    } else {
      var dc = AO__ToIntegerOrInfinity($, deleteCount);
      var actualDeleteCount = $.clamp(dc, $.default(0, []), $.subtract(len, actualStart));
    }
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 231, $.greaterThan($.subtract($.add(len, itemCount), actualDeleteCount), $.subtract($.exponentiate($.default(2, []), $.default(53, [])), $.default(1, [])))))) {
    throw new TypeError();
  }
  var A = AO__ArraySpeciesCreate($, O, actualDeleteCount);
  var k = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 232, $.lessThan(k, actualDeleteCount)))) {
    var from = AO__ToString($, $.add(actualStart, k));
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 233, $.is(AO__HasProperty($, O, from), $.default(true, []))))) {
      var fromValue = AO__Get($, O, from);
      AO__CreateDataPropertyOrThrow($, A, AO__ToString($, k), fromValue);
    }
    k = $.add(k, $.default(1, []));
  }
  AO__Set($, A, $.default("length", []), actualDeleteCount, $.default(true, []));
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 234, $.lessThan(itemCount, actualDeleteCount)))) {
    k = actualStart;
    while ($.value($.condition(Number.MAX_SAFE_INTEGER - 235, $.lessThan(k, $.subtract(len, actualDeleteCount))))) {
      var from = AO__ToString($, $.add(k, actualDeleteCount));
      var to = AO__ToString($, $.add(k, itemCount));
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 236, $.is(AO__HasProperty($, O, from), $.default(true, []))))) {
        var fromValue = AO__Get($, O, from);
        AO__Set($, O, to, fromValue, $.default(true, []));
      } else {
        AO__DeletePropertyOrThrow($, O, to);
      }
      k = $.add(k, $.default(1, []));
    }
    k = len;
    while ($.value($.condition(Number.MAX_SAFE_INTEGER - 237, $.greaterThan(k, $.add($.subtract(len, actualDeleteCount), itemCount))))) {
      AO__DeletePropertyOrThrow($, O, AO__ToString($, $.subtract(k, $.default(1, []))));
      k = $.subtract(k, $.default(1, []));
    }
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 238, $.greaterThan(itemCount, actualDeleteCount)))) {
      k = $.subtract(len, actualDeleteCount);
      while ($.value($.condition(Number.MAX_SAFE_INTEGER - 239, $.greaterThan(k, actualStart)))) {
        var from = AO__ToString($, $.subtract($.add(k, actualDeleteCount), $.default(1, [])));
        var to = AO__ToString($, $.subtract($.add(k, itemCount), $.default(1, [])));
        if ($.value($.condition(Number.MAX_SAFE_INTEGER - 240, $.is(AO__HasProperty($, O, from), $.default(true, []))))) {
          var fromValue = AO__Get($, O, from);
          AO__Set($, O, to, fromValue, $.default(true, []));
        } else {
          AO__DeletePropertyOrThrow($, O, to);
        }
        k = $.subtract(k, $.default(1, []));
      }
    }
  }
  k = actualStart;
  for (var E of items) {
    AO__Set($, O, AO__ToString($, k), E, $.default(true, []));
    k = $.add(k, $.default(1, []));
  }
  AO__Set($, O, $.default("length", []), $.add($.subtract(len, actualDeleteCount), itemCount), $.default(true, []));
  return A;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.toReversed.ts
function INTRINSICS_Array_prototype_toReversed($, $this) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var A = AO__ArrayCreate($, len);
  var k = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 245, $.lessThan(k, len)))) {
    var from = AO__ToString($, $.subtract($.subtract(len, k), $.default(1, [])));
    var Pk = AO__ToString($, k);
    var fromValue = AO__Get($, O, from);
    AO__CreateDataPropertyOrThrow($, A, Pk, fromValue);
    k = $.add(k, $.default(1, []));
  }
  return A;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.toSorted.ts
function INTRINSICS_Array_prototype_toSorted($, $this, comparator) {
  if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 246, $.is(comparator, $.default(void 0, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 247, $.is(AO__IsCallable($, comparator), $.default(false, []))))) {
    throw new TypeError();
  }
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var A = AO__ArrayCreate($, len);
  var SortCompare = (() => {
    var _self = $.default(
      /* ABSTRACT_CLOSURE */
      (x, y) => {
        return AO__CompareArrayElements($, x, y, comparator);
      },
      [comparator]
    );
    return _self;
  })();
  var sortedList = AO__SortIndexedProperties($, O, len, SortCompare, $.default("read-through-holes", []));
  var j = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 248, $.lessThan(j, len)))) {
    AO__CreateDataPropertyOrThrow($, A, AO__ToString($, j), sortedList[j]);
    j = $.add(j, $.default(1, []));
  }
  return A;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.toSpliced.ts
function INTRINSICS_Array_prototype_toSpliced($, $this, start, skipCount, ...items) {
  var startIsPresent = arguments.length > 2;
  var skipCountIsPresent = arguments.length > 3;
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var relativeStart = AO__ToIntegerOrInfinity($, start);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 249, $.is(relativeStart, $.default(-Infinity, []))))) {
    var actualStart = $.default(0, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 250, $.lessThan(relativeStart, $.default(0, []))))) {
      var actualStart = $.max($.add(len, relativeStart), $.default(0, []));
    } else {
      var actualStart = $.min(relativeStart, len);
    }
  }
  var insertCount = $.default(items.length, []);
  if (!startIsPresent) {
    var actualSkipCount = $.default(0, []);
  } else {
    if (!skipCountIsPresent) {
      var actualSkipCount = $.subtract(len, actualStart);
    } else {
      var sc = AO__ToIntegerOrInfinity($, skipCount);
      var actualSkipCount = $.clamp(sc, $.default(0, []), $.subtract(len, actualStart));
    }
  }
  var newLen = $.subtract($.add(len, insertCount), actualSkipCount);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 251, $.greaterThan(newLen, $.subtract($.exponentiate($.default(2, []), $.default(53, [])), $.default(1, [])))))) {
    throw new TypeError();
  }
  var A = AO__ArrayCreate($, newLen);
  var i = $.default(0, []);
  var r = $.add(actualStart, actualSkipCount);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 252, $.lessThan(i, actualStart)))) {
    var Pi = AO__ToString($, i);
    var iValue = AO__Get($, O, Pi);
    AO__CreateDataPropertyOrThrow($, A, Pi, iValue);
    i = $.add(i, $.default(1, []));
  }
  for (var E of items) {
    var Pi = AO__ToString($, i);
    AO__CreateDataPropertyOrThrow($, A, Pi, E);
    i = $.add(i, $.default(1, []));
  }
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 253, $.lessThan(i, newLen)))) {
    var Pi = AO__ToString($, i);
    var from = AO__ToString($, r);
    var fromValue = AO__Get($, O, from);
    AO__CreateDataPropertyOrThrow($, A, Pi, fromValue);
    i = $.add(i, $.default(1, []));
    r = $.add(r, $.default(1, []));
  }
  return A;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.toString.ts
function INTRINSICS_Array_prototype_toString($, $this) {
  var array = AO__ToObject($, $this);
  var func = AO__Get($, array, $.default("join", []));
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 254, $.is(AO__IsCallable($, func), $.default(false, []))))) {
    func = $.default(Object.prototype.toString, []);
  }
  return AO__Call($, func, array);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.unshift.ts
function INTRINSICS_Array_prototype_unshift($, $this, ...items) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var argCount = $.default(items.length, []);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 255, $.greaterThan(argCount, $.default(0, []))))) {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 256, $.greaterThan($.add(len, argCount), $.subtract($.exponentiate($.default(2, []), $.default(53, [])), $.default(1, [])))))) {
      throw new TypeError();
    }
    var k = len;
    while ($.value($.condition(Number.MAX_SAFE_INTEGER - 257, $.greaterThan(k, $.default(0, []))))) {
      var from = AO__ToString($, $.subtract(k, $.default(1, [])));
      var to = AO__ToString($, $.subtract($.add(k, argCount), $.default(1, [])));
      var fromPresent = AO__HasProperty($, O, from);
      if ($.value($.condition(Number.MAX_SAFE_INTEGER - 258, $.is(fromPresent, $.default(true, []))))) {
        var fromValue = AO__Get($, O, from);
        AO__Set($, O, to, fromValue, $.default(true, []));
      } else {
        AO__DeletePropertyOrThrow($, O, to);
      }
      k = $.subtract(k, $.default(1, []));
    }
    var j = $.default(0, []);
    for (var E of items) {
      AO__Set($, O, AO__ToString($, j), E, $.default(true, []));
      j = $.add(j, $.default(1, []));
    }
  }
  AO__Set($, O, $.default("length", []), $.add(len, argCount), $.default(true, []));
  return $.add(len, argCount);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.Array.prototype.with.ts
function INTRINSICS_Array_prototype_with($, $this, index, value) {
  var O = AO__ToObject($, $this);
  var len = AO__LengthOfArrayLike($, O);
  var relativeIndex = AO__ToIntegerOrInfinity($, index);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 259, $.greaterThanEqual(relativeIndex, $.default(0, []))))) {
    var actualIndex = relativeIndex;
  } else {
    var actualIndex = $.add(len, relativeIndex);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 260, $.greaterThanEqual(actualIndex, len))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 261, $.lessThan(actualIndex, $.default(0, []))))) {
    throw new RangeError();
  }
  var A = AO__ArrayCreate($, len);
  var k = $.default(0, []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 262, $.lessThan(k, len)))) {
    var Pk = AO__ToString($, k);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 263, $.is(k, actualIndex)))) {
      var fromValue = value;
    } else {
      var fromValue = AO__Get($, O, Pk);
    }
    AO__CreateDataPropertyOrThrow($, A, Pk, fromValue);
    k = $.add(k, $.default(1, []));
  }
  return A;
}

// lib/dynajs/analyses/flow/internal/constructable.ts
var CONSTRUCTABLE = /* @__PURE__ */ Symbol.for("dynajs.constructable");
function markConstructable(fn) {
  fn[CONSTRUCTABLE] = true;
}
function isConstructable(fn) {
  return fn[CONSTRUCTABLE] === true;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.ts
function INTRINSICS_String($, $this, value) {
  var valueIsPresent = arguments.length > 2;
  if (!valueIsPresent) {
    var s = $.default("", []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 422, $.is($.default(new.target, []), $.default(void 0, [])))) && $.value($.condition(Number.MAX_SAFE_INTEGER - 423, $.isType(value, "symbol")))) {
      return AO__SymbolDescriptiveString($, value);
    }
    var s = AO__ToString($, value);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 424, $.is($.default(new.target, []), $.default(void 0, []))))) {
    return s;
  }
  return AO__StringCreate($, s, AO__GetPrototypeFromConstructor($, $.default(new.target, []), $.default("%String.prototype%", [])));
}
markConstructable(INTRINSICS_String);

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.fromCharCode.ts
function INTRINSICS_String_fromCharCode($, $this, ...codeUnits) {
  var result = $.default("", []);
  for (var next of codeUnits) {
    var nextCU = AO__ToUint16($, next);
    result = $.concatenate(result, nextCU);
  }
  return result;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.fromCodePoint.ts
function INTRINSICS_String_fromCodePoint($, $this, ...codePoints) {
  var result = $.default("", []);
  for (var next of codePoints) {
    var nextCP = AO__ToNumber($, next);
    if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 425, $.isInteger(nextCP)))) {
      throw new RangeError();
    }
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 426, $.lessThan(nextCP, $.default(0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 427, $.greaterThan(nextCP, $.default("\uFFFF", []))))) {
      throw new RangeError();
    }
    result = $.concatenate(result, AO__UTF16EncodeCodePoint($, nextCP));
  }
  return result;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.anchor.ts
function INTRINSICS_String_prototype_anchor($, $this, name) {
  var S = $this;
  return AO__CreateHTML($, S, $.default("a", []), $.default("name", []), name);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.at.ts
function INTRINSICS_String_prototype_at($, $this, index) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var len = $.length(S);
  var relativeIndex = AO__ToIntegerOrInfinity($, index);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 428, $.greaterThanEqual(relativeIndex, $.default(0, []))))) {
    var k = relativeIndex;
  } else {
    var k = $.add(len, relativeIndex);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 429, $.lessThan(k, $.default(0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 430, $.greaterThanEqual(k, len)))) {
    return $.default(void 0, []);
  }
  return $.substring(S, k, $.add(k, $.default(1, [])));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.big.ts
function INTRINSICS_String_prototype_big($, $this) {
  var S = $this;
  return AO__CreateHTML($, S, $.default("big", []), $.default("", []), $.default("", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.blink.ts
function INTRINSICS_String_prototype_blink($, $this) {
  var S = $this;
  return AO__CreateHTML($, S, $.default("blink", []), $.default("", []), $.default("", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.bold.ts
function INTRINSICS_String_prototype_bold($, $this) {
  var S = $this;
  return AO__CreateHTML($, S, $.default("b", []), $.default("", []), $.default("", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.charAt.ts
function INTRINSICS_String_prototype_charAt($, $this, pos) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var position = AO__ToIntegerOrInfinity($, pos);
  var size = $.length(S);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 431, $.lessThan(position, $.default(0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 432, $.greaterThanEqual(position, size)))) {
    return $.default("", []);
  }
  return $.substring(S, position, $.add(position, $.default(1, [])));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.charCodeAt.ts
function INTRINSICS_String_prototype_charCodeAt($, $this, pos) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var position = AO__ToIntegerOrInfinity($, pos);
  var size = $.length(S);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 433, $.lessThan(position, $.default(0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 434, $.greaterThanEqual(position, size)))) {
    return $.default(NaN, []);
  }
  return $.codeUnitAt(S, position);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.codePointAt.ts
function INTRINSICS_String_prototype_codePointAt($, $this, pos) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var position = AO__ToIntegerOrInfinity($, pos);
  var size = $.length(S);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 435, $.lessThan(position, $.default(0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 436, $.greaterThanEqual(position, size)))) {
    return $.default(void 0, []);
  }
  var cp = AO__CodePointAt($, S, position);
  return cp[
    "CodePoint"
    /* TODO INTERNAL : internal access */
  ];
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.concat.ts
function INTRINSICS_String_prototype_concat($, $this, ...args) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var R = S;
  for (var next of args) {
    var nextString = AO__ToString($, next);
    R = $.concatenate(R, nextString);
  }
  return R;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.endsWith.ts
function INTRINSICS_String_prototype_endsWith($, $this, searchString, endPosition = $.default(void 0, [])) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var isRegExp = AO__IsRegExp($, searchString);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 437, $.is(isRegExp, $.default(true, []))))) {
    throw new TypeError();
  }
  var searchStr = AO__ToString($, searchString);
  var len = $.length(S);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 438, $.is(endPosition, $.default(void 0, []))))) {
    var pos = len;
  } else {
    var pos = AO__ToIntegerOrInfinity($, endPosition);
  }
  var end = $.clamp(pos, $.default(0, []), len);
  var searchLength = $.length(searchStr);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 439, $.is(searchLength, $.default(0, []))))) {
    return $.default(true, []);
  }
  var start = $.subtract(end, searchLength);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 440, $.lessThan(start, $.default(0, []))))) {
    return $.default(false, []);
  }
  var substring = $.substring(S, start, end);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 441, $.is(substring, searchStr)))) {
    return $.default(true, []);
  }
  return $.default(false, []);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.fixed.ts
function INTRINSICS_String_prototype_fixed($, $this) {
  var S = $this;
  return AO__CreateHTML($, S, $.default("tt", []), $.default("", []), $.default("", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.fontcolor.ts
function INTRINSICS_String_prototype_fontcolor($, $this, colour) {
  var S = $this;
  return AO__CreateHTML($, S, $.default("font", []), $.default("color", []), colour);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.fontsize.ts
function INTRINSICS_String_prototype_fontsize($, $this, size) {
  var S = $this;
  return AO__CreateHTML($, S, $.default("font", []), $.default("size", []), size);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.includes.ts
function INTRINSICS_String_prototype_includes($, $this, searchString, position = $.default(void 0, [])) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var isRegExp = AO__IsRegExp($, searchString);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 442, $.is(isRegExp, $.default(true, []))))) {
    throw new TypeError();
  }
  var searchStr = AO__ToString($, searchString);
  var pos = AO__ToIntegerOrInfinity($, position);
  var len = $.length(S);
  var start = $.clamp(pos, $.default(0, []), len);
  var index = AO__StringIndexOf($, S, searchStr, start);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 443, $.is(index, $.default("not-found", []))))) {
    return $.default(false, []);
  }
  return $.default(true, []);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.indexOf.ts
function INTRINSICS_String_prototype_indexOf($, $this, searchString, position = $.default(void 0, [])) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var searchStr = AO__ToString($, searchString);
  var pos = AO__ToIntegerOrInfinity($, position);
  var len = $.length(S);
  var start = $.clamp(pos, $.default(0, []), len);
  var result = AO__StringIndexOf($, S, searchStr, start);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 444, $.is(result, $.default("not-found", []))))) {
    return $.default(-1, []);
  }
  return result;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.isWellFormed.ts
function INTRINSICS_String_prototype_isWellFormed($, $this) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  return AO__IsStringWellFormedUnicode($, S);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.italics.ts
function INTRINSICS_String_prototype_italics($, $this) {
  var S = $this;
  return AO__CreateHTML($, S, $.default("i", []), $.default("", []), $.default("", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.lastIndexOf.ts
function INTRINSICS_String_prototype_lastIndexOf($, $this, searchString, position = $.default(void 0, [])) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var searchStr = AO__ToString($, searchString);
  var numPos = AO__ToNumber($, position);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 445, $.isNaN(numPos)))) {
    var pos = $.default(Infinity, []);
  } else {
    var pos = AO__ToIntegerOrInfinity($, numPos);
  }
  var len = $.length(S);
  var searchLen = $.length(searchStr);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 446, $.lessThan(len, searchLen)))) {
    return $.default(-1, []);
  }
  var start = $.clamp(pos, $.default(0, []), $.subtract(len, searchLen));
  var result = AO__StringLastIndexOf($, S, searchStr, start);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 447, $.is(result, $.default("not-found", []))))) {
    return $.default(-1, []);
  }
  return result;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.link.ts
function INTRINSICS_String_prototype_link($, $this, url) {
  var S = $this;
  return AO__CreateHTML($, S, $.default("a", []), $.default("href", []), url);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.normalize.ts
function INTRINSICS_String_prototype_normalize($, $this, form = $.default(void 0, [])) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 456, $.is(form, $.default(void 0, []))))) {
    var f = $.default("NFC", []);
  } else {
    var f = AO__ToString($, form);
  }
  if (!($.value($.condition(Number.MAX_SAFE_INTEGER - 457, $.is(f, $.default("NFC", [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 458, $.is(f, $.default("NFD", [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 459, $.is(f, $.default("NFKC", [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 460, $.is(f, $.default("NFKD", [])))))) {
    throw new RangeError();
  }
  var ns = $.default($.value(S).normalize($.value(f)), [S, f]);
  return ns;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.padEnd.ts
function INTRINSICS_String_prototype_padEnd($, $this, maxLength, fillString = $.default(void 0, [])) {
  var O = AO__RequireObjectCoercible($, $this);
  return AO__StringPaddingBuiltinsImpl($, O, maxLength, fillString, $.default("end", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.padStart.ts
function INTRINSICS_String_prototype_padStart($, $this, maxLength, fillString = $.default(void 0, [])) {
  var O = AO__RequireObjectCoercible($, $this);
  return AO__StringPaddingBuiltinsImpl($, O, maxLength, fillString, $.default("start", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.repeat.ts
function INTRINSICS_String_prototype_repeat($, $this, count) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var n = AO__ToIntegerOrInfinity($, count);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 461, $.lessThan(n, $.default(0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 462, $.is(n, $.default(Infinity, []))))) {
    throw new RangeError();
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 463, $.is(n, $.default(0, []))))) {
    return $.default("", []);
  }
  return $.default($.value(S).repeat($.value(n)), [S, n]);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.replace.ts
function INTRINSICS_String_prototype_replace($, $this, searchValue, replaceValue) {
  var O = AO__RequireObjectCoercible($, $this);
  if (!($.value($.condition(Number.MAX_SAFE_INTEGER - 464, $.is(searchValue, $.default(void 0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 465, $.is(searchValue, $.default(null, [])))))) {
    var replacer = AO__GetMethod($, searchValue, $.default(Symbol.replace, []));
    if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 466, $.is(replacer, $.default(void 0, []))))) {
      return AO__Call($, replacer, searchValue, [O, replaceValue]);
    }
  }
  var string = AO__ToString($, O);
  var searchString = AO__ToString($, searchValue);
  var functionalReplace = AO__IsCallable($, replaceValue);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 467, $.is(functionalReplace, $.default(false, []))))) {
    replaceValue = AO__ToString($, replaceValue);
  }
  var searchLength = $.length(searchString);
  var position = AO__StringIndexOf($, string, searchString, $.default(0, []));
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 468, $.is(position, $.default("not-found", []))))) {
    return string;
  }
  var preceding = $.substring(string, $.default(0, []), position);
  var following = $.substring(string, $.add(position, searchLength), $.length(string));
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 469, $.is(functionalReplace, $.default(true, []))))) {
    var replacement = AO__ToString($, AO__Call($, replaceValue, $.default(void 0, []), [searchString, position, string]));
  } else {
    var captures = [];
    var replacement = AO__GetSubstitution($, searchString, string, position, captures, $.default(void 0, []), replaceValue);
  }
  return $.concatenate($.concatenate(preceding, replacement), following);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.replaceAll.ts
function INTRINSICS_String_prototype_replaceAll($, $this, searchValue, replaceValue) {
  var O = AO__RequireObjectCoercible($, $this);
  if (!($.value($.condition(Number.MAX_SAFE_INTEGER - 470, $.is(searchValue, $.default(void 0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 471, $.is(searchValue, $.default(null, [])))))) {
    var isRegExp = AO__IsRegExp($, searchValue);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 472, $.is(isRegExp, $.default(true, []))))) {
      var flags = AO__Get($, searchValue, $.default("flags", []));
      AO__RequireObjectCoercible($, flags);
      if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 473, $.contains(AO__ToString($, flags), $.default("g", []))))) {
        throw new TypeError();
      }
    }
    var replacer = AO__GetMethod($, searchValue, $.default(Symbol.replace, []));
    if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 474, $.is(replacer, $.default(void 0, []))))) {
      return AO__Call($, replacer, searchValue, [O, replaceValue]);
    }
  }
  var string = AO__ToString($, O);
  var searchString = AO__ToString($, searchValue);
  var functionalReplace = AO__IsCallable($, replaceValue);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 475, $.is(functionalReplace, $.default(false, []))))) {
    replaceValue = AO__ToString($, replaceValue);
  }
  var searchLength = $.length(searchString);
  var advanceBy = $.max($.default(1, []), searchLength);
  var matchPositions = [];
  var position = AO__StringIndexOf($, string, searchString, $.default(0, []));
  while (!$.value($.condition(Number.MAX_SAFE_INTEGER - 476, $.is(position, $.default("not-found", []))))) {
    $.append(matchPositions, position);
    position = AO__StringIndexOf($, string, searchString, $.add(position, advanceBy));
  }
  var endOfLastMatch = $.default(0, []);
  var result = $.default("", []);
  for (var p of matchPositions) {
    var preserved = $.substring(string, endOfLastMatch, p);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 477, $.is(functionalReplace, $.default(true, []))))) {
      var replacement = AO__ToString($, AO__Call($, replaceValue, $.default(void 0, []), [searchString, p, string]));
    } else {
      var captures = [];
      var replacement = AO__GetSubstitution($, searchString, string, p, captures, $.default(void 0, []), replaceValue);
    }
    result = $.concatenate($.concatenate(result, preserved), replacement);
    endOfLastMatch = $.add(p, searchLength);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 478, $.lessThan(endOfLastMatch, $.length(string))))) {
    result = $.concatenate(result, $.substring(string, endOfLastMatch, $.length(string)));
  }
  return result;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.slice.ts
function INTRINSICS_String_prototype_slice($, $this, start, end) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var len = $.length(S);
  var intStart = AO__ToIntegerOrInfinity($, start);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 482, $.is(intStart, $.default(-Infinity, []))))) {
    var from = $.default(0, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 483, $.lessThan(intStart, $.default(0, []))))) {
      var from = $.max($.add(len, intStart), $.default(0, []));
    } else {
      var from = $.min(intStart, len);
    }
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 484, $.is(end, $.default(void 0, []))))) {
    var intEnd = len;
  } else {
    var intEnd = AO__ToIntegerOrInfinity($, end);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 485, $.is(intEnd, $.default(-Infinity, []))))) {
    var to = $.default(0, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 486, $.lessThan(intEnd, $.default(0, []))))) {
      var to = $.max($.add(len, intEnd), $.default(0, []));
    } else {
      var to = $.min(intEnd, len);
    }
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 487, $.greaterThanEqual(from, to)))) {
    return $.default("", []);
  }
  return $.substring(S, from, to);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.small.ts
function INTRINSICS_String_prototype_small($, $this) {
  var S = $this;
  return AO__CreateHTML($, S, $.default("small", []), $.default("", []), $.default("", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.split.ts
function INTRINSICS_String_prototype_split($, $this, separator, limit) {
  var O = AO__RequireObjectCoercible($, $this);
  if (!($.value($.condition(Number.MAX_SAFE_INTEGER - 488, $.is(separator, $.default(void 0, [])))) || $.value($.condition(Number.MAX_SAFE_INTEGER - 489, $.is(separator, $.default(null, [])))))) {
    var splitter = AO__GetMethod($, separator, $.default(Symbol.split, []));
    if (!$.value($.condition(Number.MAX_SAFE_INTEGER - 490, $.is(splitter, $.default(void 0, []))))) {
      return AO__Call($, splitter, separator, [O, limit]);
    }
  }
  var S = AO__ToString($, O);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 491, $.is(limit, $.default(void 0, []))))) {
    var lim = $.subtract($.exponentiate($.default(2, []), $.default(32, [])), $.default(1, []));
  } else {
    var lim = AO__ToUint32($, limit);
  }
  var R = AO__ToString($, separator);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 492, $.is(lim, $.default(0, []))))) {
    return AO__CreateArrayFromList($, []);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 493, $.is(separator, $.default(void 0, []))))) {
    return AO__CreateArrayFromList($, [S]);
  }
  var separatorLength = $.length(R);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 494, $.is(separatorLength, $.default(0, []))))) {
    var strLen = $.length(S);
    var outLen = $.clamp(lim, $.default(0, []), strLen);
    var head = $.substring(S, $.default(0, []), outLen);
    var codeUnits = $.value(head).split("").map((c) => $.default(c, [head]));
    return AO__CreateArrayFromList($, codeUnits);
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 495, $.is(S, $.default("", []))))) {
    return AO__CreateArrayFromList($, [S]);
  }
  var substrings = [];
  var i = $.default(0, []);
  var j = AO__StringIndexOf($, S, R, $.default(0, []));
  while (!$.value($.condition(Number.MAX_SAFE_INTEGER - 496, $.is(j, $.default("not-found", []))))) {
    var T = $.substring(S, i, j);
    $.append(substrings, T);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 497, $.is($.default(substrings.length, []), lim)))) {
      return AO__CreateArrayFromList($, substrings);
    }
    i = $.add(j, separatorLength);
    j = AO__StringIndexOf($, S, R, i);
  }
  var T = $.substring(S, i, $.length(S));
  $.append(substrings, T);
  return AO__CreateArrayFromList($, substrings);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.startsWith.ts
function INTRINSICS_String_prototype_startsWith($, $this, searchString, position = $.default(void 0, [])) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var isRegExp = AO__IsRegExp($, searchString);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 498, $.is(isRegExp, $.default(true, []))))) {
    throw new TypeError();
  }
  var searchStr = AO__ToString($, searchString);
  var len = $.length(S);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 499, $.is(position, $.default(void 0, []))))) {
    var pos = $.default(0, []);
  } else {
    var pos = AO__ToIntegerOrInfinity($, position);
  }
  var start = $.clamp(pos, $.default(0, []), len);
  var searchLength = $.length(searchStr);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 500, $.is(searchLength, $.default(0, []))))) {
    return $.default(true, []);
  }
  var end = $.add(start, searchLength);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 501, $.greaterThan(end, len)))) {
    return $.default(false, []);
  }
  var substring = $.substring(S, start, end);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 502, $.is(substring, searchStr)))) {
    return $.default(true, []);
  }
  return $.default(false, []);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.strike.ts
function INTRINSICS_String_prototype_strike($, $this) {
  var S = $this;
  return AO__CreateHTML($, S, $.default("strike", []), $.default("", []), $.default("", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.sub.ts
function INTRINSICS_String_prototype_sub($, $this) {
  var S = $this;
  return AO__CreateHTML($, S, $.default("sub", []), $.default("", []), $.default("", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.substr.ts
function INTRINSICS_String_prototype_substr($, $this, start, length) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var size = $.length(S);
  var intStart = AO__ToIntegerOrInfinity($, start);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 503, $.is(intStart, $.default(-Infinity, []))))) {
    intStart = $.default(0, []);
  } else {
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 504, $.lessThan(intStart, $.default(0, []))))) {
      intStart = $.max($.add(size, intStart), $.default(0, []));
    } else {
      intStart = $.min(intStart, size);
    }
  }
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 505, $.is(length, $.default(void 0, []))))) {
    var intLength = size;
  } else {
    var intLength = AO__ToIntegerOrInfinity($, length);
  }
  intLength = $.clamp(intLength, $.default(0, []), size);
  var intEnd = $.min($.add(intStart, intLength), size);
  return $.substring(S, intStart, intEnd);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.substring.ts
function INTRINSICS_String_prototype_substring($, $this, start, end) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var len = $.length(S);
  var intStart = AO__ToIntegerOrInfinity($, start);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 506, $.is(end, $.default(void 0, []))))) {
    var intEnd = len;
  } else {
    var intEnd = AO__ToIntegerOrInfinity($, end);
  }
  var finalStart = $.clamp(intStart, $.default(0, []), len);
  var finalEnd = $.clamp(intEnd, $.default(0, []), len);
  var from = $.min(finalStart, finalEnd);
  var to = $.max(finalStart, finalEnd);
  return $.substring(S, from, to);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.sup.ts
function INTRINSICS_String_prototype_sup($, $this) {
  var S = $this;
  return AO__CreateHTML($, S, $.default("sup", []), $.default("", []), $.default("", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.toLowerCase.manual.ts
function INTRINSICS_String_prototype_toLowerCase($, $this) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  return $.toLower(S);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.toString.ts
function INTRINSICS_String_prototype_toString($, $this) {
  return AO__ThisStringValue($, $this);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.toUpperCase.manual.ts
function INTRINSICS_String_prototype_toUpperCase($, $this) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  return $.toUpper(S);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.toWellFormed.ts
function INTRINSICS_String_prototype_toWellFormed($, $this) {
  var O = AO__RequireObjectCoercible($, $this);
  var S = AO__ToString($, O);
  var strLen = $.length(S);
  var k = $.default(0, []);
  var result = $.default("", []);
  while ($.value($.condition(Number.MAX_SAFE_INTEGER - 507, $.lessThan(k, strLen)))) {
    var cp = AO__CodePointAt($, S, k);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 508, $.is(cp[
      "IsUnpairedSurrogate"
      /* TODO INTERNAL : internal access */
    ], $.default(true, []))))) {
      result = $.concatenate(result, $.default("\uFFFD", []));
    } else {
      result = $.concatenate(result, AO__UTF16EncodeCodePoint($, cp[
        "CodePoint"
        /* TODO INTERNAL : internal access */
      ]));
    }
    k = $.add(k, cp[
      "CodeUnitCount"
      /* TODO INTERNAL : internal access */
    ]);
  }
  return result;
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.trim.ts
function INTRINSICS_String_prototype_trim($, $this) {
  var S = $this;
  return AO__TrimString($, S, $.default("start+end", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.trimEnd.ts
function INTRINSICS_String_prototype_trimEnd($, $this) {
  var S = $this;
  return AO__TrimString($, S, $.default("end", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.trimStart.ts
function INTRINSICS_String_prototype_trimStart($, $this) {
  var S = $this;
  return AO__TrimString($, S, $.default("start", []));
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.prototype.valueOf.ts
function INTRINSICS_String_prototype_valueOf($, $this) {
  return AO__ThisStringValue($, $this);
}

// lib/dynajs/analyses/flow/spec/INTRINSICS.String.raw.ts
function INTRINSICS_String_raw($, $this, template, ...substitutions) {
  var substitutionCount = $.default(substitutions.length, []);
  var cooked = AO__ToObject($, template);
  var literals = AO__ToObject($, AO__Get($, cooked, $.default("raw", [])));
  var literalCount = AO__LengthOfArrayLike($, literals);
  if ($.value($.condition(Number.MAX_SAFE_INTEGER - 510, $.lessThanEqual(literalCount, $.default(0, []))))) {
    return $.default("", []);
  }
  var R = $.default("", []);
  var nextIndex = $.default(0, []);
  while (true) {
    var nextLiteralVal = AO__Get($, literals, AO__ToString($, nextIndex));
    var nextLiteral = AO__ToString($, nextLiteralVal);
    R = $.concatenate(R, nextLiteral);
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 511, $.is($.add(nextIndex, $.default(1, [])), literalCount)))) {
      return R;
    }
    if ($.value($.condition(Number.MAX_SAFE_INTEGER - 512, $.lessThan(nextIndex, substitutionCount)))) {
      var nextSubVal = substitutions[nextIndex];
      var nextSub = AO__ToString($, nextSubVal);
      R = $.concatenate(R, nextSub);
    }
    nextIndex = $.add(nextIndex, $.default(1, []));
  }
}

// lib/dynajs/analyses/flow/spec/SYNTAX__add.manual.ts
function SYNTAX__add_primitive($, lPrim, rPrim) {
  if ($.value($.isType(lPrim, "string")) || $.value($.isType(rPrim, "string"))) {
    const lStr = AO__ToString($, lPrim);
    const rStr = AO__ToString($, rPrim);
    return $.concatenate(lStr, rStr);
  }
  const lNum = AO__ToNumber($, lPrim);
  const rNum = AO__ToNumber($, rPrim);
  if (!(typeof $.value(lNum) === typeof $.value(rNum))) {
    throw new TypeError("TypeError: Cannot mix BigInt and other types");
  }
  return $.add(lNum, rNum);
}
function SYNTAX__add($, lVal, rVal) {
  const lPrim = AO__ToPrimitive($, lVal);
  const rPrim = AO__ToPrimitive($, rVal);
  return SYNTAX__add_primitive($, lPrim, rPrim);
}

// lib/dynajs/analyses/flow/internal/model.ts
var Model = class _Model {
  constructor($) {
    this.$ = $;
  }
  // --- static properties and methods ---
  static BUILTINS = new Map(
    [
      [String, INTRINSICS_String],
      [String.fromCharCode, INTRINSICS_String_fromCharCode],
      [
        String.fromCodePoint,
        INTRINSICS_String_fromCodePoint
      ],
      [String.raw, INTRINSICS_String_raw],
      [String.prototype.at, INTRINSICS_String_prototype_at],
      [String.prototype.charAt, INTRINSICS_String_prototype_charAt],
      [
        String.prototype.charCodeAt,
        INTRINSICS_String_prototype_charCodeAt
      ],
      [
        String.prototype.codePointAt,
        INTRINSICS_String_prototype_codePointAt
      ],
      [String.prototype.concat, INTRINSICS_String_prototype_concat],
      [
        String.prototype.endsWith,
        INTRINSICS_String_prototype_endsWith
      ],
      [
        String.prototype.includes,
        INTRINSICS_String_prototype_includes
      ],
      [
        String.prototype.indexOf,
        INTRINSICS_String_prototype_indexOf
      ],
      [
        String.prototype.isWellFormed,
        INTRINSICS_String_prototype_isWellFormed
      ],
      [
        String.prototype.lastIndexOf,
        INTRINSICS_String_prototype_lastIndexOf
      ],
      [
        String.prototype.normalize,
        INTRINSICS_String_prototype_normalize
      ],
      [String.prototype.padEnd, INTRINSICS_String_prototype_padEnd],
      [
        String.prototype.padStart,
        INTRINSICS_String_prototype_padStart
      ],
      [String.prototype.repeat, INTRINSICS_String_prototype_repeat],
      [
        String.prototype.replace,
        INTRINSICS_String_prototype_replace
      ],
      [
        String.prototype.replaceAll,
        INTRINSICS_String_prototype_replaceAll
      ],
      [String.prototype.slice, INTRINSICS_String_prototype_slice],
      [String.prototype.split, INTRINSICS_String_prototype_split],
      [
        String.prototype.startsWith,
        INTRINSICS_String_prototype_startsWith
      ],
      [String.prototype.substr, INTRINSICS_String_prototype_substr],
      [
        String.prototype.substring,
        INTRINSICS_String_prototype_substring
      ],
      [
        String.prototype.toUpperCase,
        INTRINSICS_String_prototype_toUpperCase
      ],
      [
        String.prototype.toLowerCase,
        INTRINSICS_String_prototype_toLowerCase
      ],
      [
        String.prototype.toString,
        INTRINSICS_String_prototype_toString
      ],
      [
        String.prototype.toWellFormed,
        INTRINSICS_String_prototype_toWellFormed
      ],
      [String.prototype.trim, INTRINSICS_String_prototype_trim],
      [
        String.prototype.trimEnd,
        INTRINSICS_String_prototype_trimEnd
      ],
      [
        String.prototype.trimStart,
        INTRINSICS_String_prototype_trimStart
      ],
      [
        String.prototype.valueOf,
        INTRINSICS_String_prototype_valueOf
      ],
      // Annex B HTML wrapper methods.
      [String.prototype.anchor, INTRINSICS_String_prototype_anchor],
      [String.prototype.big, INTRINSICS_String_prototype_big],
      [String.prototype.blink, INTRINSICS_String_prototype_blink],
      [String.prototype.bold, INTRINSICS_String_prototype_bold],
      [String.prototype.fixed, INTRINSICS_String_prototype_fixed],
      [
        String.prototype.fontcolor,
        INTRINSICS_String_prototype_fontcolor
      ],
      [
        String.prototype.fontsize,
        INTRINSICS_String_prototype_fontsize
      ],
      [
        String.prototype.italics,
        INTRINSICS_String_prototype_italics
      ],
      [String.prototype.link, INTRINSICS_String_prototype_link],
      [String.prototype.small, INTRINSICS_String_prototype_small],
      [String.prototype.strike, INTRINSICS_String_prototype_strike],
      [String.prototype.sub, INTRINSICS_String_prototype_sub],
      [String.prototype.sup, INTRINSICS_String_prototype_sup],
      // RegExp.prototype.test/exec and String.prototype.match/matchAll/search are
      // intentionally unregistered — handled by the symbolic regex seam ($.regexOp).
      // [Array.from, generated.INTRINSICS_Array_from],
      [Array.isArray, INTRINSICS_Array_isArray],
      [Array.of, INTRINSICS_Array_of],
      [Array.prototype.at, INTRINSICS_Array_prototype_at],
      [Array.prototype.concat, INTRINSICS_Array_prototype_concat],
      [
        Array.prototype.copyWithin,
        INTRINSICS_Array_prototype_copyWithin
      ],
      [Array.prototype.every, INTRINSICS_Array_prototype_every],
      [Array.prototype.fill, INTRINSICS_Array_prototype_fill],
      [Array.prototype.filter, INTRINSICS_Array_prototype_filter],
      [Array.prototype.find, INTRINSICS_Array_prototype_find],
      [
        Array.prototype.findIndex,
        INTRINSICS_Array_prototype_findIndex
      ],
      [
        Array.prototype.findLast,
        INTRINSICS_Array_prototype_findLast
      ],
      [
        Array.prototype.findLastIndex,
        INTRINSICS_Array_prototype_findLastIndex
      ],
      [Array.prototype.flat, INTRINSICS_Array_prototype_flat],
      [Array.prototype.flatMap, INTRINSICS_Array_prototype_flatMap],
      [Array.prototype.forEach, INTRINSICS_Array_prototype_forEach],
      [
        Array.prototype.includes,
        INTRINSICS_Array_prototype_includes
      ],
      [
        Array.prototype.indexOf,
        INTRINSICS_Array_prototype_indexOf
      ],
      [Array.prototype.join, INTRINSICS_Array_prototype_join],
      [
        Array.prototype.lastIndexOf,
        INTRINSICS_Array_prototype_lastIndexOf
      ],
      [Array.prototype.map, INTRINSICS_Array_prototype_map],
      [Array.prototype.pop, INTRINSICS_Array_prototype_pop],
      [Array.prototype.push, INTRINSICS_Array_prototype_push],
      [Array.prototype.reduce, INTRINSICS_Array_prototype_reduce],
      [
        Array.prototype.reduceRight,
        INTRINSICS_Array_prototype_reduceRight
      ],
      [Array.prototype.reverse, INTRINSICS_Array_prototype_reverse],
      [Array.prototype.shift, INTRINSICS_Array_prototype_shift],
      [Array.prototype.slice, INTRINSICS_Array_prototype_slice],
      [Array.prototype.some, INTRINSICS_Array_prototype_some],
      [Array.prototype.sort, INTRINSICS_Array_prototype_sort],
      [Array.prototype.splice, INTRINSICS_Array_prototype_splice],
      [
        Array.prototype.toReversed,
        INTRINSICS_Array_prototype_toReversed
      ],
      [
        Array.prototype.toSorted,
        INTRINSICS_Array_prototype_toSorted
      ],
      [
        Array.prototype.toSpliced,
        INTRINSICS_Array_prototype_toSpliced
      ],
      [
        Array.prototype.toString,
        INTRINSICS_Array_prototype_toString
      ],
      [Array.prototype.unshift, INTRINSICS_Array_prototype_unshift],
      [Array.prototype.with, INTRINSICS_Array_prototype_with]
    ].filter((entry) => entry[0] !== void 0)
  );
  static SYNTAX = /* @__PURE__ */ new Map([["+", SYNTAX__add]]);
  static support(f) {
    return this.BUILTINS.has(f);
  }
  /** @deprecated */
  static supportSyntax(op) {
    return this.SYNTAX.has(op);
  }
  static ofBuiltin(f) {
    const polyfill = _Model.BUILTINS.get(f);
    if (polyfill === void 0) {
      throw new Error(`Unsupported built-in function: ${f.name}`);
    }
    return polyfill;
  }
  /** @deprecated */
  static ofSyntax(op) {
    const polyfill = _Model.SYNTAX.get(op);
    if (polyfill === void 0) {
      throw new Error(`Unsupported syntax operator: ${op}`);
    }
    return polyfill;
  }
};

// lib/dynajs/analyses/flow/internal/site.ts
var UNKNOWN_SITE = { kind: "unknown" };
function resolveCodeSite(id) {
  const loc = D$.ids?.[id];
  const file = D$.idToFile?.(id);
  if (loc === void 0 || file === void 0) return UNKNOWN_SITE;
  return {
    kind: "code",
    id,
    file,
    start: { line: loc[0], column: loc[1] },
    end: { line: loc[2], column: loc[3] }
  };
}
var SiteResolver = class {
  currentId = void 0;
  currentBuiltin = void 0;
  reportId(id) {
    this.currentId = id;
  }
  reportBuiltin(name) {
    this.currentBuiltin = name;
  }
  withBuiltinSite(name, body) {
    const savedBuiltin = this.currentBuiltin;
    this.currentBuiltin = name;
    try {
      return body();
    } finally {
      this.currentBuiltin = savedBuiltin;
    }
  }
  resolve() {
    if (this.currentBuiltin !== void 0) {
      const call = this.currentId !== void 0 ? resolveCodeSite(this.currentId) : UNKNOWN_SITE;
      return {
        kind: "builtin",
        name: this.currentBuiltin,
        call: call.kind === "code" ? call : void 0
      };
    }
    if (this.currentId !== void 0) return resolveCodeSite(this.currentId);
    return UNKNOWN_SITE;
  }
  resolveCodeSite(id) {
    const loc = D$.ids[id];
    const file = D$.idToFile(id);
    if (loc === void 0 || file === void 0) return UNKNOWN_SITE;
    return {
      kind: "code",
      id,
      file,
      start: { line: loc[0], column: loc[1] },
      end: { line: loc[2], column: loc[3] }
    };
  }
  /* readable name for a modeled builtin (builtin-kind sites) */
  builtinName(f) {
    const n = typeof f === "function" ? f.name : "";
    return n !== "" ? n : "builtin";
  }
};

// lib/dynajs/analyses/flow/internal/lift.ts
import util from "node:util";

// lib/dynajs/analyses/flow/internal/escape.ts
var {
  ReflectOwnKeys,
  ObjectGetOwnPropertyDescriptor,
  ObjectDefineProperty,
  ObjectIs
} = CAPTURED;
function append(arr, v) {
  ObjectDefineProperty(arr, arr.length, {
    value: v,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
var BoundaryEscape = class _BoundaryEscape {
  constructor(isPrimitiveProxy, unlift, lift) {
    this.isPrimitiveProxy = isPrimitiveProxy;
    this.unlift = unlift;
    this.lift = lift;
  }
  // Fast-path flag: until some store places a lifted primitive into a
  // container, the recursive scan is skipped entirely.
  containersMayHoldLifted = false;
  // Fast-path flag: until some instrumented coercion method (valueOf/toString/
  // @@toPrimitive) is observed, the *nested* coercion-wrap walk is skipped.
  // Top-level operands are always wrapped (cheap), so this only gates recursion.
  mayHaveInstrumentedCoercion = false;
  // valueOf/toString/@@toPrimitive — the methods native ToPrimitive invokes.
  static COERCION_KEYS = [
    "valueOf",
    "toString",
    Symbol.toPrimitive
  ];
  markEscapable(value) {
    if (!this.containersMayHoldLifted && this.isPrimitiveProxy(value)) {
      this.containersMayHoldLifted = true;
    }
  }
  /** Object/array literals store member expressions natively before any putField
   * fires; shallow-scan own props so both flags stay sound. A literal carrying a
   * lifted primitive arms the container walk; one whose valueOf/toString/
   * @@toPrimitive is an instrumented function arms the nested coercion walk
   * (each nested literal is scanned as it is created, so `{length:{valueOf}}`
   * arms it too). */
  markEscapableLiteral(value) {
    if (typeof value !== "object" || value === null) return;
    if (this.containersMayHoldLifted && this.mayHaveInstrumentedCoercion) return;
    const keys = ReflectOwnKeys(value);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const desc = ObjectGetOwnPropertyDescriptor(value, key);
      if (desc === void 0 || !("value" in desc)) continue;
      if (!this.containersMayHoldLifted && this.isPrimitiveProxy(desc.value)) {
        this.containersMayHoldLifted = true;
      }
      if (!this.mayHaveInstrumentedCoercion && _BoundaryEscape.COERCION_KEYS.includes(key) && typeof desc.value === "function" && isInstrumentedFn(desc.value)) {
        this.mayHaveInstrumentedCoercion = true;
      }
    }
  }
  escape(base, args, entries, options = {}) {
    const log = [];
    const visited = /* @__PURE__ */ new Set();
    const escapedArgs = args.map(
      (a) => this.escapeValue(a, log, visited, options)
    );
    const escapedBase = this.escapeValue(base, log, visited, options);
    const crossed = entries.filter((e) => this.isPrimitiveProxy(e)).concat(log.flatMap((e) => e.kind === "prop" ? [e.lifted] : []));
    return { base: escapedBase, args: escapedArgs, log, crossed };
  }
  /** Wrap the coercion methods of values a native operator is about to coerce
   * (binary `<`/`==`/`^`/…, unary `+`/`-`/`~`), returning a log for restore().
   * Operators coerce their operands directly, so only the operands themselves
   * need wrapping. No-op (and no allocation cost beyond the array) unless the
   * program is known to define an instrumented coercion method. */
  wrapForOperator(values) {
    if (!this.mayHaveInstrumentedCoercion) return [];
    const log = [];
    for (let i = 0; i < values.length; i++) this.wrapCoercion(values[i], log);
    return log;
  }
  restore(log) {
    for (let i = 0; i < log.length; i++) {
      const e = log[i];
      if (e.kind === "method") {
        if (e.prev === void 0)
          delete e.obj[e.key];
        else ObjectDefineProperty(e.obj, e.key, e.prev);
        continue;
      }
      const desc = ObjectGetOwnPropertyDescriptor(e.container, e.prop);
      if (desc !== void 0 && "value" in desc && desc.writable === true && ObjectIs(desc.value, this.unlift(e.lifted))) {
        ObjectDefineProperty(e.container, e.prop, {
          value: e.lifted,
          writable: true,
          enumerable: desc.enumerable,
          configurable: desc.configurable
        });
      }
    }
  }
  escapeValue(v, log, visited, options) {
    if (this.isPrimitiveProxy(v)) return this.unlift(v);
    if (v !== null && (typeof v === "object" || typeof v === "function")) {
      if (options.wrapTopLevelCoercion) this.wrapCoercion(v, log);
      this.wrapIterable(v, log);
      this.escapeOwnLifted(v, log);
      if (this.containersMayHoldLifted || this.mayHaveInstrumentedCoercion) {
        this.escapeInto(v, log, visited);
      }
    }
    return v;
  }
  escapeOwnLifted(obj, log) {
    const keys = ReflectOwnKeys(obj);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const desc = ObjectGetOwnPropertyDescriptor(obj, key);
      if (desc === void 0 || !("value" in desc) || desc.writable !== true)
        continue;
      const child = desc.value;
      if (!this.isPrimitiveProxy(child)) continue;
      ObjectDefineProperty(obj, key, {
        value: this.unlift(child),
        writable: true,
        enumerable: desc.enumerable,
        configurable: desc.configurable
      });
      append(log, { kind: "prop", container: obj, prop: key, lifted: child });
    }
  }
  escapeInto(obj, log, visited) {
    if (visited.has(obj)) return;
    visited.add(obj);
    const keys = ReflectOwnKeys(obj);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const desc = ObjectGetOwnPropertyDescriptor(obj, key);
      if (desc === void 0 || !("value" in desc) || desc.writable !== true)
        continue;
      const child = desc.value;
      if (this.isPrimitiveProxy(child)) {
        ObjectDefineProperty(obj, key, {
          value: this.unlift(child),
          writable: true,
          enumerable: desc.enumerable,
          configurable: desc.configurable
        });
        append(log, { kind: "prop", container: obj, prop: key, lifted: child });
      } else if (typeof child === "object" && child !== null) {
        if (this.mayHaveInstrumentedCoercion) {
          this.wrapCoercion(child, log);
          this.wrapIterable(child, log);
        }
        this.escapeInto(child, log, visited);
      }
    }
  }
  /** Temporarily shadow `v`'s coercion methods with wrappers that unlift the
   * return, so native ToPrimitive receives a real primitive instead of a
   * lifted-primitive object. Only instrumented methods are touched — native
   * valueOf/toString already return raw. The shadow is an own property,
   * restored (deleted or reset) by restore(). */
  wrapCoercion(v, log) {
    if (v === null || typeof v !== "object" && typeof v !== "function") return;
    const obj = v;
    const keys = _BoundaryEscape.COERCION_KEYS;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      let orig;
      try {
        orig = obj[key];
      } catch {
        continue;
      }
      if (typeof orig !== "function" || !isInstrumentedFn(orig)) continue;
      this.mayHaveInstrumentedCoercion = true;
      const fn = orig;
      const unlift = this.unlift;
      const lift = this.lift;
      const wrapper = function(...a) {
        return unlift(fn.apply(this, a.map((x) => lift(x))));
      };
      const prev = ObjectGetOwnPropertyDescriptor(obj, key);
      try {
        ObjectDefineProperty(obj, key, {
          value: wrapper,
          writable: true,
          enumerable: prev?.enumerable ?? false,
          configurable: true
        });
      } catch {
        continue;
      }
      append(log, { kind: "method", obj, key, prev });
    }
  }
  /** Temporarily make a native consumer that iterates `v` (Intl.ListFormat.
   * format, `new Set(it)`, spread into a native, …) see raw yielded values, not
   * lifted-primitive proxies ("Iterable yielded #<ProxiedPrimitive>…").
   *  (A) instrumented custom @@iterator → shadow it to return a next-wrapped
   *      iterator;
   *  (B) `v` is itself an iterator (native @@iterator but owns/inherits `next`,
   *      e.g. `arr[Symbol.iterator]()` over a lifted-element array) → wrap its
   *      next/return in place.
   * Each wrapped result has its `value` unlifted (no-op for already-raw values).
   * Plain arrays/Map/Set keep their native @@iterator and are handled by the
   * element strip in escapeInto / the Map-Set walk. */
  wrapIterable(v, log) {
    if (v === null || typeof v !== "object" && typeof v !== "function") return;
    const obj = v;
    let atIter;
    try {
      atIter = obj[Symbol.iterator];
    } catch {
      return;
    }
    if (typeof atIter !== "function") return;
    const unlift = this.unlift;
    const unliftResult = (r) => {
      if (r !== null && typeof r === "object") {
        r.value = unlift(r.value);
        r.done = unlift(r.done);
      }
      return r;
    };
    const wrapIteratorMethods = (it) => {
      for (let i = 0; i < ITER_METHOD_KEYS.length; i++) {
        const key = ITER_METHOD_KEYS[i];
        const orig = it[key];
        if (typeof orig !== "function") continue;
        ObjectDefineProperty(it, key, {
          value: (...a) => unliftResult(orig.apply(it, a)),
          writable: true,
          enumerable: false,
          configurable: true
        });
      }
    };
    if (isInstrumentedFn(atIter)) {
      this.mayHaveInstrumentedCoercion = true;
      const origIter = atIter;
      const wrapper = function(...a) {
        const it = origIter.apply(this, a);
        wrapIteratorMethods(it);
        return it;
      };
      const prev = ObjectGetOwnPropertyDescriptor(obj, Symbol.iterator);
      try {
        ObjectDefineProperty(obj, Symbol.iterator, {
          value: wrapper,
          writable: true,
          enumerable: prev?.enumerable ?? false,
          configurable: true
        });
      } catch {
        return;
      }
      append(log, { kind: "method", obj, key: Symbol.iterator, prev });
      return;
    }
    if (typeof obj.next !== "function") return;
    this.mayHaveInstrumentedCoercion = true;
    for (let i = 0; i < ITER_METHOD_KEYS.length; i++) {
      const key = ITER_METHOD_KEYS[i];
      const orig = obj[key];
      if (typeof orig !== "function") continue;
      const prev = ObjectGetOwnPropertyDescriptor(obj, key);
      try {
        ObjectDefineProperty(obj, key, {
          value: (...a) => unliftResult(orig.apply(obj, a)),
          writable: true,
          enumerable: prev?.enumerable ?? false,
          configurable: true
        });
      } catch {
        continue;
      }
      append(log, { kind: "method", obj, key, prev });
    }
  }
};
var ITER_METHOD_KEYS = ["next", "return"];

// lib/dynajs/analyses/flow/internal/lift.ts
var ProxiedPrimitive = class {
  constructor(value, stringIterator) {
    this.value = value;
    this.stringIterator = stringIterator;
  }
  [Symbol.toPrimitive](hint) {
    if (this.value === null || this.value === void 0) return this.value;
    return this.value;
  }
  get [Symbol.iterator]() {
    if (typeof this.value === "undefined" || this.value === null) {
      return void 0;
    } else {
      return this.SymbolIterator.bind(this);
    }
  }
  SymbolIterator() {
    if (typeof this.value === "string") {
      return this.stringIterator(this, this.value);
    }
    throw new TypeError("not iterable");
  }
  valueOf() {
    return this.value;
  }
  toString() {
    return String(this.value);
  }
  [util.inspect.custom]() {
    return "<lifted-primitive>";
  }
};
var LiftedDomain = class {
  liftedPrimitives = /* @__PURE__ */ new WeakSet();
  valueMap = /* @__PURE__ */ new WeakMap();
  infoMap = /* @__PURE__ */ new WeakMap();
  escaper = new BoundaryEscape(
    this.isPrimitiveProxy.bind(this),
    this.unlift.bind(this),
    this.lift.bind(this)
  );
  // ---- Info storage helpers ----
  getInfo(value) {
    const key = this.getInfoKey(value);
    return key === void 0 ? this.domain.getBottom() : this.infoMap.get(key) ?? this.domain.getBottom();
  }
  setInfo(value, info) {
    const key = this.getInfoKey(value);
    if (key === void 0) return;
    this.infoMap.set(key, info);
  }
  getOrCreateInfo(value, makeEmpty) {
    const key = this.getInfoKey(value);
    if (key === void 0) return this.domain.getBottom();
    let info = this.infoMap.get(key);
    if (info === void 0) {
      info = makeEmpty();
      this.infoMap.set(key, info);
    }
    return info;
  }
  valued(v) {
    return {
      info: this.getInfo(v),
      value: this.unlift(v)
    };
  }
  /** NOTE never override this method */
  lift(value, info = this.domain.getBottom()) {
    let w;
    if (this.isObjectish(value)) {
      if (!this.valueMap.has(value)) {
        this.valueMap.set(value, { value });
      }
      w = value;
    } else {
      const proxy = new ProxiedPrimitive(
        value,
        this.iterateLiftedString.bind(this)
      );
      this.liftedPrimitives.add(proxy);
      this.valueMap.set(proxy, { value });
      w = proxy;
    }
    if (!this.domain.isBottom(info)) this.setInfo(w, info);
    return w;
  }
  *iterateLiftedString(_self, value) {
    yield* value[Symbol.iterator]();
  }
  ////////// lift-hanlders //////////
  isObjectish(v) {
    return v !== null && (typeof v === "object" || typeof v === "function");
  }
  isPrimitive(v) {
    return !this.isObjectish(v);
  }
  isLifted(v) {
    return this.isObjectish(v) && this.valueMap.has(v);
  }
  isPrimitiveProxy(v) {
    return this.isObjectish(v) && this.liftedPrimitives.has(v);
  }
  unlift(value) {
    if (!this.isObjectish(value)) return value;
    const entry = this.valueMap.get(value);
    return entry === void 0 ? value : entry.value;
  }
  getEntry(value) {
    if (!this.isObjectish(value)) return void 0;
    return this.valueMap.get(value);
  }
  getInfoKey(value) {
    if (!this.isObjectish(value)) return void 0;
    return this.valueMap.has(value) ? value : void 0;
  }
};

// lib/dynajs/analyses/flow/flow.ts
var { ReflectApply } = CAPTURED;
var NON_VALUE_BINARY_OPS = /* @__PURE__ */ new Set(["instanceof", "in"]);
function execWithIndices(regex, s) {
  if (regex.hasIndices) return regex.exec(s);
  const withIndices = new RegExp(regex.source, regex.flags + "d");
  withIndices.lastIndex = regex.lastIndex;
  const match = withIndices.exec(s);
  regex.lastIndex = withIndices.lastIndex;
  return match;
}
var FlowAnalysis = class extends LiftedDomain {
  siteResolver = new SiteResolver();
  site() {
    return this.siteResolver.resolve();
  }
  transparentCalls = /* @__PURE__ */ new Set();
  /** Route supported builtin calls through the spec polyfill model. An analysis
   *  can set this false to run every builtin natively (the opaque path) — a
   *  baseline with no spec models. See analyses/noop-nobuiltin. */
  modelBuiltins = true;
  policy = {
    isOpaque: (f) => typeof f === "function" && !isInstrumentedFn(f) && !this.transparentCalls.has(f)
  };
  conditionInfo(_id, _cond, _taken) {
  }
  escapedInfo(_f, _escaped) {
  }
  /** internal(flow.ts) */
  numOp(v, parents) {
    return this.lift(
      v,
      this.defaultInfo(
        v,
        parents.map((p) => this.valued(p))
      )
    );
  }
  /** internal(flow.ts) */
  binOp(op, l, r, v) {
    return this.lift(
      v,
      this.binaryInfo?.(op, this.valued(l), this.valued(r)) ?? this.defaultInfo(v, [this.valued(l), this.valued(r)])
    );
  }
  /** internal(flow.ts) */
  unOp(op, x, v) {
    return this.lift(
      v,
      this.unaryInfo?.(op, this.valued(x)) ?? this.defaultInfo(v, [this.valued(x)])
    );
  }
  /** internal(flow.ts) — operands are Lifted<unknown>: ordering comparisons pass
   * numbers, but `is`/`isNot` compare strings, sentinels, etc. */
  cmpOp(op, l, r, v) {
    return this.lift(
      v,
      this.binaryInfo?.(op, this.valued(l), this.valued(r)) ?? this.defaultInfo(v, [this.valued(l), this.valued(r)])
    );
  }
  *iterateLiftedString(self, value) {
    for (let i = 0; i < value.length; i++) {
      yield this.$.substring(
        self,
        this.$.default(i, []),
        this.$.default(i + 1, [])
      );
    }
  }
  $ = {
    // StringOps
    length: (s) => {
      const v = this.$.value(s).length;
      if (this.$.value(this.$.isType(s, "string"))) {
        return this.lift(
          v,
          this.lengthOfStringInfo?.(this.valued(s)) ?? this.defaultInfo(v, [this.valued(s)])
        );
      }
      return this.lift(v, this.defaultInfo(v, [this.valued(s)]));
    },
    substring: (s, from, to) => {
      const startN = this.unlift(from);
      const r = this.unlift(s).substring(
        startN,
        this.unlift(to)
      );
      return this.lift(
        r,
        this.substringInfo?.(
          this.valued(s),
          this.valued(from),
          this.valued(to),
          r.length
        ) ?? this.defaultInfo(r, [
          this.valued(s),
          this.valued(from),
          this.valued(to)
        ])
      );
    },
    concatenate: (l, r) => {
      const r1 = this.unlift(l);
      const r2 = this.unlift(r);
      const res = r1 + r2;
      return this.lift(
        res,
        this.concatenateInfo?.(
          this.valued(l),
          r1.length,
          this.valued(r),
          r2.length
        ) ?? this.defaultInfo(res, [this.valued(l), this.valued(r)])
      );
    },
    codeUnitAt: (s, i) => {
      const idx = this.unlift(i);
      const r = this.unlift(s).charAt(idx);
      return this.lift(
        r,
        this.substringInfo?.(
          this.valued(s),
          this.valued(i),
          this.valued(i),
          r.length
        ) ?? this.defaultInfo(r, [this.valued(s), this.valued(i)])
      );
    },
    trim: (s, leading, trailing) => {
      let r = this.unlift(s);
      if (leading && trailing) r = r.trim();
      else if (leading) r = r.trimStart();
      else if (trailing) r = r.trimEnd();
      return this.lift(r, this.defaultInfo(r, [this.valued(s)]));
    },
    toLower: (s) => {
      const r = this.unlift(s).toLowerCase();
      return this.lift(
        r,
        this.toLowerInfo?.(this.valued(s)) ?? this.defaultInfo(r, [this.valued(s)])
      );
    },
    toUpper: (s) => {
      const r = this.unlift(s).toUpperCase();
      return this.lift(
        r,
        this.toUpperInfo?.(this.valued(s)) ?? this.defaultInfo(r, [this.valued(s)])
      );
    },
    // Both operands unlifted — a lifted proxy reaching native
    // String.prototype.includes coerces to "[object Object]".
    containsStr: (s, sub) => {
      const v = this.unlift(s).includes(this.unlift(sub));
      return this.lift(
        v,
        this.containsStrInfo?.(this.valued(s), this.valued(sub)) ?? this.defaultInfo(v, [this.valued(s), this.valued(sub)])
      );
    },
    // RegexOps
    regexExec: (regex, string) => {
      const rawRegex = this.unlift(regex);
      const rawString = this.unlift(string);
      const concrete = execWithIndices(rawRegex, rawString);
      const matched = concrete !== null;
      const info = this.regexExecInfo?.(
        this.valued(regex),
        this.valued(string),
        concrete
      );
      const elems = concrete === null ? [] : concatList([], concrete);
      return {
        // Whether it matched depends on the pattern AND the subject; the match
        // POSITION is structural (a number, not content) so it carries no taint
        // by default; concolic supplies the symbolic start via regexExecInfo.
        matched: this.lift(
          matched,
          info?.matched ?? this.defaultInfo(matched, [
            this.valued(regex),
            this.valued(string)
          ])
        ),
        index: this.lift(
          concrete === null ? -1 : concrete.index,
          info?.index ?? this.defaultInfo(-1, [])
        ),
        captures: elems.map((c, i) => {
          const v = c ?? "";
          if (info?.captures?.[i] !== void 0)
            return this.lift(v, info.captures[i]);
          const span = concrete?.indices?.[i];
          if (span)
            return this.$.substring(
              string,
              this.$.default(span[0], []),
              this.$.default(span[1], [])
            );
          return this.lift(v, this.defaultInfo(v, [this.valued(string)]));
        }),
        input: string
      };
    },
    // ArithmeticOps
    add: (l, r) => this.binOp(
      "+",
      l,
      r,
      this.unlift(l) + this.unlift(r)
    ),
    subtract: (l, r) => this.binOp(
      "-",
      l,
      r,
      this.unlift(l) - this.unlift(r)
    ),
    multiply: (l, r) => this.binOp(
      "*",
      l,
      r,
      this.unlift(l) * this.unlift(r)
    ),
    divide: (l, r) => this.binOp(
      "/",
      l,
      r,
      this.unlift(l) / this.unlift(r)
    ),
    remainder: (l, r) => this.binOp(
      "%",
      l,
      r,
      this.unlift(l) % this.unlift(r)
    ),
    negate: (x) => this.unOp("-", x, -this.unlift(x)),
    exponentiate: (b, e) => this.binOp(
      "**",
      b,
      e,
      this.unlift(b) ** this.unlift(e)
    ),
    bitwiseAND: (l, r) => this.binOp(
      "&",
      l,
      r,
      this.unlift(l) & this.unlift(r)
    ),
    bitwiseOR: (l, r) => this.binOp(
      "|",
      l,
      r,
      this.unlift(l) | this.unlift(r)
    ),
    bitwiseXOR: (l, r) => this.binOp(
      "^",
      l,
      r,
      this.unlift(l) ^ this.unlift(r)
    ),
    // CompareOps
    lessThan: (l, r) => this.cmpOp(
      "<",
      l,
      r,
      this.unlift(l) < this.unlift(r)
    ),
    lessThanEqual: (l, r) => this.cmpOp(
      "<=",
      l,
      r,
      this.unlift(l) <= this.unlift(r)
    ),
    greaterThan: (l, r) => this.cmpOp(
      ">",
      l,
      r,
      this.unlift(l) > this.unlift(r)
    ),
    greaterThanEqual: (l, r) => this.cmpOp(
      ">=",
      l,
      r,
      this.unlift(l) >= this.unlift(r)
    ),
    condition: (bid, cond) => {
      const v = this.$.value(cond);
      const info = this.conditionInfo?.(bid, this.valued(cond), Boolean(v)) ?? this.defaultInfo(v, [this.valued(cond)]);
      return this.lift(v, info);
    },
    is: (l, r) => this.cmpOp("===", l, r, this.unlift(l) === this.unlift(r)),
    isNot: (l, r) => this.cmpOp("!==", l, r, this.unlift(l) !== this.unlift(r)),
    // isNaN/isFinite/isType go through baseInfo, not unaryInfo: unlike isInteger
    // (a genuine symbolic predicate over the SMT Real), these aren't modelable —
    // NaN/∞ aren't in the Real theory and a value's type is concrete. baseInfo
    // carries no op model, so for concolic the result is concretized and the
    // branch runs concretely (ExpoSE-faithful), while taint still flows
    // operand→result.
    isNaN: (x) => {
      const v = Number.isNaN(this.unlift(x));
      return this.lift(v, this.defaultInfo(v, [this.valued(x)]));
    },
    isFinite: (x) => {
      const v = Number.isFinite(this.unlift(x));
      return this.lift(v, this.defaultInfo(v, [this.valued(x)]));
    },
    isInteger: (x) => {
      const v = Number.isInteger(this.unlift(x));
      return this.lift(
        v,
        this.unaryInfo?.("isInteger", this.valued(x)) ?? this.defaultInfo(v, [this.valued(x)])
      );
    },
    isType: (x, ty) => {
      const raw = this.unlift(x);
      let v;
      switch (ty) {
        // "Type(x) is Object": objects and callables, but not null.
        case "object":
          v = typeof raw === "object" && raw !== null || typeof raw === "function";
          break;
        case "null":
          v = raw === null;
          break;
        case "undefined":
          v = raw === void 0;
          break;
        // string / number / boolean / symbol / bigint / function
        default:
          v = typeof raw === ty;
      }
      return this.lift(v, this.defaultInfo(v, [this.valued(x)]));
    },
    // MathOps
    min: (...xs) => this.numOp(
      ReflectApply(Math.min, void 0, xs.map((x) => this.unlift(x))),
      xs
    ),
    max: (...xs) => this.numOp(
      ReflectApply(Math.max, void 0, xs.map((x) => this.unlift(x))),
      xs
    ),
    abs: (x) => this.numOp(Math.abs(this.unlift(x)), [x]),
    // floor/ceil/round route through unaryInfo (op-keyed, like $.isInteger) so an
    // analysis can model the rounding symbolically; without a hook they fall back
    // to baseInfo, same as numOp.
    floor: (x) => this.unOp("floor", x, Math.floor(this.unlift(x))),
    ceil: (x) => this.unOp("ceil", x, Math.ceil(this.unlift(x))),
    round: (x) => this.unOp("round", x, Math.round(this.unlift(x))),
    truncate: (x) => {
      const v = Math.trunc(this.unlift(x));
      return this.lift(
        v,
        this.truncateInfo?.(this.valued(x)) ?? this.defaultInfo(v, [this.valued(x)])
      );
    },
    clamp: (x, lower, upper) => {
      const v = Math.max(
        this.unlift(lower),
        Math.min(this.unlift(x), this.unlift(upper))
      );
      return this.lift(
        v,
        this.clampInfo?.(
          this.valued(x),
          this.valued(lower),
          this.valued(upper)
        ) ?? this.defaultInfo(v, [
          this.valued(x),
          this.valued(lower),
          this.valued(upper)
        ])
      );
    },
    // ListOps
    append: (list, x) => {
      this.escaper.markEscapable(x);
      list.push(x);
      return list;
    },
    prepend: (list, x) => {
      this.escaper.markEscapable(x);
      list.unshift(x);
      return list;
    },
    contains: (seq, x) => (
      // Overloaded in the spec metalanguage (see DynamicOps.contains): a List
      // is a native array, a String a lifted proxy. Recover the domain here.
      Array.isArray(seq) ? this.$.containsList(seq, x) : this.$.containsStr(seq, x)
    ),
    containsList: (list, x) => {
      const v = list.includes(x);
      return this.lift(
        v,
        this.containsListInfo?.(this.valued(list), this.valued(x)) ?? this.defaultInfo(v, [this.valued(list), this.valued(x)])
      );
    },
    range: (lo, loInclusive, hi, hiInclusive, ascending, bid) => {
      const start = this.unlift(lo) + (loInclusive ? 0 : 1);
      const end = this.unlift(hi) - (hiInclusive ? 0 : 1);
      const out = [];
      for (let i = start; i <= end; i++) {
        out.push(
          this.lift(
            i,
            this.rangeInfo?.(
              i,
              this.valued(lo),
              loInclusive,
              this.valued(hi),
              hiInclusive,
              ascending,
              bid
            ) ?? this.defaultInfo(i, [this.valued(lo), this.valued(hi)])
          )
        );
      }
      if (!ascending) out.reverse();
      return out;
    },
    // SpecOps
    default: (v, parents) => this.lift(
      v,
      this.defaultInfo(
        v,
        parents.map((p) => this.valued(p))
      )
    ),
    value: (lifted) => this.unlift(lifted),
    info: (lifted) => this.getInfo(lifted),
    get: (base, prop) => {
      const result = this.$.value(base)[this.$.value(prop)];
      return this.lift(
        result,
        this.getFieldInfo?.(
          this.valued(base),
          this.valued(prop),
          this.valued(result)
        ) ?? this.defaultInfo(result, [this.valued(base), this.valued(prop)])
      );
    },
    apply: (f, thisArg, args) => {
      const fn = this.unlift(f);
      const argArr = args;
      const entries = concatList([thisArg], argArr);
      const kind = this.callKind(fn, entries);
      if (kind === "modeled") return this.callModeled(fn, thisArg, argArr);
      if (kind === "opaque") {
        const esc = this.escaper.escape(
          thisArg,
          argArr,
          entries,
          this.opaqueEscapeOptions(fn)
        );
        if (esc.crossed.length > 0)
          this.escapedInfo?.(
            fn,
            esc.crossed.map((w) => this.valued(w))
          );
        const result = ReflectApply(fn, esc.base, esc.args);
        return this.opaqueResult(fn, entries, result, esc.log);
      }
      return this.carryOrDefault(
        ReflectApply(fn, thisArg, argArr),
        entries
      );
    }
  };
  condition(id, _op, value) {
    if (_op !== "model") this.siteResolver.reportId(id);
    const cond = this.$.condition(
      id,
      value
    );
    const raw = this.$.value(cond);
    return { result: raw };
  }
  classHeritage(_id, value) {
    return { result: this.$.value(value) };
  }
  literal(_id, value) {
    this.siteResolver.reportId(_id);
    this.escaper.markEscapableLiteral(value);
    const w = this.$.default(value, []);
    return w === value ? void 0 : { result: w };
  }
  forInOfObject(_id, value, isForIn) {
    const raw = this.$.value(value);
    if (!isForIn && typeof raw === "string" && raw !== value) {
      return void 0;
    }
    return raw === value ? void 0 : { result: raw };
  }
  binaryPre(_id, op, left, right) {
    const l = this.$.value(left);
    const r = this.$.value(right);
    const escaped = op === "+" ? void 0 : this.escaper.wrapForOperator([l, r]);
    const frame = { ty: "bin", op, left, right, escaped };
    return { op, left: l, right: r, skip: op === "+", frame };
  }
  binary(_id, _op, _l, _r, result, frame) {
    required(frame !== void 0, "binary hook missing frame");
    this.siteResolver.reportId(_id);
    const f = frame;
    if (f.escaped) this.escaper.restore(f.escaped);
    if (f.op === "+") {
      return {
        result: SYNTAX__add(this.$, f.left, f.right)
      };
    } else {
      const left = this.valued(f.left);
      const right = this.valued(f.right);
      const resultInfo = NON_VALUE_BINARY_OPS.has(f.op) ? this.defaultInfo(result, [left, right]) : this.binaryInfo?.(f.op, left, right) ?? this.defaultInfo(result, [left, right]);
      return { result: this.lift(result, resultInfo) };
    }
  }
  templateConcatPre(_id, left, right) {
    const l = this.$.value(left);
    const r = this.$.value(right);
    const frame = { ty: "bin", op: "+", left, right };
    return { left: l, right: r, skip: true, frame };
  }
  templateConcat(_id, _left, _right, result, frame) {
    required(frame !== void 0, "templateConcat hook missing frame");
    this.siteResolver.reportId(_id);
    const f = frame;
    return {
      result: SYNTAX__add(this.$, f.left, f.right)
    };
  }
  unaryPre(_id, op, _prefix, operand) {
    const e = this.$.value(operand);
    const escaped = op === "+" || op === "-" || op === "~" ? this.escaper.wrapForOperator([e]) : void 0;
    const frame = { ty: "un", op, operand, escaped };
    return { op, operand: e, skip: false, frame };
  }
  unary(_id, _op, _prefix, _operand, result, frame) {
    required(frame !== void 0, "unary hook missing frame");
    this.siteResolver.reportId(_id);
    const f = frame;
    if (f.escaped) this.escaper.restore(f.escaped);
    const transformed = this.lift(
      result,
      this.unaryInfo?.(f.op, this.valued(f.operand)) ?? this.defaultInfo(result, [this.valued(f.operand)])
    );
    return { result: transformed };
  }
  getFieldPre(_id, base, prop) {
    const frame = {
      ty: "getField",
      base,
      prop
    };
    return {
      base: this.$.value(base),
      prop: this.$.value(prop),
      skip: false,
      frame
    };
  }
  getField(_id, _base, _prop, result, _isPrivate, frame) {
    required(frame !== void 0, "getField hook missing frame");
    this.siteResolver.reportId(_id);
    const transformed = (() => {
      const f = frame;
      const b = this.$.value(f.base);
      const p = this.$.value(f.prop);
      if (typeof b === "string") {
        const i = this.$.value(
          AO__CanonicalNumericIndexString(
            this.$,
            this.$.default(p.toString(), [f.prop])
          )
        );
        if (i !== void 0) {
          if (this.getFieldInfo !== void 0) {
            return this.lift(
              result,
              this.getFieldInfo(
                this.valued(f.base),
                this.valued(f.prop),
                this.valued(result)
              ) ?? this.defaultInfo(result, [
                this.valued(f.base),
                this.valued(f.prop)
              ])
            );
          }
          return this.$.substring(
            f.base,
            this.$.default(i, [f.prop]),
            this.$.default(i + 1, [f.prop])
          );
        }
        if (p === "length") {
          if (this.$.value(this.$.isType(f.base, "string"))) {
            return this.lift(
              result,
              this.lengthOfStringInfo?.(
                this.valued(f.base)
              ) ?? this.defaultInfo(result, [this.valued(f.base)])
            );
          } else {
            return this.lift(
              result,
              this.defaultInfo(result, [this.valued(f.base)])
            );
          }
        }
      }
      if (this.isLifted(result) && !this.domain.isBottom(this.getInfo(result))) {
        return result;
      }
      return this.lift(
        result,
        this.getFieldInfo?.(
          this.valued(f.base),
          this.valued(f.prop),
          this.valued(result)
        ) ?? this.defaultInfo(result, [this.valued(f.base), this.valued(f.prop)])
      );
    })();
    return { result: transformed };
  }
  putFieldPre(_id, base, prop, value) {
    const rawBase = this.$.value(base);
    let v = value;
    if (ArrayBuffer.isView(rawBase)) {
      v = this.$.value(value);
    } else {
      this.escaper.markEscapable(value);
    }
    return {
      base: rawBase,
      prop: this.$.value(prop),
      value: v,
      skip: false
    };
  }
  // // Class field initializers store natively, like a putField.
  // fieldInit(_id: number, _obj: any, _key: any, _isStatic: boolean, value: any) {
  //   this.escaper.markEscapable(value);
  // }
  // the native instrumenter needs a raw string
  instrumentCodePre(_id, code, _isDirect) {
    return { code: this.$.value(code), skip: false };
  }
  // ---- shared call dispatch (used by invokeFunPre/invokeFun and $.apply) ----
  // A call from instrumented code is split across invokeFunPre (decide + escape
  // args) and invokeFun (run the model / shape the result) because the engine
  // makes the native call between the two hooks. $.apply makes the call itself,
  // so it runs the same pieces back-to-back. The classification and the
  // result-shaping live here so neither path can drift from the other.
  /** modeled  — a supported builtin with at least one non-bottom or non-primitive
   *             input (all-bottom-primitive inputs skip the model for speed);
   *  opaque   — crosses into uninstrumented native code (escape args, run, restore);
   *  transparent — an instrumented callee; lifted values flow straight through. */
  callKind(f, entries) {
    if (this.modelBuiltins && Model.support(f) && !entries.every(
      (e) => this.isPrimitive(this.$.value(e)) && this.domain.isBottom(this.getInfo(e))
    ))
      return "modeled";
    return this.policy.isOpaque(f) ? "opaque" : "transparent";
  }
  /** Run a modeled builtin's polyfill under the builtin's Site. */
  callModeled(f, base, args) {
    const modelFn = Model.ofBuiltin(f);
    return this.siteResolver.withBuiltinSite(
      this.siteResolver.builtinName(f),
      () => ReflectApply(modelFn, void 0, concatList([this.$, base], args))
    );
  }
  /** Keep an already-lifted result; otherwise derive default info from the
   *  parents that flowed into the call. */
  carryOrDefault(result, parents) {
    if (this.isLifted(result)) return result;
    return this.$.default(result, parents);
  }
  /** Provenance for a value returned from an uninstrumented (opaque) native
   *  call: restore the primitives escaped on the way in, then attach info from
   *  the analysis hook or fall back to default propagation. */
  opaqueResult(f, entries, result, escaped) {
    if (escaped.length > 0) this.escaper.restore(escaped);
    const opaqueInfo = this.opaqueCallInfo?.(f, entries, result);
    if (opaqueInfo !== void 0) return this.lift(result, opaqueInfo);
    return this.carryOrDefault(result, entries);
  }
  opaqueEscapeOptions(f) {
    return {
      wrapTopLevelCoercion: f === String || f === Number || f === BigInt || f === Symbol || f === parseInt || f === parseFloat || f === isFinite || f === isNaN
    };
  }
  invokeFunPre(_id, _f, _base, args, _isConstructor, _isMethod) {
    this.siteResolver.reportId(_id);
    const argArr = Array.from(args);
    const entries = _isMethod ? concatList([_base], argArr) : argArr;
    const kind = this.callKind(_f, entries);
    if (kind === "modeled") {
      if (_isConstructor && !isConstructable(Model.ofBuiltin(_f))) {
        throw new TypeError(
          `${this.siteResolver.builtinName(_f)} is not a constructor`
        );
      }
      return {
        skip: true,
        f: _f,
        base: _base,
        args: argArr,
        frame: { ty: "opaque", f: _f, modeled: true, entries, escaped: [] }
      };
    }
    const callee = this.$.value(_f);
    if (kind === "opaque") {
      const esc = this.escaper.escape(
        _base,
        argArr,
        entries,
        this.opaqueEscapeOptions(callee)
      );
      if (esc.crossed.length > 0)
        this.escapedInfo?.(
          _f,
          esc.crossed.map((w) => this.valued(w))
        );
      return {
        skip: false,
        f: callee,
        base: esc.base,
        args: esc.args,
        frame: {
          ty: "opaque",
          f: _f,
          modeled: false,
          entries,
          escaped: esc.log
        }
      };
    }
    return {
      skip: false,
      f: callee,
      base: _base,
      args,
      frame: { ty: "transparent", entries }
    };
  }
  invokeFun(_id, _f, _base, _args2, result, _isConstructor, _isMethod, frame) {
    required(frame !== void 0, "invokeFun hook missing frame");
    this.siteResolver.reportId(_id);
    const f = frame;
    if (f.ty === "transparent")
      return { result: this.carryOrDefault(result, f.entries) };
    if (f.modeled)
      return {
        result: this.callModeled(_f, _base, _args2)
      };
    return {
      result: this.opaqueResult(_f, f.entries, result, f.escaped)
    };
  }
};

// src/dynajs-analysis/provenance.ts
var UNKNOWN_SITE2 = { kind: "unknown" };
function isPrimitive(value) {
  return value === null || typeof value !== "object" && typeof value !== "function";
}
function normalizeProvenanceValue(value, seen = /* @__PURE__ */ new WeakMap()) {
  if (isPrimitive(value)) return value;
  if (typeof value === "function") return value;
  const objectValue = value;
  if (seen.has(objectValue)) return seen.get(objectValue);
  const valueOf = objectValue.valueOf;
  if (typeof valueOf === "function") {
    try {
      const primitive = valueOf.call(objectValue);
      if (primitive !== objectValue && isPrimitive(primitive)) return primitive;
    } catch {
    }
  }
  if (Array.isArray(value)) {
    const result2 = [];
    seen.set(objectValue, result2);
    for (const element of value) {
      result2.push(normalizeProvenanceValue(element, seen));
    }
    return result2;
  }
  const result = {};
  seen.set(objectValue, result);
  for (const [key, child] of Object.entries(value)) {
    result[key] = normalizeProvenanceValue(child, seen);
  }
  return result;
}
function anyTainted(info) {
  if (info === void 0) return false;
  return info.bit || (info.chars?.some((c) => c) ?? false);
}
function newNode(label, parents, value, site = UNKNOWN_SITE2, sinkType = "") {
  const tainted = label === "Tainted" || parents.some((p) => p.tainted);
  return { label, parents, value: normalizeProvenanceValue(value), tainted, site, sinkType };
}

// src/dynajs-analysis/prelude.ts
function __set_taint__(v) {
  D$.analysis.setTaint(v, true);
}
function __is_tainted__(v) {
  return D$.analysis.isTainted(v);
}
function __is_tainted_at__(v, index) {
  return D$.analysis.isTaintedAt(v, index);
}
function __assert__(v) {
  D$.analysis.assert(v);
}
function __print_if_tainted__(x) {
  if (D$.analysis.isTainted(x)) {
    console.log("@@DJX_VERDICT detected");
  } else {
    console.log("@@DJX_VERDICT clean");
  }
}
function __flow_found__() {
  return D$.analysis.flowFound;
}
function __print_if_flow__() {
  console.log(D$.analysis.flowFound ? "@@DJX_VERDICT detected" : "@@DJX_VERDICT clean");
}
function __taint_loc_line__(v) {
  return D$.analysis.taintLocLine(v);
}
function __taint_label__(v) {
  return D$.analysis.taintLabel(v);
}
function __flow_sink_type__() {
  return D$.analysis.flowSinkType();
}
function __flow_complexity__() {
  return D$.analysis.provenanceComplexity;
}
function __flow_attacker_data__() {
  return D$.analysis.attackerControlledData;
}
function __flow_prefix__() {
  return D$.analysis.prefixAce;
}
function __flow_triggers__() {
  return D$.analysis.triggersFlow;
}
function __taint_json__(v) {
  return D$.analysis.taintJson(v);
}
function __jalangi_set_taint__(v) {
  D$.analysis.setTaint(v, true);
}
function __jalangi_clear_taint__(v) {
  D$.analysis.clearTaint(v);
}
function __jalangi_get_taint__(v) {
  return D$.analysis.getTaint(v);
}
function __jalangi_set_prop_taint__(obj, key) {
  D$.analysis.setPropTaint(obj, key, true);
}
function __jalangi_clear_prop_taint__(obj, key) {
  D$.analysis.clearPropTaint(obj, key);
}
function __jalangi_check_taint__(v) {
  D$.analysis.checkTaint(v);
}
function __jalangi_check_taint_string__(v) {
  D$.analysis.checkTaintString(v);
}
function __jalangi_assert_taint_true__(v) {
  D$.analysis.assertTaintTrue(v);
}
function __jalangi_assert_taint_false__(v) {
  D$.analysis.assertTaintFalse(v);
}
function __jalangi_assert_prop_taint_true__(obj, key) {
  const concreteObj = D$.analysis.valued(obj).value;
  const concreteKey = String(D$.analysis.valued(key).value);
  if (concreteObj === null || typeof concreteObj !== "object" && typeof concreteObj !== "function") {
    throw new Error("Property expected to be tainted");
  }
  const propVal = concreteObj[concreteKey];
  if (!D$.analysis.isTainted(propVal)) throw new Error("Property expected to be tainted");
}
function __jalangi_assert_prop_taint_false__(obj, key) {
  const concreteObj = D$.analysis.valued(obj).value;
  const concreteKey = String(D$.analysis.valued(key).value);
  if (concreteObj === null || typeof concreteObj !== "object" && typeof concreteObj !== "function") return;
  const propVal = concreteObj[concreteKey];
  if (D$.analysis.isTainted(propVal)) throw new Error("Property expected to be untainted");
}
function __jalangi_assert_some_prop_tainted__(obj) {
  const concreteObj = D$.analysis.valued(obj).value;
  if (concreteObj === null || typeof concreteObj !== "object") {
    throw new Error("Argument expected to have at least one tainted property");
  }
  for (const k of Object.keys(concreteObj)) {
    if (D$.analysis.isTainted(concreteObj[k])) return;
  }
  throw new Error("Argument expected to have at least one tainted property");
}
function __jalangi_assert_wrapped__(v) {
  D$.analysis.assertWrapped(v);
}
function __jalangi_assert_not_wrapped__(v) {
  D$.analysis.assertNotWrapped(v);
}
function __jalangi_set_sink__(f) {
  D$.analysis.setSink(f);
}
function __string_range_set_taint__(str, lb, ub) {
  D$.analysis.stringRangeSetTaint(str, lb, ub);
}
function __string_range_clear_taint__(str, lb, ub) {
  D$.analysis.stringRangeClearTaint(str, lb, ub);
}
function __assert_string_range_all_tainted__(str, lb, ub) {
  D$.analysis.assertStringRangeAllTainted(str, lb, ub);
}
function __assert_string_range_all_untainted__(str, lb, ub) {
  D$.analysis.assertStringRangeAllUntainted(str, lb, ub);
}
function __assert_array_range_all_tainted__(arr, lb, ub) {
  D$.analysis.assertArrayRangeAllTainted(arr, lb, ub);
}
function __assert_array_range_all_untainted__(arr, lb, ub) {
  D$.analysis.assertArrayRangeAllUntainted(arr, lb, ub);
}
function __fuzzer_get_trace_properties__(_placeholder) {
  return D$.analysis.getTraceProp();
}
function __fuzzer__reset_state__() {
  D$.analysis.resetState();
}
function __set_taint_flow_path__(p) {
  D$.analysis.setTaintFlowPath(p);
}
function __get_taint_flow_idx__() {
  return D$.analysis.getTaintFlowIdx();
}
function installPrelude() {
  const g = globalThis;
  g.__set_taint__ = __set_taint__;
  g.__is_tainted__ = __is_tainted__;
  g.__is_tainted_at__ = __is_tainted_at__;
  g.__assert__ = __assert__;
  g.__print_if_tainted__ = __print_if_tainted__;
  g.__flow_found__ = __flow_found__;
  g.__print_if_flow__ = __print_if_flow__;
  g.__taint_loc_line__ = __taint_loc_line__;
  g.__taint_label__ = __taint_label__;
  g.__flow_sink_type__ = __flow_sink_type__;
  g.__flow_complexity__ = __flow_complexity__;
  g.__flow_attacker_data__ = __flow_attacker_data__;
  g.__flow_prefix__ = __flow_prefix__;
  g.__flow_triggers__ = __flow_triggers__;
  g.__taint_json__ = __taint_json__;
  g.__jalangi_set_taint__ = __jalangi_set_taint__;
  g.__jalangi_clear_taint__ = __jalangi_clear_taint__;
  g.__jalangi_get_taint__ = __jalangi_get_taint__;
  g.__jalangi_set_prop_taint__ = __jalangi_set_prop_taint__;
  g.__jalangi_clear_prop_taint__ = __jalangi_clear_prop_taint__;
  g.__jalangi_check_taint__ = __jalangi_check_taint__;
  g.__jalangi_check_taint_string__ = __jalangi_check_taint_string__;
  g.__jalangi_assert_taint_true__ = __jalangi_assert_taint_true__;
  g.__jalangi_assert_taint_false__ = __jalangi_assert_taint_false__;
  g.__jalangi_assert_prop_taint_true__ = __jalangi_assert_prop_taint_true__;
  g.__jalangi_assert_prop_taint_false__ = __jalangi_assert_prop_taint_false__;
  g.__jalangi_assert_some_prop_tainted__ = __jalangi_assert_some_prop_tainted__;
  g.__jalangi_assert_wrapped__ = __jalangi_assert_wrapped__;
  g.__jalangi_assert_not_wrapped__ = __jalangi_assert_not_wrapped__;
  g.__jalangi_set_sink__ = __jalangi_set_sink__;
  g.__string_range_set_taint__ = __string_range_set_taint__;
  g.__string_range_clear_taint__ = __string_range_clear_taint__;
  g.__assert_string_range_all_tainted__ = __assert_string_range_all_tainted__;
  g.__assert_string_range_all_untainted__ = __assert_string_range_all_untainted__;
  g.__assert_array_range_all_tainted__ = __assert_array_range_all_tainted__;
  g.__assert_array_range_all_untainted__ = __assert_array_range_all_untainted__;
  g.__fuzzer_get_trace_properties__ = __fuzzer_get_trace_properties__;
  g.__fuzzer__reset_state__ = __fuzzer__reset_state__;
  g.__set_taint_flow_path__ = __set_taint_flow_path__;
  g.__get_taint_flow_idx__ = __get_taint_flow_idx__;
  return /* @__PURE__ */ new Set([
    // Legacy
    __set_taint__,
    __is_tainted__,
    __is_tainted_at__,
    __assert__,
    __print_if_tainted__,
    __flow_found__,
    __print_if_flow__,
    __taint_loc_line__,
    __taint_label__,
    __flow_sink_type__,
    __flow_complexity__,
    __flow_attacker_data__,
    __flow_prefix__,
    __flow_triggers__,
    __taint_json__,
    // __jalangi_*
    __jalangi_set_taint__,
    __jalangi_clear_taint__,
    __jalangi_get_taint__,
    __jalangi_set_prop_taint__,
    __jalangi_clear_prop_taint__,
    __jalangi_check_taint__,
    __jalangi_check_taint_string__,
    __jalangi_assert_taint_true__,
    __jalangi_assert_taint_false__,
    __jalangi_assert_prop_taint_true__,
    __jalangi_assert_prop_taint_false__,
    __jalangi_assert_some_prop_tainted__,
    __jalangi_assert_wrapped__,
    __jalangi_assert_not_wrapped__,
    __jalangi_set_sink__,
    // String-range
    __string_range_set_taint__,
    __string_range_clear_taint__,
    __assert_string_range_all_tainted__,
    __assert_string_range_all_untainted__,
    // Array-range
    __assert_array_range_all_tainted__,
    __assert_array_range_all_untainted__,
    // Fuzzer protocol
    __fuzzer_get_trace_properties__,
    __fuzzer__reset_state__,
    __set_taint_flow_path__,
    __get_taint_flow_idx__
  ]);
}

// src/dynajs-analysis/sinks.ts
import { exec, execSync, spawn, spawnSync } from "node:child_process";
import { Script } from "node:vm";
var SINKS = /* @__PURE__ */ new Map([
  [Function, "Function"],
  [exec, "exec"],
  [execSync, "exec"],
  [eval, "eval"],
  [Script, "eval"],
  [spawn, "spawn"],
  [spawnSync, "spawn"]
]);
var _dynamicSinks = /* @__PURE__ */ new Map();
function registerDynamicSink(f, name = "__jalangi_set_sink__") {
  _dynamicSinks.set(f, name);
}
function sinkName(f) {
  const registered = SINKS.get(f) ?? _dynamicSinks.get(f);
  if (registered !== void 0) return registered;
  if (typeof f === "function" && f.name === "Function") {
    try {
      if (/\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(f))) {
        return "Function";
      }
    } catch {
    }
  }
  if (typeof f === "function" && Object.getPrototypeOf(f) === Function) {
    return "Function";
  }
  return void 0;
}

// src/dynajs-analysis/report.ts
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
var FLOW_FINGERPRINT_PATH = process.env.NODEMEDIC_FP_PATH ?? "flow_fingerprints.jsonl";
function siteToLoc(site) {
  if (site.kind === "code") {
    return {
      scriptName: site.file,
      startLineNumber: site.start.line,
      startColumnNumber: site.start.column,
      endLineNumber: site.end.line,
      endColumnNumber: site.end.column
    };
  }
  return {
    scriptName: "UNKNOWN",
    startLineNumber: -1,
    startColumnNumber: -1,
    endLineNumber: -1,
    endColumnNumber: -1
  };
}
function get_untainted_vals(pn) {
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
function get_tainted_vals_aux(pn, sink) {
  var result = [];
  if (!pn) {
    return result;
  }
  if (pn.label === "Tainted") {
    return result;
  }
  if (pn.tainted && !((pn.label === "call:stringify" || pn.label === "imprecise:stringify") && sink == "eval") && !((pn.label === "call:encodeURIComponent" || pn.label === "call:escape" || pn.label === "imprecise:escape" || pn.label === "imprecise:encodeURIComponent") && (sink == "exec" || sink == "spawn"))) {
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
function get_tainted_vals(pn, sink) {
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
  if ((pn.label === "call:encodeURIComponent" || pn.label === "call:escape") && (sink == "exec" || sink == "spawn")) {
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
var map_expl = {
  "imprecise:concat": [0.03, 0.03],
  "model:string.split": [0.23, 0.92],
  "object.GetField": [0.17, 0.03],
  "call:isArray": [0.23, 0.16],
  "call:existsSync": [0.45, 0.55],
  "call:Anonymous Function": [0.21, 0.04],
  "precise:string.substr": [0.1, 0],
  "call:exec": [0.05, 0.01],
  "call:compile": [0.08, 0.02],
  "call:parse": [0.08, 0],
  "call:substring": [0.21, 0],
  "call:eval": [0.67, 0],
  "string.GetField": [0, 0],
  "call:Array": [0.01, 0],
  "imprecise:stringify": [0.09, 0],
  "imprecise:Array": [0, 0],
  "|": [0, 0.4],
  "model:array.join": [0.4, 0.5],
  "call:add": [0.22, 0.64],
  "call:hasOwnProperty": [0.03, 0],
  "precise:string.substring": [0.09, 0.01],
  "call:concat": [0.47, 0.67],
  "precise:string.replace": [0.21, 0.05],
  "call:indexOf": [0.12, 0.01],
  "-": [0, 0.01],
  "call:isObject": [0, 0.5],
  "call:string": [0, 0],
  "object.Unary": [0, 0.01],
  ">>>": [0, 1],
  "call:log": [0.84, 0.71],
  "imprecise:slice": [0.04, 0],
  "precise:string.trim": [0.19, 0.75],
  "model:array.map": [0.02, 0.26],
  "call:debug": [0.67, 0],
  "precise:string.concat": [0.11, 0.41],
  "call:get": [0.55, 1],
  "call:charAt": [0, 0],
  "imprecise:filter": [0, 0.5],
  "call:push": [0.08, 0.02],
  "call:stringify": [0.08, 0.12],
  "call:replace": [0.43, 0.13],
  "imprecise:call": [0.62, 0],
  "call:matchAll": [0, 0],
  "+": [0.08, 0.01],
  "precise:string.slice": [0.12, 0],
  "call:isString": [0.1, 1],
  "call:String": [0.26, 1],
  "call:assign": [0.42, 0.34]
};
function get_number_of_nodes(pn, visited = /* @__PURE__ */ new Set()) {
  var result = 0;
  if (!pn) {
    return result;
  }
  if (visited.has(pn)) return 0;
  visited.add(pn);
  if (map_expl[pn.label] !== void 0) {
    result += 1 - map_expl[pn.label][1 - Number(pn.tainted)];
  } else {
    result += 0.958;
  }
  for (const parent of pn.parents) {
    result += get_number_of_nodes(parent, visited);
  }
  return result;
}
function circularReplacer() {
  const seen = /* @__PURE__ */ new WeakSet();
  return function(_key, value) {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  };
}
function stringifyTaintPathJSON(json) {
  try {
    return JSON.stringify(json, null, 4);
  } catch {
    return JSON.stringify(json, circularReplacer(), 4);
  }
}
function flowFingerprint(root) {
  const ops = [];
  const sites = /* @__PURE__ */ new Set();
  let sink = "";
  const seen = /* @__PURE__ */ new Set();
  const visit = (node) => {
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
    sites: sites.size
  };
}
function recordFlowTelemetry(root) {
  try {
    const g = globalThis;
    const ts = Date.now();
    if (g.__nm_first_flow_ms__ == null) g.__nm_first_flow_ms__ = ts;
    const f = flowFingerprint(root);
    appendFileSync(
      FLOW_FINGERPRINT_PATH,
      JSON.stringify({ ts, fp: f.fp, sink: f.sink, ops: f.ops, sites: f.sites, tainted: root.tainted }) + "\n"
    );
  } catch (_err) {
  }
}
function buildTaintPathJSON(root) {
  const out = {};
  const walk = (pn, id) => {
    const thisId = id;
    const flows_from = [];
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
      sink_type: pn.sinkType
    };
    return id;
  };
  walk(root, 1);
  return out;
}

// src/dynajs-analysis/config.ts
function getEnvArgs() {
  const rawArgs = process.env.NODEMEDIC_ANALYSIS_ARGS ?? "";
  if (rawArgs.trim() === "") return [];
  try {
    const parsed = JSON.parse(rawArgs);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) return parsed;
  } catch (_err) {
  }
  return rawArgs.split(" ").filter(Boolean);
}
function parseArgs(args) {
  const m = /* @__PURE__ */ new Map();
  for (const arg of args) {
    const eq = arg.indexOf("=");
    if (eq === -1) {
      m.set(arg, "true");
    } else {
      m.set(arg.slice(0, eq), arg.slice(eq + 1));
    }
  }
  return m;
}
var _args = parseArgs(getEnvArgs());
var taintPathsJson = _args.get("taint_paths_json") === "true";
var logLevel = _args.get("log_level") ?? "";
var abortOnFlow = _args.get("abort_on_flow") === "true";

// src/dynajs-analysis/trace.ts
var TraceProperty = class _TraceProperty {
  // exploitability metric (read by the fuzzer's compute_exploitability_vals)
  called_sink = void 0;
  triggers_flow = 0;
  prefix_ace = "";
  provenance_complexity = 0;
  attacker_controlled_data = "";
  // coverage. branches/global_branches dedup branch ids; the fuzzer reads the
  // two counters. Our DynaJS condition ids are globally unique, so a flat Set
  // suffices (no per-script-sid dimension the legacy engine needed).
  branches = /* @__PURE__ */ new Set();
  global_branches = /* @__PURE__ */ new Set();
  code_coverage = 0;
  global_code_coverage = 0;
  // object reconstruction (read by the fuzzer when use_object_reconstruction)
  accessed_attrs = [];
  add_field(offset) {
    if (!this.accessed_attrs.includes(offset)) this.accessed_attrs.push(offset);
  }
  // Records a covered branch. key = taken ? id : id-1 (mirrors legacy condition
  // hook). Increments per-iteration + global coverage on first sight.
  coverBranch(id, taken) {
    const key = taken ? id : id - 1;
    if (!this.branches.has(key)) {
      this.branches.add(key);
      this.code_coverage++;
    }
    if (!this.global_branches.has(key)) {
      this.global_branches.add(key);
      this.global_code_coverage++;
    }
  }
  // Per-fuzzer-iteration reset: clears per-input coverage + exploitability, KEEPS
  // global_branches/global_code_coverage (mirrors Base.ts:64-74).
  reset_state() {
    this.called_sink = void 0;
    this.triggers_flow = 0;
    this.prefix_ace = "";
    this.provenance_complexity = 0;
    this.attacker_controlled_data = "";
    this.branches = /* @__PURE__ */ new Set();
    this.code_coverage = 0;
    this.accessed_attrs = [];
  }
  // Only the exploitability fields are cloned (Base.ts:76-85) — what FlowError carries.
  clone() {
    const cp = new _TraceProperty();
    cp.called_sink = this.called_sink;
    cp.triggers_flow = this.triggers_flow;
    cp.prefix_ace = this.prefix_ace;
    cp.provenance_complexity = this.provenance_complexity;
    cp.attacker_controlled_data = this.attacker_controlled_data;
    return cp;
  }
};
var FlowError = class extends Error {
  found_flow = true;
  trace_prop;
  constructor(message, trace_prop) {
    super(message);
    this.trace_prop = trace_prop;
  }
};

// src/dynajs-analysis/index.ts
var GHOSTS = installPrelude();
var GHOST_NAMES = new Set(
  Array.from(GHOSTS, (fn) => fn.name).filter(
    (n) => typeof n === "string" && n.length > 0
  )
);
function isPrimitive2(value) {
  return value === null || typeof value !== "object" && typeof value !== "function";
}
function functionNameMatches(pendingName, actualName) {
  return pendingName === actualName || pendingName.replace(/^(bound )+/, "") === actualName;
}
function isNativeFunction(value) {
  try {
    return /\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(value));
  } catch {
    return false;
  }
}
function isCommonJSRequire(value) {
  const maybeRequire = value;
  return value.name === "require" && typeof maybeRequire.resolve === "function" && maybeRequire.cache !== void 0 && maybeRequire.extensions !== void 0;
}
function isArgumentsObject(value) {
  return Object.prototype.toString.call(value) === "[object Arguments]";
}
function arrayLikeEntries(value, concrete) {
  const length = Number(value?.length ?? concrete.length);
  return Array.from({ length }, (_, i) => value[i]);
}
var NodeMedicAnalysis = class extends FlowAnalysis {
  transparentCalls = GHOSTS;
  domain = {
    getBottom: () => void 0,
    isBottom: (info) => !anyTainted(info)
  };
  // --- flow verdict state ---
  flowFound = false;
  flowSink = void 0;
  flowNode = void 0;
  // --- taint-path output location (set via __set_taint_flow_path__) ---
  taintPath = "./";
  // --- TraceProperty: holds exploit metrics + branch/field coverage ---
  traceProp = new TraceProperty();
  // --- exploit metrics: getters backed by traceProp (prelude reads these as fields) ---
  get provenanceComplexity() {
    return this.traceProp.provenance_complexity;
  }
  get attackerControlledData() {
    return this.traceProp.attacker_controlled_data;
  }
  get prefixAce() {
    return this.traceProp.prefix_ace;
  }
  get triggersFlow() {
    return this.traceProp.triggers_flow;
  }
  // --- taint-path JSON file counter ---
  _taintFileCounter = 0;
  pendingCallArgs = [];
  pendingBindCalls = /* @__PURE__ */ new Map();
  boundFunctions = /* @__PURE__ */ new WeakMap();
  boundTargets = /* @__PURE__ */ new WeakMap();
  lastPrimitiveRead;
  primitiveVariableInfos = /* @__PURE__ */ new Map();
  fieldFrames = [];
  pendingFieldReturn;
  // --- propagation hooks ---
  operandNode(v) {
    return v.info?.node ?? newNode("Untainted", [], v.value, this.currentSite());
  }
  matchingBoundTargetArgs(target, runtimeArgs) {
    const candidates = this.boundTargets.get(target);
    if (candidates === void 0) return void 0;
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
    return void 0;
  }
  pendingArgsMatchRuntime(pendingArgs, runtimeArgs) {
    if (pendingArgs.length !== runtimeArgs.length) return false;
    for (let i = 0; i < pendingArgs.length; i++) {
      if (!Object.is(this.valued(pendingArgs[i]).value, this.valued(runtimeArgs[i]).value)) {
        return false;
      }
    }
    return true;
  }
  shouldTreatOpaqueCallAsForwarding(f, args) {
    if (typeof f !== "function" || !this.policy.isOpaque(f)) return false;
    if (isNativeFunction(f) || isCommonJSRequire(f)) return false;
    return args.some((arg) => {
      const tainted = this.findTaintedSinkValue(arg);
      return tainted !== void 0 && anyTainted(tainted.info);
    });
  }
  propagateArrayElementInfo(sourceArg, targetArg) {
    const source = this.valued(sourceArg).value;
    const target = this.valued(targetArg).value;
    if (!Array.isArray(source) || !Array.isArray(target)) return false;
    let propagated = false;
    const elementParents = [];
    const limit = Math.min(source.length, target.length);
    for (let i = 0; i < limit; i++) {
      const sourceElement = this.valued(source[i]);
      if (!anyTainted(sourceElement.info)) continue;
      if (!Object.is(sourceElement.value, this.valued(target[i]).value)) continue;
      elementParents.push(sourceElement.info.node);
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
        node: newNode("flow", elementParents, this.valued(targetArg).value, this.currentSite())
      });
    }
    return propagated;
  }
  arrayConcatResult(f, base, args, result) {
    const concreteBase = this.valued(base).value;
    const concreteResult = this.valued(result).value;
    if (!Array.isArray(concreteBase) || !Array.isArray(concreteResult) || f !== Array.prototype.concat && !(typeof f === "function" && f.name === "concat")) {
      return void 0;
    }
    const parents = [];
    let resultIndex = 0;
    const appendElement = (element) => {
      if (resultIndex >= concreteResult.length) return;
      const sourceElement = this.valued(element);
      const resultElement = this.valued(concreteResult[resultIndex]);
      if (anyTainted(sourceElement.info) && Object.is(sourceElement.value, resultElement.value)) {
        concreteResult[resultIndex] = this.lift(resultElement.value, sourceElement.info);
        parents.push(sourceElement.info.node);
      }
      resultIndex++;
    };
    const appendPart = (part) => {
      const concrete = this.valued(part).value;
      if (Array.isArray(concrete)) {
        for (const element of arrayLikeEntries(part, concrete)) appendElement(element);
      } else {
        appendElement(part);
      }
    };
    appendPart(base);
    for (const arg of Array.from(args ?? [])) appendPart(arg);
    if (parents.length === 0) return void 0;
    return this.lift(concreteResult, {
      bit: true,
      node: newNode("flow", parents, concreteResult, this.currentSite())
    });
  }
  objectAssignInfo(entries, result) {
    if (entries.length < 2) return void 0;
    const parents = entries.map((entry) => this.valued(entry));
    if (!parents.some((parent) => anyTainted(parent.info))) return void 0;
    return {
      bit: true,
      node: newNode(
        "call:assign",
        parents.map((parent) => this.operandNode(parent)),
        this.valued(result).value,
        this.currentSite()
      )
    };
  }
  materializeArrayElementInfo(arg) {
    if (!Array.isArray(arg.value)) return arg.value;
    let changed = false;
    const copy = arg.value.slice();
    for (let i = 0; i < copy.length; i++) {
      const element = this.valued(copy[i]);
      let info = element.info;
      if (!anyTainted(info) && anyTainted(arg.info)) {
        const propNode = newNode("Untainted", [], i, this.currentSite());
        info = {
          bit: true,
          node: newNode("object.GetField", [this.operandNode(arg), propNode], element.value, this.currentSite())
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
  currentSite() {
    return this.site();
  }
  defaultInfo(value, parents) {
    if (!parents.some((p) => anyTainted(p.info))) return void 0;
    const parentNodes = parents.map((p) => this.operandNode(p));
    const node = newNode("flow", parentNodes, value, this.currentSite());
    if (typeof value === "string") {
      return { bit: true, chars: Array.from({ length: value.length }, () => true), node };
    }
    return { bit: true, node };
  }
  opaqueCallInfo(f, entries, result) {
    if (f === Object.assign) {
      return this.objectAssignInfo(entries, result);
    }
    return void 0;
  }
  concatenateInfo(left, leftLength, right, rightLength) {
    const chars = [];
    const push = (n, info) => {
      for (let i = 0; i < n; i++) {
        chars.push(info?.chars !== void 0 ? info.chars[i] === true : info?.bit ?? false);
      }
    };
    push(leftLength, left.info);
    push(rightLength, right.info);
    const parents = [this.operandNode(left), this.operandNode(right)];
    const value = String(left.value) + String(right.value);
    return {
      bit: anyTainted(left.info) || anyTainted(right.info) || chars.some((c) => c),
      chars,
      node: newNode("precise:string.concat", parents, value, this.currentSite())
    };
  }
  coercedObjectConcatInfo(left, right, result) {
    if (typeof result !== "string") return void 0;
    const leftValue = this.valued(left);
    const rightValue = this.valued(right);
    const leftObjectTainted = leftValue.value !== null && (typeof leftValue.value === "object" || typeof leftValue.value === "function") && anyTainted(leftValue.info);
    const rightObjectTainted = rightValue.value !== null && (typeof rightValue.value === "object" || typeof rightValue.value === "function") && anyTainted(rightValue.info);
    if (!leftObjectTainted && !rightObjectTainted) return void 0;
    const chars = Array.from({ length: result.length }, () => false);
    const leftPrimitiveString = isPrimitive2(leftValue.value) ? String(leftValue.value) : void 0;
    const rightPrimitiveString = isPrimitive2(rightValue.value) ? String(rightValue.value) : void 0;
    if (leftObjectTainted && rightPrimitiveString !== void 0 && result.endsWith(rightPrimitiveString)) {
      chars.fill(true, 0, result.length - rightPrimitiveString.length);
    } else if (rightObjectTainted && leftPrimitiveString !== void 0 && result.startsWith(leftPrimitiveString)) {
      chars.fill(true, leftPrimitiveString.length);
    } else {
      chars.fill(true);
    }
    const parents = [this.operandNode(leftValue), this.operandNode(rightValue)];
    return {
      bit: chars.some((c) => c),
      chars,
      node: newNode("precise:string.concat", parents, result, this.currentSite())
    };
  }
  // DynaJS a2e446e changed this hook's ABI: start/end now arrive as Valued
  // (carrying their own index taint), not raw numbers, and resultLength is the
  // 4th arg. We mirror the legacy numeric-offset behavior under the new ABI.
  substringInfo(src, start, _end, resultLength) {
    const startN = Number(start.value);
    const chars = [];
    for (let i = 0; i < resultLength; i++) {
      if (src.info?.chars !== void 0) chars.push(src.info.chars[startN + i] === true);
      else chars.push(src.info?.bit ?? false);
    }
    const parents = [this.operandNode(src)];
    const value = String(src.value).substring(startN, startN + resultLength);
    return {
      bit: anyTainted(src.info) || chars.some((c) => c),
      chars,
      node: newNode("precise:string.substring", parents, value, this.currentSite())
    };
  }
  getFieldInfo(base, prop, result) {
    if (!anyTainted(base.info) && !anyTainted(prop.info)) return void 0;
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
  conditionInfo(id, _cond, taken) {
    this.traceProp.coverBranch(id, taken);
  }
  // --- field access recording ---
  getField(id, base, prop, result, isPrivateOrFrame, maybeFrame) {
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
      const index = typeof concreteProp === "number" ? concreteProp : typeof concreteProp === "symbol" ? NaN : Number(concreteProp);
      if (Number.isInteger(index) && index >= 0 && index < concreteBase.length) {
        result = concreteBase[index];
      }
    }
    return super.getField(id, base, prop, result, isPrivate, frame);
  }
  forInOfObject(id, value, isForIn) {
    const source = this.valued(value);
    if (typeof source.value === "string") {
      const chars = [];
      for (let i = 0; i < source.value.length; i++) {
        const start = this.lift(i);
        const end = this.lift(i + 1);
        const ch = source.value[i];
        const info = this.substringInfo(
          source,
          this.valued(start),
          this.valued(end),
          ch.length
        );
        chars.push(this.lift(ch, info));
      }
      return { result: chars };
    }
    return super.forInOfObject(id, value, isForIn);
  }
  functionEnter(_id, f, _base, args, _isAsync, _isGenerator) {
    const runtimeArgs = Array.from(args ?? []);
    let pendingArgs;
    let pendingInfos;
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
    if (pendingArgs === void 0 && typeof concreteF === "function" && concreteF.name) {
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
    if (pendingArgs === void 0) {
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
    if (pendingArgs === void 0 && typeof concreteF === "function") {
      const matchedBoundArgs = this.matchingBoundTargetArgs(concreteF, runtimeArgs);
      if (matchedBoundArgs !== void 0) {
        pendingArgs = matchedBoundArgs;
        pendingForwarded = true;
      }
    }
    const provenanceArgs = pendingForwarded || pendingArgs !== void 0 && runtimeArgs.length === 0 ? pendingArgs ?? runtimeArgs : runtimeArgs;
    const argArr = runtimeArgs.length > 0 ? runtimeArgs : provenanceArgs;
    const allowParamNameFeedback = pendingArgs !== void 0 && runtimeArgs.length === 0;
    const name = typeof concreteF === "function" && concreteF.name ? concreteF.name : "Anonymous Function";
    const paramInfos = [];
    for (let i = 0; i < provenanceArgs.length; i++) {
      const sourceArg = provenanceArgs[i];
      const targetArg = argArr[i] ?? sourceArg;
      this.propagateArrayElementInfo(sourceArg, targetArg);
      const info = pendingInfos?.[i] ?? this.getInfo(sourceArg);
      if (pendingForwarded) paramInfos.push(void 0);
      if (!anyTainted(info)) continue;
      const valued = this.valued(targetArg);
      const callInfo = {
        ...info,
        node: newNode(`call:${name}`, [info.node], valued.value, this.currentSite())
      };
      if (pendingForwarded) paramInfos[i] = callInfo;
      this.setInfo(targetArg, callInfo);
    }
    const callValuedArgs = argArr.map((arg, i) => {
      const valued = this.valued(arg);
      const forwardedInfo = paramInfos[i];
      if (!anyTainted(valued.info) && anyTainted(forwardedInfo)) {
        return { value: valued.value, info: forwardedInfo };
      }
      return valued;
    });
    const argsTainted = callValuedArgs.some((arg) => anyTainted(arg.info));
    this.fieldFrames.push({
      name,
      argsTainted: argsTainted || paramInfos.some((info) => anyTainted(info)),
      args: callValuedArgs,
      nodes: [],
      paramNames: /* @__PURE__ */ new Set(),
      paramFields: /* @__PURE__ */ new Map(),
      paramInfos,
      allowParamNameFeedback,
      nextParamIndex: 0
    });
  }
  _return(_id, value) {
    const frame = this.fieldFrames.at(-1);
    if (frame === void 0) return void 0;
    if (!["toString", "valueOf", "[Symbol.toPrimitive]"].includes(frame.name)) return void 0;
    const concrete = this.valued(value).value;
    if (!isPrimitive2(concrete)) return void 0;
    return { result: concrete };
  }
  functionExit(_id, returnValue, exception, _isAsync, _isGenerator) {
    const frame = this.fieldFrames.pop();
    if (frame === void 0 || exception !== void 0 || !frame.argsTainted || frame.nodes.length === 0) {
      return;
    }
    if (anyTainted(this.getInfo(returnValue))) return;
    const fieldNode = frame.nodes[frame.nodes.length - 1];
    this.pendingFieldReturn = { name: frame.name, node: fieldNode, value: this.valued(returnValue).value };
  }
  stringConcatInfo(f, base, args, result) {
    const concreteBase = this.valued(base).value;
    if (concreteBase === null || typeof concreteBase === "undefined" || f !== String.prototype.concat && !(typeof f === "function" && f.name === "concat" && typeof concreteBase === "string")) {
      return void 0;
    }
    const pieces = [this.valued(base), ...Array.from(args ?? [], (arg) => this.valued(arg))];
    if (!pieces.some((piece) => anyTainted(piece.info))) return void 0;
    let current = {
      value: String(pieces[0].value),
      info: pieces[0].info
    };
    for (const piece of pieces.slice(1)) {
      const next = {
        value: String(piece.value),
        info: piece.info
      };
      const info = this.concatenateInfo(current, current.value.length, next, next.value.length);
      current = { value: current.value + next.value, info };
    }
    return current.value === result ? current.info : void 0;
  }
  arrayJoinInfo(f, base, result) {
    const concreteBase = this.valued(base).value;
    if (!Array.isArray(concreteBase) || f !== Array.prototype.join && !(typeof f === "function" && f.name === "join")) {
      return void 0;
    }
    const baseValue = this.valued(base);
    const pieces = concreteBase.map((element) => this.valued(element));
    if (!anyTainted(baseValue.info) && !pieces.some((piece) => anyTainted(piece.info))) return void 0;
    const parents = anyTainted(baseValue.info) ? [this.operandNode(baseValue)] : pieces.map((piece) => this.operandNode(piece));
    const value = String(result);
    return {
      bit: true,
      chars: Array.from({ length: value.length }, () => true),
      node: newNode("model:array.join", parents, value, this.currentSite())
    };
  }
  stringReplaceInfo(f, base, args, result) {
    const concreteBase = this.valued(base).value;
    if (concreteBase === null || typeof concreteBase === "undefined" || f !== String.prototype.replace && !(typeof f === "function" && f.name === "replace" && typeof concreteBase === "string") || typeof result !== "string") {
      return void 0;
    }
    const argArr = Array.from(args ?? []);
    const source = this.valued(base);
    const searchValue = this.valued(argArr[0]);
    const replaceValue = this.valued(argArr[1]);
    const pieces = [source, searchValue, replaceValue];
    if (!pieces.some((piece) => anyTainted(piece.info))) return void 0;
    const chars = Array.from(
      { length: result.length },
      () => pieces.some((piece) => anyTainted(piece.info))
    );
    return {
      bit: chars.some((c) => c),
      chars,
      node: newNode("precise:string.replace", pieces.map((piece) => this.operandNode(piece)), result, this.currentSite())
    };
  }
  normalizeSliceIndex(value, length, fallback) {
    if (value === void 0) return fallback;
    const integer = Math.trunc(Number(value));
    if (!Number.isFinite(integer)) return 0;
    if (integer < 0) return Math.max(length + integer, 0);
    return Math.min(integer, length);
  }
  argumentsSliceCallResult(f, base, args, result) {
    const concreteF = this.valued(f).value;
    const concreteBase = this.valued(base).value;
    if (concreteF !== Function.prototype.call || concreteBase !== Array.prototype.slice || !Array.isArray(result)) {
      return void 0;
    }
    const argArr = Array.from(args ?? []);
    const source = this.valued(argArr[0]).value;
    if (Object.prototype.toString.call(source) !== "[object Arguments]") return void 0;
    const frame = this.fieldFrames.at(-1);
    if (frame === void 0) return void 0;
    const length = frame.args.length;
    const start = this.normalizeSliceIndex(this.valued(argArr[1]).value, length, 0);
    const end = this.normalizeSliceIndex(this.valued(argArr[2]).value, length, length);
    const copied = result;
    let propagated = false;
    for (let sourceIndex = start, resultIndex = 0; sourceIndex < end && resultIndex < copied.length; sourceIndex++, resultIndex++) {
      const sourceArg = frame.args[sourceIndex];
      if (sourceArg === void 0 || !anyTainted(sourceArg.info)) continue;
      copied[resultIndex] = this.lift(copied[resultIndex], sourceArg.info);
      propagated = true;
    }
    return propagated ? copied : void 0;
  }
  objectEntriesResult(f, args, result) {
    if (f !== Object.entries || !Array.isArray(result)) return void 0;
    const argArr = Array.from(args ?? []);
    if (argArr.length < 1) return void 0;
    const source = this.valued(argArr[0]);
    const sourceObject = source.value;
    if (sourceObject === null || typeof sourceObject !== "object" && typeof sourceObject !== "function") {
      return void 0;
    }
    let propagated = false;
    for (const entry of result) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const key = this.valued(entry[0]).value;
      if (typeof key !== "string") continue;
      if (!Object.prototype.hasOwnProperty.call(sourceObject, key)) continue;
      const sourceValue = sourceObject[key];
      const sourceValueInfo = this.valued(sourceValue).info;
      const parentInfo = anyTainted(sourceValueInfo) ? sourceValueInfo : source.info;
      if (!anyTainted(parentInfo)) continue;
      const entryValue = this.valued(entry[1]).value;
      const propNode = newNode("Untainted", [], key, this.currentSite());
      const info = {
        bit: true,
        node: newNode(
          "object.GetField",
          [this.operandNode(source), propNode, parentInfo.node],
          entryValue,
          this.currentSite()
        )
      };
      if (typeof entryValue === "string") {
        info.chars = Array.from({ length: entryValue.length }, () => true);
      }
      entry[1] = this.lift(entry[1], info);
      propagated = true;
    }
    return propagated ? result : void 0;
  }
  objectKeysStringResult(f, args, result) {
    if (f !== Object.keys || !Array.isArray(result)) return void 0;
    const argArr = Array.from(args ?? []);
    if (argArr.length < 1) return void 0;
    const source = this.valued(argArr[0]);
    let sourceString;
    if (typeof source.value === "string") {
      sourceString = source.value;
    } else if (source.value instanceof String) {
      try {
        const primitive = String.prototype.valueOf.call(source.value);
        if (typeof primitive === "string") sourceString = primitive;
      } catch {
      }
    }
    if (sourceString === void 0) return void 0;
    const keys = result.map((key) => {
      const valuedKey = this.valued(key);
      if (typeof valuedKey.value !== "string" || !/^\d+$/.test(valuedKey.value)) {
        return key;
      }
      return valuedKey.value;
    });
    return keys;
  }
  registerReturnedSinkAlias(args, result) {
    if (typeof result !== "function") return;
    for (const arg of Array.from(args ?? [])) {
      const name = sinkName(this.valued(arg).value);
      if (name !== void 0) {
        registerDynamicSink(result, name);
        return;
      }
    }
  }
  abortWithFlow(err) {
    if (!abortOnFlow) return;
    setTimeout(() => {
      process.emit("uncaughtException", err);
      const backupExit = process.backup_exit;
      if (typeof backupExit === "function") {
        backupExit(0);
      } else {
        process.exit(0);
      }
    }, 0);
  }
  findTaintedSinkValue(value, seen = /* @__PURE__ */ new Set(), options = {}) {
    const valued = this.valued(value);
    const concrete = valued.value;
    if (concrete === null || typeof concrete !== "object" && typeof concrete !== "function") {
      return anyTainted(valued.info) ? valued : void 0;
    }
    if (seen.has(concrete)) return anyTainted(valued.info) ? valued : void 0;
    seen.add(concrete);
    const properties = Array.isArray(concrete) ? Array.from({ length: concrete.length }, (_, i) => i) : this.ownDataPropertyNames(concrete);
    for (const prop of properties) {
      const childValue = concrete[prop];
      const child = this.findTaintedSinkValue(childValue, seen, options);
      if (child === void 0 || !anyTainted(child.info)) continue;
      const propNode = newNode("Untainted", [], prop, this.currentSite());
      const node = newNode(
        "object.GetField",
        [this.operandNode(valued), propNode, child.info.node],
        child.value,
        this.currentSite()
      );
      return { value: child.value, info: { bit: true, node } };
    }
    if (options.allowArrayContainer === false) return void 0;
    return anyTainted(valued.info) ? valued : void 0;
  }
  ownDataPropertyNames(value) {
    try {
      return Object.getOwnPropertyNames(value).filter((prop) => {
        if (prop === "caller" || prop === "callee" || prop === "arguments") return false;
        const descriptor = Object.getOwnPropertyDescriptor(value, prop);
        return descriptor !== void 0 && "value" in descriptor;
      });
    } catch {
      return [];
    }
  }
  canReachNativeSink(name, args) {
    if (name !== "spawn") return true;
    if (args.length === 0) return false;
    if (typeof this.valued(args[0]).value !== "string") return false;
    if (args.length < 2) return true;
    const spawnArgs = this.valued(args[1]).value;
    return spawnArgs === void 0 || Array.isArray(spawnArgs) || spawnArgs !== null && typeof spawnArgs === "object";
  }
  write(_id, names, value) {
    const source = this.valued(value);
    if (names.length === 1) {
      const name = names[0];
      const concrete = source.value;
      if (name !== "undefined" && isPrimitive2(concrete)) {
        if (anyTainted(source.info)) {
          this.primitiveVariableInfos.set(name, { value: concrete, info: source.info });
        } else {
          const lastRead = this.lastPrimitiveRead;
          const primitiveInfo = lastRead !== void 0 && Object.is(lastRead.value, concrete) ? lastRead.info ?? this.primitiveVariableInfos.get(lastRead.name)?.info : void 0;
          if (primitiveInfo !== void 0) {
            this.primitiveVariableInfos.set(name, { value: concrete, info: primitiveInfo });
          } else {
            this.primitiveVariableInfos.delete(name);
          }
        }
      }
    }
    if (names.length <= 1 || source.value === null || typeof source.value !== "object" || !anyTainted(source.info)) {
      return void 0;
    }
    const destructured = new Set(names);
    const target = source.value;
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
      }
    });
    return { result: proxy };
  }
  invokeFun(id, f, base, args, result, isConstructor, isMethod, frame) {
    const post = super.invokeFun(id, f, base, args, result, isConstructor, isMethod, frame);
    const concreteResult = post !== void 0 ? this.valued(post.result).value : result;
    const concreteF = this.valued(f).value;
    const pendingBind = this.pendingBindCalls.get(id);
    this.pendingBindCalls.delete(id);
    if (pendingBind !== void 0 && typeof concreteResult === "function") {
      this.boundFunctions.set(concreteResult, pendingBind);
      const bindings = this.boundTargets.get(pendingBind.target) ?? [];
      bindings.push({ args: pendingBind.args });
      this.boundTargets.set(pendingBind.target, bindings.slice(-32));
      const name = sinkName(pendingBind.target);
      if (name !== void 0) {
        registerDynamicSink(concreteResult, name);
      }
    }
    if (concreteF === promisify) {
      const [target] = Array.from(args ?? []);
      const name = sinkName(this.valued(target).value);
      if (name !== void 0 && typeof concreteResult === "function") {
        registerDynamicSink(concreteResult, name);
      }
    }
    if (sinkName(concreteF) === "Function" && typeof concreteResult === "function") {
      registerDynamicSink(concreteResult, "Function");
    }
    this.registerReturnedSinkAlias(args, concreteResult);
    const objectKeysStringResult = this.objectKeysStringResult(concreteF, args, concreteResult);
    if (objectKeysStringResult !== void 0) {
      return { result: objectKeysStringResult };
    }
    const objectEntriesResult = this.objectEntriesResult(concreteF, args, concreteResult);
    if (objectEntriesResult !== void 0) {
      return { result: objectEntriesResult };
    }
    const argumentsSliceResult = this.argumentsSliceCallResult(concreteF, base, args, concreteResult);
    if (argumentsSliceResult !== void 0) {
      return { result: argumentsSliceResult };
    }
    const arrayConcatResult = this.arrayConcatResult(concreteF, base, args, concreteResult);
    if (arrayConcatResult !== void 0) {
      return { result: arrayConcatResult };
    }
    const replaceInfo = this.stringReplaceInfo(concreteF, base, args, concreteResult);
    if (replaceInfo !== void 0) {
      return { result: this.lift(concreteResult, replaceInfo) };
    }
    const joinInfo = this.arrayJoinInfo(concreteF, base, concreteResult);
    if (joinInfo !== void 0) {
      return { result: this.lift(concreteResult, joinInfo) };
    }
    const concatInfo = this.stringConcatInfo(concreteF, base, args, concreteResult);
    if (concatInfo !== void 0) {
      return { result: this.lift(concreteResult, concatInfo) };
    }
    const info = post !== void 0 ? this.getInfo(post.result) : void 0;
    if (!anyTainted(info) && this.pendingFieldReturn !== void 0 && this.pendingFieldReturn.value === concreteResult) {
      const pending = this.pendingFieldReturn;
      this.pendingFieldReturn = void 0;
      const node = newNode(`call:${pending.name}`, [pending.node], concreteResult, this.currentSite());
      return { result: this.lift(concreteResult, { bit: true, node }) };
    }
    if (info !== void 0 && info.node.label === "flow") {
      const name = typeof concreteF === "function" && concreteF.name ? concreteF.name : "Anonymous Function";
      info.node.label = `call:${name}`;
    }
    return post;
  }
  // --- sink detection ---
  invokeFunPre(id, f, base, args, isConstructor, isMethod) {
    if (typeof f === "function" && f.name && GHOST_NAMES.has(f.name)) {
      const real = globalThis[f.name];
      if (typeof real === "function" && real !== f) {
        f = real;
      }
    }
    const concreteF = this.valued(f).value;
    const concreteBase = this.valued(base).value;
    if ((concreteF === Function.prototype.bind || typeof concreteF === "function" && concreteF.name === "bind") && typeof concreteBase === "function") {
      this.pendingBindCalls.set(id, { target: concreteBase, args: Array.from(args ?? []).slice(1) });
    }
    let sinkTarget = concreteF;
    let sinkArgs = Array.from(args ?? []);
    let pendingTarget = concreteF;
    let pendingArgs = sinkArgs;
    let pendingForwarded = false;
    const opaqueForwarding = this.shouldTreatOpaqueCallAsForwarding(concreteF, sinkArgs);
    const bound = typeof concreteF === "function" ? this.boundFunctions.get(concreteF) : void 0;
    if (bound !== void 0) {
      sinkTarget = bound.target;
      sinkArgs = [...bound.args, ...sinkArgs];
      pendingTarget = concreteF;
      pendingArgs = sinkArgs;
      pendingForwarded = true;
    }
    if (concreteF === Function.prototype.apply || concreteF === Function.prototype.call) {
      sinkTarget = this.valued(base).value;
      if (concreteF === Function.prototype.apply && sinkArgs.length > 1) {
        const applyArg = this.valued(sinkArgs[1]);
        const applyArgs = applyArg.value;
        if (isArgumentsObject(applyArgs)) {
          const frameArgs = this.fieldFrames.at(-1)?.args;
          sinkArgs = frameArgs !== void 0 ? frameArgs.map((arg) => this.materializeArrayElementInfo(arg)) : arrayLikeEntries(sinkArgs[1], applyArgs);
        } else if (Array.isArray(applyArgs)) {
          const materialized = this.materializeArrayElementInfo(applyArg);
          sinkArgs = arrayLikeEntries(materialized, applyArgs);
        }
      } else if (concreteF === Function.prototype.call) {
        sinkArgs = sinkArgs.slice(1);
      }
      pendingTarget = sinkTarget;
      pendingArgs = sinkArgs;
      pendingForwarded = true;
    }
    const name = sinkName(sinkTarget);
    if (name !== void 0) {
      const argArr = sinkArgs;
      if (!this.canReachNativeSink(name, argArr)) {
        return super.invokeFunPre(id, f, base, args, isConstructor, isMethod);
      }
      const requiredFunctionIdx = argArr.length > 0 ? argArr.length - 1 : 0;
      const indices = name === "Function" && argArr.length > 0 ? [requiredFunctionIdx, ...argArr.map((_, i) => i).filter((i) => i !== requiredFunctionIdx)] : argArr.map((_, i) => i);
      for (const i of indices) {
        const argValue = this.valued(argArr[i]).value;
        const taintedValue = this.findTaintedSinkValue(argArr[i], /* @__PURE__ */ new Set(), {
          allowArrayContainer: !(name === "spawn" && i > 0 && Array.isArray(argValue))
        });
        const info = taintedValue?.info;
        if (anyTainted(info)) {
          this.flowFound = true;
          this.flowSink = name;
          const node = newNode(`call:${name}`, [info.node], taintedValue.value, this.currentSite(), name);
          this.flowNode = node;
          if (this.traceProp.provenance_complexity === 0) this.traceProp.provenance_complexity = get_number_of_nodes(node);
          this.traceProp.attacker_controlled_data = get_tainted_vals(node, name);
          if (name === "Function" && this.traceProp.prefix_ace === "") this.traceProp.prefix_ace = get_untainted_vals(node);
          if (name === "Function") {
            const requiredIdx = argArr.length > 0 ? argArr.length - 1 : 0;
            this.traceProp.triggers_flow = i === requiredIdx ? 1 : 0.3;
          } else {
            this.traceProp.triggers_flow = 1;
          }
          this.traceProp.called_sink = name;
          recordFlowTelemetry(node);
          if (taintPathsJson) {
            const json = buildTaintPathJSON(node);
            const fname = `taint_${this._taintFileCounter++}.json`;
            fs.writeFileSync(fname, stringifyTaintPathJSON(json));
          }
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
        infos: pendingArgs.map((arg) => this.valued(arg).info),
        forwarded: pendingForwarded || pendingTarget !== concreteF || opaqueForwarding
      });
    }
    return super.invokeFunPre(id, f, base, args, isConstructor, isMethod);
  }
  declare(_id, name, kind, _init, value, _isSpread) {
    if (kind !== "param" || anyTainted(this.getInfo(value))) return;
    const frame = this.fieldFrames.at(-1);
    if (frame !== void 0) {
      const paramInfo = frame.paramInfos[frame.nextParamIndex++];
      if (anyTainted(paramInfo)) {
        const concrete2 = this.valued(value).value;
        const info = { ...paramInfo, node: paramInfo.node };
        if (typeof concrete2 === "string" && info.chars === void 0) {
          info.chars = Array.from({ length: concrete2.length }, () => true);
        }
        frame.paramFields.set(name, { value: concrete2, info });
        return;
      }
    }
    if (frame === void 0 || !frame.argsTainted) return;
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
      const source = arg.value;
      if (!Object.prototype.hasOwnProperty.call(source, name)) continue;
      const propValue = source[name];
      if (!Object.is(this.valued(propValue).value, concrete)) continue;
      this.traceProp.add_field(name);
      const propNode = newNode("Untainted", [], name, this.currentSite());
      const node = newNode("object.GetField", [this.operandNode(arg), propNode], concrete, this.currentSite());
      const info = { bit: true, node };
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
  read(_id, name, value) {
    const valued = this.valued(value);
    const concreteValue = valued.value;
    const primitiveInfo = this.primitiveVariableInfos.get(name);
    if (primitiveInfo !== void 0 && Object.is(primitiveInfo.value, concreteValue)) {
      if (name !== "undefined" && isPrimitive2(concreteValue)) {
        this.lastPrimitiveRead = { name, value: concreteValue, info: primitiveInfo.info };
      }
      return { result: this.lift(concreteValue, primitiveInfo.info) };
    }
    for (let i = this.fieldFrames.length - 1; i >= 0; i--) {
      const field = this.fieldFrames[i].paramFields.get(name);
      if (field !== void 0 && Object.is(field.value, concreteValue)) {
        return { result: this.lift(value, field.info) };
      }
    }
    const rememberPrimitiveRead = () => {
      if (name !== "undefined" && isPrimitive2(concreteValue)) {
        this.lastPrimitiveRead = {
          name,
          value: concreteValue,
          info: anyTainted(valued.info) ? valued.info : void 0
        };
      }
    };
    const frame = this.fieldFrames.at(-1);
    if (frame === void 0 || !frame.paramNames.has(name)) {
      rememberPrimitiveRead();
      return void 0;
    }
    for (const arg of frame.args) {
      if (!anyTainted(arg.info) || arg.value === null) continue;
      if (typeof arg.value !== "object" && typeof arg.value !== "function") continue;
      const source = arg.value;
      if (!Object.prototype.hasOwnProperty.call(source, name)) continue;
      const propValue = source[name];
      if (!Object.is(this.valued(propValue).value, concreteValue)) continue;
      this.traceProp.add_field(name);
      const propNode = newNode("Untainted", [], name, this.currentSite());
      const info = {
        bit: true,
        node: newNode("object.GetField", [this.operandNode(arg), propNode], concreteValue, this.currentSite())
      };
      if (typeof concreteValue === "string") {
        info.chars = Array.from({ length: concreteValue.length }, () => true);
      }
      frame.paramFields.set(name, { value: concreteValue, info });
      return { result: this.lift(value, info) };
    }
    rememberPrimitiveRead();
    return void 0;
  }
  binary(id, op, left, right, result, frame) {
    const ret = super.binary(id, op, left, right, result, frame);
    const f = frame;
    if (ret === void 0 || f?.op !== "+" || f.left === void 0 || f.right === void 0) {
      return ret;
    }
    const concrete = this.valued(ret.result).value;
    const info = this.coercedObjectConcatInfo(f.left, f.right, concrete);
    if (info === void 0) return ret;
    return { result: this.lift(concrete, info) };
  }
  instrumentCodePre(_id, code, _isDirect) {
    const valuedCode = this.valued(code);
    const info = valuedCode.info;
    if (anyTainted(info)) {
      this.flowFound = true;
      this.flowSink = "eval";
      const node = newNode("call:eval", [info.node], valuedCode.value, this.currentSite(), "eval");
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
  putFieldPre(id, base, prop, value, _isPrivate) {
    const pre = super.putFieldPre(id, base, prop, value);
    if (pre && Array.isArray(pre.base) && pre.prop === "length") {
      pre.value = this.valued(pre.value).value;
    }
    return pre;
  }
  // --- taint queries (prelude entry points) ---
  isTainted(value) {
    return anyTainted(this.getInfo(value));
  }
  isTaintedAt(value, indexW) {
    const raw = this.valued(indexW).value;
    const index = typeof raw === "number" ? raw : Number(raw);
    const info = this.getInfo(value);
    if (info === void 0) return false;
    if (info.chars !== void 0 && index >= 0 && index < info.chars.length) {
      return info.chars[index] === true;
    }
    return info.bit;
  }
  assert(condW) {
    if (this.valued(condW).value) return;
    throw new Error("Assertion failed");
  }
  // --- source marking ---
  setTaint(value, tainted) {
    const concrete = this.valued(value).value;
    const site = this.currentSite();
    const origin = newNode("Untainted", [], concrete, site);
    const node = tainted ? newNode("Tainted", [newNode("call:__jalangi_set_taint__", [origin], concrete, site)], concrete, site) : origin;
    const info = this.getOrCreateInfo(value, () => ({ bit: tainted, node }));
    if (info === void 0) {
      const lastRead = this.lastPrimitiveRead;
      if (lastRead !== void 0 && isPrimitive2(concrete) && Object.is(lastRead.value, concrete)) {
        if (tainted) {
          const primitiveInfo = { bit: true, node };
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
  taintLocLine(value) {
    const site = this.getInfo(value)?.node.site;
    return site?.kind === "code" ? site.start.line : -1;
  }
  taintLabel(value) {
    return this.getInfo(value)?.node.label ?? "";
  }
  flowSinkType() {
    return this.flowNode?.sinkType ?? "";
  }
  /** Returns the buildTaintPathJSON result for a value's provenance node (or {} if none). */
  taintJson(value) {
    const info = this.getInfo(value);
    if (!info?.node) return {};
    return buildTaintPathJSON(info.node);
  }
  // --- __jalangi_clear_taint__ ---
  clearTaint(v) {
    this.setTaint(v, false);
  }
  // --- __jalangi_get_taint__ (returns boolean taint bit) ---
  getTaint(v) {
    return this.isTainted(v);
  }
  // --- __fuzzer__reset_state__ (per-iteration hygiene) ---
  resetState() {
    this.traceProp.reset_state();
    this.flowFound = false;
    this.flowNode = void 0;
    this.flowSink = void 0;
  }
  // --- __fuzzer_get_trace_properties__ ---
  getTraceProp() {
    return this.traceProp;
  }
  // --- __set_taint_flow_path__ ---
  setTaintFlowPath(p) {
    this.taintPath = String(this.valued(p).value);
  }
  // --- __get_taint_flow_idx__ ---
  getTaintFlowIdx() {
    return this._taintFileCounter - 1;
  }
  // --- __jalangi_assert_taint_true__ ---
  assertTaintTrue(v) {
    if (!this.isTainted(v)) throw new Error("Argument expected to be tainted");
  }
  // --- __jalangi_assert_taint_false__ ---
  assertTaintFalse(v) {
    if (this.isTainted(v)) throw new Error("Argument expected to be untainted");
  }
  // --- __jalangi_assert_wrapped__ ---
  // no-op for now, the new analysis does not expose API for this
  assertWrapped(_v) {
  }
  // --- __jalangi_assert_not_wrapped__ ---
  // no-op for now, the new analysis does not expose API for this
  assertNotWrapped(_v) {
  }
  // --- __jalangi_set_prop_taint__ ---
  // Sets taint on obj[key]. DynaJS propagates object-property taint by tracking
  // each property's wrapped value independently. We get the current info for `obj`
  // and set a per-property taint entry using setInfo on the concrete property value.
  // Limitation: we can only mark the current concrete value of obj[key]; if the
  // property is later reassigned the taint won't follow. Mirrors TSetProp semantics
  // as closely as possible within the public FlowAnalysis API.
  setPropTaint(obj, key, tainted) {
    const concreteObj = this.valued(obj).value;
    const concreteKey = String(this.valued(key).value);
    if (concreteObj === null || typeof concreteObj !== "object" && typeof concreteObj !== "function") return;
    const propValue = concreteObj[concreteKey];
    if (propValue === void 0 || propValue === null) return;
    this.setTaint(propValue, tainted);
  }
  // --- __jalangi_clear_prop_taint__ ---
  clearPropTaint(obj, key) {
    this.setPropTaint(obj, key, false);
  }
  // --- __string_range_set_taint__ ---
  stringRangeSetTaint(str, lbW, ubW) {
    const lb = Number(this.valued(lbW).value);
    const ub = Number(this.valued(ubW).value);
    const info = this.getOrCreateInfo(str, () => {
      const concrete = this.valued(str).value;
      const node = newNode("Untainted", [], concrete, this.currentSite());
      return { bit: false, chars: [], node };
    });
    if (info === void 0) return;
    if (info.chars === void 0) {
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
  stringRangeClearTaint(str, lbW, ubW) {
    const lb = Number(this.valued(lbW).value);
    const ub = Number(this.valued(ubW).value);
    const info = this.getInfo(str);
    if (info === void 0 || info.chars === void 0) return;
    for (let i = lb; i < ub; i++) {
      if (i >= 0 && i < info.chars.length) info.chars[i] = false;
    }
    info.bit = info.chars.some((c) => c);
  }
  // --- __assert_string_range_all_tainted__ ---
  assertStringRangeAllTainted(str, lbW, ubW) {
    const lb = Number(this.valued(lbW).value);
    const ub = Number(this.valued(ubW).value);
    const untainted = [];
    for (let i = lb; i < ub; i++) {
      if (!this.isTaintedAt(str, i)) untainted.push(i);
    }
    if (untainted.length > 0) throw new Error(`Untainted indices: [${untainted}]`);
  }
  // --- __assert_string_range_all_untainted__ ---
  assertStringRangeAllUntainted(str, lbW, ubW) {
    const lb = Number(this.valued(lbW).value);
    const ub = Number(this.valued(ubW).value);
    const tainted = [];
    for (let i = lb; i < ub; i++) {
      if (this.isTaintedAt(str, i)) tainted.push(i);
    }
    if (tainted.length > 0) throw new Error(`Tainted indices: [${tainted}]`);
  }
  // --- __assert_array_range_all_tainted__ ---
  assertArrayRangeAllTainted(arrW, lbW, ubW) {
    const arr = this.valued(arrW).value;
    const lb = Number(this.valued(lbW).value);
    const ub = Number(this.valued(ubW).value);
    const untainted = [];
    for (let i = lb; i < ub; i++) {
      if (!this.isTainted(arr[i])) untainted.push(i);
    }
    if (untainted.length > 0) throw new Error(`Untainted indices: [${untainted}]`);
  }
  // --- __assert_array_range_all_untainted__ ---
  assertArrayRangeAllUntainted(arrW, lbW, ubW) {
    const arr = this.valued(arrW).value;
    const lb = Number(this.valued(lbW).value);
    const ub = Number(this.valued(ubW).value);
    const tainted = [];
    for (let i = lb; i < ub; i++) {
      if (this.isTainted(arr[i])) tainted.push(i);
    }
    if (tainted.length > 0) throw new Error(`Tainted indices: [${tainted}]`);
  }
  // --- __jalangi_set_sink__ ---
  setSink(fW) {
    const f = this.valued(fW).value;
    if (typeof f !== "function") throw new Error("Sink must be a function");
    registerDynamicSink(f);
  }
  // --- __jalangi_check_taint__ ---
  // If tainted: set flowFound, populate traceProp, throw FlowError.
  checkTaint(v) {
    const info = this.getInfo(v);
    if (!anyTainted(info)) return;
    this.flowFound = true;
    this.flowNode = info.node;
    this.traceProp.called_sink = "__jalangi_check_taint__";
    throw new FlowError("check_taint reached tainted value", this.traceProp.clone());
  }
  // --- __jalangi_check_taint_string__ ---
  // Like checkTaint but also logs tainted char indices (mirrors GhostFunction.ts:163-180).
  checkTaintString(v) {
    const concrete = this.valued(v).value;
    if (typeof concrete === "string") {
      const taintedIndices = [];
      for (let i = 0; i < concrete.length; i++) {
        if (this.isTaintedAt(v, i)) taintedIndices.push(i);
      }
      if (taintedIndices.length > 0) {
        console.log(`String has tainted indices: [${taintedIndices}]`);
      }
    }
    this.checkTaint(v);
  }
  endExecution() {
  }
};
D$.analysis = new NodeMedicAnalysis();
export {
  NodeMedicAnalysis
};
