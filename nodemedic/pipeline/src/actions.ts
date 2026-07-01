import * as axios from 'axios';
import * as pacote from 'pacote';
import { promises as fs, readdirSync, statSync, readFileSync, existsSync, unlinkSync, rmdirSync, mkdirSync} from 'fs';
import { Maybe, Result } from './functional';
import {
    Path, Response, logger,
    DownloadCountCache, Bound, checkForAPI,
    delay,
    getSafeNameFromPackageName
} from './utilities';
import {
    PackageData, ExploitResult, SinkType,
    EntryPoint,
    SynthesisResult
} from './package';

import { Context} from "./pipeline";
import { AsyncProcess, ProcessStatus } from './process';
import { BaseError, PipelineError, ProcessError, ProcessOutputError, ProcessTimeoutError, ResultError } from './errors';
const { execSync } = require('child_process');

const path = require('path');

import * as esprima from 'esprima';
import * as estraverse from 'estraverse';


export async function getPackageDownloadCount(thePackage: PackageData, downloadInfoDir: Path): Promise<Maybe<number>> {
    const downloadCountCachePath: Path = downloadInfoDir.extend(['downloadCounts.json']);
    try {
        await fs.access(downloadCountCachePath.toString());
    } catch {
        // Download cache does not exist
        await fs.writeFile(downloadCountCachePath.toString(), JSON.stringify({}));
    }
    let downloadCountCache: DownloadCountCache = JSON.parse(
        await fs.readFile(downloadCountCachePath.toString(), 'utf8')
    );
    // Download count uses *just* the package name
    if (!(thePackage.name() in downloadCountCache)) {
        // Retrieve download count
        try {
            const response: Response = await (axios as any).get(`https://api.npmjs.org/downloads/point/last-month/${thePackage.name()}`);
            downloadCountCache[thePackage.name()] = (response.data.downloads as number);
            await fs.writeFile(downloadCountCachePath.toString(), JSON.stringify(downloadCountCache));
        } catch (exn) {
            logger.error(`Failed to GET download count of ${thePackage.name()}:\n${exn}`);
            return new Maybe();
        }
    }
    return new Maybe(downloadCountCache[thePackage.name()]);
}


export async function filterByDownloadCount(
    thePackage: PackageData,
    downloadCountTarget: number,
    bound: Bound,
    downloadInfoDir: Path,
): Promise<Result<number, BaseError>> {
    logger.debug('Filter: Download count');
    const downloadCountMonad: Maybe<number> = await getPackageDownloadCount(thePackage, downloadInfoDir);
    if (!downloadCountMonad.isNothing()) {
        const downloadCount: number = downloadCountMonad.unwrap();
        if ((bound == Bound.lower && downloadCount >= downloadCountTarget) ||
            (bound == Bound.upper && downloadCount <= downloadCountTarget)) {
            return Result.Success(downloadCount);
        }
        return Result.Failure(new ResultError(`Package does not meet download count bound: ${bound} ${downloadCountTarget}`));
    }
    // Count not check download count; don't include
    return Result.Failure(new PipelineError(`Failed to get the download count for package ${thePackage.name()}`));
}


export async function getPackageVersion(packagePath: Path): Promise<Result<string, BaseError>> {
    try {
        let manifest = JSON.parse(
            await fs.readFile(packagePath.extend(['package.json']).toString(), 'utf8')
        );
        return Result.Success(manifest['version']);
    } catch (err) {
        // Could not read package manifest; don't include
        return Result.Failure(new ResultError(`Failed to read manifest for ${packagePath}:\n${err}`));
    }
}


export async function filterByMain(packagePath: Path): Promise<Result<null, BaseError>> {
    logger.debug('Filter: Manifest has main');
    let manifest: any;
    try {
        manifest = JSON.parse(
            await fs.readFile(packagePath.extend(['package.json']).toString(), 'utf8')
        );
    } catch (exn) {
        return Result.Failure(new PipelineError(`Failed to read manifest for ${packagePath}:\n${exn}`));
    }
    if ('main' in manifest) {
        try {
            await fs.access(packagePath.extend([manifest['main']]).toString());
            return Result.Success(null);
        } catch (err) {
            return Result.Failure(
                new ResultError(
                    `Failed to locate entry point file for ${packagePath}:\n${err}`
                )
            );
        }
    }
    return Result.Failure(new ResultError('Package manifest has no main'));
}


export async function filterByAPIs(
    packagePath: Path,
    apis: Array<string>,
): Promise<Result<Array<string>, PipelineError>> {
    logger.debug(`Filter: Package has APIs: ${apis}`);
    let packageAPIs: Array<string> = [];
    for (const api of apis) {
        try {
            if (await checkForAPI(packagePath, api)) {
                packageAPIs.push(api);
            }
        } catch (err) {
            // Short-circuit checking sinks if we encounter an error
            return Result.Failure(
                new PipelineError(`Encountered an error while checking for API: ${api}:\n${err}`)
            );
        }
    }
    return Result.Success(packageAPIs);
}

/*
DEPRECATED

export async function importPackage(
    thePackage: PackageData,
): Promise<Result<null, BaseError>> {
    logger.debug(`Filter: Package can be imported`);
    const importDriver = `require('${thePackage.name()}');`;
    const importDriverPath = thePackage.path().dir().extend([`tmp_${thePackage.name()}`]);
    try {
        await fs.writeFile(importDriverPath.toString(), importDriver);
    } catch (err) {
        return Result.Failure(new PipelineError(`Failed to write import driver: ${err}`));
    }
    const timeoutLen = 60e3;
    const child = new AsyncProcess(
        'node',
        [importDriverPath.toString()],
        timeoutLen,
        { cwd: thePackage.path().toString() }
    );
    try {
        await child.run();
    } catch (err) {
        return Result.Failure(new PipelineError(`Failed to import package: ${err}`));
    }
    const result = child.checkResult();
    if (result.isFailure()) {
        const status = result.unwrap();
        if (status == ProcessStatus.Timeout) {
            return Result.Failure(new ProcessTimeoutError(timeoutLen, child.output()));
        }
        return Result.Failure(new ProcessError(result.unwrap(), child.output()));
    } else if (child.outputHasError()) {
        return Result.Failure(new ProcessOutputError(child.output()));
    }
    return Result.Success(null);
}
*/

export async function checkExecExploit(): Promise<Result<null, BaseError>> {
    let successFilePath: Path = new Path(['/tmp', 'success']);
    try {
        // Check for the side effect
        await fs.access(successFilePath.toString());
    } catch (err) {
        return Result.Failure(new ResultError(`Exploit not successful; ${err.message}`));
    }
    try {
        // Remove the side effect
        await fs.unlink(successFilePath.toString());
    } catch (err) {
        console.log("WARNING: Failed to remove side effect", successFilePath.toString(), err.message, "but I will proceed since we usually analyze packages independently")
    }
    logger.debug('Exploit was successful!');
    return Result.Success(null);
}


export async function checkExploit(
    thePackage: PackageData,
    failOnNonZeroExit: boolean,
    target_entrypoint: string,
    input: Array<string>,
    outputDir: Path
): Promise<Result<ExploitResult[], BaseError>> {
    // Remove any existing `success` files
    let successFilePath: Path = Path.relCwd(['success']);
    if ((await successFilePath.exists())) {
        try {
            // Remove the side effect
            await fs.unlink(successFilePath.toString());
        } catch (err) {
            return Result.Failure(
                new PipelineError(
                    `Failed to remove side effect: ${successFilePath.toString()}; ${err.message}`
                )
            );
        }
    }


    let successfulExploits: ExploitResult[] = [];
    let i = 0;
    var candidate = JSON.stringify(thePackage.candidateExploit());
    
    const entryPoint = thePackage.entryPoints()[parseInt(target_entrypoint)];
    for (var arg_idx = 0; arg_idx < input.length; arg_idx++) {
        var exploit_to_try = input.slice();
        exploit_to_try[arg_idx] = candidate;
        // We used to set all other arguments to undefined, but it is important to keep the origina linputs that triggered the flow
        /*const isDefault = (e) => 
            e == "{ '0': '0' }" 
            || Object.getOwnPropertyNames(e).indexOf("0") != -1 && e["0"] == "0";
        for (let i = 0; i < exploit_to_try.length; i++) {
            if (i != arg_idx && isDefault(exploit_to_try[i])) {
                exploit_to_try[i] = undefined;
            }
        }*/
        let preamble: string;
        if (thePackage.sinkType() == SinkType.execSink) {
            preamble = '';
        } else {
            preamble = 'global.CTF = function() {console.log("GLOBAL.CTF HIT")}\n';
        }
        const driver: string = packageDriverExploitConfirmationTemplate(
            thePackage.path().toString(), [entryPoint], preamble, exploit_to_try
        );
        const pocPath = outputDir.extend([`poc${i}.js`]);
        try {
            await fs.writeFile(pocPath.toString(), driver);
        } catch (err) {
            return Result.Failure(new PipelineError(`Failed to write check exploit driver: ${err.message}`));
        }
        const timeoutLen = 60e3;
        const checkProcess = new AsyncProcess('node', [pocPath.toString()], timeoutLen);
        logger.debug(`Checking exploit with cmd: ${checkProcess.cmd()} ${checkProcess.args().join(" ")}`);
        try {
            await checkProcess.run();
        } catch (err) {
            return Result.Failure(new PipelineError(`Failed to test exploit: ${err.message}`));
        }
        const result: Result<null, ProcessStatus> = checkProcess.checkResult();
        if (failOnNonZeroExit && result.isFailure()) {
            const status = result.unwrap();
            if (status == ProcessStatus.Timeout) {
                return Result.Failure(new ProcessTimeoutError(timeoutLen, checkProcess.output()));
            }
            return Result.Failure(new ProcessError(status, checkProcess.output()));
        }

        // Delay 0.1 seconds for execution
        await delay(100);
        let success = false;
        if (thePackage.sinkType() == SinkType.execSink) {
            const checkResult = await checkExecExploit();
            if (checkResult.isFailure()) {
                const error = checkResult.unwrap();
                if (!(error instanceof ResultError)) {
                    return Result.Failure(error);
                }
            } else {
                success = true;
            }
        } else {
            // eval exploit
            success = checkProcess.stdout().orDefault('').includes('GLOBAL.CTF HIT');
        }
        if (success) {
            const result: ExploitResult = {
                exploitFunction: entryPoint.functionName,
                exploitString: candidate
            };
            successfulExploits.push(result);
            const packageDir = outputDir.extend([getSafeNameFromPackageName(thePackage.name())]);
            if (existsSync(packageDir.toString())) {
                const preservedPocPath = packageDir.extend([`poc${i}.js`]);
                try {
                    await fs.copyFile(pocPath.toString(), preservedPocPath.toString());
                } catch (err) {
                    logger.warn(`Failed to preserve successful PoC at ${preservedPocPath.toString()}: ${err.message}`);
                }
            }
        }
        i += 1;
    }
    return Result.Success(successfulExploits);
}


