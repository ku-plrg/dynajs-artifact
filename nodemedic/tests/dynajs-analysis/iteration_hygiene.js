// Regression for the cross-iteration taint leak (stage-2 root cause: legacy
// TSet preserved proto-taint across fuzzer iterations). In our DynaJS engine
// each value carries its own Info entry; clearTaint resets the bit, and
// resetState() does NOT re-introduce taint on previously-cleared values.
//
// Iteration N: taint a value, then clear + reset as the driver does between
// iterations. Iteration N+1: a DIFFERENT fresh value must NOT be tainted.
var a = 'iterN';
__jalangi_set_taint__(a);
__assert__(__is_tainted__(a));
__jalangi_clear_taint__(a);
__fuzzer__reset_state__();

var b = 'iterN1';                    // fresh, never tainted
__assert__(!__is_tainted__(b));
// and a re-derived value from the cleared `a` must be clean too
var c = a + 'X';
__assert__(!__is_tainted__(c));
