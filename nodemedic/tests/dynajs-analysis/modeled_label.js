// Modeled string ops must keep their precise:string.* label — the call:<name>
// relabelling must NOT touch them (they never pass through baseInfo, so their
// node label is never "flow").
var x = 'abcdef';
__set_taint__(x);
var y = x.substring(1, 3);
__assert__(__taint_label__(y) === 'precise:string.substring');
