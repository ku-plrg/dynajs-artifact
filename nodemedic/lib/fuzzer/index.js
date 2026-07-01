// JALANGI DO NOT INSTRUMENT
// DYNAJS DO NOT INSTRUMENT

// Main fuzzer file
//var random = require('random-object-generator');
const util = require('util');
const fs = require('fs');

const hasard = require('hasard');
const h = hasard;

const PRINTABLE = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/', ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~', ' ', '\t', '\n', '\r', '\x0b', '\x0c'];


function sfc32(a, b, c, d) {
    return function() {
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
      var t = (a + b) | 0;
      a = b ^ b >>> 9;
      b = c + (c << 3) | 0;
      c = (c << 21 | c >>> 11);
      d = d + 1 | 0;
      t = t + d | 0;
      c = c + t | 0;
      return (t >>> 0) / 4294967296;
    }
}

// Seed the fuzzer
var prng = sfc32(1337, 31337, 31336, 1336);
h.Value.__proto__.prototype.prng = prng;
Math.random = prng;

var randomValue = hasard.value();    
var randomInteger = hasard.integer({type: 'poisson', lambda: 4});
var randomString = hasard.string({
    size: randomInteger,
    value: hasard.value('abcdefghijklmnopkrstuvw'.split(''))
});
var randomNumber = hasard.number(-100, 100);
var randomFunction = hasard.fn();
var randomBoolean = hasard.boolean(0.5);

var ALL_TYPES = ['String', 'Number', 'Function', 'Boolean', 'Array', 'Bigint', 'Symbol', 'Null', 'Undefined', 'Date', 'RegExp', 'Object'];
var ALL_WEIGHTS =   [200,      14,       100,        125,       1,       0.1,      0.05,     1,      6,          0.04,   0.05,     529];
var ALL_WEIGHTS_OBJ = [1,      0.1,      0.1,        0.3,      0.2,      0.01,     0.01,     0.05,   0.2,        0.03,   0.02,     0.2 ];

function get_max_key(description){
    const numbers = Object.keys(description).map(Number); // Convert each element to an integer
  
    if (numbers.length === 0) {
      return undefined;
    }
  
    let max = numbers[0]; // Assume the first element is the maximum
  
    for (let i = 1; i < numbers.length; i++) {
      if (!isNaN(numbers[i])) {
        if (numbers[i] > max) {
          max = numbers[i]; // Update max if a larger element is found
        }
      }
    }
  
    return max;
}

function normalize_spec(spec, weights) {
    if (weights == undefined){
        weights = ALL_WEIGHTS;
    }
    // Removes Bottom to add all types
    // Also adds weights if not present
    if (spec.types.includes('Bot')) {
        if (spec.types.length == 1) {
            spec.types = ALL_TYPES;
            spec.weights = weights;
        }
        else {
            console.log("Error: Bot should be the only type in the spec");
            exit(1);
        }
    }
    if (spec.weights === undefined){
        spec.weights = [];
        for (var i = 0; i < spec.types.length; i++) {
            spec.weights.push(1/spec.types.length);
        }
    }
    else{
        if (spec.weights.length != spec.types.length) {
            console.log("Error: weights and types should have the same length");
            exit(1);
        }
    }

    // Normalize weights
    var sum = 0;
    for (var i = 0; i < spec.weights.length; i++) {
        sum += spec.weights[i];
    }
    for (var i = 0; i < spec.weights.length; i++) {
        spec.weights[i] = spec.weights[i]/sum;
    }

    if (spec.sampled === undefined){
        spec.sampled = [];
        for (var i = 0; i < spec.types.length; i++){
            spec.sampled.push(1); // Init all sampled counters to 1
        }
    }
    else{
        if (spec.sampled.length != spec.types.length) {
            console.log("Error: sampled and types should have the same length");
            exit(1);
        }
    }

    if (spec.reward === undefined){
        spec.reward = [];
        for (var i = 0; i < spec.types.length; i++){
            spec.reward.push(spec.weights[i]); // Init all rewards to the initial bias
        }
    }
    else{
        if (spec.reward.length != spec.types.length) {
            console.log("Error: reward and types should have the same length");
            exit(1);
        }
    }

    for (const [key, value] of Object.entries(spec.structure)) {
        spec.structure[key] = normalize_spec(value, ALL_WEIGHTS_OBJ);
    }
    return spec;
}


