import { Maybe } from './functional';
import { logger, Path } from './utilities';


export enum SinkType {
    evalSink = 'eval',
    execSink = 'exec',
}


export interface EntryPoint {
    functionName: string,
    numArguments: number,
    isMethod: boolean,
    isConstructor: boolean,
    fromConstructor: boolean,
    input: string,
    entrypointIndex: number,
    exploitability_metric,
    exploitability_vals
}


export interface SynthesisResult {
    /*
    The following fields are used by the synthesis task:
    - smt_statement: The SMT statement attempted to solve
    - smt_solution: The SMT solution, if any
    - solving_time_sec: The time it took Z3 to solve (seconds)
    - abstract_value: The inferred abstract value (attacker-controlled input)
    - concretized: The concretized abstract value
    */
    smt_statement: string,
    smt_solution: object,
    solving_time_sec: number,
    abstract_value: object,
    concretized: Maybe<any>,
}


export interface ExploitResult {
    exploitFunction: string,
    exploitString: string,
}


export interface PackageResult {
    name: string,
    version: string,
    completed: boolean,
    results: ExploitResult[] | null,
    error: string | null,
}

export interface Flow {
    entryPoint: Maybe<EntryPoint>,
    batchNumber: Maybe<number>,
    sinkType: Maybe<SinkType>,
    synthesisResult: Maybe<SynthesisResult>,
    candidateExploit: Maybe<any>,
    exploitResults: Maybe<Array<ExploitResult>>,
}

