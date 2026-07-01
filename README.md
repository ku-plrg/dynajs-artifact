# How to install 

## Requirements
You need 
- `node`, (21.7.2, recommend nvm),
- `python3`, `z3`, `clang` or `gcc` (to run NodeMedic and ExpoSE),
-  `sbt`, `scala` (to run extractor, optional)

```sh
export DYNAJS_ARTIFACT_HOME='/path/to/artifact' # set as you need
export DYNAJS_HOME="$DYNAJS_ARTIFACT_HOME/dynajs"
export DYNAJS_EXTRACTOR_HOME="$DYNAJS_ARTIFACT_HOME/extractor" # required, if you want to test automatic extracting
export NODEMEDIC_HOME="$DYNAJS_ARTIFACT_HOME/nodemedic"
export EXPOSE_HOME="$DYNAJS_ARTIFACT_HOME/extractor"
```

## DynaJS

```sh
# start from repository root
cd dynajs
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
cd nodemedic
npm install
npm run 
```

## ExpoSE
```sh
# start from repository root
cd expose
./install
```


> [!NOTE]
> 


## ExpoSE

## NodeMedic

## Extractor

# How to check

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
npm run 
```