function choose_type(spec){
    // Choose a type from the list of spec.types according to the rewards and sampled counters
    var weighted_sampling = [];

    var max_with_one = undefined;
    var max_with_one_reward = 0;

    for (var i = 0; i < spec.types.length; i++){
        if (spec.sampled[i] == 1){
            if (spec.reward[i] > max_with_one_reward){
                max_with_one = i;
                max_with_one_reward = spec.reward[i];
            }
        }
        weighted_sampling.push(spec.reward[i]/spec.sampled[i]);
    }

    if (max_with_one !== undefined){
        return spec.types[max_with_one];
    }

    const sum = weighted_sampling.reduce((acc, val) => acc + val, 0);
    const normalizedW = weighted_sampling.map(val => val / sum);

    return hasard.value({choices: spec.types, weights: normalizedW}).run(1);
}

function generateObjectFromSpec(spec, prob) {

    var choices = [];
    var weights = [];

    if (spec.concrete !== null){
        return spec.concrete;
    }

    var prob = 0.25; //1 - 1 / spec.structure.length
    var empty_struct = Object.keys(spec.structure).length == 0;
    var type_to_generate = choose_type(spec);

    if (type_to_generate == 'Object') {
        const objSpec = {};
        for (const [key, value] of Object.entries(spec.structure)) {
            if (hasard.boolean(prob).run(1)[0]){
                objSpec[key] = generateObjectFromSpec(value);
            }
        }
        return hasard.object(objSpec);
    }

    if (type_to_generate == 'Array') {
        var max_key = get_max_key(spec.structure);

        if (max_key === undefined) {
            max_key = 0;
        }
        const arrSpec = [];
        for (var i = 0; i < max_key + 1; i++) {
            if (spec.structure[i]) {
                arrSpec.push(generateObjectFromSpec(spec.structure[i]));
            }
            else {
                var to_add = hasard.value();
                to_add.set({choices: [randomString, randomNumber, randomInteger, randomFunction, randomBoolean]});
                arrSpec.push(to_add);
            }
        }
        return hasard.array(arrSpec);
    }

    if (type_to_generate == 'String') {
        var max_key = get_max_key(spec.structure);
        if (max_key === undefined || isNaN(max_key) || max_key === null) {
            max_key = 0;
        }

        var s = hasard.string({value: hasard.value(PRINTABLE), size: hasard.integer([max_key,max_key+10])});
        return hasard.value({choices: [s, '/tmp', '~/', '.'], weights: [0.8, 0.066, 0.066, 0.068]});
    }

    if (type_to_generate == 'Number') {
        return hasard.integer(-1000, 10000);
    }

    if (type_to_generate == 'Boolean') {
        return hasard.boolean();
    }

    if (type_to_generate == 'Bigint') {
        return hasard.value({choices: [-999999999n, -1n, 0n, 1n, 999999999n]});
    }

    if (type_to_generate == 'Symbol') {
        return hasard.value({choices: [Symbol('0'), Symbol('bar')]});
    }

    if (type_to_generate == 'Null') {
        return null;
    }

    if (type_to_generate == 'Function') {
        return hasard.value({choices: [function(){}, async function(){}]});
    }

    if (type_to_generate == 'Undefined') {
        return undefined;
    }

    if (type_to_generate == 'Map') {
        if (empty_struct){
            return hasard.value({choices: [new Map(), new Map([[1, 'foo'], [2, 'bar']])]});
        }
        else{
            const mapSpec = new Map();
            for (const [key, value] of Object.entries(spec.structure)) {
                if (hasard.boolean(prob).run(1)[0]){
                    mapSpec[key] = generateObjectFromSpec(value);
                }

            }
            return mapSpec;
        }
    }

    if (type_to_generate == 'Set') {
        if (empty_struct){
            return hasard.value({choices: [new Set(), new Set([1, 2, 3])]});
        }
        else{
            const setSpec = new Set();
            for (const [key, value] of Object.entries(spec.structure)) {
                if (hasard.boolean(prob).run(1)[0]){
                    setSpec[key] = generateObjectFromSpec(value); // DISCUSSED in 2023_06_01 meeting: Structure also means attr access for sets
                }
            }
            return setSpec;
        }
    }

    if (type_to_generate == 'WeakMap') {
        if (empty_struct){
            return hasard.value({choices: [new WeakMap(), new WeakMap([[{}, 'foo'], [{}, 'bar']])]});
        }
        else{
            const weakMapSpec = new WeakMap();
            for (const [key, value] of Object.entries(spec.structure)) {
                if (hasard.boolean(prob).run(1)[0]){
                    weakMapSpec[key] = generateObjectFromSpec(value);
                }
            }
            return weakMapSpec;
        }
    }

    if (type_to_generate == 'WeakSet') {
        if (empty_struct){
            return hasard.value({choices: [new WeakSet(), new WeakSet([{}, {}, {}])]});
        }
        else{
            const weakSetSpec = new WeakSet();
            for (const [key, value] of Object.entries(spec.structure)) {
                if (hasard.boolean(prob).run(1)[0]){
                    weakSetSpec[key] = generateObjectFromSpec(value);
                }
            }
            return weakSetSpec;
        }
    }

    if (type_to_generate == 'Error') {
        return hasard.value({choices: [new Error(), new Error('foo')]});
    }

    if (type_to_generate == 'Date') {
        return hasard.value({choices: [new Date(), new Date('December 17, 1995 03:24:00')]});
    }

    if (type_to_generate == 'RegExp') {
        return hasard.value({choices: [new RegExp(), new RegExp('foo', 'g')]});
    }

    return undefined;
}