export class PackageData {
    _name: string;
    _index: Maybe<number>;
    _version: Maybe<string>;
    _downloadCount: Maybe<number>;
    _packagePath: Maybe<Path>;
    _hasMain: Maybe<boolean>;
    _browserAPIs: Maybe<Array<string>>;
    _sinks: Maybe<Array<string>>;
    _sinksHit: Maybe<Array<string>>;
    _entryPoints: Maybe<Array<EntryPoint>>;
    _treeMetadata: Maybe<object>;
    _curFlow: Maybe<Flow>;
    _processedFlows: Array<Flow>;                                                                       
    _taskResults: Array<Record<string, Record<string, any> | string | Array<any>>>; // format: [{taskName: {...}}, {entryPoint: name, tasks: [{taskName: data}, ...], ...]
    constructor(name: string, version: Maybe<string>) {
        this._name = name;
        this._index = Maybe.Nothing();
        this._version = version;
        this._downloadCount = Maybe.Nothing();
        this._packagePath = Maybe.Nothing();
        this._hasMain = Maybe.Nothing();
        this._browserAPIs = Maybe.Nothing();
        this._sinks = Maybe.Nothing();
        this._sinksHit = Maybe.Nothing();
        this._entryPoints = Maybe.Nothing();
        this._treeMetadata = Maybe.Nothing();
        this._curFlow = Maybe.Nothing();
        this._processedFlows = [];
        this._taskResults = [];
    }
    identifier(): string {
        let version = '*';
        if (!this._version.isNothing()) {
            version = this._version.unwrap();
        }
        return `${this._name}@${version}`;
    }
    name(): string {
        return this._name;
    }
    version(): string {
        if (this._version.isNothing()) {
            return '*';
        } else {
            return this._version.unwrap();
        }
    }
    path(): Path {
        if (this._packagePath.isNothing()) {
            throw Error('Attempted to access unset package path');
        }
        return this._packagePath.unwrap();
    }
    entryPoints(): Array<EntryPoint> {
        if (this._entryPoints.isNothing()) {
            throw Error('Attempted to access unset entryPoints');
        }
        return this._entryPoints.unwrap();
    }
    sinkType(): SinkType {
        if (this._curFlow.isNothing() || this._curFlow.unwrap().sinkType.isNothing()) {
            throw Error('Attempted to access unset sinkType');
        }
        return this._curFlow.unwrap().sinkType.unwrap();
    }
    candidateExploit(): string {
        if (this._curFlow.isNothing() || this._curFlow.unwrap().candidateExploit.isNothing()) {
            throw Error('Attempted to access unset exploit');
        }
        return this._curFlow.unwrap().candidateExploit.unwrap();
    }
    setIndex(idx: number) {
        this._index = Maybe.Just(idx);
    }
    setVersion(versionStr: string) {
        this._version = Maybe.Just(versionStr);
    }
    setDownloadCount(count: number) {
        this._downloadCount = Maybe.Just(count);
    }
    setPackagePath(packagePath: Path) {
        this._packagePath = Maybe.Just(packagePath);
    }
    setHasMain(hasMain: boolean) {
        this._hasMain = Maybe.Just(hasMain);
    }
    setBrowserAPIs(browserAPIs: Array<string>) {
        this._browserAPIs = Maybe.Just(browserAPIs);
    }
    setSinks(sinks: Array<string>) {
        this._sinks = Maybe.Just(sinks);
    }
    setSinksHit(sinksHit: Array<string>) {
        this._sinksHit = Maybe.Just(sinksHit);
    }
    setEntryPoints(entryPoints: Array<EntryPoint>) {
        this._entryPoints = Maybe.Just(entryPoints);
    }
    setTreeMetadata(treeMetadata: object) {
        this._treeMetadata = Maybe.Just(treeMetadata);
    }
    initializeCurFlowIfEmpty(){
        if(this._curFlow.isNothing()){
            this._curFlow = Maybe.Just({
                entryPoint: Maybe.Nothing(),
                batchNumber: Maybe.Nothing(),
                sinkType: Maybe.Nothing(),
                synthesisResult: Maybe.Nothing(),
                candidateExploit: Maybe.Nothing(),
                exploitResults: Maybe.Nothing()
            });
        }
    }
    setEntryPoint(entryPoint: EntryPoint) {
        this.initializeCurFlowIfEmpty();
        this._curFlow.unwrap().entryPoint = Maybe.Just(entryPoint);
    }
    setBatchNumber(batchNumber: number) {
        this.initializeCurFlowIfEmpty();
        this._curFlow.unwrap().batchNumber = Maybe.Just(batchNumber);
    }
    setSinkType(sinkType: SinkType) {
        this.initializeCurFlowIfEmpty();
        this._curFlow.unwrap().sinkType = Maybe.Just(sinkType);
    }
    setSynthesisResult(synthesisResult: SynthesisResult) {
        this.initializeCurFlowIfEmpty();
        this._curFlow.unwrap().synthesisResult = Maybe.Just(synthesisResult);
    }
    setCandidateExploit(exploit: any) {
        this.initializeCurFlowIfEmpty();
        this._curFlow.unwrap().candidateExploit = Maybe.Just(exploit);
    }
    setExploitResults(exploitResults: Array<ExploitResult>) {
        this.initializeCurFlowIfEmpty();
        this._curFlow.unwrap().exploitResults = Maybe.Just(exploitResults);
    }
    saveCurFlow() {
        if(!this._curFlow.isNothing()){
            this._processedFlows.push(this._curFlow.unwrap());
            this._curFlow = Maybe.Nothing();
        }
    }
    registerTaskResult(taskName: string, taskResult: Record<string, any>, isEntryPointSpecific: boolean = false) {
        // If the task belongs to a specific entrypoint:
        if (isEntryPointSpecific) {
            const curEntryPoint = this._curFlow.unwrap().entryPoint.unwrap();
            if(
                this._taskResults.length > 0 &&
                "entryPoint" in this._taskResults[this._taskResults.length - 1] &&
                this._taskResults[this._taskResults.length - 1]["entryPoint"] === curEntryPoint
            ) {
                const lastResult = this._taskResults[this._taskResults.length - 1];
                if (Array.isArray(lastResult["tasks"])) {
                    lastResult["tasks"].push({ [taskName]: taskResult });
                }
                else {
                    throw Error("tasks field is not an array");
                }
            }
            else {
                this._taskResults.push({ entryPoint: curEntryPoint, tasks: [{ [taskName]: taskResult }] });
            }
        }
        else {
            this._taskResults.push({ [taskName]: taskResult });
        }
    }
    toJSON(): object {
        logger.debug("GUO", this._taskResults);
        let obj = {};
        let self = this;
        Object.getOwnPropertyNames(self).forEach(function (name, idx, arr) {
            let value = self[name];
            if (name == '_processedFlows') {
                value = value.map((flow: Flow) => {
                    let newFlow = {};
                    Object.getOwnPropertyNames(flow).forEach(function (name, idx, arr) {
                        let value = flow[name];
                        if (value instanceof Maybe) {
                            if (value.isNothing()) {
                                value = '';
                            } else {
                                value = value.unwrap();
                            }
                        }
                        newFlow[name] = value;
                    });
                    return newFlow;
                });
            }
            // curFlow will not be present in JSON
            else if (name == '_curFlow'){
                return;                
            }
            if (value instanceof Maybe) {
                if (value.isNothing()) {
                    value = '';
                } else {
                    value = value.unwrap();
                }
            }
            if (value instanceof Path) {
                value = value.toString();
            }
            name = name.substring(1);
            if (name == 'name') {
                name = 'id';
            }
            obj[name] = value;
        });
        return obj;
    }

