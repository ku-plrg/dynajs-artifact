#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");

let ENTRYPOINT_CSV = "entrypoints_results.csv";
let LIMIT = 0;   // 0 = run all packages
let WORKERS = 1; // parallel packages per config

function usage() {
  console.log(`Usage: ${path.basename(process.argv[1])} [--csv FILE] [--limit N] [--workers N]`);
  console.log("  --csv FILE   CSV with package_name,version,num_entrypoints");
  console.log("  --limit N    Only run the first N packages after sorting");
  console.log("  --workers N  Run N packages in parallel per config");
  process.exit(1);
}

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === "--csv") {
    ENTRYPOINT_CSV = process.argv[++i];
  } else if (arg === "--limit") {
    LIMIT = Number(process.argv[++i]);
  } else if (arg === "--workers") {
    WORKERS = Number(process.argv[++i]);
  } else if (arg === "-h" || arg === "--help") {
    usage();
  } else {
    console.error(`Unknown argument: ${arg}`);
    usage();
  }
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }

  out.push(cur);
  return out;
}

function loadPackagesFromCsv(csvPath) {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found: ${csvPath}`);
  }

  const text = fs.readFileSync(csvPath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);

  if (lines.length === 0) {
    throw new Error(`CSV is empty: ${csvPath}`);
  }

  const header = parseCsvLine(lines[0]);
  const pkgIdx = header.indexOf("package_name");
  const verIdx = header.indexOf("version");
  const entIdx = header.indexOf("num_entrypoints");

  if (pkgIdx === -1 || verIdx === -1 || entIdx === -1) {
    throw new Error("CSV must have headers: package_name, version, num_entrypoints");
  }

  const seen = new Set();
  const packages = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const packageName = (cols[pkgIdx] || "").trim();
    const version = (cols[verIdx] || "").trim();
    const rawEntrypoints = (cols[entIdx] || "").trim();

    if (!packageName || !version) {
      continue;
    }

    if (rawEntrypoints === "") {
      console.log(`[skip] ${packageName}@${version}: empty num_entrypoints`);
      continue;
    }

    const numEntrypoints = Number(rawEntrypoints);
    if (!Number.isFinite(numEntrypoints)) {
      console.log(`[skip] ${packageName}@${version}: invalid num_entrypoints='${rawEntrypoints}'`);
      continue;
    }

    const packageKey = `${packageName}@${version}`;
    if (seen.has(packageKey)) {
      continue;
    }
    seen.add(packageKey);

    packages.push({
      packageName,
      version,
      packageKey,
      numEntrypoints,
    });
  }

  packages.sort((a, b) => {
    if (a.numEntrypoints !== b.numEntrypoints) {
      return a.numEntrypoints - b.numEntrypoints;
    }
    return a.packageKey.localeCompare(b.packageKey);
  });

  return LIMIT > 0 ? packages.slice(0, LIMIT) : packages;
}

function safeLogName(packageKey) {
  return packageKey.replace(/[\/\\:*?"<>|]/g, "_");
}

function readElapsed(outFile) {
  try {
    const content = fs.readFileSync(outFile, "utf8");
    const m = content.match(/^real\s+(.+)$/m);
    return m ? m[1] : "";
  } catch {
    return "";
  }
}

function snapshotTopLevel(dir) {
  if (!fs.existsSync(dir)) return new Set();
  return new Set(fs.readdirSync(dir));
}

function deleteNewEntries(dir, beforeSnapshot) {
  if (!fs.existsSync(dir)) return;

  const after = new Set(fs.readdirSync(dir));

  for (const name of after) {
    if (!beforeSnapshot.has(name)) {
      const target = path.join(dir, name);
      try {
        fs.rmSync(target, { recursive: true, force: true });
        console.log(`[cleanup] Removed ${target}`);
      } catch (err) {
        console.error(`[cleanup] Failed to remove ${target}: ${err.message}`);
      }
    }
  }
}

function runOnePackage(pkg, outDir, extraFlags, resultDir) {
  return new Promise((resolve) => {
    mkdirp(path.join(outDir, "analysisArtifacts"));

    const logBase = safeLogName(pkg.packageKey);
    const outFile = path.join(outDir, `${logBase}.out`);
    const resultFile = path.join(resultDir, logBase);

    const cmd =
      `pipeline/run_pipeline.sh 1 lower 0 ` +
      `--mode=nofilter ` +
      `--log-level=debug ` +
      `--cache-dir=packageData ` +
      `--output-dir=${outDir}/analysisArtifacts ` +
      `--tmp-dir=/tmp/ ` +
      `--z3-path=/nodetaint/z3/bin/z3 ` +
      `--fresh ` +
      `--package=${pkg.packageKey} ` +
      `--start-index=0 ` +
      `--end-index=1 ` +
      `--min-num-deps=10 ` +
      `--min-depth=-1 ` +
      `--policies=object:precise,string:precise,array:precise ` +
      `--batch-size=1 ` +
      `--stop-on-1st-exploited ` +
      `--disable-sandbox ` +
      `${extraFlags} ` +
      `--skip-require-analysis=ALL`;

    const shellCmd =
      `{ time timeout 360 /bin/sh -c '${cmd.replace(/'/g, `'\\''`)}'; } > '${outFile.replace(/'/g, `'\\''`)}' 2>&1`;

    const beforeSnapshot = snapshotTopLevel("packageData");

    function runOnce(callback) {
      const child = spawn("/bin/bash", ["-lc", shellCmd], {
        stdio: "ignore",
      });

      child.on("close", () => callback());
      child.on("error", () => callback());
    }

    function checkResult() {
      try {
        const content = fs.readFileSync(outFile, "utf8");
        return content.includes("Exploit(s) found for functions")
          ? "SUCCESS"
          : "FAIL";
      } catch {
        return "FAIL";
      }
    }

    // First run
    runOnce(() => {
      let result = checkResult();
      deleteNewEntries("packageData", beforeSnapshot);
      fs.writeFileSync(resultFile, `${result}\n`);
      resolve();
    });
  });
}

