import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildTaintPathJSON } from "../../src/dynajs-analysis/report.js";
import { newNode } from "../../src/dynajs-analysis/provenance.js";
import type { Site } from "../../lib/dynajs/src/model/site.js";

// Helper: make a code Site with a distinct file for easy assertion.
function loc(scriptName: string): Site {
  return { kind: "code", id: 0, file: scriptName,
           start: { line: 1, column: 0 }, end: { line: 1, column: 5 } };
}

describe("buildTaintPathJSON — single node (no parents)", () => {
  it("root is at id '1' with empty flows_from and correct fields", () => {
    const node = newNode("Tainted", [], "secret", loc("a.js"), "exec");
    const out = buildTaintPathJSON(node);

    assert.deepEqual(Object.keys(out), ["1"]);
    assert.equal(out["1"].operation, "Tainted");
    assert.equal(out["1"].value, "secret");
    assert.equal(out["1"].file, "a.js");
    assert.equal(out["1"].startLineNumber, 1);
    assert.equal(out["1"].startColumnNumber, 0);
    assert.equal(out["1"].endLineNumber, 1);
    assert.equal(out["1"].endColumnNumber, 5);
    assert.equal(out["1"].tainted, true);
    assert.deepEqual(out["1"].flows_from, []);
    assert.equal(out["1"].sink_type, "exec");
  });
});

describe("buildTaintPathJSON — two parents (flat)", () => {
  // concat(Tainted, Untainted): root="1", parent[0]→"2", parent[1]→"3"
  it("root flows_from is ['2','3'] and parent entries exist at those ids", () => {
    const taintedParent = newNode("Tainted", [], "t", loc("t.js"));
    const untaintedParent = newNode("Untainted", [], "u", loc("u.js"));
    const root = newNode("precise:string.concat", [taintedParent, untaintedParent], "tu", loc("root.js"), "exec");

    const out = buildTaintPathJSON(root);

    // Root
    assert.equal(out["1"].operation, "precise:string.concat");
    assert.deepEqual(out["1"].flows_from, ["2", "3"]);

    // parent[0] = Tainted at id 2
    assert.equal(out["2"].operation, "Tainted");
    assert.deepEqual(out["2"].flows_from, []);

    // parent[1] = Untainted at id 3
    assert.equal(out["3"].operation, "Untainted");
    assert.deepEqual(out["3"].flows_from, []);

    // Exactly 3 entries
    assert.deepEqual(Object.keys(out).sort(), ["1", "2", "3"]);
  });
});

describe("buildTaintPathJSON — nested grandparent (DFS id scheme)", () => {
  // DAG: concat(substring(Tainted), Untainted)
  // Pre-order DFS walk:
  //   walk(concat, 1): thisId=1
  //     parent[0]=substring → id=2, flows_from=["2"]
  //       walk(substring, 2): thisId=2
  //         parent[0]=Tainted → id=3, flows_from=["3"]
  //           walk(Tainted, 3): no parents → out[3], returns 3
  //         out[2]={flows_from:["3"]}, returns 3
  //     id now 3; parent[1]=Untainted → id=4, flows_from=["2","4"]
  //       walk(Untainted, 4): no parents → out[4], returns 4
  //   out[1]={flows_from:["2","4"]}, returns 4
  it("exact id→operation mapping across 4 nodes", () => {
    const taintedLeaf = newNode("Tainted", [], "secret", loc("src.js"));
    const substring = newNode("precise:string.substring", [taintedLeaf], "secr", loc("op.js"));
    const untaintedLeaf = newNode("Untainted", [], "static", loc("lit.js"));
    const concat = newNode("precise:string.concat", [substring, untaintedLeaf], "secrstatic", loc("sink.js"), "exec");

    const out = buildTaintPathJSON(concat);

    // Exactly 4 entries
    assert.deepEqual(Object.keys(out).sort(), ["1", "2", "3", "4"]);

    // id 1: concat, flows_from parent[0]=substring→2, parent[1]=untainted→4
    assert.equal(out["1"].operation, "precise:string.concat");
    assert.deepEqual(out["1"].flows_from, ["2", "4"]);
    assert.equal(out["1"].file, "sink.js");
    assert.equal(out["1"].sink_type, "exec");

    // id 2: substring (child of concat), flows_from Tainted→3
    assert.equal(out["2"].operation, "precise:string.substring");
    assert.deepEqual(out["2"].flows_from, ["3"]);
    assert.equal(out["2"].file, "op.js");
    assert.equal(out["2"].tainted, true);

    // id 3: Tainted leaf (grandchild), no parents
    assert.equal(out["3"].operation, "Tainted");
    assert.deepEqual(out["3"].flows_from, []);
    assert.equal(out["3"].tainted, true);
    assert.equal(out["3"].value, "secret");

    // id 4: Untainted leaf (second child of concat), no parents
    assert.equal(out["4"].operation, "Untainted");
    assert.deepEqual(out["4"].flows_from, []);
    assert.equal(out["4"].tainted, false);
    assert.equal(out["4"].value, "static");
  });
});