export function generateTrivialExploit(
    sinkType: SinkType
): Result<string, BaseError> {
    if (sinkType == SinkType.execSink) {
        return Result.Success(" $(touch /tmp/success) # \" || touch /tmp/success # ' || touch /tmp/success");
    } else if (sinkType == SinkType.evalSink) {
        return Result.Success('global.CTF();//"+global.CTF();//\'+global.CTF();//${global.CTF()}');
    } else {
        return Result.Failure(new ResultError(`No trivial exploit for sink type: ${sinkType}`));
    }
}


export async function inferenceAndSynthesis(
    taintJSONPath: Path,
    useHoneyobjects: boolean,
    useInference: boolean,
    useEnumerator: boolean,
    useEnumeratorTemplates: boolean,
    polyglotACIPayload: boolean,
    polyglotACEPayload: boolean,
    stringOnlySynthesis: boolean,
    solvingTime: number,
): Promise<Result<SynthesisResult, BaseError>> {
    let flags = [
        `--prov=${taintJSONPath.toString()}`,
        '--concretize',
        `--solving-time=${solvingTime}`,
        '--allow-unsound',
    ];
    if (useHoneyobjects) {
        flags.push('--honeyobjects');
    }
    if (useInference) {
        flags.push('--use-inference');
    }
    if (useEnumerator) {
        flags.push('--use-enumerator');
    }
    if (useEnumeratorTemplates) {
        flags.push('--use-enumerator-templates');
    }
    if (polyglotACIPayload) {
        flags.push('--use-polyglot-aci-payload');
    }
    if (polyglotACEPayload) {
        flags.push('--use-polyglot-ace-payload');
    }
    if (stringOnlySynthesis) {
        flags.push('--only-string-datatype');
    }
    let args = [
        '-m',
        'src.main',
        ...flags,
    ];
    const proc = new AsyncProcess(
        'python3',
        args,
        60e3 + solvingTime*1000,
        { cwd: Path.relParentDir(['../lib/NodeExploitSynthesis/']).toString() }
    );
    logger.debug(`Running inference and synthesis: ${proc.cmd()} ${proc.args().join(" ")}`);
    try {
        await proc.run();
    } catch (err) {
        return Result.Failure(new PipelineError(`Failed to run: ${err}`));
    }
    const result = proc.checkResult();
    if (result.isFailure()) {
        return Result.Failure(new ProcessError(result.unwrap(), proc.output()));
    }
    if (proc.stdout().isNothing()) {
        return Result.Failure(new PipelineError(`Output is empty`));
    }
    let synthesisResult: SynthesisResult;
    try {
        synthesisResult = JSON.parse(proc.stdout().unwrap());
    } catch (err) {
        return Result.Failure(new PipelineError(`Failed to read synthesis result: ${err}`));
    }
    let smtPath: Path = taintJSONPath.dir().extend(['candidate.smt2']);
    try {
        await fs.writeFile(smtPath.toString(), synthesisResult.smt_statement);
    } catch (err) {
        return Result.Failure(new PipelineError(`Failed to write generated SMT: ${err}`));
    }
    return Result.Success(synthesisResult);
}


export async function checkSinkType(
    taintJSONPath: Path
): Promise<Result<SinkType, BaseError>> {
    let taintData: any;
    try {
        taintData = JSON.parse(
            await fs.readFile(taintJSONPath.toString(), 'utf8')
        );
    } catch (err) {
        return Result.Failure(new PipelineError(`Failed to read taint JSON file:\n${err.message}`));
    }
    switch (taintData['1']['sink_type']) {
        case 'exec':
        case 'spawn':
            return Result.Success(SinkType.execSink);
        case 'eval':
        case 'Function':
            return Result.Success(SinkType.evalSink);
        default:
            return Result.Failure(new ResultError('No sink found'));
    }
}

export function rankFlowsByDiversityThenExploitability<T extends EntryPoint>(
  taintedFlows: Iterable<T>,
  quantize: (x: number) => number = x => x
): T[] {
    const tf = Array.from(taintedFlows);
    
    interface KGroup { arr: T[]; idx: number }
    interface EPState { kMap: Map<number, KGroup>; kKeys: number[]; kIdx: number }

    const epMap = new Map<number, EPState>();
    // Build: entrypoint → (metric → flows)

    for (let i = 0; i < tf.length; i++) {
        const f = tf[i];
        const ep = f.entrypointIndex | 0;
        const k = f.exploitability_metric;
        let eps = epMap.get(ep);
        if (!eps) { eps = { kMap: new Map(), kKeys: [], kIdx: 0 }; epMap.set(ep, eps); }
        let kg = eps.kMap.get(k);
        if (!kg) { kg = { arr: [], idx: 0 }; eps.kMap.set(k, kg); eps.kKeys.push(k); }
        kg.arr.push(f);
    }
  
    // Order entrypoints and their metric groups
    var epKeys = Array.from(epMap.keys());
    for (let i = 0; i < epKeys.length; i++) {
        const eps = epMap.get(epKeys[i])!;
        eps.kKeys.sort((a, b) => b - a);
    }

    epKeys = epKeys.sort((a, b) => epMap.get(b)!.kKeys[0] - epMap.get(a)!.kKeys[0]);

    const total = tf.length;
    const out: T[] = [];
    let epIdx = 0;

    // Round-robin clocks: EP → metric-group → flow
    while (out.length < total && epKeys.length > 0) {
        if (epIdx >= epKeys.length) epIdx = 0;
        const ep = epKeys[epIdx];
        const eps = epMap.get(ep)!;

        let picked = false;
        let attempts = eps.kKeys.length;

        while (attempts > 0 && eps.kKeys.length > 0) {
            if (eps.kIdx >= eps.kKeys.length) eps.kIdx = 0;
            const k = eps.kKeys[eps.kIdx];
            const kg = eps.kMap.get(k)!;

            if (kg.idx < kg.arr.length) {
                out.push(kg.arr[kg.idx++]);                    // pick one flow
                eps.kIdx = (eps.kIdx + 1) % eps.kKeys.length;  // advance metric clock
                picked = true;
                break;
            } else {
                // drop exhausted metric group and try next
                eps.kKeys.splice(eps.kIdx, 1);
                // keep eps.kIdx as-is (now points to next group after splice)
            }
            attempts--;
        }

        if (!picked) {
            // entrypoint exhausted; remove from EP rotation
            epKeys.splice(epIdx, 1);
            // do not advance epIdx
        } else {
            epIdx = (epIdx + 1) % epKeys.length; // advance EP clock
        }
    }

    return out;
}

function getDynajsPaths(): { bin: Path, home: Path } {
    const topLevelHome = Path.relParentDir(['../dynajs']);
    const libHome = Path.relParentDir(['../lib/dynajs']);
    const topLevelBin = topLevelHome.extend(['dynajs']);

    if (existsSync(topLevelBin.toString())) {
        return { bin: topLevelBin, home: topLevelHome };
    }

    return { bin: libHome.extend(['dynajs']), home: libHome };
}

