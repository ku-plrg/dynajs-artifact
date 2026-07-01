import {
    __jalangi_assert_taint_true__,
    __jalangi_set_taint__,
} from "../../taint_header";
import { test_one, test_suite } from "../../test_header";

test_suite("------------- Generator Hooks -----------", function() {
    let yielded = "yielded";

    test_one("Setting taint on yielded value", function() {
        __jalangi_set_taint__(yielded);
    });

    function* yieldOnce() {
        yield yielded;
    }

    const yieldedResult = yieldOnce().next();

    test_one("yield should preserve taint for the yielded value", function() {
        __jalangi_assert_taint_true__(yieldedResult.value);
    });

    let resumed = "resumed";

    test_one("Setting taint on resumed value", function() {
        __jalangi_set_taint__(resumed);
    });

    let captured;
    function* receiveResume() {
        captured = yield "plain";
        return captured;
    }

    const iterator = receiveResume();
    iterator.next();
    const resumeResult = iterator.next(resumed);

    test_one("resume should preserve taint on the generator return value", function() {
        __jalangi_assert_taint_true__(resumeResult.value);
    });
});
