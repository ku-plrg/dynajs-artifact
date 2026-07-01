import type { NodeMedicAnalysis } from "./index.js";

declare const D$: { analysis: NodeMedicAnalysis } & Record<string, any>;

// ── Legacy / existing ghosts ──────────────────────────────────────────────────

function __set_taint__(v: unknown): void {
  D$.analysis.setTaint(v, true);
}

function __is_tainted__(v: unknown): boolean {
  return D$.analysis.isTainted(v);
}

function __is_tainted_at__(v: unknown, index: unknown): boolean {
  return D$.analysis.isTaintedAt(v, index);
}

function __assert__(v: unknown): void {
  D$.analysis.assert(v);
}

function __print_if_tainted__(x: unknown): void {
  if (D$.analysis.isTainted(x)) {
    console.log("@@DJX_VERDICT detected");
  } else {
    console.log("@@DJX_VERDICT clean");
  }
}

function __flow_found__(): boolean {
  return D$.analysis.flowFound;
}

function __print_if_flow__(): void {
  console.log(D$.analysis.flowFound ? "@@DJX_VERDICT detected" : "@@DJX_VERDICT clean");
}

function __taint_loc_line__(v: unknown): number {
  return D$.analysis.taintLocLine(v);
}

function __taint_label__(v: unknown): string {
  return D$.analysis.taintLabel(v);
}

function __flow_sink_type__(): string {
  return D$.analysis.flowSinkType();
}

function __flow_complexity__(): number {
  return D$.analysis.provenanceComplexity;
}

function __flow_attacker_data__(): string {
  return D$.analysis.attackerControlledData;
}

function __flow_prefix__(): string {
  return D$.analysis.prefixAce;
}

function __flow_triggers__(): number {
  return D$.analysis.triggersFlow;
}

function __taint_json__(v: unknown): Record<string, unknown> {
  return D$.analysis.taintJson(v);
}

// ── jalangi ghost protocol ────────────────────────────────────────────────────

/** Alias of __set_taint__ (the real pipeline uses __jalangi_set_taint__). */
function __jalangi_set_taint__(v: unknown): void {
  D$.analysis.setTaint(v, true);
}

function __jalangi_clear_taint__(v: unknown): void {
  D$.analysis.clearTaint(v);
}

function __jalangi_get_taint__(v: unknown): boolean {
  return D$.analysis.getTaint(v);
}

function __jalangi_set_prop_taint__(obj: unknown, key: unknown): void {
  D$.analysis.setPropTaint(obj, key, true);
}

function __jalangi_clear_prop_taint__(obj: unknown, key: unknown): void {
  D$.analysis.clearPropTaint(obj, key);
}

function __jalangi_check_taint__(v: unknown): void {
  D$.analysis.checkTaint(v);
}

function __jalangi_check_taint_string__(v: unknown): void {
  D$.analysis.checkTaintString(v);
}

function __jalangi_assert_taint_true__(v: unknown): void {
  D$.analysis.assertTaintTrue(v);
}

function __jalangi_assert_taint_false__(v: unknown): void {
  D$.analysis.assertTaintFalse(v);
}

function __jalangi_assert_prop_taint_true__(obj: unknown, key: unknown): void {
  // Best-effort: read the property and check taint.
  const concreteObj = D$.analysis.valued(obj).value as Record<string, unknown>;
  const concreteKey = String(D$.analysis.valued(key).value);
  if (concreteObj === null || (typeof concreteObj !== "object" && typeof concreteObj !== "function")) {
    throw new Error("Property expected to be tainted");
  }
  const propVal = concreteObj[concreteKey];
  if (!D$.analysis.isTainted(propVal)) throw new Error("Property expected to be tainted");
}