function buildInstrumentationProcess(
    templatePath: Path,
    analysisArgs: string[],
    timeoutLen: number,
    useDynajs: boolean,
    useDynajsEngine: boolean,
    packageRoot?: Path,
): { backend: string, process: AsyncProcess } {
    const fpPath: Path = templatePath.dir().extend(['flow_fingerprints.jsonl']);
    if (useDynajs) {
        const dynajs = getDynajsPaths();
        // Engine selection (migration Phase 6): the legacy hand-rolled engine
        // (src/rewrite_dynajs.js) stays the default. Pass --dynajs-engine to run
        // the new FlowAnalysis subclass (src/vendor/NodeMedicAnalysis.mjs).
        // The new engine needs `--pos persist` for source locations and
        // `abort_on_flow=true` so its FlowError aborts like the legacy engine.
        // NOTE: keep this behind an explicit flag until differential parity holds
        // for the benchmark set; DynaJS model coverage is still evolving.
        const analysisPath: Path = useDynajsEngine
            ? Path.relParentDir(['../src/vendor/NodeMedicAnalysis.mjs'])
            : Path.relParentDir(['../src/rewrite_dynajs.js']);
        const dynajsOptions = useDynajsEngine
            ? `--analysis ${analysisPath.toString()} --pos persist${packageRoot ? ` --include ${packageRoot.toString()}` : ''}`
            : `--analysis ${analysisPath.toString()}`;
        const engineArgs = useDynajsEngine
            ? [...analysisArgs, 'abort_on_flow=true']
            : analysisArgs;
        return {
            backend: useDynajsEngine ? 'DynaJS/NodeMedicAnalysis' : 'DynaJS',
            process: new AsyncProcess(
                dynajs.bin.toString(),
                ['node', templatePath.toString()],
                timeoutLen,
                {
                    env: {
                        ...process.env,
                        DYNAJS_HOME: dynajs.home.toString(),
                        DYNAJS_OPTIONS: dynajsOptions,
                        NODEMEDIC_ANALYSIS_ARGS: JSON.stringify(engineArgs),
                        NODEMEDIC_FP_PATH: fpPath.toString(),
                    },
                }
            ),
        };
    }

    const jalangiPath: Path = Path.relParentDir(['../lib/jalangi2-babel/src/js/commands/jalangi.js']);
    const analysisPath: Path = Path.relParentDir(['../src/rewrite.js']);
    return {
        backend: 'Jalangi',
        process: new AsyncProcess(
            'node',
            [
                jalangiPath.toString(),
                '--inlineIID',
                '--inlineSource',
                '--analysis',
                analysisPath.toString(),
                templatePath.toString(),
                ...analysisArgs,
            ],
            timeoutLen,
            {
                env: {
                    ...process.env,
                    NODEMEDIC_FP_PATH: fpPath.toString(),
                },
            },
        ),
    };
}

export async function runAnalysis(
    templatePath: Path,
    policies: string,
    failOnOutputError: boolean,
    failOnNonZeroExit: boolean,
    context: Context,
    analysisTimeBudget: number,
    useDynajs: boolean,
    useDynajsEngine: boolean
): Promise<Result<Path, BaseError>> {
    const timeoutLen = (analysisTimeBudget + 20) * 1000;
    const analysisArgs = [
        'log_level=error',
        'taint_paths=true',
        'taint_paths_json=true',
    ];
    if (policies !== '') {
        analysisArgs.push(`policies=${policies}`);
    }


    const packageSafeName: string = getSafeNameFromPackageName(context.getProperty('thePackage').name());
    const packageOutputDir: Path = context.getProperty('outputDir').extend([packageSafeName]);
    
    const instrumentationRun = buildInstrumentationProcess(
        templatePath,
        analysisArgs,
        timeoutLen,
        useDynajs,
        useDynajsEngine,
        context.getProperty('thePackage').path(),
    );
    const analysisProc = instrumentationRun.process;
    logger.debug(`Running ${instrumentationRun.backend} analysis: ${analysisProc.cmd()} ${analysisProc.args().join(" ")}`);
    try {
        await analysisProc.run();

        if (failOnNonZeroExit && !analysisProc.exitZero()) {
            return Result.Failure(new ProcessError(analysisProc.status(), analysisProc.output()));
        }
        if (failOnOutputError && analysisProc.outputHasError().orDefault(false)) {
            return Result.Failure(new ProcessOutputError(analysisProc.output()));
        }

    } catch (err) {
        if (failOnOutputError){
            return Result.Failure(new PipelineError(`Failed to execute analysis:\n${err}`));
        }
    }

    const batchInfoPath = packageOutputDir.extend([`batch${context.getProperty('curBatchNumber').toString()}`, 'batch_info.json']).toString();
    const confirmedFlows: EntryPoint[] = [];

    if (existsSync(batchInfoPath)) {
        const taintedFlows: EntryPoint[] = [];
        try{
            const content = readFileSync(batchInfoPath, "utf8");
            const lines = content.split("\n").filter(l => l.trim().length > 0);

            for (const line of lines) {
                const obj = JSON.parse(line);
                // assume obj.flow is one EntryPoint
                taintedFlows.push(obj.flow as EntryPoint);
            }

            if (taintedFlows.length === 0) {
                return Result.Failure(new ResultError("No tainted flows found"));
            }

            /*// Retrieve tainted flows from the 1st stage
            const batchInfo = readFileSync(batchInfoPath, 'utf8')
            taintedFlows = JSON.parse(batchInfo)['tainted_flows'] as EntryPoint[];*/
        } catch (err){
            return Result.Failure(new ResultError(`Error reading or parsing batch information file:\n${err.message}`));
        }

        // Loop through all tainted flows
        for (const flow of taintedFlows) {
            // Add the confirmed flow to the list
            confirmedFlows.push(flow);
        }
    }

    else if (analysisProc.timeout()) {
        return Result.Failure(new ProcessTimeoutError(timeoutLen, analysisProc.output()));
    } 
    else {
        return Result.Failure(new ResultError(`Batch information file not found after instrumented run: ${batchInfoPath}`));
    }

    if (confirmedFlows.length === 0) {
        return Result.Failure(new ResultError('No confirmed tainted flows found'));
    }

    var final_flows = rankFlowsByDiversityThenExploitability(confirmedFlows); // Sort by exploitability metric and diversity

    // Update context with the validated tainted flows
    context.setProperty("curBatchConfirmedFlows", final_flows);
    return Result.Success(null);
}

