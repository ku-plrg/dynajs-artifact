# Flow Info WeakMap

## Problem

DynaJS `FlowAnalysis` stored flow metadata in a `Map<symbol, Info>`, keyed by
the fresh id assigned to each wrapped value. The wrapper identity itself lived in
weak maps, but the flow metadata map held strong references to every info entry
created during long fuzzing runs.

That is a general engine memory-retention problem. The analysis can create many
short-lived wrapper objects while fuzzing, especially when generated inputs are
not replayable and the first stage keeps exploring. Once a wrapper is no longer
reachable, its flow metadata should be collectable too.

## Added Code

`lib/dynajs/analyses/flow/flow.ts` now stores info by wrapper object identity in
a `WeakMap<object, Info>`:

```ts
private infoMap = new WeakMap<object, Info>();
```

`getInfo`, `setInfo`, and `getOrCreateInfo` now resolve the wrapped object as
the metadata key:

```ts
private getInfoKey(value: unknown): object | undefined {
  if (!this.isObjectish(value)) return undefined;
  return this.valueMap.has(value) ? value : undefined;
}
```

This keeps the existing value identity semantics but lets JavaScript garbage
collection reclaim flow metadata when the wrapper object is unreachable.

## Example

A long-running fuzzer loop can create many transient wrapped strings:

```js
for (const candidate of generatedInputs) {
  __jalangi_set_taint__(candidate);
  entrypoint(candidate);
}
```

Those candidates should not leave permanent flow metadata behind after the
iteration completes. The `WeakMap` change makes the metadata lifetime match the
wrapper lifetime.

This is analysis-agnostic DynaJS behavior. It does not encode NodeMedic sink
policy, exploit synthesis, or package-specific provenance. It should benefit any
analysis built on `FlowAnalysis`, including concolic-style analyses that also
create large numbers of temporary wrapped values.
