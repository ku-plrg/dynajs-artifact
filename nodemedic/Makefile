TSC=tsc
TSC_FLAGS=-b

NODE=node
NODE_FLAGS=--trace-uncaught --stack-trace-limit=20
NODE_DEBUG_FLAGS=--trace-uncaught --inspect --inspect-brk

JALANGI_DIR=lib/jalangi2-babel
JALANGI_CMD=${JALANGI_DIR}/src/js/commands/jalangi.js --inlineIID --inlineSource --analysis
ANALYSIS_FILE := src/rewrite.js
BLANK_ANALYSIS := tests/blank_analysis.js
DYNAJS_BIN=./lib/dynajs/dynajs
DYNAJS_HOME=$(CURDIR)/lib/dynajs
DYNAJS_OPTIONS_BASE=
DYNAJS_JALANGI_ANALYSIS_FILE := src/rewrite_dynajs.js
ARGS_BASE=log_level=${LOGLEVEL} policies=${POLICIES} taint_paths=${TAINTPATHS} taint_paths_json=${TAINTPATHSJSON} honeyobjects=${HONEYOBJECTS}
ARGS_BENCH=log_level=error policies=${POLICIES} taint_paths=false taint_paths_json=false
ARGS=$(ARGS_BASE) assert_passed=${ASSERTPASSED} eval_sink=${EVALSINK}
ARGS_TEST=$(ARGS_BASE) eval_sink=${EVALSINK} assert_passed=${ASSERTPASSED}
ARGS_EVAL=$(ARGS_BASE) eval_sink=false assert_passed=${ASSERTPASSED}

TIMING_CMD=hyperfine -i -u second --warmup 3 --export-csv

.PHONY: js.stub

dynajs-model.stub: scripts/build-dynajs-model-cjs.mjs lib/dynajs/src/model/string.ts
	$(NODE) scripts/build-dynajs-model-cjs.mjs
	@touch $@

js.stub: dynajs-model.stub
	$(TSC) $(TSC_FLAGS)
	@touch $@

analyze: js.stub
	$(NODE) $(NODE_FLAGS) $(JALANGI_CMD) ${ANALYSIS_FILE} ${FILE} $(ARGS)

time_analyze:
	$(TIMING_CMD) "$(NODE) $(NODE_FLAGS) $(JALANGI_CMD) ${ANALYSIS_FILE} ${FILE} $(ARGS)"

casestudy: js.stub
	$(NODE) $(NODE_FLAGS) $(JALANGI_CMD) ${ANALYSIS_FILE} ${FILE} $(ARGS_TEST)

time_casestudy_debug:
	timeout 1h time -p $(NODE) $(NODE_FLAGS) $(JALANGI_CMD) ${ANALYSIS_FILE} ${FILE} $(ARGS_TEST)
	time -p $(NODE) $(NODE_FLAGS) $(JALANGI_CMD) ${BLANK_ANALYSIS} ${FILE}
	time -p $(NODE) $(NODE_FLAGS) ${FILE}

time_casestudy:
	$(TIMING_CMD) stats1.csv "$(NODE) $(JALANGI_CMD) ${ANALYSIS_FILE} ${FILE} $(ARGS_BENCH)"
	$(TIMING_CMD) stats2.csv "$(NODE) $(JALANGI_CMD) ${BLANK_ANALYSIS} ${FILE}"
	$(TIMING_CMD) stats3.csv "$(NODE) ${FILE}"

debug: js.stub
	$(NODE) $(NODE_DEBUG_FLAGS) $(JALANGI_CMD) ${ANALYSIS_FILE} ${FILE} ${ARGS}

analyze_with_eval: js.stub
	$(NODE) $(NODE_FLAGS) $(JALANGI_CMD) ${ANALYSIS_FILE} ${FILE} $(ARGS_EVAL)

analyze_with_mocha: js.stub
	./run_with_mocha.sh ${FILE} $(ARGS)

analyze_with_blank: js.stub
	$(NODE) $(NODE_FLAGS) $(JALANGI_CMD) ${BLANK_ANALYSIS} ${FILE}

jalangi_tests: js.stub
	tsc -b tests/unit_jalangi/tests/
	UNIT_TEST_TIMEOUT_MS="$(UNIT_TEST_TIMEOUT_MS)" $(NODE) $(NODE_FLAGS) tests/unit_jalangi/run_unit.js

run_one_test: js.stub
	tsc -b tests/unit_jalangi/tests/
	$(NODE) $(NODE_FLAGS) $(JALANGI_CMD) ${ANALYSIS_FILE} tests/unit_jalangi/tests/_build/unit_jalangi/tests/${TEST}.js $(ARGS_TEST)

run_one_test_dyna: js.stub
	tsc -b tests/unit_jalangi/tests/
	DYNAJS_HOME="$(DYNAJS_HOME)" DYNAJS_OPTIONS="$(DYNAJS_OPTIONS_BASE) --analysis $(DYNAJS_JALANGI_ANALYSIS_FILE)" NODEMEDIC_ANALYSIS_ARGS="$(ARGS_TEST)" $(DYNAJS_BIN) $(NODE) $(NODE_FLAGS) tests/unit_jalangi/tests/_build/unit_jalangi/tests/${TEST}.js

run_one_test_debug: js.stub
	tsc -b tests/unit_jalangi/tests/
	$(NODE) $(NODE_DEBUG_FLAGS) $(JALANGI_CMD) ${ANALYSIS_FILE} tests/unit_jalangi/tests/_build/unit_jalangi/tests/${TEST}.js $(ARGS_TEST)

clean:
	find ./src -type f -name '*.js' -delete
	find ./src -type f -name '*.js.map' -delete
	rm -f dynajs-model.stub src/vendor/dynajs-model.cjs
