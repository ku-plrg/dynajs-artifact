# Array.map Opaque Callback Boundary

## Package That Exposed It

- Package: `upstart@0.0.2`
- Disagreement row: `upstart@0.0.2,1,0,legacy`
- Legacy path: `initctl(command, args, cb)` builds `[upstart.config.initctl, command].concat(args || []).join(" ")` and reaches `child_process.exec`.

## Failure

The new engine aborted before writing `batch_info.json`. With `--fail-on-output-error`, the first error was:

```text
TypeError [ERR_INVALID_ARG_TYPE]: The "id" argument must be of type string. Received an instance of Object
    at Module.require
    at INTRINSICS_Array_prototype_map
```

`upstart/index.js` loads subsets with:

```js
["./lib/common", "./lib/job", "./lib/event", "./lib/other"]
  .map(require)
```

The DynaJS `Array.prototype.map` model invoked the opaque native `require` callback with wrapped primitive arguments. Node's `require` validates the module id with `typeof id === "string"`, so the wrapped primitive object caused `ERR_INVALID_ARG_TYPE`.

## Fix

Changed `lib/dynajs/analyses/flow/flow.ts` so `SpecRuntime.apply` uses the same boundary escape path as ordinary opaque calls when a spec model invokes a non-modeled opaque callback. It now unwraps primitive proxies before the callback, restores escaped containers afterward, and still attributes the result to the callee, receiver, and arguments.

This is a DynaJS-layer fix because it preserves normal JavaScript callback semantics for all FlowAnalysis clients, not just NodeMedic.

## Verification

Inside Docker container `71d78aa4b8cc`:

```text
DYNAJS_OPTIONS="--analysis=/nodetaint/src/vendor/NodeMedicAnalysis.mjs --partial --pos persist" \
  /nodetaint/lib/dynajs/dynajs node /nodetaint/tests/dynajs-analysis/array_map_require_callback_repro.js
```

The original package now succeeds:

```text
NODEMEDIC_NEW_ENGINE=1 pipeline/run_pipeline.sh ... --package=upstart@0.0.2 ... --dynajs --convertPotentialToString
```

The verified new-engine path is:

```text
initctl arg 0 -> model:array.join -> call:exec
```

and the pipeline confirms exploits for `initctl`.
