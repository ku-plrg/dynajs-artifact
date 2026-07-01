const cp = require('child_process');
try { cp.execSync('echo hi'); } catch (e) {}
__assert__(!__flow_found__());  // PASS = no flow