async function runWithPool(items, workerLimit, fn) {
  const active = new Set();

  for (const item of items) {
    const p = fn(item).finally(() => active.delete(p));
    active.add(p);

    if (active.size >= workerLimit) {
      await Promise.race(active);
    }
  }

  await Promise.all(active);
}

async function runConfig(label, outDir, extraFlags, packages) {
  const resultDir = fs.mkdtempSync(path.join(os.tmpdir(), "pollution-results-"));
  mkdirp(outDir);

  console.log("");
  console.log(`[+] Config: ${label}`);
  console.log(`[+] Running ${packages.length} packages with ${WORKERS} worker(s)`);

  await runWithPool(packages, WORKERS, (pkg) =>
    runOnePackage(pkg, outDir, extraFlags, resultDir)
  );

  let success = 0;
  let fail = 0;

  for (const pkg of packages) {
    const logBase = safeLogName(pkg.packageKey);
    const resultFile = path.join(resultDir, logBase);
    const outFile = path.join(outDir, `${logBase}.out`);

    let r = "FAIL";
    try {
      r = fs.readFileSync(resultFile, "utf8").trim() || "FAIL";
    } catch {
      r = "FAIL";
    }

    const elapsed = readElapsed(outFile);
    console.log(`\t[${r.padEnd(7)}] ${pkg.packageKey}${elapsed ? ` (${elapsed})` : ""}`);

    if (r === "SUCCESS") success++;
    else fail++;
  }

  fs.rmSync(resultDir, { recursive: true, force: true });

  console.log("");
  console.log(`[+] Results (${label}): SUCCESS=${success}  FAIL=${fail}`);
}

async function main() {
  const packages = loadPackagesFromCsv(ENTRYPOINT_CSV);

  console.log("[+] Execution order:");
  for (const pkg of packages) {
    const n = Number.isFinite(pkg.numEntrypoints) ? pkg.numEntrypoints : "unknown";
    console.log(`    ${pkg.packageKey} [entrypoints=${n}]`);
  }

  await runConfig(
    "synthesis, no honey",
    "syn_nohoney_results",
    "--fuzz-with-synthesis --pollution",
    packages
  );

  // await runConfig(
  //   "no synthesis, no honey",
  //   "nosyn_nohoney_results",
  //   "",
  //   packages
  // );

  // await runConfig(
  //   "synthesis, honey",
  //   "syn_honey_results",
  //   "--fuzz-with-synthesis --tainthoneyobjects",
  //   packages
  // );

  // await runConfig(
  //   "no synthesis, honey",
  //   "nosyn_honey_results",
  //   "--tainthoneyobjects",
  //   packages
  // );
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});

//pipeline/run_pipeline.sh 1 lower 0 --mode=nofilter --log-level=debug --cache-dir=packageData --output-dir=analysisArtifacts --tmp-dir=/tmp/ --z3-path=/nodetaint/z3/bin/z3 --fresh --package=getsetdeep@4.15.0 --start-index=0 --end-index=1 --min-num-deps=10 --min-depth=-1 --require-sink-hit --policies=object:precise,string:precise,array:precise --batch-size=1 --stop-on-1st-exploited --fuzz-with-synthesis --tainthoneyobjects --pollution --skip-require-analysis=ALL