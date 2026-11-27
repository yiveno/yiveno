#!/bin/bash

set -e

bun --no-env-file ../scripts/dev-env.mjs sync --profile=development --target=website --quiet
bunx --bun astro dev "$@"
