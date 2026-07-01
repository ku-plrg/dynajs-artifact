import { __jalangi_assert_taint_true__, __jalangi_assert_taint_false__,
    __jalangi_set_taint__ } from "../../taint_header";
import {test_suite, test_one} from "../../test_header";

test_suite("----------- Call Non-Callable Object -----------", function() {

    test_one("calling a non-function should throw TypeError, not crash the analysis", function() {
        var f: any = {};
        try {
            f();
        } catch (e) {
            if (e.message && e.message.indexOf('Assertion failure') !== -1) {
                throw e;
            }
        }
        
        __jalangi_assert_taint_false__(Object());
    });

});
