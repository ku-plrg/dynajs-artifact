import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireDyna = createRequire(path.join(repoRoot, "lib/dynajs/package.json"));
const { build } = requireDyna("esbuild");

const testDir = path.join(repoRoot, "tests/dynajs-analysis");
function collect(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".test.ts"))
    .map((e) => path.join(dir, e.name));
}
const tests = collect(testDir);
if (tests.length === 0) { console.log("no unit tests"); process.exit(0); }

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "nm-unit-"));
const bundles = [];
for (const t of tests) {
  const out = path.join(outDir, path.basename(t).replace(/\.ts$/, ".mjs"));
  await build({ entryPoints: [t], outfile: out, bundle: true, format: "esm",
    platform: "node", target: "node20", packages: "bundle", logLevel: "warning" });
  bundles.push(out);
}
const r = spawnSync(process.execPath, ["--test", ...bundles], { stdio: "inherit" });
process.exit(r.status ?? 1);
