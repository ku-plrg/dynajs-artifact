// taint_json.js — verify JSON shape of provenance graph without file I/O.
// __taint_json__ returns the raw object (not a JSON string) to avoid DynaJS
// wrapping issues that break JSON.parse on prelude-returned strings.
var x = 'abc';
__set_taint__(x);
var y = x + 'Z';
var obj = __taint_json__(y);
__assert__(obj['1'].operation === 'precise:string.concat');
__assert__(Array.isArray(obj['1'].flows_from));
