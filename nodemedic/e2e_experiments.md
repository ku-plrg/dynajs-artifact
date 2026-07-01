# Instructions to run the E2E NodeMedic experiments

First, build the Docker image using command:

```sh
docker build --platform=linux/amd64 -t nodemedic:new-analysis .
```

Then, to run the full E2E experiments, use the `run_tests_docker.py` script with the command:

```sh
python3 run_tests_docker.py --csv <flows-csv> --workers <num-workers> --out-dir <out-dir> --image <docker-image>
```

Where:

- `flows-csv` is the CSV file with the package names (in this repo it is the `filtered_flows.csv` file);
- `num-workers` is the number of parallel workers running packages;
- `out-dir` is the name of the directory where the logs and analysis artifacts from the run will get stored (this gets automatically created);
- `docker-image` is the name of the image that was built (e.g., `nodemedic:new-analysis`);

To run specific configurations, use the `--flags "..."` options. The default, no flag, option runs the Jalangi + legacy engine baseline.
To run the DynaJS + legacy engine configuration use the flag `--dynajs`. Example:

```sh
python3 run_tests_docker.py --csv filtered_flows.csv --workers 4 --flags="--dynajs" --out-dir docker_results_dynajs_legacy --image nodemedic:new-analysis
```

To run the DynaJS + new engine configuration, use the flags `--dynajs` and `--dynajs-engine`. Example:

```sh
python3 run_tests_docker.py --csv filtered_flows.csv --workers 4 --flags="--dynajs --dynajs-engine" --out-dir docker_results_dynajs_new_engine --image nodemedic:new-analysis
```

Other relevant flags in the `run_tests_docker.py` script include:

- `--timeout SECONDS`: per-container timeout passed to `entrypoint.sh` Default: `600`.
- `--dry-run`: print the packages that would be run and exit without starting Docker.
- `--limit N`: run only the first `N` packages after de-duplication. Default: `0`, meaning all packages.

## Run one package

```sh
mkdir -p docker_results_one/analysisArtifacts/raspberry-vol_1.1.0

docker run --rm \
  -v "$(pwd)/docker_results_one/analysisArtifacts/raspberry-vol_1.1.0:/nodetaint/analysisArtifacts:rw" \
  --platform linux/amd64 \
  nodemedic:new-analysis \
  /nodetaint/entrypoint.sh \
  --package=raspberry-vol \
  --version=1.1.0 \
  --mode=full \
  --flags="--dynajs --dynajs-engine" \
  --batch-size=1 \
  --timeout=600 \
  --stop-on-1st-exploited
```

The current Dockerfile uses `CMD ["/bin/bash"]`, so include
`/nodetaint/entrypoint.sh` in raw `docker run` commands.
