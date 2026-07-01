#!/usr/bin/env node
/*
 * Reproduce PLDI'19 ExpoSE paper, Table 6 ("Statement coverage ... on popular NPM packages").
 *
 * The paper reports, per library, the statement coverage achieved by ExpoSE. ExpoSE's JSON
 * result (EXPOSE_JSON_PATH) records per-file coverage in `finalCoverage[]`:
 *   - loc       : { found, total, touched[], all[], coverage }   <- statement (line) coverage
 *   - terms     : { found, total, coverage }   <- term/expression coverage
 *   - decisions : { trueTaken, falseTaken, totalOptions, coverage }  <- decision/branch coverage
 *
 * NOTE on loc: `coverage` is `found / all.length` -- covered reachable lines over total
 * *reachable* (instrumented) lines, NOT found/total. `total` is the file's physical line
 * count (the log's "Lines Of Code"), which is what the paper reports as LOC. So statement
 * coverage uses all.length as denominator; the LOC column uses total.
 *
 * Per target we aggregate over all loaded files EXCEPT ExpoSE's own harness + S$ runtime, so
 * "LOC" is the paper's "lines of code loaded at runtime" and the percentages are weighted by
 * line/term/option counts (sum found / sum denom), not a naive mean of per-file ratios.
 *
 * Usage:
 *   # single config (detailed): LOC, statement %, decision %, term %
 *   node extract-coverage.js minimist=out/minimist.json semver=out/semver.json
 *
 *   # average several runs of the same target (paper averaged 6) -- comma-separate the files
 *   node extract-coverage.js minimist=out/run1/minimist.json,out/run2/minimist.json,...
 *
 *   # compare two configs -> Old%, New%, +% (relative increase), mirroring Table 6
 *   #   prefix each arg with "ColumnName:"
 *   node extract-coverage.js \
 *     Old:minimist=out/old/minimist.json  New:minimist=out/new/minimist.json \
 *     Old:semver=out/old/semver.json      New:semver=out/new/semver.json
 *
 * Getting an "Old" baseline on THIS tree (the original ExpoSE [27] is a separate codebase):
 * run AHG with regex features disabled to approximate the §7.3 "concrete regex" baseline, e.g.
 *   EXPOSE_DISABLE_CAPTURE_GROUPS=1 EXPOSE_DISABLE_REFINEMENTS=1  -> partial
 *   EXPOSE_DISABLE_REGULAR_EXPRESSIONS=1                          -> concrete baseline
 */

"use strict";
const fs = require("fs");
const path = require("path");

// ExpoSE's own harness / symbolic runtime -- not part of the target library.
const INTERNAL = [
  `${path.sep}lib${path.sep}Harness${path.sep}`,
  `${path.sep}lib${path.sep}S$${path.sep}`,
];
const isInternal = (f) => INTERNAL.some((p) => f.includes(p));

// Aggregate coverage counters across the target's (non-internal) files in one JSON result.
function coverageOf(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const acc = {
    locFound: 0, // covered reachable lines (loc.found == touched.length)
    locReach: 0, // total reachable/instrumented lines (loc.all.length) -> stmt-cov denominator
    locTotal: 0, // physical line count (loc.total) -> reported as "LOC loaded"
    termFound: 0,
    termTotal: 0,
    decTaken: 0,
    decTotal: 0,
  };
  for (const c of j.finalCoverage || []) {
    if (isInternal(c.file)) continue;
    if (c.loc) {
      acc.locFound += c.loc.found;
      acc.locReach += c.loc.all ? c.loc.all.length : c.loc.total;
      acc.locTotal += c.loc.total;
    }
    if (c.terms) {
      acc.termFound += c.terms.found;
      acc.termTotal += c.terms.total;
    }
    if (c.decisions) {
      acc.decTaken += c.decisions.trueTaken + c.decisions.falseTaken;
      acc.decTotal += c.decisions.totalOptions;
    }
  }
  const pct = (a, b) => (b ? (100 * a) / b : 0);
  return {
    loc: acc.locTotal,
    stmt: pct(acc.locFound, acc.locReach),
    decision: pct(acc.decTaken, acc.decTotal),
    term: pct(acc.termFound, acc.termTotal),
  };
}

