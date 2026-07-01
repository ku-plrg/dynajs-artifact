# Analyzing Stage

## Added Feature

### Non Instrumentation Step
Some packages are inherently faulty, which will run into error eventually, and should be excluded during the analyzing stage. By running the packages without instrumentation ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/pipeline/pipeline.ts#L464)), we can save CPU resources of instrumentation for faulty packages and virtually increase no runtime for the pipeline.

### Progress Tracking
Some packages break the pipeline, especially for the CLI-related packages. Currently, this is a non-resolved issue, so we try to mitigate the issue by keeping track of the analyzing progress ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/pipeline/pipeline.ts#L720)) to resume the pipeline in a correct position ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/pipeline/pipeline.ts#L718)). We created a file at `output/index.txt` ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/pipeline/pipeline.ts#L179)) to save the index current running package. After completing the pipeline, the value of `output/index.txt` will be set to -1 ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/pipeline/pipeline.ts#L753)), indicating the process is finished.

## Improvement

### Extending Driver Generating Function
Since there are two steps, non-instrumented and instrumented steps, that require the driver to run, we extend the driver generating function ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/pipeline/pipeline.ts#L562)) to generate the corresponding driver for each step based on the argument.

### Output File Format
The original output file has no indentation or newline, which decreases readability, especially for the resulting output of the large-scale tests. By adding the indentation ([ref](https://cement.andrew.cmu.edu/darionc/NodeTaintProxy/src/0a7bfac9c0701be115df73fa79e361d323a624c5/pipeline/pipeline.ts#L156)), we make it easier to browse through the analyzing result manually if needed.
