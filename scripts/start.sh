#!/bin/sh

FILENAME=$(basename "$0")
LOCATION="$(cd "$(dirname "$0")" && pwd)"

node ${LOCATION}/app.js
