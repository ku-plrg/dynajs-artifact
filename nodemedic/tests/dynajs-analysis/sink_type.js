const cp = require('child_process');
var x = 'whoami';
__set_taint__(x);
try { cp.execSync('echo ' + x); } catch (e) {}
__assert__(__flow_found__());
__assert__(__flow_sink_type__() === 'exec');