export async function run2ndStageDriver(
    thePackage: PackageData,
    context: Context,
    packageOutputDir: Path,
    flow: EntryPoint,
    useHoneyObjects: boolean,
    policies: string,
    useDynajs: boolean,
    useDynajsEngine: boolean,
): Promise<Result<Path, BaseError>> {

    // Runs 2nd driver against a specific flow
    var vulnerable_entrypoint = flow.entrypointIndex;
    var payload = flow.input;

    console.log("Vulnerable entrypoint:", vulnerable_entrypoint);
    console.log("Found the following input that causes a flow:", payload);
    console.log("EV:", flow.exploitability_vals);
    context.setProperty('target_entrypoint', vulnerable_entrypoint);
    context.setProperty('input', eval(payload));

    var template;
    var modes = ["normal"];
    if (context.getProperty('convertPotentialToString')) {
        const requestedMode = context.getProperty('secondStageMode') || "converted";
        modes = requestedMode == "normal" ? ["normal"] : ["converted", "normal"];
    }

    const packageSafeName: string = getSafeNameFromPackageName(thePackage.name());

    const secondTemplateDir: Path = packageOutputDir.extend([`batch${context.getProperty('curBatchNumber').toString()}`, flow.functionName]);
    const secondTemplatePath: Path = secondTemplateDir.extend([`run-${packageSafeName}2.js`]);

    const taintJSONPath: Path = Path.relCwd(['taint_0.json']);
    const taintPDFPath: Path = Path.relCwd(['taint_0.pdf']);

    var found = false;

    for (var j = 0; j < modes.length; j++){
        if (found) break;
        var mode = modes[j];
        for (let i = 0; i < context.getProperty('input').length; i++) {

            var payload_to_inject = context.getProperty('input');
            if (mode == "converted"){
                payload_to_inject = new Array(payload_to_inject.length).fill("'.'");
            }

            template = package2ndStageDriverTemplate(thePackage.path().toString(), thePackage.entryPoints()[vulnerable_entrypoint], payload_to_inject, i, mode);
            try {
                await fs.writeFile(secondTemplatePath.toString(), template)
            } catch (err) {
                console.log(err);
                return Result.Failure(new PipelineError(`Failed to write template to ${secondTemplatePath.toString()}; ${err}`));
            }

            // Remove any pre-existing taint_0.json before this run so the
            // existence poll below only succeeds on a FRESH write. The new
            // (DynaJS FlowAnalysis) engine writes taint_0.json to CWD during the
            // FIRST stage (taint_paths_json + abort_on_flow); without this unlink
            // the second-stage poll false-positives on that stale first-stage
            // file at i=0, never advancing to the argument that actually flows,
            // and synthesis then consumes object-valued first-stage provenance.
            await fs.rm(taintJSONPath.toString(), { force: true });

            // Second stage run
            const timeoutLen = 1 * 60e3;
            const secondStageAnalysisArgs = [
                'log_level=error',
                'taint_paths=true',
                'taint_paths_json=true',
            ];
            if (useHoneyObjects) {
                secondStageAnalysisArgs.push('honeyobjects=true');
            }
            if (policies !== '') {
                secondStageAnalysisArgs.push(`policies=${policies}`);
            }
            
            const instrumentationRun = buildInstrumentationProcess(
                secondTemplatePath,
                secondStageAnalysisArgs,
                timeoutLen,
                useDynajs,
                useDynajsEngine,
                thePackage.path(),
            );
            const analysisProc = instrumentationRun.process;
            logger.debug(`Running 2nd stage ${instrumentationRun.backend} analysis: ${analysisProc.cmd()} ${analysisProc.args().join(" ")}`);
            try {
                await analysisProc.run();
            } catch (err) {

                // Its possible that one of the drivers fail but other does not
                //return Result.Failure(new PipelineError(`Failed to execute analysis:\n${err}`));
            }
            if (analysisProc.timeout()) {
                // Its possible that one of the drivers timeouts but other does not
                // return Result.Failure(new ProcessTimeoutError(timeoutLen, analysisProc.output()));
            }

            // Poll for file creation (check immediately, then every 100ms, stop after 2000ms)
            const timeoutMs = 2000;
            const intervalMs = 100;
            const start = Date.now();

            while (Date.now() - start < timeoutMs) {
                try {
                    await fs.access(taintJSONPath.toString());
                    context.setProperty('taint_arg', i);
                    console.log("You have to taint argument number", i, "of the vulnerable entrypoint");
                    context.setProperty('input', payload_to_inject);
                    context.setProperty('secondStageMode', mode);
                    found = true;
                    break;
                } catch (err) {
                    // not present yet — wait one window before rechecking
                    await delay(intervalMs);
                }
            }
            if (found) break;
        }
    }
    const newTaintJSONPath: Path = secondTemplateDir.extend(['taint_0.json']);
    try {
        await fs.access(taintJSONPath.toString());
    } catch (err) {
        return Result.Failure(new ResultError(`Taint path JSON output not found:\n${err.message}`));
    }
    try {
        await fs.copyFile(
            taintJSONPath.toString(),
            newTaintJSONPath.toString(),
        );
        await fs.unlink(taintJSONPath.toString());
        logger.debug(`Taint path JSON output moved from ${taintJSONPath.toString()} to ${newTaintJSONPath.toString()}`);
    } catch (err) {
        return Result.Failure(new PipelineError(`Failed to move taint JSON output: ${err.message}`));
    }
    const newTaintPDFPath: Path = secondTemplateDir.extend(['taint_0.pdf']);
    if (await taintPDFPath.exists()) {
        try {
            await fs.copyFile(
                taintPDFPath.toString(),
                newTaintPDFPath.toString(),
            );
            await fs.unlink(taintPDFPath.toString());
            logger.debug(`Taint path PDF output moved from ${taintPDFPath.toString()} to ${newTaintPDFPath.toString()}`);
        } catch (err) {
            return Result.Failure(new PipelineError(`Failed to move taint PDF output: ${err.message}`));
        }
    }

    return Result.Success(null);

}

export async function runNonInst(
    templatePath: Path,
    failOnOutputError: boolean,
    failOnNonZeroExit: boolean,
): Promise<Result<null, BaseError>> {
    const absTemplatePath: Path = Path.relParentDir([templatePath.toString()]);
    const cmd = 'node';
    const args = [
        absTemplatePath.toString(),
    ];
    // Run with a timeout of 1 minute
    const timeoutLen = 1 * 60e3;

    logger.debug(`Running non-instrumentation step: ${cmd} ${args.join(" ")}`);
    const nonInstProc = new AsyncProcess(cmd, args, timeoutLen);
    try {
        await nonInstProc.run();
    } catch (err) {
        return Result.Failure(new PipelineError(`Failed to execute non-instrumentation step:\n${err}`));
    }
    const result = nonInstProc.checkResult();
    if (result.isFailure()) {
        const status = result.unwrap();
        if (status == ProcessStatus.Timeout) {
            return Result.Failure(new ProcessTimeoutError(timeoutLen, nonInstProc.output()));
        }
        if (failOnNonZeroExit) {
            return Result.Failure(new ProcessError(status, nonInstProc.output()));
        }
    }
    if (failOnOutputError && nonInstProc.outputHasError().orDefault(false)) {
        return Result.Failure(new ProcessOutputError(nonInstProc.output()));
    }
    return Result.Success(null);
}


export async function runJalangiBabel(
    templatePath: Path,
    requireSinkHit: boolean,
    failOnOutputError: boolean,
    failOnNonZeroExit: boolean,
): Promise<Result<Maybe<Array<string>>, BaseError>> {
    const absTemplatePath: Path = Path.relParentDir([templatePath.toString()]);
    const parentPath = path.dirname(absTemplatePath.toString());
    
    // Array of sink function names
    const sinks: string[] = ['eval', 'exec', 'execSync', 'Function', 'spawn', 'spawnSync', 'execFile', 'execFileSync', 'runInNewContext', 'runInThisContext', 'runInContext'];
    const PREFILTER_TIMEOUT = 5000;

    // Path to the x package directory
    const dirPath: string = process.argv[2];
    let all_calls: string[] = [];
    var num_traverses = 0;
    var start = Math.floor(new Date().getTime());    

    function timeout(start){
        var res = Math.floor(new Date().getTime());
        return res - start > PREFILTER_TIMEOUT;
      }
      
    // Define a function to recursively search for JavaScript files in a directory
    function findJsFiles(dirPath: string): string[] {
        let files: string[];
        try {
            files = readdirSync(dirPath);
        } catch (e) {
            return [];
        }
        let jsFiles: string[] = [];
    
        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = statSync(filePath);
        
            if (stat.isDirectory()) {
                try{
                    jsFiles = jsFiles.concat(findJsFiles(filePath));
                }
                catch (e){
                }
            } else if (file.endsWith('.js')) {
                jsFiles.push(filePath);
            }
        }
    
        num_traverses++;
        if (num_traverses % 1000 == 0 && timeout(start)){
            throw new Error("Timeout when listing files");
        }
        return jsFiles;
    }
    
    // Define a function to search for sink function calls in a JavaScript file
    function searchFileForSinkCalls(filePath: string): boolean {
        // Read the file contents
        const fileContent: string = readFileSync(filePath, 'utf8');
    
        // Parse the code using esprima
        //console.log("Parsing", filePath);
        let ast: esprima.Program;
        try {
            ast = esprima.parseScript(fileContent);
        } catch (e) {
            //console.log("Error parsing", filePath);
            return false;
        }
    
        estraverse.traverse(ast, {
        enter: function (node: esprima.Node) {
            num_traverses++;
            if (num_traverses % 1000 == 0 && timeout(start)){
                throw new Error("Timeout when traversing AST");
            }
            if (node.type === 'CallExpression' || node.type === 'NewExpression') {
            if (node.callee.type === 'MemberExpression') {
                if (sinks.includes(node.callee.property.name) && !all_calls.includes(node.callee.property.name)) {
                all_calls.push(node.callee.property.name);
                }
            }
            if (sinks.includes(node.callee.name) && !all_calls.includes(node.callee.name)) {
                all_calls.push(node.callee.name);
            }
            }
        },
        });
    
        return false;
    }
  
    try{
        // Find all JavaScript files in the x package directory and its subdirectories
        const jsFiles: string[] = findJsFiles(parentPath);
            
        // Search each JavaScript file for sink function calls
        for (const filePath of jsFiles) {
            searchFileForSinkCalls(filePath);
        }

        // Output the result
        if (all_calls.length == 0 && requireSinkHit) {
            console.log("No sink hit");
            return Result.Failure(new ResultError('No sink hit'));
        } else {
            let sinksHit: Set<string> = new Set();
            if (all_calls.includes('Function') || all_calls.includes('function')){
                sinksHit.add('function');
            }
            if (all_calls.includes('exec') || all_calls.includes('execSync') || all_calls.includes('execFile') || all_calls.includes('execFileSync')){
                sinksHit.add('execSync');
            }
            if (all_calls.includes('eval') || all_calls.includes('runInNewContext') || all_calls.includes('runInContext') || all_calls.includes('runInThisContext')) {
                sinksHit.add('eval');
            }
            if (all_calls.includes('spawn') || all_calls.includes('spawnSync')){
                sinksHit.add('spawn');
            }

            return Result.Success(Maybe.Just(Array.from(sinksHit)));
        }
    }
    catch (e){
        // Fallback when it timesout
        var contains_child_process2 = execSync(`grep -r --exclude-dir=test "require('child_process')" ${parentPath} || true`).length;
        var contains_child_process = contains_child_process2 + execSync(`grep --no-filename -o -r --exclude-dir=test 'require("child_process")' ${parentPath} || true`).length;
        var contains_exec = execSync(`grep --no-filename -o -r --exclude-dir=test "exec" ${parentPath} || true`).length;
        var contains_spawn = execSync(`grep --no-filename -o -r --exclude-dir=test "spawn" ${parentPath} || true`).length;
        var contains_eval = execSync(`grep --no-filename -o -r --exclude-dir=test "eval(" ${parentPath} || true`).length;
        var contains_function = execSync(`grep --no-filename -o -r --exclude-dir=test "Function(" ${parentPath} || true`).length;
        var contains_vm1 = execSync(`grep --no-filename -o -r --exclude-dir=test "runInNewContext(" ${parentPath} || true`).length;
        var contains_vm2 = execSync(`grep --no-filename -o -r --exclude-dir=test "runInContext(" ${parentPath} || true`).length;
        var contains_vm3 = execSync(`grep --no-filename -o -r --exclude-dir=test "runInThisContext(" ${parentPath} || true`).length;
        var sinkHit = false;

        var execSink = false;
        var spawnSink = false;
        var evalSink = false;
        var functionSink = false;

        execSink = contains_child_process > 0 && contains_exec > 0;
        spawnSink = contains_child_process > 0 && contains_spawn > 0;
        evalSink = contains_eval > 0 || contains_vm1 > 0 || contains_vm2 > 0 || contains_vm3 > 0;
        functionSink = contains_function > 0;

        sinkHit = execSink || spawnSink || evalSink || functionSink;
        
        console.log("Needed alternative pre-filtering because of timeout", contains_child_process, contains_exec);

        if (!sinkHit && requireSinkHit){
            console.log("No sink hit");
            return Result.Failure(new ResultError('No sink hit'));
        }
        else{
            let sinksHit: Set<string> = new Set();
            if (sinkHit){
                if (execSink)
                    sinksHit.add('execSync');
                if (spawnSink)
                    sinksHit.add('spawn');
                if (evalSink)
                    sinksHit.add('eval');
                if (functionSink)
                    sinksHit.add('function');
            }
            return Result.Success(Maybe.Just(Array.from(sinksHit)));
        }
    }
}


