#!/bin/bash

echo "Setting up dependencies"

# echo "Cloning dynajs"
# # cloning is not needed now?
# git clone https://github.com/ku-plrg/dynajs.git
(cd dynajs && npm i && npm run build)

echo "Cloning jalangi2"
if [ ! -d jalangi2 ]; then
  git clone https://github.com/Samsung/jalangi2.git
else
  echo "jalangi2 already exists, skipping clone"
fi

echo "Creating jalangi2-babel"
if [ ! -d jalangi2-babel ]; then
  mkdir jalangi2-babel
  cp -r jalangi2/src jalangi2-babel/
  cp jalangi2/package.json jalangi2-babel/

  echo "Applying jalangi2-babel patch"
  cd jalangi2-babel
  git apply ../babel-changes.patch
  #patch jalangi2-babel/src/js/instrument/esnstrument.js < babel-changes.patch
else
  echo "jalangi2-babel already exists, skipping creation and patch"
  cd jalangi2-babel
fi

echo "Installing npm dependencies"
npm i
npm i --save-dev @babel/core@^7.11.6 @babel/preset-env@^7.11.5

echo "Installing fuzzer"
cd ../fuzzer
npm i
npm i .
for i in `find -name "*.js"`; do printf "\n// JALANGI DO NOT INSTRUMENT\n// DYNAJS DO NOT INSTRUMENT" >> $i; done

echo "Installing NodeExploitSynthesis"
cd ../NodeExploitSynthesis
if [ -f package-lock.json ]; then
    npm ci
else
    npm i
fi
cd src/synthesis/operation_types && ./run.sh
pip3 install z3-solver==4.12.2
