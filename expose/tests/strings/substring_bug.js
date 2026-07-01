/*
 * Bug demo for Analyser/src/Models/StringModels.js.
 *
 * In StringModels.js a single `substrModel` is built with
 *   symbolicHook(String.prototype.substr, cond, symbolicSubstring)
 * and then registered for BOTH `String.prototype.substr` AND
 * `String.prototype.substring`. JS substring semantics differ from substr:
 *
 *   - substring(start, end): args[1] is an EXCLUSIVE END INDEX
 *   - substring swaps its arguments when start > end
 *   - substring clamps negative args to 0 (does NOT count from the end)
 *
 * Two-level failure is observable:
 *   1. Symbolic: the model emits `(str.substr arg start args[1])`, treating
 *      args[1] as a length. The solver then can't find inputs that satisfy
 *      branch conditions only reachable under true substring semantics.
 *   2. Concrete: symbolicHook's runMethod invokes `String.prototype.substr`
 *      (the first arg of the hook) even when the user wrote .substring(),
 *      so ExpoSE's "concrete" run also returns the wrong value and either
 *      misses real throws or fires throws on inputs that wouldn't really
 *      satisfy them.
 *
 * Running this file: `./scripts/analyse "$(pwd)/tests/strings/substring_bug.js"`
 *
 * Expected with the bug present:
 *   - `Reachable_swap` is never discovered, although `arg = "x12yy"` makes
 *     it reachable in real JS ("x12yy".substring(3,1) === "12" is true).
 *   - `Reachable_negative_end` and other reports are misattributed to
 *     inputs that wouldn't satisfy them under real substring semantics.
 *
 * Fix sketch: build a dedicated substringModel using
 *   symbolicHook(String.prototype.substring, cond, helpers.substringForSubstring)
 * where the symbolic helper:
 *   - clamps both args to [0, length]
 *   - swaps if start > end
 *   - emits seq.substr(start, end - start) rather than seq.substr(start, len)
 */

var S$ = require("S$");
var arg = S$.symbol("arg", "");

// substring swaps args when start > end; substr does not.
// Real JS:  arg.substring(3, 1) === arg.substring(1, 3)  -> needs arg[1..2] === "12"
// Model:    arg.substr(3, 1)                              -> 1-char result, UNSAT vs "12"
function caseSwap(s) {
  if (s.substring(3, 1) === "12") {
    throw "Reachable_swap";
  }
}

// Negative end clamps to 0 in substring (result is empty string).
// Real JS:  "anything".substring(2, -3) === ""  always
// Model:    substr(2, -3)  -> negative length handler kicks in, encoding diverges
function caseNegativeEnd(s) {
  if (s.length >= 5 && s.substring(2, -3) === "") {
    throw "Reachable_negative_end";
  }
}

// End past length clamps in substring.
// Real JS:  "ab".substring(0, 99) === "ab"   -> reachable with arg = "ab"
// Model:    substr(0, 99) on "ab" → helper clamps len to length, also "ab".
// Both happen to agree here, included as a control point that should pass.
function caseEndOverflow(s) {
  if (s === "ab" && s.substring(0, 99) === "ab") {
    throw "Reachable_overflow_control";
  }
}

caseSwap(arg);
caseNegativeEnd(arg);
caseEndOverflow(arg);