// Average metrics over several run files of the same (column, target) cell.
function averaged(files) {
  const ms = files.map(coverageOf);
  const mean = (k) => ms.reduce((s, m) => s + m[k], 0) / ms.length;
  return {
    loc: Math.round(mean("loc")),
    stmt: mean("stmt"),
    decision: mean("decision"),
    term: mean("term"),
    runs: ms.length,
  };
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error(
    "usage: node extract-coverage.js [Column:]target=file[,file...] ...",
  );
  process.exit(1);
}

// Parse "[col:]label=file,file,..." -> grouped by column (ordered) and row label (ordered).
const columns = [];
const rows = [];
const cells = {}; // cells[label][col] = metrics
for (const a of args) {
  const eq = a.indexOf("=");
  if (eq < 0) {
    console.error(`bad arg (need label=file): ${a}`);
    process.exit(1);
  }
  let left = a.slice(0, eq);
  const files = a
    .slice(eq + 1)
    .split(",")
    .filter(Boolean);
  let col = "Coverage";
  const colon = left.indexOf(":");
  if (colon >= 0) {
    col = left.slice(0, colon);
    left = left.slice(colon + 1);
  }
  const label = left;
  if (!columns.includes(col)) columns.push(col);
  if (!rows.includes(label)) rows.push(label);
  (cells[label] || (cells[label] = {}))[col] = averaged(files);
}

const f1 = (v) => v.toFixed(1);

function render(matrix) {
  const w = matrix[0].map((_, i) =>
    Math.max(...matrix.map((r) => String(r[i]).length)),
  );
  const pad = (s, i) =>
    i === 0 ? String(s).padEnd(w[i]) : String(s).padStart(w[i] + 2);
  matrix.forEach((r, ri) => {
    console.log(r.map((c, i) => pad(c, i)).join("  "));
    if (ri === 0)
      console.log(
        "-".repeat(w.reduce((a, b) => a + b + 2, 0) + (w.length - 1) * 2),
      );
  });
}

if (columns.length === 1) {
  // Single-config: detailed coverage breakdown.
  console.log("\nStatement / decision / term coverage per target\n");
  const matrix = [["Target", "LOC", "Stmt%", "Decision%", "Term%", "runs"]];
  for (const label of rows) {
    const m = cells[label][columns[0]];
    matrix.push([
      label,
      String(m.loc),
      f1(m.stmt),
      f1(m.decision),
      f1(m.term),
      String(m.runs),
    ]);
  }
  render(matrix);
} else {
  // Multi-config: PLDI Table 6 style -> statement coverage per column + relative increase.
  const first = columns[0];
  const last = columns[columns.length - 1];
  console.log(
    `\nTable 6: statement coverage by config  (+% = relative increase ${first} -> ${last})\n`,
  );
  const matrix = [["Library", "LOC", ...columns.map((c) => c + "%"), "+%"]];
  for (const label of rows) {
    const byCol = cells[label] || {};
    const loc = (byCol[last] || byCol[first] || {}).loc || 0;
    const o = byCol[first] ? byCol[first].stmt : null;
    const n = byCol[last] ? byCol[last].stmt : null;
    let delta = "-";
    if (o != null && n != null) {
      delta = o === 0 ? (n === 0 ? "0.0" : "∞") : f1(((n - o) / o) * 100);
    }
    matrix.push([
      label,
      String(loc),
      ...columns.map((c) => (byCol[c] ? f1(byCol[c].stmt) : "-")),
      delta,
    ]);
  }
  render(matrix);
}
console.log(
  "\n(Stmt% = statement/line coverage = paper's 'coverage'. LOC = lines loaded at runtime,\n ExpoSE harness + S$ runtime excluded.)",
);
