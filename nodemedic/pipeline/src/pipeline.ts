import { hrtime } from 'process';

interface Logger {
    debug: (msg: string) => void,
    info: (msg: string) => void,
    warn: (msg: string) => void,
    error: (msg: string) => void,
}


export class Context {
    private _properties: Record<string, any>;
    constructor(properties?: Record<string, any>) {
        this._properties = properties;
    }
    setProperty(key: string, value: any) {
        this._properties[key] = value;
    }
    getProperty(key: string): any {
        return this._properties[key];
    }
}


export enum TaskStatus {
    NotRun = 'NotRun',
    Started = 'Running',
    Continue = 'Continue',
    Abort = 'Abort',
    Halt = 'Halt',
}


export class Task {
    private _name: string;
    private _f: (Context) => Promise<Context>;
    private _status: TaskStatus;
    constructor(
        name: string,
        f: (Context) => Promise<Context>,
    ) {
        this._name = name;
        this._f = f;
        this._status = TaskStatus.NotRun;
    }
    name(): string {
        return this._name;
    }
    setStatus(status: TaskStatus) {
        this._status = status;
    }
    async execute(context: Context): Promise<[Context, TaskStatus]> {
        this._status = TaskStatus.Started;
        const nextContext = await this._f(context);
        return [nextContext, this._status];
    }
}


export class Pipeline {
    private _logger: Logger;
    private _tasks: Record<string, Task>;
    private _taskList: Array<string>;
    private _completedTasks: Array<string>;
    constructor(taskList: Array<string>, logger?: Logger) {
        if (logger !== undefined) {
            this._logger = logger;
        } else {
            this._logger = console;
        }
        this._tasks = {};
        this._taskList = taskList;
        this._completedTasks = [];
    }
    registerTask(task: Task) {
        this._tasks[task.name()] = task;
    }
    completedTask(taskName: string): boolean {
        return this._completedTasks.includes(taskName);
    }
    lastCompleted(): string {
        if (this._completedTasks.length == 0) {
            throw Error('No last completed: Pipeline has completed no tasks!');
        }
        return this._completedTasks[this._completedTasks.length - 1];
    }
    async execute(initialContext: Context, taskList?: Array<string>) {
        this._completedTasks = [];
        let context = initialContext;

        const time_budget = context.getProperty('timeBudget');
        const startTime = hrtime.bigint();
        
        context.setProperty('curBatchNumber', 1); // the batch to be processed, starts at 1
        context.setProperty('curBatchConfirmedFlows', []); // confirmed flows output from runInstrumented in the current batch
        context.setProperty('curBatchProgress', 0); // index of the confirmed flow to be processed within current batch, starts at 0
        context.setProperty('processedEntryPoints', []); // processed entry points in the package
        context.setProperty('successfulExploits', 0); // number of successfully exploited flows
        context.setProperty('secondStageMode', context.getProperty('convertPotentialToString') ? 'converted' : 'normal');
        context.setProperty('retryCurrentFlow', false);
        if (taskList === undefined) {
            taskList = this._taskList;
        }
        this._logger.debug(`Executing ${taskList.length} tasks...`);
        let count = 1;
        let taskPtr = 0
        const runInstrumentedPtr = taskList.indexOf('runInstrumented');
        const setSinkTypePtr = taskList.indexOf('setSinkType');
        while(true){
            const elapsedTime = Number(
                (hrtime.bigint() - startTime) / BigInt(1e6) // milliseconds
            );
            if (elapsedTime > time_budget*1000){
                this._logger.debug(`Time budget fully consumed\n`);
                break;
            }
            // Execute the next task in the pipeline
            let taskName = taskList[taskPtr];
            if (!Object.getOwnPropertyNames(this._tasks).includes(taskName)) {
                throw Error(`Task ${taskName} not found in registered tasks`);
            }
            try {
                this._logger.debug(`Executing task ${count}: ${taskName}`);
                const [nextContext, status] = await this._tasks[taskName].execute(context);
                // After the current tainted flow is processed:
                // that is, if any task in 'setSinkType', 'trivialExploit', 'checkExploit','smt' fails OR 'checkExploit' succeeds OR the last 'checkExploit' task fails to confirm the exploit:
                // return to setSinkType to process the next package OR runInstrumented to process the next batch OR exit
                if ((['setSinkType', 'trivialExploit', 'checkExploit', 'smt'].includes(taskName) && [TaskStatus.Abort, TaskStatus.Halt, TaskStatus.Started, TaskStatus.NotRun].includes(status))
                    || (taskName == 'checkExploit' && taskPtr == taskList.length - 1 && status == TaskStatus.Continue)
                    || (taskName == 'checkExploit' && status == TaskStatus.Abort)) {   
                    let thePackage = context.getProperty('thePackage');
                    let curBatchNumber = context.getProperty('curBatchNumber');
                    let curBatchProgress = context.getProperty('curBatchProgress');
                    let curBatchConfirmedFlows = context.getProperty('curBatchConfirmedFlows') || [];
                    if (context.getProperty('retryCurrentFlow')) {
                        this._logger.debug(`Retrying current tainted flow in ${context.getProperty('secondStageMode')} mode`);
                        context.setProperty('retryCurrentFlow', false);
                        taskPtr = setSinkTypePtr;
                        count++;
                        continue;
                    }
                    thePackage.saveCurFlow(); // Save the current flow result in thePackage
                    // If stop the pipeline after the 1st tanited flow is successfully exploited: exit
                    if(context.getProperty("successfulExploits") > 0 && context.getProperty("stopOn1stExploited")){
                        this._logger.info(`Stopping the pipeline after the 1st tainted flow is successfully exploited`);
                        break;
                    }
                    // If current batch is processed, push curConfirmedFlows into processedEntrypoints AND return to runInstrumented
                    if(curBatchProgress >= curBatchConfirmedFlows.length - 1){
                        context.getProperty('processedEntryPoints').push(...curBatchConfirmedFlows);
                        context.setProperty('curBatchConfirmedFlows', []);
                        context.setProperty("curBatchNumber", curBatchNumber + 1);
                        context.setProperty("curBatchProgress", 0);
                        context.setProperty('secondStageMode', context.getProperty('convertPotentialToString') ? 'converted' : 'normal');
                        taskPtr = runInstrumentedPtr;
                    }
                    else{
                        context.setProperty("curBatchProgress", curBatchProgress + 1);
                        context.setProperty('secondStageMode', context.getProperty('convertPotentialToString') ? 'converted' : 'normal');
                        taskPtr = setSinkTypePtr;
                    }
                }
                else if (status === TaskStatus.Abort || status === TaskStatus.Halt) {
                    this._logger.info(`Stopping pipeline at task ${taskName}`);
                    break;
                } else if (status === TaskStatus.Started || status === TaskStatus.NotRun) {
                    this._logger.error(`Error running task; stalled with status: ${status}`);
                    break;
                } else if (status == TaskStatus.Continue) {
                    this._completedTasks.push(taskName);
                    context = nextContext;
                    if(taskPtr == taskList.length - 1){
                        break;
                    }
                    taskPtr ++;
                }
                count++;
            } catch (err) {
                this._logger.error(`Failed to execute task ${taskName}:\n${err}`);
                break;
            }   
        }
        this._logger.debug(`Pipeline complete`);
    }
}
