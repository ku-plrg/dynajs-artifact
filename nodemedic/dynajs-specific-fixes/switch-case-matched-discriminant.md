# Switch Case Matched Discriminant

## Problem

DynaJS instruments switch statements by wrapping the switch discriminant with
`Swl(...)` and each case expression with `Swr(...)`:

```js
switch (Swl(id, discriminant)) {
  case Swr(id, caseValue):
    ...
}
```

`Swr` used to compute the instrumented strict-equality comparison between the
saved discriminant and the case value, but then always returned the raw
`caseValue`.

That is wrong when the saved discriminant is a DynaJS wrapped primitive. The
analysis-level comparison can report that the case matched, while the real
JavaScript `switch` still compares the wrapped discriminant object with the raw
case literal. Since switch case matching uses strict equality, the real switch
can miss the matching case and fall through to `default`.

## Added Code

In `lib/dynajs/src/analysis.ts`, `Swr` now returns the saved discriminant when
the instrumented comparison says the case matched:

```ts
function Swr(id: number, caseValue: any): any {
  const result = B(id, '===', switchLeft, caseValue);
  const matched = C(id, 'switch', result);
  return matched ? switchLeft : caseValue;
}
```

This keeps the runtime branch aligned with the comparison observed by DynaJS.
It is a general instrumentation semantics fix: the switch statement should take
the same case that DynaJS's own strict-equality hook reports as matched.

## Example

This was necessary for `@inkohx/git-time@0.0.1`.

The package is compiled TypeScript and uses the standard `__generator` helper.
That helper contains a switch like:

```js
switch (op[0]) {
  case 0:
  case 1:
    t = op;
    break;
  default:
    ...
}
```

Under the new engine, `op[0]` could be a wrapped primitive whose concrete value
was `0`. DynaJS printed and compared it as `0`, but the real JavaScript switch
still saw the wrapped object and repeatedly selected `default`, causing an
infinite loop before the package reached its `exec` sink.

After the fix, the matched `case 0` path is taken and the package reaches the
same promisified `child_process.exec` flow as the legacy run.

## Verified

After copying the change into the `angry_jang` container and rebuilding DynaJS
inside Docker:

- A reduced TypeScript `__generator` reproducer completed instead of looping.
- A focused `@inkohx/git-time@0.0.1` probe reached `call:exec` and wrote
  `taint_0.json`.
- The full new-engine pipeline found the old input
  `[ '"/<^=yNk>"', '"<"' ]` and `checkExploit` succeeded.
