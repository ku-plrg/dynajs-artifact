import {
    __assert_string_range_all_tainted__,
    __assert_string_range_all_untainted__,
    __jalangi_assert_taint_false__,
    __jalangi_assert_taint_true__,
    __jalangi_set_taint__,
} from "../../taint_header";
import { test_one, test_suite } from "../../test_header";

test_suite("------------- Template Literal Concatenation (Precise) -----------", function() {
    let a = "a";
    let b = "b";
    let c = "c";
    let d = "";

    test_one("Setting taint on template expression", function() {
        __jalangi_set_taint__(c);
    });

    test_one("template expression should be tainted", function() {
        __jalangi_assert_taint_true__(c);
    });

    test_one("untainted template expression should not be tainted", function() {
        __jalangi_assert_taint_false__(b);
    });

    d = `${a}${b} ${c}`;

    test_one("template literal result should not be fully tainted under precise string policy", function() {
        __jalangi_assert_taint_false__(d);
    });

    test_one("template literal a should remain untainted", function() {
        __assert_string_range_all_untainted__(d, 0, a.length + b.length + 1);
    });

    test_one("template literal tainted expression range should be tainted", function() {
        const taintedStart = a.length + b.length + 1;
        __assert_string_range_all_tainted__(d, taintedStart, taintedStart + c.length);
    });
});

test_suite("------------- Template Literal Concatenation (Whole String) -----------", function() {
    let left = "tainted";
    let right = "suffix";

    test_one("Setting taint on template literal left side", function() {
        __jalangi_set_taint__(left);
    });

    let value = `${left}-${right}`;

    test_one("template literal left expression should taint its character range", function() {
        __assert_string_range_all_tainted__(value, 0, left.length);
    });

    test_one("template literal quasi and right expression should remain untainted", function() {
        __assert_string_range_all_untainted__(value, left.length, value.length);
    });
});