function __jalangi_assert_prop_taint_false__(obj: unknown, key: unknown): void {
  // Best-effort: read the property and check taint.
  const concreteObj = D$.analysis.valued(obj).value as Record<string, unknown>;
  const concreteKey = String(D$.analysis.valued(key).value);
  if (concreteObj === null || (typeof concreteObj !== "object" && typeof concreteObj !== "function")) return;
  const propVal = concreteObj[concreteKey];
  if (D$.analysis.isTainted(propVal)) throw new Error("Property expected to be untainted");
}

function __jalangi_assert_some_prop_tainted__(obj: unknown): void {
  const concreteObj = D$.analysis.valued(obj).value as Record<string, unknown>;
  if (concreteObj === null || typeof concreteObj !== "object") {
    throw new Error("Argument expected to have at least one tainted property");
  }
  for (const k of Object.keys(concreteObj)) {
    if (D$.analysis.isTainted(concreteObj[k])) return;
  }
  throw new Error("Argument expected to have at least one tainted property");
}

function __jalangi_assert_wrapped__(v: unknown): void {
  D$.analysis.assertWrapped(v);
}

function __jalangi_assert_not_wrapped__(v: unknown): void {
  D$.analysis.assertNotWrapped(v);
}

function __jalangi_set_sink__(f: unknown): void {
  D$.analysis.setSink(f);
}

// ── String-range ghosts ───────────────────────────────────────────────────────

function __string_range_set_taint__(str: unknown, lb: unknown, ub: unknown): void {
  D$.analysis.stringRangeSetTaint(str, lb, ub);
}

function __string_range_clear_taint__(str: unknown, lb: unknown, ub: unknown): void {
  D$.analysis.stringRangeClearTaint(str, lb, ub);
}

function __assert_string_range_all_tainted__(str: unknown, lb: unknown, ub: unknown): void {
  D$.analysis.assertStringRangeAllTainted(str, lb, ub);
}

function __assert_string_range_all_untainted__(str: unknown, lb: unknown, ub: unknown): void {
  D$.analysis.assertStringRangeAllUntainted(str, lb, ub);
}

// ── Array-range ghosts ────────────────────────────────────────────────────────

function __assert_array_range_all_tainted__(arr: unknown, lb: unknown, ub: unknown): void {
  D$.analysis.assertArrayRangeAllTainted(arr, lb, ub);
}

function __assert_array_range_all_untainted__(arr: unknown, lb: unknown, ub: unknown): void {
  D$.analysis.assertArrayRangeAllUntainted(arr, lb, ub);
}

// ── Fuzzer protocol ghosts ────────────────────────────────────────────────────

/** Returns the current TraceProperty (pass-through; arg is unused placeholder). */
function __fuzzer_get_trace_properties__(_placeholder: unknown): unknown {
  return D$.analysis.getTraceProp();
}

/** Resets per-iteration state. */
function __fuzzer__reset_state__(): void {
  D$.analysis.resetState();
}

/** Stores the taint-path output directory. */
function __set_taint_flow_path__(p: unknown): void {
  D$.analysis.setTaintFlowPath(p);
}

/** Returns the index of the last taint-path file written (last counter - 1). */
function __get_taint_flow_idx__(): number {
  return D$.analysis.getTaintFlowIdx();
}

// ── installPrelude ────────────────────────────────────────────────────────────

