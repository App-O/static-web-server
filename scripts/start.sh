#!/bin/sh

FILENAME=$(basename "$0")
LOCATION="$(cd "$(dirname "$0")" && pwd)"

cd ../${LOCATION}
sudo node app.js
