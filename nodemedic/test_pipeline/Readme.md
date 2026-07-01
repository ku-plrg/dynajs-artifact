The "test1" package contains 4 entry points, 2 tainted and 2 regular. The following test cases are created:  

1. Test the --stop-on-1st-exploited flag stops the program once the 1st tainted flow is exploited:  
timeout 1800 /bin/sh -c "pipeline/run_pipeline.sh 1 lower 0 --mode=full --log-level=debug --cache-dir=test_pipeline --output-dir=analysisArtifacts --tmp-dir=/tmp/ --z3-path=/nodetaint/z3/bin/z3 --fresh --package=test1@$1.0.0 --start-index=0 --end-index=1 --min-num-deps=10 --min-depth=-1 --require-sink-hit --policies=object:precise,string:precise,array:precise $flags --batch-size=1 --stop-on-1st-exploited"

2. Test --batch-size flag with value greater than the number of entrypoints will execute normally  
timeout 1800 /bin/sh -c "pipeline/run_pipeline.sh 1 lower 0 --mode=full --log-level=debug --cache-dir=test_pipeline --output-dir=analysisArtifacts --tmp-dir=/tmp/ --z3-path=/nodetaint/z3/bin/z3 --fresh --package=test1@$1.0.0 --start-index=0 --end-index=1 --min-num-deps=10 --min-depth=-1 --require-sink-hit --policies=object:precise,string:precise,array:precise $flags --batch-size=5"

3. Test --batch-size flag with value equal to the number of entrypoints will execute normally  
timeout 1800 /bin/sh -c "pipeline/run_pipeline.sh 1 lower 0 --mode=full --log-level=debug --cache-dir=test_pipeline --output-dir=analysisArtifacts --tmp-dir=/tmp/ --z3-path=/nodetaint/z3/bin/z3 --fresh --package=test1@$1.0.0 --start-index=0 --end-index=1 --min-num-deps=10 --min-depth=-1 --require-sink-hit --policies=object:precise,string:precise,array:precise $flags --batch-size=2"

4. Test --batch-size flag with value smaller than to the number of entrypoints will execute normally  
timeout 1800 /bin/sh -c "pipeline/run_pipeline.sh 1 lower 0 --mode=full --log-level=debug --cache-dir=test_pipeline --output-dir=analysisArtifacts --tmp-dir=/tmp/ --z3-path=/nodetaint/z3/bin/z3 --fresh --package=test1@$1.0.0 --start-index=0 --end-index=1 --min-num-deps=10 --min-depth=-1 --require-sink-hit --policies=object:precise,string:precise,array:precise $flags --batch-size=1"

5. Test --timeout flag will stop the pipeline  
timeout 15 /bin/sh -c "pipeline/run_pipeline.sh 1 lower 0 --mode=full --log-level=debug --cache-dir=test_pipeline --output-dir=analysisArtifacts --tmp-dir=/tmp/ --z3-path=/nodetaint/z3/bin/z3 --fresh --package=test1@$1.0.0 --start-index=0 --end-index=1 --min-num-deps=10 --min-depth=-1 --require-sink-hit --policies=object:precise,string:precise,array:precise $flags --batch-size=1"