function is_hasard_object(obj){
    // Returns True if obj is a hasard object
    return typeof(obj) == 'object' && obj !== null && obj !== undefined && typeof(obj['run']) === typeof(function(){});
} 

function concretize(obj){
    if (is_hasard_object(obj)){
        return concretize(obj.run(1)[0]);
    }
    else{
        if (obj instanceof Array) {
            for (var i = 0; i < obj.length; i++) {
                obj[i] = concretize(obj[i]);
            }
        }
        else if (obj instanceof Set) {
            var new_obj = new Set();
            obj.forEach((el)=>new_obj.add(concretize(el)));
            obj = new_obj;
        }
        else if (obj instanceof Map) {
            var new_obj = new Map();
            obj.forEach((value, key)=>new_obj.set(concretize(key), concretize(value)));
            obj = new_obj;
        }
        
        else if (obj instanceof Object) {
            for (const [key, value] of Object.entries(obj)) {
                obj[key] = concretize(value);
            }
        }

        return obj;
    }
}


function find_covered_type(value) {
    var type = typeof value;

    if (type === 'object') {
        if (value === null) {
            return 'Null';
        } else if (Array.isArray(value)) {
            return 'Array';
        } else if (value instanceof Map) {
            return 'Map';
        } else if (value instanceof Set) {
            return 'Set';
        } else if (value instanceof WeakMap) {
            return 'WeakMap';
        } else if (value instanceof WeakSet) {
            return 'WeakSet';
        } else if (value instanceof Date) {
            return 'Date';
        } else if (value instanceof RegExp) {
            return 'RegExp';
        } else if (value instanceof Error) {
            return 'Error';
        } else {
            return 'Object';
        }
    }

    return type.charAt(0).toUpperCase() + type.slice(1);
}

function get_attr(concrete, attr){
    try{
        return concrete[attr];
    }
    catch {
        return undefined;
    }
}

