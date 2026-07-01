// A tainted value carried through an object property into a command-execution
// sink is detected as a flow — end-to-end check that object support reaches the
// sink layer. Exit 0 (flow found) = PASS.
const cp = require('child_process');
var t = 'whoami';
__set_taint__(t);
var o = { cmd: t };
try { cp.execSync('echo ' + o.cmd); } catch (e) {}
__assert__(__flow_found__());
