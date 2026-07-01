import { exec, execSync, spawn, spawnSync } from "node:child_process";
import { Script } from "node:vm";

// f -> sink category name. Mirrors src/Taint.ts _SINKS.
export const SINKS: ReadonlyMap<Function, string> = new Map<Function, string>([
  [Function, "Function"],
  [exec, "exec"],
  [execSync, "exec"],
  [eval, "eval"],
  [Script, "eval"],
  [spawn, "spawn"],
  [spawnSync, "spawn"],
]);

// Dynamic sink registry: populated at runtime via __jalangi_set_sink__.
const _dynamicSinks = new Map<Function, string>();

/** Register a function as a dynamic sink. */
export function registerDynamicSink(f: Function, name = "__jalangi_set_sink__"): void {
  _dynamicSinks.set(f, name);
}

export function sinkName(f: unknown): string | undefined {
  const registered = SINKS.get(f as Function) ?? _dynamicSinks.get(f as Function);
  if (registered !== undefined) return registered;
  if (typeof f === "function" && f.name === "Function") {
    try {
      if (/\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(f))) {
        return "Function";
      }
    } catch {
      // Fall through to the structural fallback below.
    }
  }
  if (typeof f === "function" && Object.getPrototypeOf(f) === Function) {
    return "Function";
  }
  return undefined;
}
