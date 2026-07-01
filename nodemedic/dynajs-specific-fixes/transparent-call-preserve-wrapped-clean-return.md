# Preserve Wrapped Clean Returns From Transparent Calls

## Problem

For transparent user-code calls, `FlowAnalysis.invokeFun` used to taint the call
result from all call entries whenever the returned value did not already carry
non-bottom info:

```ts
const parents = Array.from(f.entries) as Wrapped[];
return this.$.base(result, parents);
```

That overtainted functions whose bodies returned a clean wrapped value. A common
shape is a tainted options object that is inspected, but a clean default string
is returned:

```js
function defaulted(opts) {
  var _a = opts || {};
  var to = _a.to === undefined ? "main" : _a.to;
  return to;
}

var opts = {};
__jalangi_set_taint__(opts);
var value = defaulted(opts);
```

The function argument is tainted, but the direct return value may already be a
wrapped clean value from the function body. Replacing that wrapped value with a
new result derived from all arguments loses the distinction between:

- "the function returned a clean default"
- "the function returned data from the tainted object"

For exploit synthesis, that distinction matters because whole-argument taint can
produce a bare string exploit instead of an object-field exploit.

## Added Code

In `lib/dynajs/analyses/flow/flow.ts`, the transparent-call case now preserves any
wrapped result, even when its info is bottom:

```ts
case 'transparent': {
  if (this.isWrapped(result) && !this.domain.isBottom(this.getInfo(result))) {
    return result as Wrapped<unknown>;
  }
  if (this.isWrapped(result)) {
    return result as Wrapped<unknown>;
  }
  const parents = Array.from(f.entries) as Wrapped[];
  return this.$.base(result, parents);
}
```

The fallback still taints from call entries when the return is an unwrapped
native value, but it no longer overwrites an instrumented function body's actual
wrapped return.

## Example

This was needed while debugging `@alekseyleshko/git-diff@0.2.0`.

The new engine originally found a false first-stage flow for `[ '{}' ]` and
reported provenance from the whole argument:

```text
call:exec -> call:getCmd -> Tainted({})
```

That led SMT to synthesize a bare string:

```json
"$(touch /tmp/success);#"
```

instead of the legacy object payload:

```json
{ "to": "$(touch /tmp/success);#" }
```

Preserving wrapped returns keeps transparent function boundaries from inventing
whole-argument taint when the function body already produced a more precise
return value.

## Verified

After porting the fix to the rebased DynaJS flow model and rebuilding inside
the `angry_jang` container, the new engine confirmed the exploit for
`@alekseyleshko/git-diff@0.2.0`.