export async function getPackageEntryPoints(
    thePackage: PackageData,
    tmpDir: Path,
): Promise<Result<EntryPoint[], BaseError>> {

    let safeName = getSafeNameFromPackageName(thePackage.name());
    const tempFileName: string = `tmp-${safeName}.js`;
    let helperPath: Path = tmpDir.extend([tempFileName]);
    // We encapsulate this in a subprocess so that importing
    // the package cannot cause the overall pipeline to crash
    let helperCode: string;
    try {
        helperCode = await fs.readFile(
            Path.relDir(['getEntryPoints.ts']).toString(),
            'utf8'
        );
        helperCode = helperCode.replace(
            `const PACKAGE_PATH = "";`,
            `const PACKAGE_PATH = "${thePackage.path().toString()}";`
        );
        await fs.writeFile(helperPath.toString(), helperCode);
    } catch (err) {
        return Result.Failure(new PipelineError(`Failed to create getEntryPoints driver: ${err}`));
    }
    // Execute the above driver with a timeout of 1 minute
    const timeoutLen = 60e3;
    const getEntryPointsProc = new AsyncProcess(
        'node',
        [helperPath.toString()],
        timeoutLen,
    );
    logger.debug(`Running getEntryPoints driver: ${getEntryPointsProc.cmd()} ${getEntryPointsProc.args()}`);
    try {
        await getEntryPointsProc.run();
    } catch (err) {
        return Result.Failure(new PipelineError(`Failed to execute getEntryPoints driver:\n${err}`));
    } finally {
        // clear the temp file
        await fs.unlink(helperPath.toString());
    }
    const result = getEntryPointsProc.checkResult();
    if (result.isFailure()) {
        const status = result.unwrap();
        if (status == ProcessStatus.Timeout) {
            return Result.Failure(new ProcessTimeoutError(timeoutLen, getEntryPointsProc.output()));
        }
        return Result.Failure(new ProcessError(status, getEntryPointsProc.output()));
    } else {
        let entryPointsStr = getEntryPointsProc.output();
        entryPointsStr = entryPointsStr.split('----- ENTRYPOINTS -----')[1];
        entryPointsStr = entryPointsStr.split('-----------------------')[0];
        let entryPoints: EntryPoint[] = JSON.parse(entryPointsStr);
        return Result.Success(entryPoints);
    }
}

function package2ndStageDriverTemplate(
    packagePath: string,
    entryPoint: EntryPoint,
    payloads: string,
    taint_arg: number,
    mode: string
): string {
    var driver = "";
    driver += `// JALANGI DRIVER
    
process.backup_exit = process.exit;
process.exit = function(){console.log("Tried calling process.exit")};
var PUT = require('${packagePath}');
`
    const { functionName, numArguments, isMethod, isConstructor, fromConstructor } = entryPoint;
    
    for (let i = 0; i < numArguments; i++){
        const val = payloads[i];
        if (mode === "converted") {
            driver += `var x${i} = ${JSON.stringify(val)};\n`;
        } else {
            driver += `var x${i} = ${val};\n`;
        }
    }
    driver += `__jalangi_set_taint__(x${taint_arg});\n`;

    let argString = '';
    for (let i = 0; i < numArguments; i++){
        if (i == numArguments-1)
            argString += `x${i}`;
        else
            argString += `x${i},`;
    }

    if (fromConstructor) {
        driver += `var put = new PUT();\nput${functionNameToAccessor(functionName)}(${argString});\n`;
    } else {
        let construct = '';
        if (isConstructor) {
            construct += 'new ';
        }
        if (isMethod) {
            driver += `${construct}PUT${functionNameToAccessor(functionName)}(${argString});\n`;
        } else {
            driver += `${construct}PUT(${argString});\n`;
        }
    }
    return driver;
}


function functionNameToAccessor(functionName: string): string {
    if (functionName.indexOf('.') == -1){
        return `["${functionName}"]`;
    } else {
        return functionName.split('.').map((e) => `["${e}"]`).join('');
    }
}


