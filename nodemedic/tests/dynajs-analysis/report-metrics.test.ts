import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  get_number_of_nodes,
  get_tainted_vals,
  get_untainted_vals,
  map_expl,
} from "../../src/dynajs-analysis/report.js";
import { newNode, UNKNOWN_SITE } from "../../src/dynajs-analysis/provenance.js";

// ---------------------------------------------------------------------------
// Hand-traced expected values (see comments per test for derivation).
// ---------------------------------------------------------------------------

const L = UNKNOWN_SITE;

// ---------------------------------------------------------------------------
// map_expl — spot-check a few entries to catch copy-paste drift
// ---------------------------------------------------------------------------
describe("map_expl — spot checks", () => {
  it("has 48 entries", () => {
    assert.equal(Object.keys(map_expl).length, 48);
  });
  it("precise:string.concat = [0.11, 0.41]", () => {
    assert.deepEqual(map_expl["precise:string.concat"], [0.11, 0.41]);
  });
  it("call:concat = [0.47, 0.67]", () => {
    assert.deepEqual(map_expl["call:concat"], [0.47, 0.67]);
  });
  it(">>> = [0.0, 1.0]", () => {
    assert.deepEqual(map_expl[">>>"], [0.0, 1.0]);
  });
  it("call:isString = [0.1, 1.0]", () => {
    assert.deepEqual(map_expl["call:isString"], [0.1, 1.0]);
  });
  it("call:assign = [0.42, 0.34]", () => {
    assert.deepEqual(map_expl["call:assign"], [0.42, 0.34]);
  });
});

// ---------------------------------------------------------------------------
// get_number_of_nodes
//
// Scoring rule:
//   known label: contribution = 1 - map_expl[label][tainted ? 0 : 1]
//   unknown label: contribution = 0.958
// ---------------------------------------------------------------------------
describe("get_number_of_nodes — single Tainted node", () => {
  it("returns 0.958 for a lone Tainted node (label not in map_expl)", () => {
    // "Tainted" is not a key in map_expl → default 0.958.
    const node = newNode("Tainted", [], "secret", L);
    assert.equal(get_number_of_nodes(node), 0.958);
  });
});

describe("get_number_of_nodes — precise:string.concat over two leaves", () => {
  // DAG: concat(Tainted("whoami"), Untainted("echo "))
  // concat: tainted=true → 1 - map_expl["precise:string.concat"][0] = 1 - 0.11 = 0.89
  // Tainted leaf: unknown label, tainted=true → 0.958
  // Untainted leaf: unknown label, tainted=false → 0.958
  // Total = 0.89 + 0.958 + 0.958 = 2.806
  it("returns 2.806", () => {
    const taintedLeaf = newNode("Tainted", [], "whoami", L);
    const untaintedLeaf = newNode("Untainted", [], "echo ", L);
    const concat = newNode(
      "precise:string.concat",
      [taintedLeaf, untaintedLeaf],
      "echo whoami",
      L
    );
    const result = get_number_of_nodes(concat);
    // Use approximate comparison for floating-point sums.
    assert.ok(
      Math.abs(result - 2.806) < 1e-9,
      `Expected ≈2.806, got ${result}`
    );
  });
});

describe("get_number_of_nodes — visited guard prevents double-counting shared parent", () => {
  // DAG (diamond):
  //   shared = newNode("Tainted", ...) → unknown label, tainted=true → 0.958
  //   left   = newNode("precise:string.concat", [shared]) → tainted=true
  //              → 1 - 0.11 = 0.89
  //   right  = newNode("call:concat", [shared]) → tainted=true
  //              → 1 - 0.47 = 0.53
  //   root   = newNode("imprecise:concat", [left, right]) → tainted=true
  //              → 1 - 0.03 = 0.97
  //
  // Walk order (DFS pre-order, parents in array order):
  //   root(0.97) → left(0.89) → shared(0.958) [mark visited]
  //             → right(0.53) → shared → already visited, return 0
  //
  // Total WITH guard   = 0.97 + 0.89 + 0.958 + 0.53 = 3.348
  // Total WITHOUT guard = 0.97 + 0.89 + 0.958 + 0.53 + 0.958 = 4.306
  it("returns 3.348 (shared counted once)", () => {
    const shared = newNode("Tainted", [], "x", L);
    const left = newNode("precise:string.concat", [shared], "lx", L);
    const right = newNode("call:concat", [shared], "rx", L);
    const root = newNode("imprecise:concat", [left, right], "lxrx", L);
    const result = get_number_of_nodes(root);
    assert.ok(
      Math.abs(result - 3.348) < 1e-9,
      `Expected ≈3.348, got ${result}`
    );
  });
});

