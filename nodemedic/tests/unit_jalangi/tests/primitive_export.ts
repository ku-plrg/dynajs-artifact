import { test_suite, test_one, test_assert } from "../../test_header";

// Regression tests for IM.moduleImport handling of modules whose
// `module.exports` is a primitive (string / number / boolean / null).
// Before the fix, IM.moduleImport unconditionally called
// Object.defineProperty on the require() result, which throws TypeError
// on primitives. The fix returns the primitive directly without tagging.

test_suite("---------- Primitive export: string --------", function() {
    let imported = require('./primitive_export_string');

    test_one("require should not throw for string-primitive export", function() {
        test_assert(typeof imported === 'string');
    });

    test_one("required string value should be preserved", function() {
        test_assert(imported === 'primitive_string_value');
    });
});

test_suite("---------- Primitive export: number --------", function() {
    let imported = require('./primitive_export_number');

    test_one("require should not throw for number-primitive export", function() {
        test_assert(typeof imported === 'number');
    });

    test_one("required number value should be preserved", function() {
        test_assert(imported === 42);
    });
});

test_suite("---------- Primitive export: boolean --------", function() {
    let imported = require('./primitive_export_boolean');

    test_one("require should not throw for boolean-primitive export", function() {
        test_assert(typeof imported === 'boolean');
    });

    test_one("required boolean value should be preserved", function() {
        test_assert(imported === true);
    });
});

test_suite("---------- Primitive export: null --------", function() {
    let imported = require('./primitive_export_null');

    test_one("require should not throw for null export", function() {
        test_assert(imported === null);
    });
});

test_suite("---------- Object export still tagged (regression) --------", function() {
    let imported = require('./callback_external');

    test_one("object module.exports is still an object", function() {
        test_assert(typeof imported === 'object' && imported !== null);
    });

    test_one("object module.exports retains isInternalModule tag", function() {
        test_assert(imported.isInternalModule === true);
    });

    test_one("object module.exports retains modulePath tag", function() {
        test_assert(imported.modulePath === './callback_external');
    });
});