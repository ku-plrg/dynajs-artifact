import {
    __jalangi_assert_taint_true__,
    __jalangi_set_taint__,
} from "../../taint_header";
import { test_one, test_suite } from "../../test_header";

test_suite("------------- Super Hooks -----------", function() {
    let ctorSeed = "ctor-seed";

    test_one("Setting taint on super constructor argument", function() {
        __jalangi_set_taint__(ctorSeed);
    });

    class BaseCtor {
        value;
        constructor(value) {
            this.value = value;
        }
    }

    class DerivedCtor extends BaseCtor {
        constructor(value) {
            super(value);
        }
    }

    const ctorResult = new DerivedCtor(ctorSeed);

    test_one("super constructor call should preserve taint", function() {
        __jalangi_assert_taint_true__(ctorResult.value);
    });

    let readSeed = "read-seed";

    test_one("Setting taint on a prototype field read through super", function() {
        __jalangi_set_taint__(readSeed);
    });

    class BaseRead {
        value;
    }
    BaseRead.prototype.value = readSeed;

    class DerivedRead extends BaseRead {
        read() {
            // @ts-ignore: exercised intentionally to cover DynaJS super property reads.
            return super.value;
        }
    }

    const readResult = new DerivedRead().read();

    test_one("super property reads should preserve taint", function() {
        __jalangi_assert_taint_true__(readResult);
    });

    let writeSeed = "write-seed";

    test_one("Setting taint on a super property write", function() {
        __jalangi_set_taint__(writeSeed);
    });

    class BaseWrite {
        slot;
    }
    BaseWrite.prototype.slot = "plain";

    class DerivedWrite extends BaseWrite {
        write(value) {
            // @ts-ignore: exercised intentionally to cover DynaJS super property writes.
            super.slot = value;
            return this.slot;
        }
    }

    const writeResult = new DerivedWrite().write(writeSeed);

    test_one("super property writes should preserve taint", function() {
        __jalangi_assert_taint_true__(writeResult);
    });

    let methodSeed = "method-seed";

    test_one("Setting taint on a super method argument", function() {
        __jalangi_set_taint__(methodSeed);
    });

    class BaseMethod {
        identity(value) {
            return value;
        }
    }

    class DerivedMethod extends BaseMethod {
        call(value) {
            return super.identity(value);
        }
    }

    const methodResult = new DerivedMethod().call(methodSeed);

    test_one("super method calls should preserve taint", function() {
        __jalangi_assert_taint_true__(methodResult);
    });
});
