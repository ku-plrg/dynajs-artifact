// code_injection_prefix.js — verify that prefix_ace is extracted for the Function sink.
// The Function constructor receives one arg: body = 'var y = ' + x (x tainted, value '1').
// The untainted prefix of the concatenated string is 'var y = ' (chars 0..7 are untainted).
var x = '1';
__set_taint__(x);
var body = 'var y = ' + x;
try { new Function(body); } catch (e) {}
__assert__(__flow_found__());
__assert__(__flow_sink_type__() === 'Function');
__assert__(__flow_prefix__() === 'var y = ');
