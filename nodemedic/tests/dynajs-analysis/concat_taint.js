var x = 'abc';
__set_taint__(x);
var y = x + 'XYZ';
__assert__(__is_tainted__(y));
__assert__(__is_tainted_at__(y, 0));     // tainted char from x
__assert__(!__is_tainted_at__(y, 3));    // clean char from 'XYZ'
