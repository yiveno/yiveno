#!/bin/bash

set -e

bun ../scripts/dev-env.mjs sync --profile=development --target=website --quiet
bunx --bun astro dev "$@"
