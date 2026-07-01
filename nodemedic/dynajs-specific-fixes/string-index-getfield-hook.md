# String Index Reads Should Use getFieldInfo

## Problem

DynaJS `FlowAnalysis.getField` treated numeric string property reads such as `s[i]` as a substring operation before giving the analysis a chance to handle the property read:

```js
var s = "~/";
var key = "0";
var value = s[key];
```

For NodeMedic, this changed the provenance operation from the legacy `string.GetField` to `precise:string.substring`. That was enough to keep taint propagation alive, but it changed the synthesis input shape. In `jud-scripter@0.0.2`, legacy synthesis used two `string.GetField` nodes for `requires[0]` and `requires[1]` and reconstructed an object-like exploit input with fields `0` and `1`. The new engine instead reported substring nodes and synthesis collapsed toward a flat string-shaped input.

## Added Code

In `lib/dynajs/analyses/flow/flow.ts`, the numeric string-property branch now checks whether the analysis implements `getFieldInfo`. If it does, DynaJS reports the operation as a field read:

```ts
if (this.getFieldInfo !== undefined) {
  return this.lift(
    result,
    this.getFieldInfo(this.valued(f.base), this.valued(f.prop), this.valued(result))
      ?? this.baseInfo(result, [this.valued(f.base), this.valued(f.prop)]),
  );
}
```

If the analysis does not implement `getFieldInfo`, DynaJS keeps the previous substring fallback and carries the property value into the substring offsets.

## Why This Is General

This is not NodeMedic-package-specific behavior. JavaScript `s[i]` is a property read even when the receiver is a string. Analyses that care about property access, object shape, symbolic fields, or provenance should be able to observe it through `getFieldInfo`. Analyses that only care about character/substring flow can still omit `getFieldInfo` and use the existing substring fallback.

## Example

`jud-scripter@0.0.2` builds a browserify command with:

```js
Object.keys(requires).forEach(function (key) {
  cmd += ' -r ' + '"' + requires[key] + ':' + key + '"';
});
```

When `requires` is the tainted string `"~/"`, `requires["0"]` and `requires["1"]` must be represented as field reads so synthesis can solve fields `0` and `1` separately. Reporting those reads as substring operations loses that object-like shape.