    // No longer supported
    fromJSON(rawPackage: any) {
        // Maybe fields
        if ('index' in rawPackage && rawPackage['index'] !== '') {
            this.setIndex(rawPackage['index'] as number);
        }
        if ('version' in rawPackage && rawPackage['version'] !== '') {
            this.setVersion(rawPackage['version'] as string);
        }
        if ('downloadCount' in rawPackage && rawPackage['downloadCount'] !== '') {
            this.setDownloadCount(rawPackage['downloadCount'] as number);
        }
        if ('packagePath' in rawPackage && rawPackage['packagePath'] !== '') {
            this.setPackagePath(new Path([rawPackage['packagePath'] as string]));
        }
        if ('hasMain' in rawPackage && rawPackage['hasMain'] !== '') {
            this.setHasMain(rawPackage['hasMain'] as boolean);
        }
        if ('browserAPIs' in rawPackage && rawPackage['browserAPIs'] !== '') {
            this.setBrowserAPIs(rawPackage['browserAPIs'] as string[]);
        }
        if ('sinks' in rawPackage && rawPackage['sinks'] !== '') {
            this.setSinks(rawPackage['sinks'] as string[]);
        }
        if ('sinksHit' in rawPackage && rawPackage['sinksHit'] !== '') {
            this.setSinksHit(rawPackage['sinksHit'] as string[]);
        }
        if ('entryPoints' in rawPackage && rawPackage['entryPoints'] !== '') {
            this.setEntryPoints(rawPackage['entryPoints'] as EntryPoint[]);
        }
        if ('treeMetadata' in rawPackage && rawPackage['treeMetadata'] !== '') {
            this.setTreeMetadata(rawPackage['treeMetadata'] as object);
        }
        if ('processedFlows' in rawPackage) {
            rawPackage['processedFlows'].forEach((flow: any) => {
                let newFlow: Flow = {
                    entryPoint: Maybe.Nothing(),
                    batchNumber: Maybe.Nothing(),
                    sinkType: Maybe.Nothing(),
                    synthesisResult: Maybe.Nothing(),
                    candidateExploit: Maybe.Nothing(),
                    exploitResults: Maybe.Nothing()
                };
                if('entryPoint' in flow && flow['entryPoint'] !== ''){
                    newFlow['entryPoint'] = Maybe.Just(flow['entryPoint'] as EntryPoint);
                }
                if('batchNumber' in flow && flow['batchNumber'] !== ''){
                    newFlow['batchNumber'] = Maybe.Just(flow['batchNumber'] as number);
                }
                if('sinkType' in flow && flow['sinkType'] !== ''){
                    newFlow['sinkType'] = Maybe.Just(flow['sinkType'] as SinkType);
                }
                if('synthesisResult' in flow && flow['synthesisResult'] !== ''){
                    newFlow['synthesisResult'] = Maybe.Just(flow['synthesisResult'] as SynthesisResult);
                }
                if('candidateExploit' in flow && flow['candidateExploit'] !== ''){
                    newFlow['candidateExploit'] = Maybe.Just(flow['candidateExploit']);
                }
                if('exploitResults' in flow && flow['exploitResults'] !== ''){
                    newFlow['exploitResults'] = Maybe.Just(flow['exploitResults'] as ExploitResult[]);
                }
                this._processedFlows.push(newFlow);
            });
        }
        // Record fields
        if ('taskResults' in rawPackage) {
            for (const task of rawPackage['taskResults']) {
                const [taskName, taskData] = Object.entries(task)[0]
                this.registerTaskResult(taskName, taskData);
            }
        }
    }
}
