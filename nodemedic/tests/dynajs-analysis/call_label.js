// Non-modeled call result gets a call:<name> label.
// toUpperCase is not in Model.SUPPORTED_BUILTINS, so it is treated as a
// transparent call and its result is tagged by the call:<name> relabelling path.
// wrap() is a user function (also transparent); the inner toUpperCase result
// already has a call: label, so the outer wrap frame preserves it unchanged.
function wrap(s) { return s.toUpperCase(); }
var x = 'abc';
__set_taint__(x);
var y = wrap(x);
__assert__(__is_tainted__(y));
__assert__(__taint_label__(y) === 'call:toUpperCase');
