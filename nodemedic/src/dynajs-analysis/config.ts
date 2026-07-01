/**
 * Parse NODEMEDIC_ANALYSIS_ARGS env var into a config map.
 * Mirrors rewrite_dynajs.ts getEnvArgs(): JSON.parse → string[]; fallback split on spaces.
 */

function getEnvArgs(): string[] {
  const rawArgs = process.env.NODEMEDIC_ANALYSIS_ARGS ?? "";
  if (rawArgs.trim() === "") return [];
  try {
    const parsed = JSON.parse(rawArgs);
    if (Array.isArray(parsed) && parsed.every((x: unknown) => typeof x === "string")) return parsed as string[];
  } catch (_err) {
    // fall through
  }
  return rawArgs.split(" ").filter(Boolean);
}

function parseArgs(args: string[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const arg of args) {
    const eq = arg.indexOf("=");
    if (eq === -1) {
      m.set(arg, "true");
    } else {
      m.set(arg.slice(0, eq), arg.slice(eq + 1));
    }
  }
  return m;
}

const _args = parseArgs(getEnvArgs());

/** Write taint_<n>.json files when a flow is detected (off by default). */
export const taintPathsJson: boolean = _args.get("taint_paths_json") === "true";

/** Optional log level string (unused for now, exposed for future use). */
export const logLevel: string = _args.get("log_level") ?? "";

/** Abort the process via setTimeout when a flow is detected (off by default; on in the real pipeline). */
export const abortOnFlow: boolean = _args.get("abort_on_flow") === "true";