function update_weights(spec, concretization, reward, globalreward){
    var type = find_covered_type(concretization);
    var index = spec.types.indexOf(type); //spec.types[index] was the selected one

    spec.sampled[index] += 1;
    spec.reward[index] += reward;

    for (const [key, value] of Object.entries(spec.structure)) {
        if (concretization !== undefined && concretization !== null){ // Can not access properties of these
            spec.structure[key] = update_weights(value, get_attr(concretization, key), reward);
        }
    }
    return spec;
}

function isPrimitive(value) {
    return value === null || (typeof value !== 'object' && typeof value !== 'function');
}

const NOT_A_PRIMITIVE_WRAPPER = Symbol('not a primitive wrapper');

function coercePrimitiveWrapper(obj) {
    if (obj === null || typeof obj !== 'object') {
        return NOT_A_PRIMITIVE_WRAPPER;
    }

    const keys = Object.keys(obj);
    if (keys.length === 0) {
        return NOT_A_PRIMITIVE_WRAPPER;
    }
    if (!keys.every(key => key === 'valueOf' || key === 'toString')) {
        return NOT_A_PRIMITIVE_WRAPPER;
    }

    if (!Object.prototype.hasOwnProperty.call(obj, 'valueOf') || typeof obj.valueOf !== 'function') {
        return NOT_A_PRIMITIVE_WRAPPER;
    }
    try {
        const primitive = obj.valueOf();
        if (isPrimitive(primitive)) {
            return primitive;
        }
    } catch {
        // Keep the original object representation if coercion is unsafe.
    }

    return NOT_A_PRIMITIVE_WRAPPER;
}

function serialize(obj, seen = new WeakMap()) {
    if (obj === null) return 'null';
    if (obj === undefined) return 'undefined';
    if (typeof obj === 'number' || typeof obj === 'boolean') return obj.toString();
    if (typeof obj === 'string') return JSON.stringify(obj);
    if (typeof obj === 'symbol') return 'Symbol("' + obj.description + '")';
    if (typeof obj === 'function') return 'function(){}';
    if (typeof obj === 'bigint') return 'BigInt("'+obj.toString() + '")';
    if (obj instanceof Date) return `new Date('${obj.toISOString()}')`;
    if (obj instanceof RegExp) return obj.toString();
    if (obj instanceof Map) return  `new Map(${JSON.stringify(Array.from(x))})`;
    if (obj instanceof Set) return `new Set(${JSON.stringify(Array.from(x))})`;
    if (obj instanceof WeakMap) return `new WeakMap(${JSON.stringify(Array.from(x))})`;
    if (obj instanceof WeakSet) return `new WeakSet(${JSON.stringify(Array.from(x))})`;
    if (Array.isArray(obj)) return '[' + obj.map(item => serialize(item, seen)).join(', ') + ']';
    if (obj instanceof Error) return 'new Error()';
    if (typeof obj === 'object') {
        const primitive = coercePrimitiveWrapper(obj);
        if (primitive !== NOT_A_PRIMITIVE_WRAPPER) {
            return serialize(primitive, seen);
        }
        if (seen.has(obj)) return undefined;  // Handle circular reference

        const objName = `obj${seen.size + 1}`;
        seen.set(obj, objName);

        let str = '{';
        for (const [key, value] of Object.entries(obj)) {
            str += `${JSON.stringify(key)}: ${serialize(value, seen)}, `;
        }
        if (str.length > 1) str = str.slice(0, -2);  // Remove last comma and space
        str += '}';
        return str;
    }
    return '{}' // Unsupported data type
}

function get_representation(args){
    return util.inspect(args.map(function (x) {
        return serialize(x);
    }), {depth: null, maxStringLength: null}).replace(/[\n]/gm, '').replaceAll('[Function (anonymous)]', 'function(){}');
}

/*
function testObject() {
    this.id = "id";
    this.number = "int";
    this.description = "string";
    this.anotherObject = [new anotherTestObject()];
    this.intArray= ["int"];
}
 
function anotherTestObject() {
    this.testId = "id";
}

    object
    "id"
    "int"
    "string"
    "bool"
    "date"
    "period"

*/

function copy_spec(spec){
    return JSON.parse(JSON.stringify(spec));
}