function packageDriverTemplate(
    instrumentation: Boolean,
    outputDir: Path,
    packagePath: string,
    entryPoints: EntryPoint[],
    preamble: string,
    max_iterations: number,
    seed: object[],
    use_object_reconstruction: Boolean,
    fuzz_strings_only: Boolean,
    mix_fuzz: Boolean,
    do_fuzzer_restarts: Boolean,
    processedEntryPoints: EntryPoint[],
    batchSize: number,
    use_em: string,
    analysisTimeBudget: number,
    fuzzer_prng: number
    
): string {

    var driver = "";

    var seen_entries = new Set();
    var processed_entries = new Set();
    
    processedEntryPoints.forEach(function({ functionName, numArguments, isMethod, isConstructor, fromConstructor }) {
        processed_entries.add(`${numArguments}_${functionName}_${isMethod}_${isConstructor}_${fromConstructor}`);
    });

    // Preamble
    driver += `// JALANGI DRIVER

process.backup_exit = process.exit;
process.exit = function(){console.log("Tried calling process.exit")};
    
var PUT = require('${packagePath}');
var fuzzer = require('exp-conf-fuzzer');
var fs = require('fs');

var last_tried_input = undefined; //Array of inputs
var last_tried_entrypoint = undefined; //Index of last tried entrypoint
var last_num_args = undefined;
var last_function_name = undefined; //String
var last_from_constructor = undefined; //Boolean
var last_is_method = undefined; //Boolean
var last_is_constructor = undefined; //Boolean

const entrypoints_with_potential_flows = []; // Entrypoint objects that have been selected for the current batch

const batch_size = ${batchSize}; // How many potential flows before we stop this analysis and start exploiting
const available_entrypoints = ${entryPoints.length - processedEntryPoints.length};

var rounds = 0;
const max_rounds = ${max_iterations};

// Dummy functions. Real implementation is in our taint infra

${instrumentation ? `function __fuzzer_get_trace_properties__(e){
	return e;
}

function __fuzzer__reset_state__(){
	return [];
}

function __set_taint_flow_path__(e){
}
` : `function __fuzzer_get_trace_properties__(_e){
	return {
        called_sink: "",
        triggers_flow: 0,
        prefix_ace: "",
        provenance_complexity: 0,
        attacker_controlled_data: "",
        branches: new Set(),
        global_branches: new Set(),
        code_coverage: 0,
        global_code_coverage: 0,
        accessed_attrs: []
    };
}

function __fuzzer__reset_state__(){
	return [];
}

function __set_taint_flow_path__(e){
}

function __jalangi_set_taint__(_e){
    throw { found_flow: true };
}

function __jalangi_clear_taint__(_e){
}
`}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var start_time = new Date().getTime();
var current_time = new Date().getTime();
var elapsed = current_time - start_time;
const TIMEOUT = ${analysisTimeBudget*1000}; // ms

var mode = 'normal';
var num_entryPoints = ${entryPoints.length.toString()};
var use_em = "${use_em}";
var fuzzer_prng = ${fuzzer_prng};

function get_fuzzer(obj_rec, gen_strings_only){

    var res = new fuzzer.Fuzzer(num_entryPoints, obj_rec, gen_strings_only, use_em, fuzzer_prng);
    res.set_seed(\`` + JSON.stringify(seed) + `\`);`;

    // Now, we need to configure the number of arguments
    let setArgString = entryPoints
        .filter(function({ functionName, numArguments, isMethod, isConstructor, fromConstructor }) {
            let to_filter = (!seen_entries.has(`${numArguments}_${functionName}_${isMethod}_${isConstructor}_${fromConstructor}`)) && (!processed_entries.has(`${numArguments}_${functionName}_${isMethod}_${isConstructor}_${fromConstructor}`));
            seen_entries.add(`${numArguments}_${functionName}_${isMethod}_${isConstructor}_${fromConstructor}`);
            return to_filter && functionName !== 'constructor';
        }) 
        .map(function ({ functionName, numArguments, isMethod, isConstructor, fromConstructor }) {
            return `\tres.set_args("${numArguments}_${functionName}_${isMethod}_${isConstructor}_${fromConstructor}", ${numArguments});`;
        });
    
    driver += setArgString.join('\n') + `
    return res;
};

var fuzz = get_fuzzer(` + (mix_fuzz? false : use_object_reconstruction) + ', ' + (mix_fuzz? true : fuzz_strings_only) + `);

// Report the selected entry points of the batch and save results as batch_info.json
function report_batch_info(flow){
    var stringified_flow = JSON.stringify({"flow": flow});
    fs.appendFileSync("${outputDir}/batch_info.json", stringified_flow + "\\n");
}

function report_vuln(flow, functionName, isMethod, isConstructor, fromConstructor){
    var entrypoint = last_num_args+"_"+functionName+"_"+isMethod+"_"+isConstructor+"_"+fromConstructor;
    // spawned process stdout has max buffer size, so we write this to a file now
    //console.log("FUZZ - Last tried entrypoint:", last_tried_entrypoint);
    //console.log("FUZZ - Last tried input:", fuzzer.get_representation(last_tried_input));
    //console.log("FUZZ - Fuzzer specs used: [", fuzz.get_specs(entrypoint).join(","), "]");
    fs.mkdirSync("${outputDir}"+"/"+functionName, { recursive: true });
    fuzz.save_results("${outputDir}"+"/"+functionName+"/fuzzer_progress.json", "${outputDir}"+"/"+functionName+"/fuzzer_results.json", last_tried_entrypoint, last_tried_input, entrypoint, mode);
    report_batch_info(flow);
}


function has_potential_flow(entrypointId){
    return false;
    /* Now, we leave it to the fuzzer to find better potential flows
    for (var i = 0; i < entrypoints_with_potential_flows.length; i++){
        p = entrypoints_with_potential_flows[i];
        if (p["numArguments"] + "_" + p["functionName"] + "_" + p["isMethod"] + "_" + p["isConstructor"] + "_" + p["fromConstructor"] == entrypointId){
            return true;
        }
    }
    return false;
    */
}

async function driver(){

    __set_taint_flow_path__("disabled");
    while (rounds != max_rounds && elapsed < TIMEOUT  && entrypoints_with_potential_flows.length < batch_size){\n\trounds += 1;\n`;
    if (mix_fuzz){
        driver += `
        if (elapsed > 30000 && mode == 'normal'){
            mode = 'all_types';
            fuzz = get_fuzzer(num_entryPoints, false, false);
        }
        else if (elapsed > 60000 && mode == 'all_types'){
            mode = 'with_obj_reconstruction';
            fuzz = get_fuzzer(num_entryPoints, true, false);
        }`;
    }
    else if (do_fuzzer_restarts){
        driver += `
        if (elapsed > 30000 && mode == 'normal'){
            mode = 'all_types';
            fuzz = get_fuzzer(num_entryPoints, ${use_object_reconstruction}, ${fuzz_strings_only});
            fuzz.set_prng_seed(1301);
        }
        else if (elapsed > 60000 && mode == 'all_types'){
            mode = 'with_obj_reconstruction';
            fuzz = get_fuzzer(num_entryPoints, ${use_object_reconstruction}, ${fuzz_strings_only});
            fuzz.set_prng_seed(1303);
        }`;
    }

    driver += `\n\tfuzzer_selected = fuzz.select_entrypoint(elapsed, TIMEOUT);\n`
    // Finally, we need to do the try-catch part
    seen_entries.clear();

    var map_entrypoints_to_id : Map<string, number> = new Map<string, number>();

    var entrypoint_id = 0;
    for (var x of entryPoints){

        map_entrypoints_to_id.set(`${x.numArguments}_${x.functionName}_${x.isMethod}_${x.isConstructor}_${x.fromConstructor}`, entrypoint_id);
        entrypoint_id++;
    } 

    let tryCatchPart = entryPoints
        .filter(function({ functionName, numArguments, isMethod, isConstructor, fromConstructor }) {
            let to_filter = (!seen_entries.has(`${numArguments}_${functionName}_${isMethod}_${isConstructor}_${fromConstructor}`)) && (!processed_entries.has(`${numArguments}_${functionName}_${isMethod}_${isConstructor}_${fromConstructor}`));
            seen_entries.add(`${numArguments}_${functionName}_${isMethod}_${isConstructor}_${fromConstructor}`);
            return to_filter && functionName !== 'constructor' && numArguments > 0;
        })
        .map(function ({ functionName, numArguments, isMethod, isConstructor, fromConstructor }) {
            var tryPart = "";
            var finallyPart = "";
            let argString = '';
            tryPart += `\t\t\tlast_tried_input = [];\n`;
            var unique_id = `${numArguments}_${functionName}_${isMethod}_${isConstructor}_${fromConstructor}`;
            tryPart += `\t\t\tlast_tried_entrypoint = ${map_entrypoints_to_id.get(unique_id)};\n`;
            tryPart += `\t\t\tlast_function_name = "${functionName}";\n`;
            tryPart += `\t\t\tlast_num_args = ${numArguments};\n`;
            tryPart += `\t\t\tlast_is_method = ${isMethod};\n`;
            tryPart += `\t\t\tlast_is_constructor = ${isConstructor};\n`;
            tryPart += `\t\t\tlast_from_constructor = ${fromConstructor};\n`;
            for (let i = 0; i < numArguments; i++){
                tryPart += `\t\t\tvar x${i} = fuzz.get_input("${unique_id}", ${i});\n`;
                tryPart += `\t\t\tlast_tried_input.push(x${i});\n`

                if (i == numArguments-1)
                    argString += `x${i}`;
                else
                    argString += `x${i},`;
            }
            tryPart += `\t\t\tlast_tried_input = fuzzer.get_representation(last_tried_input);\n`;

            for (let i = 0; i < numArguments; i++){
                tryPart += `\t\t\t__jalangi_set_taint__(x${i});\n`;
            }

            tryPart += `\t\t\t__fuzzer__reset_state__();\n`;

            if (fromConstructor) {
                tryPart += `\t\t\tvar put = new PUT();\n\t\t\tput${functionNameToAccessor(functionName)}(${argString});\n`;
            } else {
                let construct = '\t\t\t';
                if (isConstructor) {
                    construct += 'new ';
                }
                if (isMethod) {
                    tryPart += `${construct}PUT${functionNameToAccessor(functionName)}(${argString});\n`;
                } else {
                    tryPart += `${construct}PUT(${argString});\n`;
                }
            }

            tryPart += '\t\t\tawait sleep(1);\n';
            finallyPart += `\t\t\tvar trace_prop = __fuzzer_get_trace_properties__([]);\n`;
            
            for (let i = 0; i < numArguments; i++){
                finallyPart += `\t\t\tfuzz.feed_cov("${unique_id}", ${i}, trace_prop, x${i});\n`;
            }

            finallyPart += `\t\t\tfuzz.store_progress(trace_prop.global_code_coverage, current_time);\n`;
            finallyPart += `\t\t\t__fuzzer__reset_state__();\n`;
            finallyPart += `\t\t\tawait sleep(1);\n`;

            for (let i = 0; i < numArguments; i++){
                finallyPart += `\t\t\t__jalangi_clear_taint__(x${i});\n`
            }

            let catchPart = `catch (e) {
                if (e.found_flow){`;
                    
    
            if(instrumentation){
                catchPart += `
                    \t\tvar trace_prop = e.trace_prop;
                    \t\tvar em = fuzz.compute_exploitability_metric(trace_prop);
                    \t\tvar ev = fuzz.compute_exploitability_vals(trace_prop);
                    \t\tvar flow = {"fromConstructor": ${fromConstructor}, "isConstructor": ${isConstructor}, "isMethod": ${isMethod}, "numArguments": ${numArguments}, "functionName": "${functionName}", "entrypointIndex": last_tried_entrypoint, "input": last_tried_input, "exploitability_metric": em, "exploitability_vals": ev};
                    \t\tentrypoints_with_potential_flows.push(flow);
                    \t\treport_vuln(flow, last_function_name, last_is_method, last_is_constructor, last_from_constructor);
                    \t\tis_saved = true;
                    \t\tconst entry_point_str = "${unique_id}";`
            }
            else{
                catchPart += `
                    \t\tbreak;`
            }
            catchPart += `\n\t}\n\t\t}`;
            return `\tif(fuzzer_selected === "${unique_id}" && (!has_potential_flow("${unique_id}"))){
            try {\n${tryPart}\t\t}\n
            ${catchPart}\n
            finally {\n${finallyPart}\t    }\n
        }\n`;
        });
    return driver + 
    tryCatchPart.join('\n') + `\n
    \tcurrent_time = new Date().getTime();
    \telapsed = current_time - start_time;\n
    \t}
    }\n
    process.on("uncaughtException", function(e){
        if (e.found_flow){
            var trace_prop = e.trace_prop;
            var em = fuzz.compute_exploitability_metric(trace_prop);
            var ev = fuzz.compute_exploitability_vals(trace_prop);
            var flow = {"fromConstructor": last_from_constructor, "isConstructor": last_is_constructor, "isMethod": last_is_method, "numArguments": last_num_args, "functionName": last_function_name, "entrypointIndex": last_tried_entrypoint, "input": last_tried_input, "exploitability_metric": em, "exploitability_vals": ev};
            entrypoints_with_potential_flows.push(flow);
            report_vuln(flow, last_function_name, last_is_method, last_is_constructor, last_from_constructor);
        } else {
            console.log("Uncatchable exception caught:", e);
        }
    });
    
    driver();`;
}



