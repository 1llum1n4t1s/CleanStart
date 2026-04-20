#!/bin/bash

set -euo pipefail

cd "$(dirname "$0")"

npm install --silent
node scripts/generate-icons.js

rm -f clean-start.zip
rm -rf temp-build

mkdir -p temp-build
cp manifest.json temp-build/
cp popup.html temp-build/
cp -R _locales temp-build/
cp -R icons temp-build/
cp -R src temp-build/

if ! command -v zip >/dev/null 2>&1; then
  echo "zip command is required."
  exit 1
fi

(cd temp-build && zip -r ../clean-start.zip .)
rm -rf temp-build

echo "Created clean-start.zip"
