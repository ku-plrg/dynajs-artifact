// Array-element taint propagation via array literals and index assignment
// (putField on an array). NOTE: native array *methods* (push, join, ...) are
// not yet modeled by DynaJS and do not propagate taint — same status as
// Set/Map; tracked as a gap to report upstream. Exit 0 = PASS.
var t = 'whoami';
__set_taint__(t);

// array-literal element
var lit = [t, 'safe'];
__assert__(__is_tainted__(lit[0]));
__assert__(!__is_tainted__(lit[1]));

// index assignment (putField on an array) + read-back
var arr = [];
arr[0] = t;
__assert__(__is_tainted__(arr[0]));
