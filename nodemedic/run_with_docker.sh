#!/bin/bash

# This script is used to analyze a package with the docker image
# It takes two arguments: the package name and the package version
# It will create a folder called output in the current directory
# and place the analysis artifacts in that folder

# Example usage: ./run_package_with_docker.sh lodash 4.17.15 output_dir [additional flags for NodeMedic]

NODEMEDIC_IMAGE=nodemedic-fine:021025v2

PACKAGE_NAME=$1
PACKAGE_VERSION=$2
OUTPUT_DIR=$3

echo "Analyzing package $PACKAGE_NAME@$PACKAGE_VERSION"
echo "Storing results in $OUTPUT_DIR"

mkdir -p ./$OUTPUT_DIR
rm -rf ./$OUTPUT_DIR/output
rm -rf ./$OUTPUT_DIR/packages
mkdir -p ./$OUTPUT_DIR/output
mkdir -p ./$OUTPUT_DIR/packages

set -e
set -x

docker run --rm -it -v ./$OUTPUT_DIR/output:/nodetaint/analysisArtifacts:rw -v ./$OUTPUT_DIR/packages:/nodetaint/packageData:rw $NODEMEDIC_IMAGE --package=$PACKAGE_NAME --version=$PACKAGE_VERSION --flags="${@:3}"

set +x

echo "-"
echo "Analysis complete. Results are in $OUTPUT_DIR/output"
