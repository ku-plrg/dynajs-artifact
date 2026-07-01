import {
    __jalangi_assert_taint_true__,
    __jalangi_set_taint__,
} from "../../taint_header";
import { test_one, test_suite } from "../../test_header";

test_suite("------------- Optional Chaining -----------", function() {
    let seed = "optional-seed";

    test_one("Setting taint on optional chaining seed", function() {
        __jalangi_set_taint__(seed);
    });

    const obj = {
        nested: {
            value: seed,
        },
    };

    const result = obj?.nested?.value;

    test_one("optional chaining should preserve taint on the success path", function() {
        __jalangi_assert_taint_true__(result);
    });
});