// ---------------------------------------------------------------------------
// get_untainted_vals
//
// Extracts the untainted prefix of a tainted node's parents (stops at first
// tainted parent). Returns "" for a "Tainted" root node.
// ---------------------------------------------------------------------------
describe("get_untainted_vals", () => {
  it("returns '' for a lone Tainted node", () => {
    const node = newNode("Tainted", [], "secret", L);
    assert.equal(get_untainted_vals(node), "");
  });

  it("returns '' when first parent is tainted (tainted before untainted)", () => {
    // parents order: [Tainted("whoami"), Untainted("echo ")]
    // loop: parent[0]=tainted → get_untainted_vals(Tainted) = "" → result=""
    //       parent[0].tainted=true → break
    // Returns "".
    // NOTE: counterintuitive — "echo " is never reached because the tainted
    // parent comes first and triggers the break.
    const taintedLeaf = newNode("Tainted", [], "whoami", L);
    const untaintedLeaf = newNode("Untainted", [], "echo ", L);
    const concat = newNode(
      "precise:string.concat",
      [taintedLeaf, untaintedLeaf],
      "echo whoami",
      L
    );
    assert.equal(get_untainted_vals(concat), "");
  });

  it("returns 'echo ' when untainted parent comes first", () => {
    // parents order: [Untainted("echo "), Tainted("whoami")]
    // loop: parent[0]=untainted → get_untainted_vals(Untainted) = "echo "
    //       parent[0].tainted=false → no break
    //       parent[1]=tainted → get_untainted_vals(Tainted) = ""
    //       parent[1].tainted=true → break
    // Returns "echo ".
    const taintedLeaf = newNode("Tainted", [], "whoami", L);
    const untaintedLeaf = newNode("Untainted", [], "echo ", L);
    const concat = newNode(
      "precise:string.concat",
      [untaintedLeaf, taintedLeaf],
      "echo whoami",
      L
    );
    assert.equal(get_untainted_vals(concat), "echo ");
  });

  it("returns the value directly for a fully untainted node", () => {
    const node = newNode("Untainted", [], "static", L);
    assert.equal(get_untainted_vals(node), "static");
  });
});

// ---------------------------------------------------------------------------
// get_tainted_vals
//
// Extracts the attacker-controlled portion: strips untainted sub-values and
// 'undefined' artefacts from the tainted node's runtime value.
// ---------------------------------------------------------------------------
describe("get_tainted_vals", () => {
  it("returns '' for a lone Tainted node (label guard)", () => {
    const node = newNode("Tainted", [], "secret", L);
    assert.equal(get_tainted_vals(node, "exec"), "");
  });

  it("returns '' for an untainted node", () => {
    const node = newNode("Untainted", [], "static", L);
    assert.equal(get_tainted_vals(node, "exec"), "");
  });

  it("extracts attacker-controlled 'whoami' from concat(Tainted, Untainted)", () => {
    // parents: [Tainted("whoami"), Untainted("echo ")]
    // concat.value = "echo whoami", tainted=true
    //
    // get_tainted_vals(concat, "exec"):
    //   tainted_val = "echo whoami"
    //   get_tainted_vals_aux(concat, "exec"):
    //     concat.tainted=true, no exclusion for "precise:string.concat" + "exec"
    //     → recurse parents:
    //       Tainted("whoami") → label="Tainted" → []
    //       Untainted("echo ") → tainted=false → else branch, value="echo " → ["echo "]
    //     returns ["echo "]
    //   "echo whoami".includes("echo ") → replace → "whoami"
    //   replaceAll('undefined','') → "whoami"
    // Returns "whoami".
    const taintedLeaf = newNode("Tainted", [], "whoami", L);
    const untaintedLeaf = newNode("Untainted", [], "echo ", L);
    const concat = newNode(
      "precise:string.concat",
      [taintedLeaf, untaintedLeaf],
      "echo whoami",
      L
    );
    assert.equal(get_tainted_vals(concat, "exec"), "whoami");
  });

  it("returns '' for call:stringify node when sink is eval", () => {
    const taintedLeaf = newNode("Tainted", [], "x", L);
    const node = newNode("call:stringify", [taintedLeaf], '{"a":"x"}', L);
    assert.equal(get_tainted_vals(node, "eval"), "");
  });

  it("returns '' for call:encodeURIComponent node when sink is exec", () => {
    const taintedLeaf = newNode("Tainted", [], "x", L);
    const node = newNode("call:encodeURIComponent", [taintedLeaf], "x", L);
    assert.equal(get_tainted_vals(node, "exec"), "");
  });

  it("call:escape does NOT block when sink is eval (no early-return)", () => {
    // call:escape + eval: NOT blocked by get_tainted_vals early returns
    // (only call:stringify/imprecise:stringify block on eval; only
    // call:encodeURIComponent/call:escape block on exec/spawn).
    // Proceeds normally → tainted_val from pn.value.
    const taintedLeaf = newNode("Tainted", [], "x", L);
    const node = newNode("call:escape", [taintedLeaf], "x", L);
    // tainted=true, value="x", aux returns [] (taintedLeaf returns []), replaceAll → "x"
    assert.equal(get_tainted_vals(node, "eval"), "x");
  });
});