function packageDriverExploitConfirmationTemplate(
    packagePath: string,
    entryPoints: EntryPoint[],
    preamble: string,
    inputs: Array<string>
): string {
    // Preamble for the package driver
    let driverPreamble = `// JALANGI DRIVER
process.backup_exit = process.exit;
process.exit = function(){console.log("Tried calling process.exit")};
    
var PUT = require('${packagePath}');\n`;
    // Generate a harness for every entry point
    let harnessStrings = entryPoints
        .filter(function({ functionName, numArguments, isMethod, isConstructor, fromConstructor }) {
            return functionName !== 'constructor';
        })
        .map(function ({ functionName, numArguments, isMethod, isConstructor, fromConstructor }) {
            let argString = '';

            let tryPart: string = '';
            for (let i = 0; i < numArguments; i++){
                tryPart += `var x${i} = ${inputs[i]};\n`;

                if (i == numArguments-1)
                    argString += `x${i}`;
                else
                    argString += `x${i},`;
            }

            if (fromConstructor) {
                tryPart += `var put = new PUT();\n\tput${functionNameToAccessor(functionName)}(${argString})()`;
            } else {
                let construct = '';
                if (isConstructor) {
                    construct = 'new ';
                }
                if (isMethod) {
                    tryPart += `${construct}PUT${functionNameToAccessor(functionName)}(${argString})()`;
                } else {
                    tryPart += `${construct}PUT(${argString})()`;
                }
            }
            return `try {\n\t${tryPart};\n} catch (e) {\n\tconsole.log(e);\n}`;
        });
    let driver = driverPreamble + preamble + harnessStrings.join('\n');
    return driver;
}

export async function setupPackageDriver(
    thePackage: PackageData,
    instrumentation: Boolean,
    use_baseline: Boolean,
    outputDir: Path,
    use_object_reconstruction: Boolean,
    fuzz_strings_only: Boolean,
    mix_fuzz: Boolean,
    do_fuzzer_restarts: Boolean,
    processedEntryPoints: EntryPoint[],
    batchSize: number = 1,
    use_em: string,
    analysisTimeBudget: number,
    fuzzer_prng: number
): Promise<Result<Path, BaseError>> {
    logger.debug('Generating driver...');
    let taintedStringHarness = (instrumentation) ? '__jalangi_set_taint__(x);\n' : '';
    let suffix = (instrumentation) ? '' : '-non-inst';
    let template;
    var upper_bound_iterations = 1; // Generate a single input
    var default_spec = [{
        "id": "",
        "types": [
            "Object"
        ],
        "structure": {},
        "constraints": [],
        "concrete": {0: "0"}
    }];
    if (instrumentation && !use_baseline){
        upper_bound_iterations = -1; // Run fuzzer infinitely
        default_spec = [{
            "id": "",
            "types": [
                "Bot"
            ],
            "structure": {},
            "constraints": [],
            "concrete": null
        }];
    }
    template = packageDriverTemplate(instrumentation, outputDir, thePackage.path().toString(), thePackage.entryPoints(), taintedStringHarness, upper_bound_iterations, default_spec, use_object_reconstruction, fuzz_strings_only, mix_fuzz, do_fuzzer_restarts, processedEntryPoints, batchSize, use_em, analysisTimeBudget, fuzzer_prng);
    let safeName = getSafeNameFromPackageName(thePackage.name());

    let templatePath = outputDir.extend([`run-${safeName}${suffix}.js`]);
    try {
        await fs.mkdir(outputDir.toString(), { recursive: true });
        await fs.writeFile(templatePath.toString(), template)
    } catch (err) {
        return Result.Failure(new PipelineError(`Failed to write template to ${templatePath.toString()}; ${err}`));
    }
    return Result.Success(templatePath);
}


export async function setupPackageDependencies(
    packagePath: Path
): Promise<Result<null, BaseError>> {
    const timeoutLen = 5 * 60e3;
    if (packagePath.glob('node_modules').length > 0) {
        logger.debug('Package dependencies already installed; skipping...');
        return Result.Success(null);
    }
    const proc = new AsyncProcess(
        'npm',
        ['i'],
        timeoutLen,
        {
            cwd: packagePath.toString(),
        },
    );
    logger.debug(`Installing package dependencies: ${proc.cmd()} ${proc.args()} ${packagePath.toString()}`);
    try {
        await proc.run();
    } catch (err) {
        return Result.Failure(new PipelineError(`Failed to install package dependencies: ${err.message}`));
    }
    const result = proc.checkResult();
    if (result.isFailure()) {
        const status = result.unwrap();
        if (status == ProcessStatus.Timeout) {
            return Result.Failure(new ProcessTimeoutError(timeoutLen, proc.output()));
        }
        return Result.Failure(new ProcessError(status, proc.output()));
    }
    return Result.Success(null);
}


export async function setupPackageEnv(
    packageName: string,
    packageVersion: string,
    packageDir: Path
): Promise<Result<Path, BaseError>> {
    let fullPath = new Path([packageDir.toString(), packageName, 'node_modules', packageName]);
    try {
        if (!(await packageDir.exists())) {
            // Create the packages directory
            await fs.mkdir(packageDir.toString());
        }
        if (await fullPath.exists()) {
            logger.debug('Package already exists, skipping...');
            return Result.Success(fullPath);
        } 
        else {
            await fs.mkdir(fullPath.toString(), { recursive: true });

            const resolved = await pacote.resolve(`${packageName}@${packageVersion}`);
            logger.debug(`Downloading package ${resolved}...`);
            const from = await pacote.extract(resolved, fullPath.toString());
            logger.debug(`Extracted package ${packageName}@${packageVersion} from ${from}`);
            
            return Result.Success(fullPath);;
        }
    } catch (err) {
        return Result.Failure(new PipelineError(`Encountered error in package setup: ${err}`));
    }
}


async function getManifestDependencies(
    manifestPath: Path,
    includeDev?: boolean,
): Promise<Set<string>> {
    // By default we do not include devDependencies
    if (includeDev === undefined) {
        includeDev = false;
    }
    if (!(await manifestPath.exists())) {
        return new Set();
    }
    const manifest = JSON.parse(await fs.readFile(manifestPath.toString(), 'utf8'));
    let deps: Set<string> = new Set();
    if ('dependencies' in manifest) {
        for (const dep of Object.keys(manifest['dependencies'])) {
            deps.add(dep);
        }
    }
    if (includeDev && 'devDependencies' in manifest) {
        for (const dep of Object.keys(manifest['devDependencies'])) {
            deps.add(dep);
        }
    }
    return deps;
}


function difference<T>(setA: Set<T>, setB: Set<T>): Set<T> {
    let _difference = new Set(setA);
    setB.forEach(function (elem) {
        _difference.delete(elem);
    });
    return _difference;
}


async function getJSFiles(
    packagePath: Path,
    packageName: string
): Promise<Set<string>> {

    let safeName = getSafeNameFromPackageName(packageName);
    const includeFiles: Set<string> = new Set();
    const jsFiles = packagePath.glob('**/*.js');
    for (const path of jsFiles) {
        const maybeIsDir = await path.isDir();
        if (!maybeIsDir.isNothing() && !maybeIsDir.unwrap()) {
            includeFiles.add(path.toString());
        }
    }
    const excludeFiles: Set<string> = new Set();
    packagePath.glob('**/node_modules/**/*.js').forEach(function (path: Path) {
        excludeFiles.add(path.toString());
    });
    const jalangiFiles: Set<string> = new Set();
    packagePath.glob('**/*_jalangi_.js').forEach(function (path: Path) {
        jalangiFiles.add(path.toString());
    });
    const driverFiles: Set<string> = new Set([
        packagePath.extend([`run-${safeName}.js`]).toString(),
        packagePath.extend([`run-${safeName}-non-inst.js`]).toString(),
    ]);
    let files: Set<string> = new Set(includeFiles);
    files = difference(files, excludeFiles);
    files = difference(files, jalangiFiles);
    files = difference(files, driverFiles);
    return files;
}


interface DependencyNode {
    parent: string,
    children: DependencyNode[],
    jsFiles: string[],
}


