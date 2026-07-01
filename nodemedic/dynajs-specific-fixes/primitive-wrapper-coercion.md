# Primitive Wrapper Coercion

## Problem

DynaJS wraps primitive values in proxy objects so the flow layer can attach
metadata to values like strings, numbers, and booleans. Some JavaScript and
native operations coerce operands with `ToPrimitive`, `valueOf`, or `toString`.

Before the fix, wrapped primitives did not reliably behave like their concrete
primitive values during coercion. That meant a wrapped primitive could leak into
native or opaque code as an object-like value instead of its raw primitive.

One concrete failure shape was a wrapped numeric/string index used to select a
value from an array. JavaScript expects:

```js
arr[wrappedIndex]
```

to coerce `wrappedIndex` to the same property key as the underlying primitive.
Without explicit coercion methods, the lookup could miss the intended element or
produce behavior different from the legacy DynaJS engine.

## Added Code

In `lib/dynajs/analyses/flow/flow.ts`, primitive wrappers now expose standard
primitive coercion hooks:

```ts
const proxy = ({
  [util.inspect.custom]() { return "<wrapped-primitive>"; },
  [Symbol.toPrimitive]() { return value as Primitive; },
  valueOf() { return value as Primitive; },
  toString() { return String(value); },
});
```

This keeps the wrapper usable as a DynaJS metadata carrier while making it
coerce like the original primitive in JavaScript and native operations.

## Example

This was necessary for the `@!!!!!/javascript@2.0.0` disagreement.

The fuzzer selected data using a wrapped primitive index. Without primitive
coercion, the new engine could fail to read the same array element that legacy
DynaJS read, so it missed the path that later reached the sink.

A reduced example is:

```js
var i = 0;
__jalangi_set_taint__(i);

var xs = ["payload"];
var selected = xs[i];
```

After the fix, the wrapper for `i` coerces to `0`, so array/property indexing
uses the intended element while preserving taint metadata on the wrapped value.

## Verified

After porting the fix to the rebased DynaJS flow model and rebuilding inside
the `angry_jang` container, the new engine confirmed the exploit for
`@!!!!!/javascript@2.0.0`.
