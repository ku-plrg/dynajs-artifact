import { hrtime } from 'process';
import { Path, Bound, getSafeNameFromPackageName } from "./utilities";
import { Maybe, Result } from "./functional";
import { promises as fs, existsSync, rmdirSync, mkdirSync} from 'fs';
import {
    filterByAPIs, filterByMain, filterByDownloadCount,
    setupPackageEnv, setupPackageDependencies, setupPackageDriver,
    getPackageVersion, getPackageEntryPoints, runNonInst,
    runAnalysis, checkSinkType, inferenceAndSynthesis,
    checkExploit, annotateNoInstrument, runJalangiBabel,
    generateTrivialExploit, run2ndStageDriver,
} from "./actions";
import { Context, Task, TaskStatus, Pipeline } from "./pipeline";
import { PackageData, EntryPoint, ExploitResult, SinkType, SynthesisResult } from "./package";
import { BaseError, ResultError } from "./errors";


function completeTask(
    context: Context,
    task: Task,
    thePackage: PackageData,
    startTime: bigint, // nanoseconds
    status: TaskStatus = TaskStatus.Continue,
) {
    const elapsedTime = Number(
        (hrtime.bigint() - startTime) / BigInt(1e6) // milliseconds
    );
    const logger = context.getProperty('logger');
    logger.debug(`[Step][${task.name()}]: Complete`);
    thePackage.registerTaskResult(task.name(), {
        'status': TaskStatus.Continue.toString(),
        'time': elapsedTime,
    },
    ['setSinkType', 'trivialExploit', 'checkExploit', 'smt'].includes(task.name())); 
    task.setStatus(status);
    return context;
}


function abortTaskWithError(
    context: Context,
    task: Task,
    thePackage: PackageData,
    error: BaseError,
    startTime: bigint, // nanoseconds
) {
    const elapsedTime = Number(
        (hrtime.bigint() - startTime) / BigInt(1e6) // milliseconds
    );
    const logger = context.getProperty('logger');
    logger.debug(`[Step][${task.name()}]: ${error.toString()}`);
    thePackage.registerTaskResult(task.name(), {
        'status': TaskStatus.Abort.toString(),
        'time': elapsedTime,
        'result': error.toJSON(),
    },     ['setSinkType', 'trivialExploit', 'checkExploit', 'smt'].includes(task.name()));
    task.setStatus(TaskStatus.Abort);
    return context;
}


