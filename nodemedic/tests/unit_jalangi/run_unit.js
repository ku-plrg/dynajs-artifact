// JALANGI DO NOT INSTRUMENT

const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')
const assert = require('assert');

const repoRoot = path.resolve(__dirname, '..', '..')
const dynajsHome = path.join(repoRoot, 'lib', 'dynajs')
const dynajsBin = path.join(dynajsHome, 'dynajs')
const rewriteFile = path.join(repoRoot, 'src', 'rewrite_dynajs.js')
const scriptsFolder = path.join(__dirname, 'tests', '_build', 'unit_jalangi', 'tests')
const files = fs.readdirSync(scriptsFolder);
const timeoutArg = process.argv.find((arg) => arg.startsWith('--timeout-ms='))
const timeoutValue = timeoutArg
    ? timeoutArg.split('=')[1]
    : process.env.UNIT_TEST_TIMEOUT_MS

function getTimeoutMs(value) {
    if (value === undefined || value === '') {
        return 0;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new Error(`Invalid timeout value: ${value}`);
    }

    return parsed;
}

const testTimeoutMs = getTimeoutMs(timeoutValue);

// Default policies to apply to all tests
const defaultPolicies = {
    'string': 'precise',
    'array': 'precise',
    'object': 'precise',
};

// Test-file-specific policies that override 
// the default policies
const filePolicies = {
    'arrayImprecise.js': {
        'array': 'imprecise',
    },
    'functionPrototype.js': {
        'array': 'imprecise',
    },
    'string_taint.js': {
        'array': 'imprecise',
    },
};

function getPolicyFlag(file) {
    let policyLevels = [];
    Object.keys(defaultPolicies).forEach(function(policyType) {
        if (filePolicies.hasOwnProperty(file) && filePolicies[file].hasOwnProperty(policyType)) {
            policyLevels.push([policyType, filePolicies[file][policyType]]);
        } else {
            policyLevels.push([policyType, defaultPolicies[policyType]]);
        }
    });

    return 'policies=' + policyLevels.map((x) => `${x[0]}:${x[1]}`).join(',');
}

function runTest(file) {
    console.log(`Running test: ${file}`);

    const testFile = path.join(scriptsFolder, file)
    const analysisArgs = [
        'log_level=error',
        'assert_passed=true',
        getPolicyFlag(file),
    ].join(' ')

    return new Promise(function(resolve) {
        execFile(
            dynajsBin,
            ['node', testFile],
            {
                cwd: repoRoot,
                env: {
                    ...process.env,
                    DYNAJS_HOME: dynajsHome,
                    DYNAJS_OPTIONS: `--analysis ${rewriteFile} --ignore-node-modules`,
                    NODEMEDIC_ANALYSIS_ARGS: analysisArgs,
                },
                maxBuffer: 10 * 1024 * 1024,
                timeout: testTimeoutMs,
            },
            function(err, stdout, stderr) {
                const output = [stdout, stderr].filter(Boolean).join('\n').trim()
                if (output) {
                    console.log(output)
                }

                resolve({
                    file,
                    error: err,
                    output,
                })
            }
        )
    })
}

function checkResults(results) {
    console.log("Checking results...")
    var succeeded_tests = 0;
    var failed_tests = 0;
    var executionFailures = [];

    for (let i in results) {
        succeeded_tests += (results[i].output.match(/Success/g) || []).length;
    }

    for (let i in results) {
        failed_tests += (results[i].output.match(/Failure/g) || []).length;
        if (results[i].error) {
            executionFailures.push(results[i]);
        }
    }

    if (executionFailures.length > 0 || failed_tests > 0 || succeeded_tests === 0) {
        const executionSummary = executionFailures
            .map(({ file, error }) => `${file}: ${error.message}`)
            .join('\n');
        assert(false, `Test results:
                        Success: ${succeeded_tests}
                        Failure: ${failed_tests}
                        Total:   ${succeeded_tests + failed_tests}
                        Execution failures: ${executionFailures.length}
${executionSummary ? `\n${executionSummary}` : ''}`);
    } else {
        console.log(`All ${succeeded_tests} tests have executed successfully.`);
    }
}

async function main() {
    if (testTimeoutMs > 0) {
        console.log(`Per-test timeout: ${testTimeoutMs}ms`);
    }

    const selectedFiles = files.filter(function(file) {
        return file.includes('.js') && !file.includes('_jalangi_') && !file.includes('__dynajs__');
    });

    const results = [];
    for (const file of selectedFiles) {
        results.push(await runTest(file));
    }

    checkResults(results);
}

main().catch(function(err) {
    console.error(err);
    process.exitCode = 1;
});
