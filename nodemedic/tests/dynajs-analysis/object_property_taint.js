// Object-property taint propagation. Exercises the putField/object support
// DynaJS shipped (newer than our former pin): a tainted value stored into a
// property is tainted when read back, through literals and nested objects, and
// char-level taint survives the round-trip. Exit 0 (all asserts hold) = PASS.
var t = 'whoami';
__set_taint__(t);

// property write + read-back
var o = {};
o.cmd = t;
__assert__(__is_tainted__(o.cmd));

// object-literal initializer
var lit = { cmd: t };
__assert__(__is_tainted__(lit.cmd));

// nested object
var nested = { a: { b: t } };
__assert__(__is_tainted__(nested.a.b));

// char-level taint survives a round-trip through a property
var s = 'abc';
__set_taint__(s);
var box = { v: s + 'XYZ' };
__assert__(__is_tainted_at__(box.v, 0));    // tainted char from s
__assert__(!__is_tainted_at__(box.v, 3));   // clean char from 'XYZ'

// a sibling clean property stays clean (no over-tainting)
o.safe = 'literal';
__assert__(!__is_tainted__(o.safe));
