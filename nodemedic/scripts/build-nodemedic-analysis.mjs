import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireDyna = createRequire(path.join(repoRoot, "lib/dynajs/package.json"));
const { build } = requireDyna("esbuild");

const requireBanner = [
  'import { createRequire } from "node:module";',
  "const require = createRequire(import.meta.url);",
].join("\n");

await build({
  entryPoints: [path.join(repoRoot, "src/dynajs-analysis/index.ts")],
  outfile: path.join(repoRoot, "src/vendor/NodeMedicAnalysis.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  packages: "bundle",
  banner: { js: requireBanner },
  tsconfig: path.join(repoRoot, "src/dynajs-analysis/tsconfig.json"),
  logLevel: "warning",
});
console.log("✓ built NodeMedicAnalysis.mjs");
