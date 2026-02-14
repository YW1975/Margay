#!/usr/bin/env node
/**
 * Bootstrap vendor/gemini-cli submodule: init, install deps, build @margay/agent-core
 * Idempotent — safe to run repeatedly; skips build if dist/ already exists and is fresh.
 *
 * Cross-platform (replaces bootstrap-vendor.sh which fails on Windows
 * when bash resolves to WSL instead of Git Bash).
 */
const { execSync } = require('child_process');
const { existsSync, rmSync } = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CORE_DIR = path.join(ROOT, 'vendor', 'gemini-cli', 'packages', 'core');
const DIST_INDEX = path.join(CORE_DIR, 'dist', 'index.js');
const SUBMODULE_PKG = path.join(ROOT, 'vendor', 'gemini-cli', 'package.json');
const GEMINI_DIR = path.join(ROOT, 'vendor', 'gemini-cli');

function run(cmd, cwd = ROOT) {
  console.log(`[bootstrap-vendor] ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit' });
}

// Skip if dist already exists (e.g. dev re-running npm install)
if (existsSync(DIST_INDEX)) {
  console.log(`[bootstrap-vendor] ${path.relative(ROOT, DIST_INDEX)} exists, skipping build`);
  process.exit(0);
}

// Initialize submodule if not yet checked out
if (!existsSync(SUBMODULE_PKG)) {
  // Clean up non-empty directory left by partial checkout (CI workaround)
  if (existsSync(GEMINI_DIR) && !existsSync(path.join(GEMINI_DIR, '.git'))) {
    rmSync(GEMINI_DIR, { recursive: true, force: true });
  }
  run('git submodule update --init --recursive');
}

// Generate git-commit info (required by telemetry module)
run('npm install --ignore-scripts', GEMINI_DIR);
try {
  run('node scripts/generate-git-commit-info.js', GEMINI_DIR);
} catch {
  // Optional — ignore if script is missing
}
run('npm run build -w packages/core', GEMINI_DIR);

console.log('[bootstrap-vendor] @margay/agent-core built successfully');
