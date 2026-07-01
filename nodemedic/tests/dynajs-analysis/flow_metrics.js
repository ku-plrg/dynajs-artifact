// flow_metrics.js — verify exploit metrics on a command-injection chain.
// Observed values (traced in container after faithfulness fix):
//   complexity  > 0
//   attacker_data = 'whoami'
//   prefix      = '' — exec is not the Function sink, so prefix_ace is not computed
//   triggers    = 1 (exec accepts any tainted arg and the first arg was tainted)
const cp = require('child_process');
var x = 'whoami';
__set_taint__(x);
var cmd = 'echo ' + x;
try { cp.execSync(cmd); } catch (e) {}
__assert__(__flow_found__());
__assert__(__flow_complexity__() > 0);
__assert__(__flow_attacker_data__() === 'whoami');
__assert__(__flow_prefix__() === '');
__assert__(__flow_triggers__() === 1);