function valid_attribute(attr){
    INVALID = ['compute_exploitability_metric', 'compute_exploitability_vals', 'defineProperty', 'filter', 'splice', 'constructor', 'execSync','exec','mark', 'log','assign','t0','message','value','done','finish','existsSync','concat','__proto__','prototype','exit','round','pow','getTime','wrap','next','toLowerCase','start','end', 'forEach', 'push', 'startsWith', 'endsWith', 'stringify', 'emit', 'on', 'split', 'Fuzzer', 'set_seed', 'set_args','apply','get_input','get_representation','resolve','then','feed_cov','map','slice','trim','replace','join','catch','toString','includes'];
    return !INVALID.includes(attr);
}

function mutate(spec, getfields, add_type){
    // Incorporate fields in getfields in the structure of spec

    for (let attr of getfields) {
        if (valid_attribute(attr))
            spec.structure[attr] = normalize_spec({"types": ["Bot"],  "structure": {}, "concrete": null}, ALL_WEIGHTS_OBJ);
    }

    // Also add new types randomly
    if (add_type){
        // Get list of types that are not there yet

        var new_types = [];
        var weights = [];
        for (var i = 0; i < ALL_TYPES.length; i++){
            var elem = ALL_TYPES[i];
            if (!spec.types.includes(elem)){
                new_types.push(elem);
                weights.push(ALL_WEIGHTS[i]);
            }
        }

        if (new_types.length != 0){
            // Normalize weights
            var sum = 0;
            for (var i = 0; i < weights.length; i++) {
                sum += weights[i];
            }
            for (var i = 0; i < weights.length; i++) {
                weights[i] = weights[i]/sum;
            }
            var new_type = hasard.value({choices: new_types, weights: weights}).run(1)[0];


            var how_many = spec.types.length;
            var new_weight = 0;
            for (var i = 0; i < spec.weights.length; i++){ 
                new_weight += spec.weights[i] * 1 / how_many;
                spec.weights[i] -= spec.weights[i] * 1 / how_many;
            }
            spec.types.push(new_type);
            spec.weights.push(new_weight);
            if (spec.reward !== undefined){
                spec.reward.push(new_weight);
            }
            if (spec.sampled !== undefined){
                spec.sampled.push(1);
            }
        }
    }

    return normalize_spec(spec);
}

class Pool {
    constructor(spec, strings_only){
        this.spec = copy_spec(spec); 
        if (strings_only){
            this.should_add_type = hasard.boolean(0); // Do not add new types if just using strings
        }
        else{
            this.should_add_type = hasard.boolean(0.01); // Probability of adding a new type to a spec
        }
    }

    tick(globalreward, reward, getfields, concrete){
        this.spec = update_weights(this.spec, concrete, reward, globalreward);
        this.spec = mutate(this.spec, getfields, this.should_add_type.run(1)[0]);
    }

    get_input(){
        return concretize(generateObjectFromSpec(this.spec));
    }

    get_spec(){
        return JSON.stringify(this.spec);
    }
}

class Fuzzer {
    constructor(num_entrypoints, use_object_reconstruction, fuzz_strings_only, use_em, fuzzer_prng){
        this.objects = {};
        this.pools = {};
        this.max_cov = 0;
        this.max_global_cov = 0;
        this.seed_spec = [];
        this.strings_only = fuzz_strings_only;
        this.progress = []; // List of pairs [timestamp, global_coverage]
        this.num_exec = 0;
        this.fuzz_start_ms = Date.now();

        this.use_em = use_em;

        this.entrypoints = [];

        this.current_entrypoint = 0
        this.number_entrypoints = num_entrypoints;
        
        this.exploitability_counts = {};
        this.exploitability_vals = {};
        for (var i = 0; i < this.number_entrypoints; i++){
            this.exploitability_counts[i] = 0;
            this.exploitability_vals[i] = 0;
        }

        if (fuzz_strings_only){
            ALL_TYPES = [ALL_TYPES[0]];
            ALL_WEIGHTS = [ALL_WEIGHTS[0]];
            ALL_WEIGHTS_OBJ = [0]; // Not used
        }
        else{
            ALL_TYPES = ['String', 'Number', 'Function', 'Boolean', 'Array', 'Bigint', 'Symbol', 'Null', 'Undefined', 'Date', 'RegExp', 'Object'];
            ALL_WEIGHTS =   [200,      14,       100,        125,       1,       0.1,      0.05,     1,      6,          0.04,   0.05,     529];
            ALL_WEIGHTS_OBJ = [1,      0.1,      0.1,        0.3,      0.2,      0.01,     0.01,     0.05,   0.2,        0.03,   0.02,     0.2 ];
        }
        
        this.use_object_reconstruction = use_object_reconstruction;

        // Use the provided fuzzer_prng if any; otherwise fall back to default
        if (Number.isInteger(fuzzer_prng)) {
            this.set_prng_seed(fuzzer_prng);
        } else {
            // Keep old behavior when no flag is passed
            this.set_prng_seed(1337);
        }
    }

