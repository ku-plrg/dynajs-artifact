#!/usr/bin/env bash
#
# Reproduce the evaluation (Table 1) from the SPIN'17 ExpoSE paper.
#
# Methodology (paper Section 4.1): "We built a generic test harness to systematically
# exercise all public methods in a given library with symbolic arguments." That generic
# harness is ExpoSE's AHG (Automatic Harness Generation): `./expoSE ahg <lib>`, which
# attaches lib/Harness/src/harness.js to the target npm library.
#
# The paper ran each target with up to 128 concurrent test cases on a 16-core machine,
# and the longest Minimist test case (900.00s) hit a 15-minute per-test timeout.
#
# This script runs AHG on minimist, semver and validator, dumps a JSON result per target
# (via EXPOSE_JSON_PATH), then prints the reproduced Table 1 with extract-table.js.
#
# Override any of these from the environment, e.g.:
#   CONCURRENT=8 TEST_TIMEOUT=2m MAX_TIME=10m ./docs/repro/run.sh
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
OUT="${OUT:-$HERE/out}"
mkdir -p "$OUT"

# --- Paper-faithful defaults (override via env) ---
TARGETS="${TARGETS:-minimist semver validator}"
CONCURRENT="${CONCURRENT:-$(nproc 2>/dev/null || echo 16)}"  # paper used 128 (16-core box)
TEST_TIMEOUT="${TEST_TIMEOUT:-15m}"                          # paper: longest case = 900.00s
MAX_TIME="${MAX_TIME:-2h}"                                   # whole-run cap; finishes early when paths exhausted

echo "ExpoSE SPIN'17 reproduction"
echo "  targets    : $TARGETS"
echo "  concurrent : $CONCURRENT   (paper: 128)"
echo "  per-test   : $TEST_TIMEOUT   (paper: longest Minimist case = 900.00s)"
echo "  max-time   : $MAX_TIME"
echo "  json out   : $OUT"
echo

cd "$ROOT"
for t in $TARGETS; do
  echo "==> ExpoSE AHG on '$t' ..."
  EXPOSE_MAX_CONCURRENT="$CONCURRENT" \
  EXPOSE_TEST_TIMEOUT="$TEST_TIMEOUT" \
  EXPOSE_MAX_TIME="$MAX_TIME" \
  EXPOSE_JSON_PATH="$OUT/$t.json" \
    ./expoSE ahg "$t" 2>&1 | tee "$OUT/$t.log" | tail -n 3
  echo
done

ARGS=""
for t in $TARGETS; do ARGS="$ARGS $t=$OUT/$t.json"; done

echo "==> Building Table 1 (SPIN'17 path stats) from JSON results"
node "$HERE/extract-table.js" $ARGS

echo
echo "==> Building coverage table (PLDI'19 Table 6 style) from JSON results"
node "$HERE/extract-coverage.js" $ARGS
