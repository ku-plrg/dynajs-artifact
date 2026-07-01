export class TraceProperty {
  // exploitability metric (read by the fuzzer's compute_exploitability_vals)
  called_sink: string | undefined = undefined;
  triggers_flow = 0;
  prefix_ace = "";
  provenance_complexity = 0;
  attacker_controlled_data = "";

  // coverage. branches/global_branches dedup branch ids; the fuzzer reads the
  // two counters. Our DynaJS condition ids are globally unique, so a flat Set
  // suffices (no per-script-sid dimension the legacy engine needed).
  branches = new Set<number>();
  global_branches = new Set<number>();
  code_coverage = 0;
  global_code_coverage = 0;

  // object reconstruction (read by the fuzzer when use_object_reconstruction)
  accessed_attrs: string[] = [];

  add_field(offset: string): void {
    if (!this.accessed_attrs.includes(offset)) this.accessed_attrs.push(offset);
  }

  // Records a covered branch. key = taken ? id : id-1 (mirrors legacy condition
  // hook). Increments per-iteration + global coverage on first sight.
  coverBranch(id: number, taken: boolean): void {
    const key = taken ? id : id - 1;
    if (!this.branches.has(key)) { this.branches.add(key); this.code_coverage++; }
    if (!this.global_branches.has(key)) { this.global_branches.add(key); this.global_code_coverage++; }
  }

  // Per-fuzzer-iteration reset: clears per-input coverage + exploitability, KEEPS
  // global_branches/global_code_coverage (mirrors Base.ts:64-74).
  reset_state(): void {
    this.called_sink = undefined;
    this.triggers_flow = 0;
    this.prefix_ace = "";
    this.provenance_complexity = 0;
    this.attacker_controlled_data = "";
    this.branches = new Set<number>();
    this.code_coverage = 0;
    this.accessed_attrs = [];
  }

  // Only the exploitability fields are cloned (Base.ts:76-85) — what FlowError carries.
  clone(): TraceProperty {
    const cp = new TraceProperty();
    cp.called_sink = this.called_sink;
    cp.triggers_flow = this.triggers_flow;
    cp.prefix_ace = this.prefix_ace;
    cp.provenance_complexity = this.provenance_complexity;
    cp.attacker_controlled_data = this.attacker_controlled_data;
    return cp;
  }
}
// FlowError — thrown when a tainted argument reaches a sink.
export class FlowError extends Error {
  found_flow = true;
  trace_prop: TraceProperty;
  constructor(message: string, trace_prop: TraceProperty) {
    super(message);
    this.trace_prop = trace_prop;
  }
}
