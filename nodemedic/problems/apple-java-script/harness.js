const PUT = require('apple-java-script');

try {
    new PUT["execSync"]("x");
} catch (e) {
    console.log("caught", e && e.message ? e.message : String(e));
}

// cmd to reproduce: DYNAJS_HOME=/nodetaint/lib/dynajs /nodetaint/lib/dynajs/dynajs node harness.js
/**
Output:
root@835f4a73e11c:/nodetaint/example# DYNAJS_HOME=/nodetaint/lib/dynajs /nodetaint/lib/dynajs/dynajs node harness.js
Warning: DYNAJS_OPTIONS is not set. run `dynajs` for usage information.

<--- Last few GCs --->

[71341:0x572ac40]    11385 ms: Scavenge (reduce) 2047.4 (2081.0) -> 2047.3 (2081.8) MB, 2.07 / 0.00 ms  (average mu = 0.215, current mu = 0.107) allocation failure;
[71341:0x572ac40]    12968 ms: Mark-Compact (reduce) 2048.3 (2081.8) -> 2048.3 (2082.8) MB, 1583.11 / 0.00 ms  (+ 1.9 ms in 31 steps since start of marking, biggest step 1.9 ms, walltime since start of marking 1594 ms) (average mu = 0.154, current mu = 0.

<--- JS stacktrace --->

FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
----- Native stack trace -----

 1: 0xb78db3 node::OOMErrorHandler(char const*, v8::OOMDetails const&) [node]
 2: 0xee8300 v8::Utils::ReportOOMFailure(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [node]
 3: 0xee85e7 v8::internal::V8::FatalProcessOutOfMemory(v8::internal::Isolate*, char const*, v8::OOMDetails const&) [node]
 4: 0x10fb205  [node]
 5: 0x1113088 v8::internal::Heap::CollectGarbage(v8::internal::AllocationSpace, v8::internal::GarbageCollectionReason, v8::GCCallbackFlags) [node]
 6: 0x10e91f1 v8::internal::HeapAllocator::AllocateRawWithLightRetrySlowPath(int, v8::internal::AllocationType, v8::internal::AllocationOrigin, v8::internal::AllocationAlignment) [node]
 7: 0x10ea385 v8::internal::HeapAllocator::AllocateRawWithRetryOrFailSlowPath(int, v8::internal::AllocationType, v8::internal::AllocationOrigin, v8::internal::AllocationAlignment) [node]
 8: 0x10c78d6 v8::internal::Factory::NewFillerObject(int, v8::internal::AllocationAlignment, v8::internal::AllocationType, v8::internal::AllocationOrigin) [node]
 9: 0x15247d6 v8::internal::Runtime_AllocateInYoungGeneration(int, unsigned long*, v8::internal::Isolate*) [node]
10: 0x195e476  [node]
Aborted
 */