    select_entrypoint(elapsed, TIMEOUT){
        const progress = elapsed / TIMEOUT;
        const MAX_ENTRYPOINT_DIFF = 50; // At most, one entrypoint can be <MAX_ENTRYPOINT_DIFF>-times as likely to fuzz as another
        var max_diff = progress*MAX_ENTRYPOINT_DIFF - 1;
        if (max_diff < 0){
            max_diff = 0;
        }

        const entrypoints = this.entrypoints.map((_, i) => i);
        var weights = this.entrypoints.map((_, i) => 
        this.exploitability_counts[i] === 0 ? 100000 : this.exploitability_vals[i] / this.exploitability_counts[i]);
        const min = Math.min(...weights);
        if (min <= 0) {
            const shift = -min + 0.001;
            weights = weights.map(w => w + shift);
        }
        

        var sum = weights.reduce((a, b) => a + b, 0);
        var normalizedWeights = weights.map(w => (max_diff)* w / sum + 1);
        sum = normalizedWeights.reduce((a, b) => a + b, 0);
        normalizedWeights = normalizedWeights.map(w => w / sum);

        var entrypoint = hasard.value({choices: entrypoints, weights: normalizedWeights}).run(1)[0];
        this.current_entrypoint = entrypoint;
        return this.entrypoints[entrypoint];
        /*this.current_entrypoint = (this.current_entrypoint + 1) % this.number_entrypoints;
        return this.entrypoints[this.current_entrypoint];*/
    }

    set_seed(seed){
        // Must be called before fuzzing
        var seed_specs = JSON.parse(seed);
        for (var spec of seed_specs){
            this.seed_spec.push(normalize_spec(spec));
        }
    }

    set_prng_seed(seed) {
        var prng = sfc32(seed, seed, seed-1, seed-1);
        h.Value.__proto__.prototype.prng = prng;
        Math.random = prng;

        randomValue = hasard.value();    
        randomInteger = hasard.integer({type: 'poisson', lambda: 4});
        randomString = hasard.string({
            size: randomInteger,
            value: hasard.value('abcdefghijklmnopkrstuvw'.split(''))
        });
        randomNumber = hasard.number(-100, 100);
        randomFunction = hasard.fn();
        randomBoolean = hasard.boolean(0.5);

    }

    get_seed(num_arg){
        var seed = this.seed_spec[num_arg];
        if (seed === undefined){
            return this.seed_spec[0]; // Assumes there is always one default seed set at least
        }
        return seed;
    }

    set_args(entrypoint, num_args){
        this.objects[entrypoint] = [];
        this.pools[entrypoint] = [];

        for (let i = 0; i < num_args; i++){
            this.objects[entrypoint].push({"0": 0}); // Push empty object
            this.pools[entrypoint].push(new Pool(this.get_seed(i), this.strings_only));
        }

        this.entrypoints.push(entrypoint);
    }

    get_specs(entrypoint){
        var specs = [];
        for (let i = 0; i < this.pools[entrypoint].length; i++){
            specs.push(this.pools[entrypoint][i].get_spec());
        }
        return specs;
    }