export function buildPipeline(logger): Pipeline {
    const pipeline = new Pipeline(
        [
            'downloadCount',
            'setupPackage',
            'filterByMain',
            'filterBrowserAPIs',
            'filterSinks',
            'runJalangiBabel',
            'setupDependencies',
            'getEntryPoints',
            'runNonInstrumented',
            'annotateNoInstrument',
            'runInstrumented',
            'setSinkType',
            'smt',
            'checkExploit',
        ],  
        logger
    );
    pipeline.registerTask(
        new Task(
            'downloadCount',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                logger.debug(`[Step][${this.name()}]: Check download count`);
                const targetDownloadCount: number = context.getProperty('targetDownloadCount');
                const thePackage: PackageData = context.getProperty('thePackage');
                const startTime = hrtime.bigint();
                if (targetDownloadCount > 0) {
                    const bound: Bound = context.getProperty('bound');
                    const outputDir: Path = context.getProperty('outputDir');
                    const result: Result<number, BaseError> = await filterByDownloadCount(
                        thePackage, targetDownloadCount, bound, outputDir
                    );
                    if (result.isFailure()) {
                        return abortTaskWithError(context, this, thePackage, result.unwrap() as BaseError, startTime);
                    }
                    thePackage.setDownloadCount(result.unwrap() as number);
                } else {
                    logger.debug(`[Step][${this.name()}]: Skipping check because target is 0`);
                }
                return completeTask(context, this, thePackage, startTime);
            },
        )
    );
    pipeline.registerTask(
        new Task(
            'setupPackage',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                const thePackage: PackageData = context.getProperty('thePackage');
                const cacheDir: Path = context.getProperty('cacheDir');

                logger.debug(`[Step][${this.name()}]: Setup package environment`);
                const startTime = hrtime.bigint();

                const packagePathResult = await setupPackageEnv(
                    thePackage.name(), thePackage.version(), cacheDir
                );

                if (packagePathResult.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, packagePathResult.unwrap() as BaseError, startTime);
                }
                const packagePath: Path = packagePathResult.unwrap() as Path;
                logger.debug(`Package path is: ${packagePath}`);
                thePackage.setPackagePath(packagePath);
                logger.debug(`[Step][${this.name()}]: Get and set package version`);
                const packageVersionResult = await getPackageVersion(
                    thePackage.path()
                );
                if (packageVersionResult.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, packageVersionResult.unwrap() as BaseError, startTime);
                }
                const packageVersion: string = packageVersionResult.unwrap() as string;
                thePackage.setVersion(packageVersion);
                return completeTask(context, this, thePackage, startTime);
            },
        )
    );
    pipeline.registerTask(
        new Task(
            'filterByMain',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                const thePackage: PackageData = context.getProperty('thePackage');
                logger.debug(`[Step][${this.name()}]: Check for main`);
                const startTime = hrtime.bigint();
                const result = await filterByMain(thePackage.path());
                if (result.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result.unwrap() as BaseError, startTime);
                }
                thePackage.setHasMain(true);
                return completeTask(context, this, thePackage, startTime);
            },
        )
    );
    pipeline.registerTask(
        new Task(
            'filterBrowserAPIs',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                const thePackage: PackageData = context.getProperty('thePackage');
                const browserAPIs: Array<string> = context.getProperty('browserAPIs');
                logger.debug(`[Step][${this.name()}]: Ensure no browser APIs are used`);
                const startTime = hrtime.bigint();
                const result: Result<Array<string>, BaseError> = await filterByAPIs(
                    thePackage.path(), browserAPIs
                );
                if (result.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result.unwrap() as BaseError, startTime);
                }
                const packageBrowserAPIs = result.unwrap() as Array<string>;
                thePackage.setBrowserAPIs(packageBrowserAPIs);
                if (packageBrowserAPIs.length > 0) {
                    return abortTaskWithError(context, this, thePackage, new ResultError(`Package has browser APIs: ${packageBrowserAPIs}`), startTime);
                }
                return completeTask(context, this, thePackage, startTime);
            },
        )
    );
    pipeline.registerTask(
        new Task(
            'filterSinks',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                const thePackage: PackageData = context.getProperty('thePackage');
                const sinks: Array<string> = context.getProperty('sinks');
                logger.debug(`[Step][${this.name()}]: Check for presence of sinks`);
                const startTime = hrtime.bigint();
                const result: Result<Array<string>, BaseError> = await filterByAPIs(
                    thePackage.path(), sinks
                );
                if (result.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result.unwrap() as BaseError, startTime);
                }
                const packageSinks = result.unwrap() as Array<string>;
                thePackage.setSinks(packageSinks);
                if (packageSinks.length == 0) {
                    return abortTaskWithError(context, this, thePackage, new ResultError('Package has no sinks'), startTime);
                }
                return completeTask(context, this, thePackage, startTime);
            },
        )
    );
    pipeline.registerTask(
        new Task(
            'runJalangiBabel',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                const thePackage: PackageData = context.getProperty('thePackage');
                const requireSinkHit: boolean = context.getProperty('requireSinkHit');
                const failOnOutputError: boolean = context.getProperty('failOnOutputError');
                const failOnNonZeroExit: boolean = context.getProperty('failOnNonZeroExit');
                logger.debug(`[Step][${this.name()}]: Setup Jalangi2-babel package driver`);
                const startTime = hrtime.bigint();
                const nonInstTemplatePath = thePackage.path().extend([`run-${getSafeNameFromPackageName(thePackage.name())}.js`]);

                logger.debug(`[Step][${this.name()}]: Run Jalangi2-babel package driver`);
                const result2: Result<Maybe<Array<string>>, BaseError> = await runJalangiBabel(
                    nonInstTemplatePath, requireSinkHit, failOnOutputError, failOnNonZeroExit,
                );
                if (result2.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result2.unwrap() as BaseError, startTime);
                }
                const maybeSinkHit: Maybe<Array<string>> = result2.unwrap() as Maybe<Array<string>>;
                logger.debug(`[Step][${this.name()}]: Sinks found: ${maybeSinkHit.orDefault([])}`);
                thePackage.setSinksHit(maybeSinkHit.orDefault([]));
                return completeTask(context, this, thePackage, startTime);
            },
        )
    );
    pipeline.registerTask(
        new Task(
            'setupDependencies',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                const thePackage: PackageData = context.getProperty('thePackage');
                logger.debug(`[Step][${this.name()}]: Setup package dependencies`);
                const startTime = hrtime.bigint();
                const result = await setupPackageDependencies(thePackage.path());
                if (result.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result.unwrap() as BaseError, startTime);
                }
                return completeTask(context, this, thePackage, startTime);
            },
        )
    );
    pipeline.registerTask(
        new Task(
            'getEntryPoints',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                const thePackage: PackageData = context.getProperty('thePackage');
                const tmpDir: Path = context.getProperty('tmpDir');
                logger.debug(`[Step][${this.name()}]: Get package entry points`);
                const startTime = hrtime.bigint();
                const result: Result<EntryPoint[], BaseError> = await getPackageEntryPoints(thePackage, tmpDir);
                if (result.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result.unwrap() as BaseError, startTime);
                }
                const entryPoints = result.unwrap() as EntryPoint[];
                thePackage.setEntryPoints(entryPoints);
                if (entryPoints.length == 0) {
                    return abortTaskWithError(context, this, thePackage, new ResultError('Package has no entry points'), startTime);
                }
                return completeTask(context, this, thePackage, startTime);
            },
        )
    );
    pipeline.registerTask(
        new Task(
            'runNonInstrumented',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                const thePackage: PackageData = context.getProperty('thePackage');
                const failOnOutputError: boolean = context.getProperty('failOnOutputError');
                const failOnNonZeroExit: boolean = context.getProperty('failOnNonZeroExit');
                const use_baseline : boolean = context.getProperty('baseline');
                const packageDir : Path = context.getProperty('outputDir').extend([getSafeNameFromPackageName(thePackage.name())]);
                const processedEntryPoints : EntryPoint[] = context.getProperty('processedEntryPoints');
                logger.debug(`[Step][${this.name()}]: Setup non-instrumented package driver`);
                const startTime = hrtime.bigint();
                const batchSize : number = context.getProperty('batchSize');
                const use_em: string = context.getProperty('fuzz_use_em');

                const analysisTimeBudget: number = context.getProperty('analysisTimeBudget');
                const fuzzer_prng: number = context.getProperty('fuzzer_prng');

                // Clean the package output directory
                if (existsSync(packageDir.toString())) {
                    rmdirSync(packageDir.toString(), { recursive: true });
                }
                mkdirSync(packageDir.toString());

                const result: Result<Path, BaseError> = await setupPackageDriver(thePackage, false, use_baseline, packageDir, false, false, false, false, processedEntryPoints, batchSize, use_em, analysisTimeBudget, fuzzer_prng);
                if (result.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result.unwrap() as BaseError, startTime);
                }
                const nonInstTemplatePath = result.unwrap() as Path;
                logger.debug(`[Step][${this.name()}]: Run non-instrumented package driver`);
                const result2 = await runNonInst(nonInstTemplatePath, failOnOutputError, failOnNonZeroExit);
                if (result2.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result2.unwrap() as BaseError, startTime);
                }
                return completeTask(context, this, thePackage, startTime);
            },
        )
    );
    pipeline.registerTask(
        new Task(
            'annotateNoInstrument',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                const thePackage: PackageData = context.getProperty('thePackage');
                const minNumDeps: number = context.getProperty('minNumDeps');
                const minDepth: number = context.getProperty('minDepth');
                logger.debug(`[Step][${this.name()}]: Annotate no-instrument`);
                const startTime = hrtime.bigint();
                const result: Result<object, BaseError> = await annotateNoInstrument(
                    thePackage, minNumDeps, minDepth
                );
                if (result.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result.unwrap() as BaseError, startTime);
                }
                thePackage.setTreeMetadata(result.unwrap());
                return completeTask(context, this, thePackage, startTime);
            }
        )
    );
    pipeline.registerTask(
        new Task(
            'runInstrumented',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                const thePackage: PackageData = context.getProperty('thePackage');
                const policies: string = context.getProperty('policies');
                const failOnOutputError: boolean = context.getProperty('failOnOutputError');
                const failOnNonZeroExit: boolean = context.getProperty('failOnNonZeroExit');
                const use_baseline : boolean = context.getProperty('baseline');
                const batchDir : Path = context.getProperty('outputDir').extend([getSafeNameFromPackageName(thePackage.name()), `batch${context.getProperty("curBatchNumber")}`]);
                const use_object_reconstruction : boolean = context.getProperty('fuzzer_object_reconstruction');
                const fuzz_strings_only : boolean = context.getProperty('fuzzStringsOnly');
                const mix_fuzz : boolean = context.getProperty('mixfuzz');
                const do_fuzzer_restarts : boolean = context.getProperty('fuzzRestart');
                const processedEntryPoints : EntryPoint[] = context.getProperty('processedEntryPoints');
                const batchSize : number = context.getProperty('batchSize');
                const use_em: string = context.getProperty('fuzz_use_em');
                const analysisTimeBudget: number = context.getProperty('analysisTimeBudget');
                const fuzzer_prng: number = context.getProperty('fuzzer_prng');
                const useDynajs: boolean = context.getProperty('dynajs');

                logger.debug(`[Step][${this.name()}]: Setup instrumented package driver`);
                const startTime = hrtime.bigint();
                const result: Result<Path, BaseError> = await setupPackageDriver(thePackage, true, use_baseline, batchDir, use_object_reconstruction, fuzz_strings_only, mix_fuzz, do_fuzzer_restarts, processedEntryPoints, batchSize, use_em, analysisTimeBudget, fuzzer_prng);
                if (result.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result.unwrap() as BaseError, startTime);
                }
                const templatePath = result.unwrap() as Path;
                logger.debug(`[Step][${this.name()}]: Run instrumented package driver`);
                const result2: Result<Path, BaseError> = await runAnalysis(
                    templatePath, policies, failOnOutputError, failOnNonZeroExit, context, analysisTimeBudget, useDynajs
                );
                if (result2.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result2.unwrap() as BaseError, startTime);
                }
                return completeTask(context, this, thePackage, startTime);
            },
        )
    );
    pipeline.registerTask(
        new Task(
            'setSinkType',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                // Choose the tainted flow to process
                const curBatchProgress: number = context.getProperty('curBatchProgress');
                const curBatchConfirmedFlows: EntryPoint[] = context.getProperty('curBatchConfirmedFlows');
                const flowToProcess: EntryPoint = curBatchConfirmedFlows[curBatchProgress];
                const thePackage: PackageData = context.getProperty('thePackage');
                const useHoneyObjects: boolean = context.getProperty('honeyobjects');
                const policies: string = context.getProperty('policies');
                const useDynajs: boolean = context.getProperty('dynajs');
                const packageSafeName: string = getSafeNameFromPackageName(thePackage.name());
                const packageOutputDir: Path = context.getProperty('outputDir').extend([packageSafeName]);

                const startTime = hrtime.bigint();
                thePackage.setEntryPoint(flowToProcess);

                const result: Result<Path, BaseError> = await run2ndStageDriver(thePackage, context, packageOutputDir, flowToProcess, useHoneyObjects, policies, useDynajs);
                if (result.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result.unwrap() as BaseError, startTime);
                }

                const taintJSONPath = context.getProperty('outputDir').extend([packageSafeName, `batch${context.getProperty("curBatchNumber")}`, flowToProcess.functionName, `taint_0.json`])
                context.setProperty('taintJSONPath', taintJSONPath);
                logger.debug(`[Step][${this.name()}]: Checking taint output for vulnerable sinks`);
                const result2: Result<SinkType, BaseError> = await checkSinkType(taintJSONPath);
                if (result2.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result2.unwrap() as BaseError, startTime);
                }
                thePackage.setBatchNumber(context.getProperty('curBatchNumber'));
                thePackage.setSinkType(result2.unwrap() as SinkType);
                return completeTask(context, this, thePackage, startTime);
            },
        )
    );
    pipeline.registerTask(
        new Task(
            'trivialExploit',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                const taintJSONPath = context.getProperty('taintJSONPath');
                const thePackage: PackageData = context.getProperty('thePackage');
                logger.debug(`[Step][${this.name()}]: Generating trivial exploit`);
                const startTime = hrtime.bigint();
                const sinkType = thePackage.sinkType();
                const result = generateTrivialExploit(sinkType);
                if (result.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result.unwrap() as BaseError, startTime);
                }
                const trivialExploit = result.unwrap() as string;
                thePackage.setCandidateExploit(trivialExploit);
                context.setProperty('abortOnExploitFailure', false);
                return completeTask(context, this, thePackage, startTime);
            },
        )
    );
    pipeline.registerTask(
        new Task(
            'smt',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                const taintJSONPath = context.getProperty('taintJSONPath');
                const thePackage: PackageData = context.getProperty('thePackage');
                const useHoneyObjects: boolean = context.getProperty('honeyobjects');
                const useInference: boolean = context.getProperty('inference');
                const useEnumerator: boolean = context.getProperty('enumerator');
                const useEnumeratorTemplates: boolean = context.getProperty('enumeratorTemplates');
                const polyglotACIPayload: boolean = context.getProperty('polyglotACIPayload');
                const polyglotACEPayload: boolean = context.getProperty('polyglotACEPayload');
                const stringOnlySynthesis: boolean = context.getProperty('stringOnlySynthesis');
                const solvingTime: number = context.getProperty('solvingTime');
                logger.debug(`[Step][${this.name()}]: Running inference and synthesis to generate exploit`);
                const startTime = hrtime.bigint();
                const result: Result<SynthesisResult, BaseError> = await inferenceAndSynthesis(
                    taintJSONPath,
                    useHoneyObjects,
                    useInference,
                    useEnumerator,
                    useEnumeratorTemplates,
                    polyglotACIPayload,
                    polyglotACEPayload,
                    stringOnlySynthesis,
                    solvingTime,
                );
                if (result.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, result.unwrap() as BaseError, startTime);
                
                }
                const synthesisResult = result.unwrap() as SynthesisResult;
                thePackage.setSynthesisResult(synthesisResult);
                thePackage.setCandidateExploit(synthesisResult.concretized);
                context.setProperty('abortOnExploitFailure', true);
                return completeTask(context, this, thePackage, startTime);
            },
        )
    );
    pipeline.registerTask(
        new Task(
            'checkExploit',
            async function (context: Context): Promise<Context> {
                const logger = context.getProperty('logger');
                const thePackage: PackageData = context.getProperty('thePackage');
                const failOnNonZeroExit: boolean = context.getProperty('failOnNonZeroExit');
                const input : Array<string> = context.getProperty('input');
                const target_entrypoint : string = context.getProperty('target_entrypoint');
                const outputDir : Path = context.getProperty('outputDir');
                logger.debug(`[Step][${this.name()}]: Checking generated exploit to confirm vulnerability`);
                const startTime = hrtime.bigint();
                const successfulExploitsResult: Result<ExploitResult[], BaseError> = await checkExploit(thePackage, failOnNonZeroExit, target_entrypoint, input, outputDir);
                if (successfulExploitsResult.isFailure()) {
                    return abortTaskWithError(context, this, thePackage, successfulExploitsResult.unwrap() as BaseError, startTime);
                }
                const successfulExploits = successfulExploitsResult.unwrap() as ExploitResult[];
                thePackage.setExploitResults(successfulExploits);
                if (context.getProperty('abortOnExploitFailure') && successfulExploits.length == 0) {
                    if (context.getProperty('convertPotentialToString') && context.getProperty('secondStageMode') == 'converted') {
                        logger.debug(`[Step][${this.name()}]: Converted-mode exploit confirmation failed; retrying current flow in normal mode`);
                        context.setProperty('secondStageMode', 'normal');
                        context.setProperty('retryCurrentFlow', true);
                    }
                    return abortTaskWithError(context, this, thePackage, new ResultError('Package has no confirmed exploits'), startTime);
                }
                let finalStatus = TaskStatus.Continue;
                if (successfulExploits.length > 0) {
                    logger.info(`\tExploit(s) found for functions: ${successfulExploits.map((x) => x.exploitFunction)}`);
                    context.setProperty('successfulExploits', context.getProperty('successfulExploits') + successfulExploits.length);
                    finalStatus = TaskStatus.Halt;
                }
                return completeTask(context, this, thePackage, startTime, finalStatus);
            },
        )
    );
    return pipeline;
}
