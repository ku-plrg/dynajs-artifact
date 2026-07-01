# Node Taint Proxy
​
## Building

### Docker
​
We have a Dockerfile that sets up this project. To use it, run
```
docker build . --tag nodetaint
docker run -it nodetaint <package_name> <package_version>
```
(Note: For users of Apple Silicon (e.g., a M1 Mac), run `docker build` with the `--platform linux/amd64` flag).
​

### Local

To set up *manually / locally*, please install the following dependencies:
```
make
npm
nodejs:15.5.0
typescript
graphviz
z3
```

Installation tips for Ubuntu users:

- make: `apt install build-essential`
- npm: `apt install npm`
- Node.js: `npm i -g n; n 15.5.0`
- TypeScript: `npm install -g typescript`
- graphviz: `apt install graphviz`
- Z3: `apt install z3`

​
Installation tips for MacOS users:

- make: `xcode-select --install`
- npm: `brew install npm`
- Node.js: `npm i -g n; n 15.5.0`
- TypeScript: `npm install -g typescript`
- graphviz: `brew install graphviz`
- Z3: `brew install z3`
​
​

In the project root **and** in the `pipeline` directory, run:
```
npm i
```
​
If you are using virtual machine based on MacOS, when you ran ```npm i```, you may face this error, "unsupported platform for fsevent error for npm i", this is not our infrastructure error, we can ignore this error, explanation is here: https://github.com/fsevents/fsevents#:~:text=I%27m%20getting%20EBADPLATFORM,warnings%20by%20default.
​

<br>​
Then run the setup script in the `lib` directory:
```
cd lib && ./setup-deps.sh
```
​
Finally, run `make` and then run the unit tests to see that everything is ok:
```
make jalangi_tests
```
​
​
## Running the complete pipeline

To run a crawl using our pipeline, use the `crawler.py` script. Here are the commands it supports:

- Command: `start`
  - Description: Start a crawl
  - Required:
    - `-n=int`: Number of containers
    - `--image=str`: Image name
    - `--volume=str`: Volume name
    - `--count=int`: Target package count     
  - Optional:
    - `--tag`: Tag for experiment file and folder names
    - `--fresh`: Fresh flag set if specified
    - `--range=int`: Last npm package list index to reach
    - `--force`: Start container even if running
    - `--only-cache-included`: Only cache packages that pass gathering filters
    - `--analysis-only=path`: Only analyze packages from the given list
- Command: `resume`
  - Description: Resume an existing crawl
  - Optional:
    - `--containers=int[]`: Comma-separated container IDs to resume (default is all stopped)
    - `--rm`: Remove stopped containers before resuming
- Command: `sync`
  - Description: Sync crawl data from containers
  - Optional:
    - `--clean`: Remove existing synced output folders
- Command: `stop`       
  - Description: Stop (and / or remove) all running crawl containers 
  - Optional:
    - `--containers=int[]`: Comma-separated container IDs to stop (default is all stopped)
    - `--rm`: Remove the container
- Command: `status`
  - Description: Display status of crawlers
- Command: `clean`
  - Description: Remove existing state data
- Command: `watchdog`
  - Description: Monitor a crawl and resume stopped containers
  - Optional:
    - `--sleep-time`: Time to sleep between watchdog cycles (minutes)
- Common flags:
  - Optional:
    - `--log-level=str`: Default is info
    - `--state=path`: Path to save / load state JSON file (default is ./state.json)
    - `--dry-run`: Print out commands without executing (use --log-level=debug)

For example, to run a crawl with 10 containers, each gathering 100 packages (having built a docker image named `nodetaint`):
```bash
python3 crawler.py start --fresh -n=10 --count=100 --image=nodetaint --volume=nodetaint
```

This crawl can then be monitored with `python3 crawler.py watchdog`.

To run the end-to-end pipeline on our case studies, use the following command from the `pipeline` directory:
```bash
python3 crawler.py start ... --analysis-only=lists/casestudies.json
```

​
​
## Normal Operation
​
To run a taint analysis in our framework, use the following command:
```
make analyze FILE=filename LOGLEVEL=loglevel1,loglevel2
```
​
Valid log levels are `info, error`. If left unspecified, the default is `error`.
​

​
## Propagating Eval Taint Through Static Analysis
​
Because we lose instrumentation whenever we enter an eval'd expression, we have to statically analyze the eval'd string to taint the modified variables. To enable this, run following command:
```
make analyze_with_eval FILE=tests/misc/eval/eval_prop_taint.js
```
​

## Tests
​
To run the regression tests, simply run the following command:
```
make jalangi_tests
```
​

## (Optional) Benchmarking
​
Install [hyperfine](https://github.com/sharkdp/hyperfine) and use `make time_analyze`.