    update_obj(entrypoint, num_arg, attr, type){
        this.objects[entrypoint][num_arg][attr] = type;
    }

    store_progress(global_cov, t){
        this.progress.push([t, global_cov]);
    }

    compute_exploitability_vals(trace_prop){
        var f0, f1, f2, f3, f4;
        
        if (trace_prop.called_sink){
            const map_val = {"eval": 0.88, "Function": 0.62, "exec": 1, "spawn": 0.1};
            f0 = map_val[trace_prop.called_sink];
            if (f0 == undefined){
                f0 = 0;
            }
        }
        else{
            f0 = 0;
        }

        f1 = trace_prop.triggers_flow;

        var prefix_length = trace_prop.prefix_ace.length;
        if (prefix_length === 0 || prefix_length === undefined){
            f2 = 1;
        }
        else{
            f2 = 1/prefix_length;
        }

        if (trace_prop.provenance_complexity === undefined || trace_prop.provenance_complexity == 0){
            f3 = 0;
        }
        else{
            f3 = 1 / trace_prop.provenance_complexity;
        }
        if (f3 >= 0.25){ // Very high values for this feature means the provenance tree is not sufficiently complex
            f3 = 0;
        }

        var atk_data = trace_prop.attacker_controlled_data;
        if (atk_data === undefined || atk_data.length === 0){
            f4 = 0;
        }
        else{
            f4 = 1 - 0.90/atk_data.length;
        }
        

        if (this.use_em.includes(":")){
            const names = ['f0','f1','f2','f3','f4'];
            const defaults = [f0, f1, f2, f3, f4]; // f0..f4 defaults
            const exprs = (this.use_em ?? '').split(':'); // e.g. "f0*2::f2:f3+1:f3+f1"
            const initial = defaults.slice();
            const results = defaults.map((d, i) => {
                const e = (exprs[i] ?? '').trim();
                if (!e) return d;
                const fn = new Function(...names, `"use strict"; return (${e});`);
                return fn(...initial);
            });

            [f0,f1,f2,f3,f4] = results;
        }
        
        return [f0, f1, f2, f3, f4];
        
    }

    compute_exploitability_metric(trace_prop){

        if (this.use_em.includes("none")){
            return 0; // Return 0 by default when not using the exploitability metric
        }

        var num_features = 6;
        var mu, s, weights;
        if (this.use_em.includes("uniform")){
            weights = [1/num_features, 1/num_features, 1/num_features, 1/num_features];
            mu = [0.0, 0.0, 0.0, 0.0];
            s = [1,1,1,1];
        }
        else if (this.use_em.includes("default")){
            /*weights = [1.2582683486847157, -0.2060538258999545, -0.36343024689312364, 0.5054166874046513, -2.984352874254362];
            mu = [0.0, 0.0, 0.0, 0.0, 0.0];
            s = [0.32592680893607573, 0.4710529018889474, 0.47126478067632066, 0.1484709490330396, 0.4610286846228404,1];*/
            weights = [1.2123853086276755, 0.371941242149067, 0.5049096619193356, -0.021182917140767556];
            s = [0.3992626515725418, 0.27692180487036777, 0.061255291152856696, 0.4133643159016024];
            mu = [0.0, 0.0, 0.0, 0.0];
        }
        /*
            Our exploitability metric is comprised of a weighted sum of multiple features f_i

                f0: calls a sink
                f1: triggers a potential flow
                f2: prioritize shorter ACE prefixes
                f3: prioritize smaller provenance trees (TODO: prioritize less complex provenance trees in terms of the operations performed)
                f4: Prioritize sink calls with more attacker-controlled data
        */
        
        var ev = this.compute_exploitability_vals(trace_prop);
        ev = [ev[0], ev[1] * ev[2], ev[3], ev[4]];
        const ev_uniform = ev.map((v, i) => (v - mu[i]) / s[i]);
        return ev_uniform.reduce((acc, v, i) => acc + v * weights[i], 0);
    }

