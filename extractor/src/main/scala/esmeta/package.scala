package esmeta

import esmeta.error.NoEnvVarError

/** line separator */
val LINE_SEP = System.getProperty("line.separator")

/** base project directory root */
val VERSION = "0.7.3"

/** base project directory root */
val BASE_DIR = sys.env.getOrElse("DYNAJS_EXTRACTOR_HOME", throw NoEnvVarError)

/** log directory */
val LOG_DIR = s"$BASE_DIR/logs"
val EXTRACT_LOG_DIR = s"$LOG_DIR/extract"
val POLYFILL_LOG_DIR = s"$LOG_DIR/polyfill"
val CFG_LOG_DIR = s"$LOG_DIR/cfg"

/** stack trace depth */
val STACK_TRACE_DEPTH = 15

/** tests directory root */
val TEST_DIR = s"$BASE_DIR/tests"

/** specification directory */
val ECMA262_DIR = s"$BASE_DIR/ecma262"
val SPEC_HTML = s"$ECMA262_DIR/spec.html"

/** current directory root */
val CUR_DIR = System.getProperty("user.dir")

/** source code directory */
val SRC_DIR = s"$BASE_DIR/src/main/scala/esmeta"

/** resource directory */
val RESOURCE_DIR = s"$BASE_DIR/src/main/resources"
val UNICODE_DIR = s"$RESOURCE_DIR/unicode"
val MANUALS_DIR = s"$RESOURCE_DIR/manuals"
val RESULT_DIR = s"$RESOURCE_DIR/result"

/** package name */
val PACKAGE_NAME = "esmeta"

/** tests directory */
val IR_TEST_DIR = s"$TEST_DIR/ir"
val ES_TEST_DIR = s"$TEST_DIR/es"

/** error stack trace display mode */
var ERROR_MODE = false

/** exit status return mode */
var STATUS_MODE = false

/** test262 directories */
var TEST262_DIR = s"$TEST_DIR/test262"
