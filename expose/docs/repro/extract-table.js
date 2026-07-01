#!/usr/bin/env node
/*
 * Reproduce SPIN'17 ExpoSE paper, Table 1 ("Statistics and runtimes for testing targets").
 *
 * Reads one or more ExpoSE JSON result files (produced via EXPOSE_JSON_PATH) and prints
 * the same statistics the paper reports per target:
 *   - Lines of Code     : LOC of the target library file(s) (harness + S$ runtime excluded)
 *   - Path Count        : number of explored paths (done.length)
 *   - Total Execution   : wall-clock time of the whole run (end - start)
 *   - Median Test Case  : median per-test-case time
 *   - Shortest Test Case: min per-test-case time
 *   - Longest Test Case : max per-test-case time
 *
 * Usage:
 *   node docs/repro/extract-table.js minimist=out/minimist.json semver=out/semver.json validator=out/validator.json
 *   node docs/repro/extract-table.js out/minimist.json          # label inferred from filename
 */

"use strict";
const fs = require("fs");
const path = require("path");

// ExpoSE's own harness / symbolic runtime — not part of the target library's LOC.
const INTERNAL = [
  `${path.sep}lib${path.sep}Harness${path.sep}`,
  `${path.sep}lib${path.sep}S$${path.sep}`,
];
const isInternal = (f) => INTERNAL.some((p) => f.includes(p));

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function stats(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const times = j.done.map((d) => d.time / 1000); // ms -> s
  const loc = (j.finalCoverage || [])
    .filter((d) => d.loc && !isInternal(d.file))
    .reduce((sum, d) => sum + d.loc.total, 0);
  const errs = j.done.reduce((n, d) => n + (d.errors ? d.errors.length : 0), 0);
  return {
    loc,
    paths: j.done.length,
    total: (j.end - j.start) / 1000,
    median: median(times),
    shortest: times.length ? Math.min(...times) : 0,
    longest: times.length ? Math.max(...times) : 0,
    errs,
  };
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error("usage: node extract-table.js [label=]result.json ...");
  process.exit(1);
}

const cols = args.map((a) => {
  const [label, file] = a.includes("=")
    ? a.split("=")
    : [path.basename(a, ".json"), a];
  return { label, ...stats(file) };
});

const f2 = (v) => v.toFixed(2) + "s";
const rows = [
  ["", ...cols.map((c) => c.label)],
  ["Lines of Code", ...cols.map((c) => String(c.loc))],
  ["Path Count", ...cols.map((c) => String(c.paths))],
  ["Total Execution", ...cols.map((c) => f2(c.total))],
  ["Median Test Case", ...cols.map((c) => f2(c.median))],
  ["Shortest Test Case", ...cols.map((c) => f2(c.shortest))],
  ["Longest Test Case", ...cols.map((c) => f2(c.longest))],
];

const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
const pad = (s, i) => (i === 0 ? s.padEnd(w[i]) : s.padStart(w[i] + 2));
console.log("\nTable 1: Statistics and runtimes for testing targets\n");
rows.forEach((r, ri) => {
  console.log(r.map((c, i) => pad(c, i)).join("  "));
  if (ri === 0)
    console.log(
      "-".repeat(w.reduce((a, b) => a + b + 2, 0) + (w.length - 1) * 2),
    );
});
console.log(
  "\n(Path errors / ignored type-exceptions per target: " +
    cols.map((c) => `${c.label}=${c.errs}`).join(", ") +
    ")",
);
