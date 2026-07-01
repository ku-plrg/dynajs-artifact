import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { taintedString, untainted, anyTainted, newNode, UNKNOWN_SITE } from "../../src/dynajs-analysis/provenance.js";

describe("taintedString", () => {
  it("sets bit=true and chars all true", () => {
    const info = taintedString("abc", "Tainted", []);
    assert.equal(info.bit, true);
    assert.deepEqual(info.chars, [true, true, true]);
    assert.equal(anyTainted(info), true);
  });

  it("empty string produces empty chars array", () => {
    const info = taintedString("", "Tainted", []);
    assert.equal(info.bit, true);
    assert.deepEqual(info.chars, []);
  });
});

describe("untainted", () => {
  it("anyTainted returns false", () => {
    const info = untainted();
    assert.equal(anyTainted(info), false);
    assert.equal(info.bit, false);
  });

  it("stores value and uses UNKNOWN_SITE by default", () => {
    const info = untainted(42);
    assert.equal(info.node.value, 42);
    assert.deepEqual(info.node.site, UNKNOWN_SITE);
  });
});

describe("anyTainted", () => {
  it("returns false for undefined", () => {
    assert.equal(anyTainted(undefined), false);
  });
});

describe("newNode taint propagation", () => {
  it("label 'Tainted' with no parents → tainted=true", () => {
    const n = newNode("Tainted", [], null, UNKNOWN_SITE);
    assert.equal(n.tainted, true);
  });

  it("non-Tainted label with no parents → tainted=false", () => {
    const n = newNode("flow", [], null, UNKNOWN_SITE);
    assert.equal(n.tainted, false);
  });

  it("node with a tainted parent → tainted=true regardless of label", () => {
    const parent = newNode("Tainted", [], null, UNKNOWN_SITE);
    const child = newNode("flow", [parent], null, UNKNOWN_SITE);
    assert.equal(child.tainted, true);
  });

  it("node with only untainted parents → tainted=false", () => {
    const parent = newNode("Untainted", [], null, UNKNOWN_SITE);
    const child = newNode("flow", [parent], null, UNKNOWN_SITE);
    assert.equal(child.tainted, false);
  });
});
