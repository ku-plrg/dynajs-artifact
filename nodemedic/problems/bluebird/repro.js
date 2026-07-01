// root@df4e0b84c609:/nodetaint# DYNAJS_HOME=/nodetaint/lib/dynajs/ DYNAJS_OPTIONS="--analysis /nodetaint/lib/dynajs/samples/EmptyAnalysis.js" /nodetaint/lib/dynajs/dynajs node repro.js
// /nodetaint/packageData/aws-cli-js-jt/node_modules/aws-cli-js-jt/node_modules/bluebird/js/main/promisify.js:457
//           D$.X(18487, D$e);
//              ^
// RangeError: Maximum call stack size exceeded
//     at promisify (/nodetaint/packageData/aws-cli-js-jt/node_modules/aws-cli-js-jt/node_modules/bluebird/js/main/promisify.js:457:14)
//     at invokeFun (file:///nodetaint/lib/dynajs/dist/entry/import.js:11176:49)
//     at file:///nodetaint/lib/dynajs/dist/entry/import.js:11063:12
//     at promisify (/nodetaint/packageData/aws-cli-js-jt/node_modules/aws-cli-js-jt/node_modules/bluebird/js/main/promisify.js:453:116)
//     at invokeFun (file:///nodetaint/lib/dynajs/dist/entry/import.js:11176:49)
//     at file:///nodetaint/lib/dynajs/dist/entry/import.js:11063:12
//     at promisify (/nodetaint/packageData/aws-cli-js-jt/node_modules/aws-cli-js-jt/node_modules/bluebird/js/main/promisify.js:453:116)
//     at invokeFun (file:///nodetaint/lib/dynajs/dist/entry/import.js:11176:49)
//     at file:///nodetaint/lib/dynajs/dist/entry/import.js:11063:12
//     at promisify (/nodetaint/packageData/aws-cli-js-jt/node_modules/aws-cli-js-jt/node_modules/bluebird/js/main/promisify.js:453:116)
//     at invokeFun (file:///nodetaint/lib/dynajs/dist/entry/import.js:11176:49)
//     at file:///nodetaint/lib/dynajs/dist/entry/import.js:11063:12
//     at promisify (/nodetaint/packageData/aws-cli-js-jt/node_modules/aws-cli-js-jt/node_modules/bluebird/js/main/promisify.js:453:116)
//     at invokeFun (file:///nodetaint/lib/dynajs/dist/entry/import.js:11176:49)
//     at file:///nodetaint/lib/dynajs/dist/entry/import.js:11063:12
//     at promisify (/nodetaint/packageData/aws-cli-js-jt/node_modules/aws-cli-js-jt/node_modules/bluebird/js/main/promisify.js:453:116)

// Node.js v20.20.2


// WITHOUT DYNAJS
// root@df4e0b84c609:/nodetaint# node repro.js
// ok function

var Promise = require("bluebird");
var f = Promise.promisify(function (x, cb) {
  cb(null, x);
});
console.log("ok", typeof f);