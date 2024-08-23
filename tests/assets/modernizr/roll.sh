#!/usr/bin/env bash

MODERNIZR_VERSION="44fa7b07c367a1814e8699e3a2f15c53fbe32df7"

cd "$(dirname "$0")"

rm -rf Modernizr
git clone https://github.com/Modernizr/Modernizr
cd Modernizr
git checkout $MODERNIZR_VERSION
npm ci

# Modernizr minifier is not working, hence we minify with ESBuild.
./bin/modernizr --config lib/config-all.json 
npx esbuild --bundle modernizr.js --minify --outfile=../modernizr.js

cd ..
rm -rf Modernizr
