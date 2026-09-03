#!/usr/bin/env bash
set -euo pipefail

# Keep dependency installation reproducible after task merges.
npm ci --no-audit --no-fund