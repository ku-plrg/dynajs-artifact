# Reproducing the SPIN'17 ExpoSE evaluation (Table 1)

Paper: _ExpoSE: Practical Symbolic Execution of Standalone JavaScript_ (SPIN'17),
`docs/spin17-expose.pdf`. Table is captured in `docs/spin-table-1.png`.

## What the evaluation is

The paper evaluates ExpoSE on three npm libraries — **minimist**, **semver**, **validator** —
and reports per target (Table 1): Lines of Code, Path Count, Total Execution, and the
Median / Shortest / Longest test-case time.

Methodology (paper §4.1, verbatim):

> "We built a generic test harness to systematically exercise all public methods in a
> given library with symbolic arguments. The symbolic arguments range over all our
> supported theories (Strings, Booleans, Reals, Undefined, Null). We ignore spurious
> type exceptions due to functions expecting values of a specific type. … Each library
> was tested with up to 128 concurrent test cases."

That "generic test harness" is exactly ExpoSE's **AHG (Automatic Harness Generation)**:
`lib/Harness/src/harness.js`, invoked as `./expoSE ahg <lib>`. It enumerates every public
method of the required library and calls it with pure symbolic arguments.

## How each Table 1 row maps to ExpoSE output

ExpoSE writes a JSON result file when `EXPOSE_JSON_PATH` is set. Per target:

| Table 1 row                       | Source in the JSON                                      |
| --------------------------------- | ------------------------------------------------------- |
| Lines of Code                     | `finalCoverage[].loc.total` of the library file(s)      |
| Path Count                        | `done.length` (also stdout: `ExpoSE Finished. N paths`) |
| Total Execution                   | `(end - start) / 1000`                                  |
| Median/Shortest/Longest Test Case | from `done[].time` (ms → s)                             |

`extract-table.js` computes all of these. (LOC excludes ExpoSE's own `lib/Harness` and
`lib/S$` runtime files; only the target library counts.)

## Run it

```sh
# All three targets with paper-faithful settings, then print the table:
./docs/repro/run.sh

# Override the heavy defaults for a quick sanity pass:
CONCURRENT=8 TEST_TIMEOUT=2m MAX_TIME=10m ./docs/repro/run.sh
```

Paper-faithful defaults in `run.sh`:

- `EXPOSE_MAX_CONCURRENT` = number of CPU cores (paper used **128** on a 16-core box).
- `EXPOSE_TEST_TIMEOUT` = `15m` — the paper's longest Minimist case is **900.00s**, i.e. it hit
  a 15-minute per-test timeout.
- `EXPOSE_MAX_TIME` = `2h` — whole-run cap; a run finishes earlier once all feasible paths
  are explored.

Manual single target:

```sh
EXPOSE_MAX_CONCURRENT=16 EXPOSE_TEST_TIMEOUT=15m EXPOSE_JSON_PATH=docs/repro/out/minimist.json \
  ./expoSE ahg minimist
node docs/repro/extract-table.js minimist=docs/repro/out/minimist.json
```

## Expect different numbers (this is fine)

Reproducing the _shape_ of Table 1 is the goal, not the exact figures. They will differ
because:

- **Solver-dependent timing.** The paper notes some queries "require several minutes to
  solve, depending on the solver's random seed." Median/longest times are not deterministic.
- **Different Z3 / Node / ExpoSE.** This tree runs Node 21+ and a newer Z3 and a newer AHG
  than 2017, so path counts and coverage differ (the current AHG explores more aggressively —
  e.g. minimist yields hundreds of paths under a short cap rather than 52).
- **Different hardware / concurrency.** The paper used 128 concurrent cases on 16 cores;
  `run.sh` defaults concurrency to your core count.
- **LOC counting.** ExpoSE counts LOC of every file actually loaded during execution
  (including dynamically `require`d submodules), so e.g. validator reports far more than the
  paper's single-file 1500.

`done[].errors` are the per-path thrown exceptions — mostly the "spurious type exceptions"
the paper says it ignores, **not** bug counts. (The paper's contribution was one real crash
bug in Minimist, found separately.)

---

# PLDI'19 mode — statement coverage (Table 6)

Paper: _Sound Regular Expression Semantics for DSE of JavaScript_ (PLDI'19),
`docs/pldi-expose-regex.pdf`. Table 6 reports **statement coverage** per library (Old vs New
vs relative increase), not the SPIN path-count statistics.

`run.sh` already prints a coverage table after Table 1 (via `extract-coverage.js`). The
coverage numbers come from `finalCoverage[]` in each JSON result:

| Metric (extract-coverage.js) | Source in the JSON                                   |
| ---------------------------- | ---------------------------------------------------- |
| `Stmt%` (paper's "coverage") | Σ `loc.found` / Σ `loc.all.length` over target files |
| `LOC` (lines loaded)         | Σ `loc.total` over target files                      |
| `Decision%`                  | Σ(`trueTaken`+`falseTaken`) / Σ `totalOptions`       |
| `Term%`                      | Σ `terms.found` / Σ `terms.total`                    |

⚠️ For `loc`, statement coverage is `found / all.length` (covered reachable lines over total
_reachable_ lines), **not** `found / total`. `loc.total` is the file's physical line count,
which is what the paper reports as LOC. (harness + S$ runtime excluded, same as Table 1.)

## §7.2 settings (the three libraries)

| Knob                       | SPIN default | PLDI §7.2 | env var                  |
| -------------------------- | ------------ | --------- | ------------------------ |
| Concurrency                | core count   | **32**    | `CONCURRENT`             |
| Per-package wall time      | `2h`         | **`1h`**  | `MAX_TIME` (6 runs, avg) |
| Refinement iteration limit | `40`         | **`20`**  | `EXPOSE_MAX_REFINEMENTS` |
| Harness                    | AHG          | AHG       | — (same generic harness) |

`EXPOSE_MAX_REFINEMENTS` isn't forwarded by `run.sh`'s command prefix, but it propagates:
the Distributor copies the whole environment into each worker (`Distributor/bin/Spawn.js`),
and the Analyser reads it (`Analyser/bin/Config.js`). Just export it.

```sh
# PLDI'19 §7.2 settings, one run of the three libraries:
CONCURRENT=32 MAX_TIME=1h TEST_TIMEOUT=40m EXPOSE_MAX_REFINEMENTS=20 \
  ./docs/repro/run.sh

# semver under-reports at 1h (paper §7.2) -- the deficit disappears at 2h:
TARGETS=semver MAX_TIME=2h CONCURRENT=32 EXPOSE_MAX_REFINEMENTS=20 ./docs/repro/run.sh
```

Not on a 32-core box? Lower `CONCURRENT` to your core count — concurrency affects throughput
and timing, not coverage correctness.

## Six runs, averaged (paper method)

The paper re-executed each package six times and averaged. `run.sh` has no averaging, so loop
into per-run directories, then pass the six JSONs comma-separated to `extract-coverage.js`:

```sh
for i in 1 2 3 4 5 6; do
  OUT=docs/repro/out/run$i \
  CONCURRENT=32 MAX_TIME=1h TEST_TIMEOUT=40m EXPOSE_MAX_REFINEMENTS=20 \
    ./docs/repro/run.sh
done

# average the six runs of each target -- files comma-separated per target.
# Brace expansion is space-separated, so join with `tr ' ' ,`:
for t in minimist semver validator; do
  ARGS="$ARGS $t=$(echo docs/repro/out/run{1..6}/$t.json | tr ' ' ,)"
done
node docs/repro/extract-coverage.js $ARGS
```

(`extract-coverage.js` averages the comma-separated files for each target. A single explicit
form: `minimist=docs/repro/out/run1/minimist.json,docs/repro/out/run2/minimist.json,...`.)

## Old vs New comparison (`+%` column)

Table 6 compares the original ExpoSE [27] (Old) against the full regex model (New). True "Old"
is a _separate, older codebase_ — this tree is "New". To produce an Old/New table on this tree
you approximate the baseline by disabling regex features, then label the two configs with a
`Column:` prefix:

```sh
# New = full support (this tree's defaults)
EXPOSE_JSON_PATH=docs/repro/out/new/minimist.json ./expoSE ahg minimist

# Old ≈ concrete-regex baseline (§7.3 baseline): regex modeling off
EXPOSE_DISABLE_REGULAR_EXPRESSIONS=1 \
  EXPOSE_JSON_PATH=docs/repro/out/old/minimist.json ./expoSE ahg minimist

# Or a partial baseline (model on, captures + refinement off):
#   EXPOSE_DISABLE_CAPTURE_GROUPS=1 EXPOSE_DISABLE_REFINEMENTS=1

node docs/repro/extract-coverage.js \
  Old:minimist=docs/repro/out/old/minimist.json \
  New:minimist=docs/repro/out/new/minimist.json
```

Output mirrors Table 6 — `Library | LOC | Old% | New% | +%`, where `+%` is the relative
increase `(New-Old)/Old·100` (`∞` when Old is 0%, as in the paper's moment/query-string/yn).
Feature toggles available (all `EXPOSE_`-prefixed, read in `Analyser/src/Config.js`):
`DISABLE_REGULAR_EXPRESSIONS`, `DISABLE_CAPTURE_GROUPS`, `DISABLE_REFINEMENTS`,
`MAX_REFINEMENTS` (default 40; paper used 20).