    feed_cov(entrypoint, num_arg, trace_prop, concrete){
        /* getfields is just a list of strings
            cov is the number of conditionals covered by these last inputs
            globalcov is the total number of conditions covered so far by the fuzzer
        */

        this.num_exec += 1;
        
        var cov = trace_prop.code_coverage;
        var globalcov = trace_prop.global_code_coverage;
        var getfields = trace_prop.accessed_attrs;
        
        var exploitability_metric = this.compute_exploitability_metric(trace_prop);
        this.exploitability_counts[this.entrypoints.indexOf(entrypoint)] += 1;
        this.exploitability_vals[this.entrypoints.indexOf(entrypoint)] += exploitability_metric;
        
        if (cov > this.max_cov){
            this.max_cov = cov;
        }

        if (globalcov > this.max_global_cov){
            this.max_global_cov = globalcov;
        }

        if (!this.use_object_reconstruction){
            getfields = [];
        }

        var obj = this.objects[entrypoint][num_arg];
        for (let attr of getfields){
            obj[attr] = randomValue;
            
        }

        this.pools[entrypoint][num_arg].tick(globalcov, cov, getfields, concrete);
        
        fs.appendFileSync('/tmp/fuzz.coverage', Date.now() + "|" + entrypoint.toString() + "|" + num_arg.toString() + "|" + cov.toString() + "\n");
        
    }

    get_input(entrypoint, num_arg){
        /*var obj = this.objects[entrypoint][num_arg];

        const randomObject = h.object(obj);
        
        const weight_object = (1 / Object.keys(obj).length) - 0.01; // So it likely wont expand forever
        const other_weights = (1 - weight_object) / 5
        
        randomValue.set({
            choices: [
                randomString,
                randomObject,
                randomNumber,
                randomInteger,
                randomFunction, 
                randomBoolean
            ],
            weights: [other_weights, weight_object, other_weights, other_weights, other_weights, other_weights]
        });
        

        const finalObject = h.value();
        finalObject.set({choices: [randomString, randomObject, randomNumber, randomInteger, randomFunction, randomBoolean],
        weights: [0.3, 0.35, 0.05, 0.05, 0.2, 0.05]});

        var ret = finalObject.run(1)[0];*/

        var ret = this.pools[entrypoint][num_arg].get_input();
        fs.appendFileSync('/tmp/fuzz.inputs', entrypoint.toString() + " " + num_arg.toString() + " " +  get_representation([ret]) + "\n");
        return ret;
    }

    save_results(progress_results_path, results_path, last_tried_entrypoint, last_tried_input, entrypoint, mode){
        //var last_tried_input = get_representation(last_tried_input);
        var first_flow_abs = (typeof globalThis !== 'undefined') ? globalThis.__nm_first_flow_ms__ : undefined;
        var time_to_first_flow_ms = (first_flow_abs != null) ? (first_flow_abs - this.fuzz_start_ms) : null;
        var result = {"fuzzmode": mode, "max_global_cov": this.max_global_cov, "max_cov": this.max_cov, "entrypoint": last_tried_entrypoint, "input": last_tried_input, "specs": "[ " + this.get_specs(entrypoint).join(",") + " ]",
            "num_exec": this.num_exec,
            "fuzz_wall_ms": Date.now() - this.fuzz_start_ms,
            "time_to_first_flow_ms": time_to_first_flow_ms};
        fs.writeFileSync(results_path, JSON.stringify(result));

        var progress_result = {"coverage": this.progress};
        fs.writeFileSync(progress_results_path, JSON.stringify(progress_result));
    }
}

function test_fuzzer(){
    fuzz = new Fuzzer(2);
    fuzz.set_args("main", 1);
    fuzz.set_args("f", 3);
    fuzz.update_obj("main", 0, "what", {});
    fuzz.feed_cov("main", 0, [ "val", "attr2"])
    console.log(fuzz.get_input("main", 0));
}

//test_fuzzer();

module.exports = {
    Fuzzer,
    get_representation
};

// JALANGI DO NOT INSTRUMENT
// JALANGI DO NOT INSTRUMENT
// DYNAJS DO NOT INSTRUMENT