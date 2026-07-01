# Gathering Stage

## Added Feature

### Browser API Filter
We implemented a browser API filter ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/analysis/packages_to_analyze/generate_package_list.ts#L271)) to exclude the packages used for the front end, which `node` does not support. The way is to abandon the package if it contains front-end API keywords, such as `window` and `document`. This is similar to finding the sink but in a reverse way. The API keywords can be expanded ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/analysis/packages_to_analyze/generate_package_list.ts#L362)) if future experiments find other useful keywords.

### Package Found Rate
Since the additional filter reduces the found rate significantly ([ref](https://hackmd.io/jOYH_royRB61eRkMo1_Nig#First-Stage-Pipeline-Test-50-Packages)), it is better to have the found rate to keep track of the gathering stage ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/analysis/packages_to_analyze/generate_package_list.ts#L395)). The found rate can also estimate the required number of packages that need to be filtered or the remaining time.

### Package Dependency Checking
Many packages failed in analyzing stage due to setup error of the dependencies, which has nothing to do with the pipeline infrastructure and should be excluded. The way of checking is to run `npm i` for the filtered packages ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/analysis/packages_to_analyze/generate_package_list.ts#L300)). This does not add the runtime or storage to the whole pipeline for the selected packages since the package data will be reused during the analyzing stage. We also set the timeout of 5 minutes ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/analysis/packages_to_analyze/generate_package_list.ts#L313)) for setting up the dependencies to prevent the gathering stage from halting.

## Improvement

### Stronger Main Filter
We add logic to check if the entry file indicated by `package.json` exists inside the package data ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/analysis/packages_to_analyze/generate_package_list.ts#L241)). Previously it only checks if the `main` entry exists, which may not be consistent with the package data.

### API Matching Function Unification
Since both functions `filterByBrowserAPIs` and `filterBySinks` use function matches API name, we unify the logic ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/analysis/packages_to_analyze/generate_package_list.ts#L254)) to reduce code redundancy.

### API Matching Command
The command can be used for searching for both function and variable inside package data. We dismiss the `node_modules` folder to exclude the dependencies during searching ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/analysis/packages_to_analyze/generate_package_list.ts#L255)).

### Package Resource Unification
During the gathering stage, each downloaded packages will be stored at `../../pipeline/packages` ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/analysis/packages_to_analyze/generate_package_list.ts#L341)) for later used to prevent the packages from downloading twice during analyzing stage.

### More Frequent Package List Writing
Originally, the package list writes to file once is gathering is completed. However, this approach would lose all the progress if there is an interrupt in the middle of the gathering stage. We write the output file progressively when each package was found ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/analysis/packages_to_analyze/generate_package_list.ts#L398)).
