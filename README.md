# Run with Docker (does the install for you)

Instead of installing everything by hand, the `Dockerfile` at the repository
root runs the **local install steps above for all four components** — DynaJS,
Extractor (esmeta), NodeMedic, and ExpoSE — in a single image. The per-tool
Dockerfiles under `./nodemedic` and `./expose` are *not* used; this image
follows the "How to install" steps in this README.

## Build

```sh
# start from repository root (where the Dockerfile lives)
docker build -t dynajs-artifact .
```

## Attach and run

Start the container and attach a shell to it — everything below runs *inside*
the container:

```sh
# start an interactive container named `dynajs`
docker run -it --name dynajs dynajs-artifact
```

You land in `/artifact/dynajs` (`$DYNAJS_HOME`) with node 22 active and every
component pre-built. If you started it detached (`docker run -dit ...`) or left
the shell, re-attach to the same container with either of:

```sh
docker attach dynajs          # re-attach to the container's main shell
docker exec -it dynajs bash   # open an additional shell
```

# Manual Install

## Requirements

If you don't prefer docker, You can run locally.
- `nvm`, (to run DynaJS, NodeMedic, ExpoSE)
- `python3`, `z3`, `clang` or `gcc` (to run NodeMedic and ExpoSE),
-  `sbt`, `scala` (to run extractor, but this is optional cause they are all packed)
    - https://www.scala-lang.org/download/

You need to set env variables for this artifact to run. add this to .bashrc or .zshrc and source it.
```sh
export DYNAJS_ARTIFACT_HOME='/path/to/artifact' # set this as needed
export DYNAJS_HOME="$DYNAJS_ARTIFACT_HOME/dynajs"
export DYNAJS_EXTRACTOR_HOME="$DYNAJS_ARTIFACT_HOME/extractor" # required, if you want to test automatic extracting
export NODEMEDIC_HOME="$DYNAJS_ARTIFACT_HOME/nodemedic"
export EXPOSE_HOME="$DYNAJS_ARTIFACT_HOME/extractor"
```

## DynaJS

```sh
# start from repository root
nvm install
nvm use
cd dynajs
nvm install
nvm use
npm install
npm run build
```

## Extractor
```sh
# start from repository root
git submodule --init --recursive
cd extractor
sbt compile
```

## NodeMedic
```sh
# start from repository root
nvm install
nvm use
cd nodemedic
npm install
npm run local-setup
```

## ExpoSE
```sh
# start from repository root
cd expose
nvm install
nvm use
./install
```


# How to check RQ

## RQ1. Modeling Effort

> [!NOTE]
> Models are already extracted and pre-included in the artifact.
> You can run RQ2, RQ3 without this step.
> If you want to check if really 

```sh
# start from repository root
# delete auto-generated files
find ./dynajs/analyses/flow/spec/ -type f -name '*.ts' ! -name '*.manual.ts' -delete
cd dynajs
# this will run extractor, and files will be re-gen
npm run copy
```

## RQ2. Accuracy, RQ3. Performance

```sh
# start from repository root
cd dynajs
npm run microbench:taint
npm run microbench:concolic
```


