#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$SCRIPT_DIR"
bun --no-env-file ./scripts/dev-env.mjs sync --profile=development --target=worker
