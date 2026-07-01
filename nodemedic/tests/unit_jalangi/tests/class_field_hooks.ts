import {
    __jalangi_assert_taint_true__,
    __jalangi_set_taint__,
} from "../../taint_header";
import { test_one, test_suite } from "../../test_header";

test_suite("------------- Class Field Hooks -----------", function() {
    let instanceSeed = "instance-field";

    test_one("Setting taint on instance field initializer", function() {
        __jalangi_set_taint__(instanceSeed);
    });

    class InstanceField {
        value = instanceSeed;
    }

    const instance = new InstanceField();

    test_one("instance field initializer should preserve taint", function() {
        __jalangi_assert_taint_true__(instance.value);
    });

    let staticSeed = "static-field";

    test_one("Setting taint on static field initializer", function() {
        __jalangi_set_taint__(staticSeed);
    });

    class StaticField {
        static value = staticSeed;
    }

    test_one("static field initializer should preserve taint", function() {
        __jalangi_assert_taint_true__(StaticField.value);
    });
});
