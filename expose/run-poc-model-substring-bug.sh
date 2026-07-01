#!/usr/bin/env bash
#
# PoC: ExpoSE's symbolic model for String.prototype.substring is wrong.
# StringModels.js registers `substrModel` (substr semantics: args[1] = length)
# for BOTH .substr and .substring. Whenever real substring semantics diverge
# from substr (start > end swap, negative→0 clamp, end-as-index vs length),
# ExpoSE produces wrong path constraints AND wrong concrete results.
#
# This script:
#   1. Runs the demo test through ExpoSE and shows which throws it finds.
#   2. Confirms in real Node that the missed throw IS reachable.
#   3. Replays the "should-trigger" input through ExpoSE and shows the SMT
#      it actually emits (str.substr instead of substring semantics).
#
# Usage: ./run-poc-model-substring-bug.sh

set -u

cd "$(dirname "$0")"

TEST="$(pwd)/tests/strings/substring_bug.js"
DIVIDER="------------------------------------------------------------"

if [ ! -f "$TEST" ]; then
  echo "Missing $TEST — create the bug demo first."
  exit 1
fi

echo "$DIVIDER"
echo "Step 1: Run ExpoSE on the demo test"
echo "$DIVIDER"
ANALYSE_OUT="$(mktemp)"
trap 'rm -f "$ANALYSE_OUT"' EXIT

./scripts/analyse "$TEST" 2>&1 | tee "$ANALYSE_OUT" >/dev/null

# Strip terminal control sequences from the progress spinner so grep works
sed -i 's/\x1b\[[0-9;]*[a-zA-Z]//g; s/\r/\n/g' "$ANALYSE_OUT"

echo "Inputs explored and throws reported by ExpoSE:"
grep -E '^\[\+\] \{|^\[!\] Reachable' "$ANALYSE_OUT" | sed 's/^/    /'

echo
if grep -q 'Reachable_swap' "$ANALYSE_OUT"; then
  echo "ExpoSE FOUND Reachable_swap — bug not reproduced."
else
  echo "ExpoSE did NOT find Reachable_swap."
  echo "  (caseSwap: arg.substring(3, 1) === \"12\")"
fi

echo
echo "$DIVIDER"
echo "Step 2: Sanity check in real Node — is Reachable_swap actually reachable?"
echo "$DIVIDER"
node -e '
  const candidates = ["x12yy", "a12bc", "P12QR"];
  for (const s of candidates) {
    const hit = s.substring(3, 1) === "12";
    console.log("    " + JSON.stringify(s) + ".substring(3, 1) === \"12\"  ->  " + hit);
  }
'
echo
echo "Real JS confirms: substring(3,1) swaps args to substring(1,3), so any"
echo "string with arg[1]=\"1\", arg[2]=\"2\" hits the branch. It is reachable."

echo
echo "$DIVIDER"
echo "Step 3: Force-replay ExpoSE with arg=\"x12yy\" and show emitted SMT"
echo "$DIVIDER"
REPLAY_OUT="$(mktemp)"
trap 'rm -f "$ANALYSE_OUT" "$REPLAY_OUT"' EXIT

./expoSE replay "$TEST" '{"arg":"x12yy","_bound":0}' >"$REPLAY_OUT" 2>&1 || true

echo "Concretizer warnings (model failed to intercept .substring):"
grep -c 'Unsupported symbolic field.*substring' "$REPLAY_OUT" \
  | awk '{print "    " $1 " warning(s) about field substring being concretized"}'

echo
echo "What ExpoSE actually emitted to Z3 for caseSwap (look for str.substr):"
grep -m1 -A2 'str.substr arg' "$REPLAY_OUT" | head -6 | sed 's/^/    /'

echo
echo "Throws that fired during the replay (note: misattributed, not caseSwap):"
grep -E 'Uncaught exception|Reachable_' "$REPLAY_OUT" | sed 's/^/    /'

echo
echo "$DIVIDER"
echo "Conclusion"
echo "$DIVIDER"
echo "ExpoSE's SMT uses (str.substr arg 3 1) for arg.substring(3, 1)."
echo "Length-1 substring can never equal \"12\", so caseSwap is reported"
echo "unreachable even though real JS reaches it trivially."
echo
echo "Root cause: Analyser/src/Models/StringModels.js:67-68"
echo "    model.add(String.prototype.substr,    substrModel);"
echo "    model.add(String.prototype.substring, substrModel);  <-- wrong"
echo
echo "Fix: build a dedicated substringModel that swaps args when start > end,"
echo "clamps negatives to 0, clamps end to length, and encodes length as"
echo "(end - start) rather than treating args[1] as a raw length."
