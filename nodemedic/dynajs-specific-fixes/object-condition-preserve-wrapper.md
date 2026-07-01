# Preserve Wrapped Object Values Through Conditions

## Problem

DynaJS condition handling unwrapped every condition operand and returned the raw
value to the instrumented program:

```ts
const raw = this.unwrap(value as Wrapped<unknown>);
return { result: raw };
```

That is correct for primitive conditions because wrapper objects would be
truthy, but it is wrong for object-valued logical expressions. In JavaScript,
objects and functions are already truthy, so returning the raw object instead of
the wrapped object loses taint metadata without changing control flow.

This broke expressions like:

```js
var _a = comparisons || {};
var to = _a.to;
```

If `comparisons` was a tainted object, `comparisons || {}` evaluated to the raw
object. The later `_a.to` read then had no tainted base, so the new engine could
not produce the legacy `object.GetField("to")` path.

## Added Code

In `lib/dynajs/analyses/flow/flow.ts`, `condition` now unwraps to compute the
branch truthiness, but preserves the wrapped value when the raw value is an
object or function:

```ts
condition(id: number, _op: string, value: unknown): { result: unknown } {
  if (_op !== 'model') this.currentId = id;
  const raw = this.unwrap(value as Wrapped<unknown>);
  this.conditionInfo?.(id, this.valued(value), Boolean(raw));
  if (raw !== null && (typeof raw === "object" || typeof raw === "function")) {
    return { result: value };
  }
  return { result: raw };
}
```

Primitive conditions still return raw primitives, which avoids changing
truthiness for wrapped strings, numbers, booleans, `null`, or `undefined`.

## Example

This was necessary for `@alekseyleshko/git-diff@0.2.0`.

The package code does:

```js
var _a = comparisons || {}, from = _a.from, _b = _a.to;
```

With a tainted object argument, preserving the wrapped object lets `_a.to`
produce:

```text
object.GetField("to")
```

That field-level provenance is what lets synthesis produce:

```json
{ "to": "$(touch /tmp/success);#" }
```

## Verified

After porting the fix to the rebased DynaJS flow model and rebuilding inside
the `angry_jang` container, the new engine confirmed the exploit for
`@alekseyleshko/git-diff@0.2.0`.