async function getDependencyTree(
    tree: DependencyNode,
    nodeModulesPath: Path,
    packageName: string,
    root: boolean,
    includeDev?: boolean,
    _visited?: Set<string>,
) {

    if (includeDev === undefined) {
        includeDev = false;
    }
    if (_visited === undefined) {
        _visited = new Set();
    }
    const packagePath = root
        ? nodeModulesPath.dir()
        : nodeModulesPath.extend([packageName]);
    // Get package's JavaScript files
    tree['jsFiles'] = Array.from(await getJSFiles(packagePath, packageName));
    // Get dependencies from the manifest
    const manifestPath = packagePath.extend(['package.json']);
    const childDeps: string[] = Array.from(await getManifestDependencies(manifestPath, includeDev));
    // Check for internal node_modules folders
    const internalNodeModules: Path = packagePath.extend(['node_modules']);
    let internalDeps: string[] = [];
    if (!root && internalNodeModules.exists()) {
        internalDeps = internalNodeModules.glob('*').map(function(path: Path) { return path.base() });
    }
    for (const dep of childDeps) {
        // Recurse for each unvisited dependency
        if (internalDeps.includes(dep)) {
            const subtree: DependencyNode = {
                'parent': dep,
                'children': [],
                'jsFiles': [],
            }
            await getDependencyTree(
                subtree, internalNodeModules, dep, false, includeDev, _visited
            );
            tree['children'].push(subtree);
        } else {
            const uniqueDepName = nodeModulesPath.extend([dep]).toString();
            if (!_visited.has(uniqueDepName)) {
                _visited.add(uniqueDepName);
                const subtree: DependencyNode = {
                    'parent': dep,
                    'children': [],
                    'jsFiles': [],
                }
                await getDependencyTree(
                    subtree, nodeModulesPath, dep, false, includeDev, _visited
                );
                tree['children'].push(subtree);
            }
        }
    }
}


async function modifyNoInstrumentHeader(
    jsFilePath: Path,
    operation: string,
): Promise<Result<null, BaseError>> {
    // Carefully read the file
    if (!jsFilePath.exists()) {
        return Result.Failure(new PipelineError(`Cannot add header; file does not exist:${jsFilePath.toString()}`));
    }
    let jsFileData: string;
    try {
        jsFileData = await fs.readFile(jsFilePath.toString(), { encoding: 'utf8' });
    } catch (err) {
        return Result.Failure(new PipelineError(`Failed to read file:\n${err}`));
    }
    const noInstrumentHeader = '// JALANGI DO NOT INSTRUMENT\n';
    // Check if the header is already present
    let alreadyHasHeader = jsFileData.includes(noInstrumentHeader);
    // Modify the file according to the specified operation
    let newJSFileData: string = jsFileData;
    if (operation == 'add') {
        if (alreadyHasHeader) {
            // logger.debug(`No-instrument header already present for ${jsFilePath.toString()}`);
        } else {
            newJSFileData = `${noInstrumentHeader}${jsFileData}`;
        }
    } else if (operation == 'remove') {
        if (!alreadyHasHeader) {
            // logger.debug(`No-instrument header already not present for ${jsFilePath.toString()}`);
        } else {
            newJSFileData = jsFileData.replace(noInstrumentHeader, '');
        }
    } else {
        return Result.Failure(new PipelineError(`Unhandled operation: ${operation}`));
    }
    // Carefully write the file
    try {
        await fs.writeFile(jsFilePath.toString(), newJSFileData);
    } catch (err) {
        return Result.Failure(new PipelineError(`Cannot write file:\n${err}`));
    }
    return Result.Success(null);
}


async function walkDependencyTree(
    tree: DependencyNode,
    minDepth: number,
    fn: (tree: DependencyNode) => Promise<Result<any, BaseError>>,
    _depth?: number,
): Promise<Result<null, BaseError>> {
    if (_depth < 0) {
        return Result.Failure(new PipelineError(`Depth must be non-negative; depth: ${_depth}`));
    }
    if (_depth === undefined) {
        _depth = 0;
    }
    const applyFn =
        (minDepth == -1 && _depth > 0 && tree['children'].length == 0) // Only apply the function to leaf nodes
        || (minDepth != -1 && _depth >= minDepth); // Apply when the depth is met
    if (applyFn) {
        const result = await fn(tree);
        if (result.isFailure()) {
            return Result.Failure(result.unwrap() as BaseError);
        }
    }
    for (const child of tree['children']) {
        const childResult = await walkDependencyTree(child, minDepth, fn, _depth + 1);
        if (childResult.isFailure()) {
            return Result.Failure(childResult.unwrap() as BaseError);
        }
    }
    return Result.Success(null);
}


async function modifyTreeNoInstrument(
    tree: DependencyNode,
    minDepth: number,
    operation: string,
): Promise<Result<null, BaseError>> {
    return await walkDependencyTree(tree, minDepth, async function (tree: DependencyNode) {
        for (const file of tree['jsFiles']) {
            const result = await modifyNoInstrumentHeader(new Path([file]), operation);
            if (result.isFailure()) {
                return Result.Failure(result.unwrap() as BaseError);
            }
        }
        return Result.Success(null);
    });
}


async function getPackageSize(
    tree: DependencyNode,
): Promise<number> {
    let size = 0;
    for (const pathStr of tree.jsFiles) {
        const fileSize: Maybe<number> = await (new Path([pathStr])).size();
        if (!fileSize.isNothing()) {
            size = size + fileSize.unwrap();
        }
    }
    for (const child of tree['children']) {
        size = size + (await getPackageSize(child));
    }
    return size;
}


async function getPackageLineCount(
    tree: DependencyNode,
): Promise<number> {
    let size = 0;
    for (const pathStr of tree.jsFiles) {
        const proc = new AsyncProcess('wc', ['-l', pathStr], 10e3);
        await proc.run();
        const output = proc.output();
        if (output != '') {
            const loc = output.split(' ').filter((s) => s != '')[0];
            size = size + parseInt(loc);
        }
    }
    for (const child of tree['children']) {
        size = size + (await getPackageLineCount(child));
    }
    return size;
}


async function getTreeDepth(
    tree: DependencyNode,
): Promise<number> {
    let maxChildDepth = 0;
    for (const child of tree['children']) {
        const childDepth = 1 + (await getTreeDepth(child));
        if (childDepth > maxChildDepth) {
            maxChildDepth = childDepth;
        }
    }
    return maxChildDepth;
}


export async function annotateNoInstrument(
    thePackage: PackageData,
    minNumDeps: number,
    minDepth: number,
): Promise<Result<object, BaseError>> {
    const tree: DependencyNode = {
        'parent': thePackage.name(),
        'children': [],
        'jsFiles': [],
    };
    let _visited: Set<string> = new Set();
    await getDependencyTree(
        tree,
        thePackage.path().extend(['node_modules']),
        thePackage.name(),
        true,
        false, // Do not include developer dependencies
        _visited,
    );
    // Compute dependency tree statistics
    const numDeps = _visited.size + 1;
    let uniqueDeps: Set<string> = new Set();
    _visited.forEach(function(dep: string) {
        const path = new Path([dep]);
        const base = path.base();
        if (!uniqueDeps.has(base)) {
            uniqueDeps.add(base);
        }
    });
    const numUniqueDeps = uniqueDeps.size + 1;
    logger.debug(`The package has ${numDeps} dependencies. Unique: ${numUniqueDeps}`);
    // Calculate the package code size (in bytes)
    const packageSize = await getPackageSize(tree);
    logger.debug(`Package size: ${packageSize} bytes`);
    // Calculate the dependency tree depth
    const treeDepth = await getTreeDepth(tree);
    logger.debug(`Dependency tree depth: ${treeDepth}`);
    // Calculate package line count
    const lineCount = await getPackageLineCount(tree);
    logger.debug(`Package lines: ${lineCount}`);
    const treeMetadata = {
        'numDeps': numDeps,
        'numUniqueDeps': numUniqueDeps,
        'packageSize': packageSize,
        'treeDepth': treeDepth,
        'lineCount': lineCount,
    };
    // logger.debug(`Dependency tree: ${inspect(tree, false, 10)}`);
    // Removing existing headers from the package and all dependencies
    logger.debug('Removing existing no-instrument headers');
    const removeResult = await modifyTreeNoInstrument(tree, 0, 'remove');
    if (removeResult.isFailure()) {
        return Result.Failure(new PipelineError(`Failed to remove no-instrument headers: ${removeResult.unwrap() as BaseError}`));
    }
    // Add new no-instrument headers to every dependency
    // at the given depth if the heuristic is satisfied
    let heuristic: boolean;
    if (minNumDeps == -1) {
        heuristic = false;
    } else {
        heuristic = numDeps >= minNumDeps;
    }
    if (heuristic) {
        logger.debug('Heuristic satisfied; adding no-instrument header');
        const addResult = await modifyTreeNoInstrument(tree, minDepth, 'add');
        if (addResult.isFailure()) {
            return Result.Failure(new PipelineError(`Failed to add no-instrument headers: ${addResult.unwrap() as BaseError}`));
        }
    }
    return Result.Success(treeMetadata);
}
