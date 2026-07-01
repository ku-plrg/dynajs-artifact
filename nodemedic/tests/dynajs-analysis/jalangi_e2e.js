// Faithful mini-driver: taint via the jalangi protocol, call a "PUT", hit a
// sink, and confirm the analysis throws a FlowError the driver catches with
// e.found_flow + e.trace_prop (exactly what packageDriverTemplate relies on).
//
// Behavior note: __fuzzer__reset_state__() clears traceProp.called_sink before
// the call. However, invokeFunPre sets called_sink again right before throwing
// the FlowError, and the clone() happens at throw time — so
// caught.trace_prop.called_sink IS "exec" (set post-reset, pre-clone).
const cp = require('child_process');
function PUT(arg) { cp.execSync('echo ' + arg); }   // tainted arg -> exec sink
var x = 'whoami';
__jalangi_set_taint__(x);
__fuzzer__reset_state__();          // a real driver resets right before the call
var caught = null;
try { PUT(x); } catch (e) { caught = e; }
__assert__(caught !== null && caught.found_flow === true);
__assert__(caught.trace_prop.called_sink === 'exec');
__jalangi_clear_taint__(x);
var tp = __fuzzer_get_trace_properties__([]);
__assert__(tp !== undefined && typeof tp.global_code_coverage === 'number');