export function installPrelude(): ReadonlySet<unknown> {
  const g = globalThis as Record<string, unknown>;

  // Legacy ghosts
  g.__set_taint__ = __set_taint__;
  g.__is_tainted__ = __is_tainted__;
  g.__is_tainted_at__ = __is_tainted_at__;
  g.__assert__ = __assert__;
  g.__print_if_tainted__ = __print_if_tainted__;
  g.__flow_found__ = __flow_found__;
  g.__print_if_flow__ = __print_if_flow__;
  g.__taint_loc_line__ = __taint_loc_line__;
  g.__taint_label__ = __taint_label__;
  g.__flow_sink_type__ = __flow_sink_type__;
  g.__flow_complexity__ = __flow_complexity__;
  g.__flow_attacker_data__ = __flow_attacker_data__;
  g.__flow_prefix__ = __flow_prefix__;
  g.__flow_triggers__ = __flow_triggers__;
  g.__taint_json__ = __taint_json__;

  // __jalangi_* ghosts
  g.__jalangi_set_taint__ = __jalangi_set_taint__;
  g.__jalangi_clear_taint__ = __jalangi_clear_taint__;
  g.__jalangi_get_taint__ = __jalangi_get_taint__;
  g.__jalangi_set_prop_taint__ = __jalangi_set_prop_taint__;
  g.__jalangi_clear_prop_taint__ = __jalangi_clear_prop_taint__;
  g.__jalangi_check_taint__ = __jalangi_check_taint__;
  g.__jalangi_check_taint_string__ = __jalangi_check_taint_string__;
  g.__jalangi_assert_taint_true__ = __jalangi_assert_taint_true__;
  g.__jalangi_assert_taint_false__ = __jalangi_assert_taint_false__;
  g.__jalangi_assert_prop_taint_true__ = __jalangi_assert_prop_taint_true__;
  g.__jalangi_assert_prop_taint_false__ = __jalangi_assert_prop_taint_false__;
  g.__jalangi_assert_some_prop_tainted__ = __jalangi_assert_some_prop_tainted__;
  g.__jalangi_assert_wrapped__ = __jalangi_assert_wrapped__;
  g.__jalangi_assert_not_wrapped__ = __jalangi_assert_not_wrapped__;
  g.__jalangi_set_sink__ = __jalangi_set_sink__;

  // String-range ghosts
  g.__string_range_set_taint__ = __string_range_set_taint__;
  g.__string_range_clear_taint__ = __string_range_clear_taint__;
  g.__assert_string_range_all_tainted__ = __assert_string_range_all_tainted__;
  g.__assert_string_range_all_untainted__ = __assert_string_range_all_untainted__;

  // Array-range ghosts
  g.__assert_array_range_all_tainted__ = __assert_array_range_all_tainted__;
  g.__assert_array_range_all_untainted__ = __assert_array_range_all_untainted__;

  // Fuzzer protocol ghosts
  g.__fuzzer_get_trace_properties__ = __fuzzer_get_trace_properties__;
  g.__fuzzer__reset_state__ = __fuzzer__reset_state__;
  g.__set_taint_flow_path__ = __set_taint_flow_path__;
  g.__get_taint_flow_idx__ = __get_taint_flow_idx__;

  return new Set<unknown>([
    // Legacy
    __set_taint__, __is_tainted__, __is_tainted_at__, __assert__,
    __print_if_tainted__, __flow_found__, __print_if_flow__,
    __taint_loc_line__, __taint_label__, __flow_sink_type__,
    __flow_complexity__, __flow_attacker_data__, __flow_prefix__,
    __flow_triggers__, __taint_json__,
    // __jalangi_*
    __jalangi_set_taint__, __jalangi_clear_taint__, __jalangi_get_taint__,
    __jalangi_set_prop_taint__, __jalangi_clear_prop_taint__,
    __jalangi_check_taint__, __jalangi_check_taint_string__,
    __jalangi_assert_taint_true__, __jalangi_assert_taint_false__,
    __jalangi_assert_prop_taint_true__, __jalangi_assert_prop_taint_false__,
    __jalangi_assert_some_prop_tainted__,
    __jalangi_assert_wrapped__, __jalangi_assert_not_wrapped__,
    __jalangi_set_sink__,
    // String-range
    __string_range_set_taint__, __string_range_clear_taint__,
    __assert_string_range_all_tainted__, __assert_string_range_all_untainted__,
    // Array-range
    __assert_array_range_all_tainted__, __assert_array_range_all_untainted__,
    // Fuzzer protocol
    __fuzzer_get_trace_properties__, __fuzzer__reset_state__,
    __set_taint_flow_path__, __get_taint_flow_idx__,
  ]);
}
