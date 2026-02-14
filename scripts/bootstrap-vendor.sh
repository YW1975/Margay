#!/bin/bash
set -e

# Bootstrap vendor/gemini-cli submodule: init, install deps, build @margay/agent-core
# Idempotent — safe to run repeatedly; skips build if dist/ already exists and is fresh.
cd "$(dirname "$0")/.."

CORE_DIR="vendor/gemini-cli/packages/core"

# Skip if dist already exists (e.g. dev re-running npm install)
if [ -f "$CORE_DIR/dist/index.js" ]; then
  echo "[bootstrap-vendor] $CORE_DIR/dist/index.js exists, skipping build"
  exit 0
fi

# Initialize submodule if not yet checked out
if [ ! -f "vendor/gemini-cli/package.json" ]; then
  # Clean up non-empty directory left by partial checkout (CI workaround)
  if [ -d "vendor/gemini-cli" ] && [ ! -d "vendor/gemini-cli/.git" ]; then
    rm -rf vendor/gemini-cli
  fi
  git submodule update --init --recursive
fi

# Generate git-commit info (required by telemetry module)
cd vendor/gemini-cli
npm install --ignore-scripts
node scripts/generate-git-commit-info.js 2>/dev/null || true
npm run build -w packages/core

echo '[bootstrap-vendor] @margay/agent-core built successfully'
