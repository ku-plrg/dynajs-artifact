import { type Site } from "../../lib/dynajs/analyses/flow/index.js";

const UNKNOWN_SITE: Site = { kind: "unknown" };

export interface PathNode {
  label: string;
  parents: PathNode[];          // array (was Set); preserves order for reporting
  value: unknown;
  tainted: boolean;
  site: Site;
  sinkType: string;
}

// Re-export so callers can default to the framework's unknown site.
export { type Site, UNKNOWN_SITE };

// The Info payload: taint bit + char-level taint + provenance node.
export interface NmInfo {
  bit: boolean;
  chars?: boolean[];
  node: PathNode;
}

function isPrimitive(value: unknown): boolean {
  return value === null || (typeof value !== "object" && typeof value !== "function");
}

function normalizeProvenanceValue(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (isPrimitive(value)) return value;
  if (typeof value === "function") return value;

  const objectValue = value as object;
  if (seen.has(objectValue)) return seen.get(objectValue);

  const valueOf = (objectValue as { valueOf?: () => unknown }).valueOf;
  if (typeof valueOf === "function") {
    try {
      const primitive = valueOf.call(objectValue);
      if (primitive !== objectValue && isPrimitive(primitive)) return primitive;
    } catch {
      // Ignore hostile valueOf implementations; provenance snapshots should not
      // change runtime behavior.
    }
  }

  if (Array.isArray(value)) {
    const result: unknown[] = [];
    seen.set(objectValue, result);
    for (const element of value) {
      result.push(normalizeProvenanceValue(element, seen));
    }
    return result;
  }

  const result: Record<string, unknown> = {};
  seen.set(objectValue, result);
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    result[key] = normalizeProvenanceValue(child, seen);
  }
  return result;
}

export function anyTainted(info: NmInfo | undefined): boolean {
  if (info === undefined) return false;
  return info.bit || (info.chars?.some((c) => c) ?? false);
}

export function newNode(label: string, parents: PathNode[], value: unknown,
                        site: Site = UNKNOWN_SITE, sinkType = ""): PathNode {
  const tainted = label === "Tainted" || parents.some((p) => p.tainted);
  return { label, parents, value: normalizeProvenanceValue(value), tainted, site, sinkType };
}

export function untainted(value: unknown = undefined, site: Site = UNKNOWN_SITE): NmInfo {
  return { bit: false, node: newNode("Untainted", [], value, site) };
}

export function taintedString(value: string, label: string, parents: PathNode[],
                              site: Site = UNKNOWN_SITE): NmInfo {
  return {
    bit: true,
    chars: Array.from({ length: value.length }, () => true),
    node: newNode(label, parents, value, site),
  };
}
