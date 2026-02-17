/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SkillDependencyChecker — Parse and check skill dependencies declared in SKILL.md frontmatter.
 *
 * Supported dependency types:
 * - bin:    System binary (ffmpeg, python3, node, etc.)
 * - npm:    Global npm package
 * - python: Python import (pip package)
 * - mcp:    MCP server configured in Margay
 *
 * Security model:
 * - SKILL.md is treated as untrusted content
 * - No arbitrary command execution from frontmatter
 * - All detection logic is hardcoded per dependency type
 * - All spawned processes use shell:false with 5s timeout
 * - Python module names are sanitized to [a-zA-Z0-9_]
 */

import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { ProcessConfig } from '../initStorage';
import type { IMcpServer } from '@/common/storage';

// ============================================================================
// Types
// ============================================================================

export type DependencyType = 'bin' | 'npm' | 'python' | 'mcp';

export interface SkillDependency {
  type: DependencyType;
  name: string;
  install: string;
  optional?: boolean;
}

export type DependencyStatus = 'installed' | 'missing' | 'error';

export interface DependencyCheckResult {
  type: DependencyType;
  name: string;
  status: DependencyStatus;
  install: string;
  version?: string;
  error?: string;
}

export interface SkillDependencyReport {
  skillName: string;
  dependencies: DependencyCheckResult[];
  allSatisfied: boolean;
  requiredMissing: number;
}

// ============================================================================
// Frontmatter Parser
// ============================================================================

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

/**
 * Parse dependencies from SKILL.md YAML frontmatter.
 * Uses simple regex-based parsing — no js-yaml dependency needed.
 */
export function parseDependenciesFromFrontmatter(content: string): SkillDependency[] {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return [];

  const yaml = match[1];
  const deps: SkillDependency[] = [];

  // Find the "dependencies:" block
  const depsStart = yaml.indexOf('dependencies:');
  if (depsStart === -1) return [];

  // Extract lines after "dependencies:"
  const lines = yaml.slice(depsStart + 'dependencies:'.length).split(/\r?\n/);

  let current: Partial<SkillDependency> | null = null;

  for (const line of lines) {
    // Stop at next top-level field: line starts with non-whitespace char and contains colon
    // Do NOT trim — indented lines like "    name: ffmpeg" must not trigger this
    if (line.length > 0 && /^\S+:/.test(line)) break;

    // New list item
    const itemMatch = line.match(/^\s+-\s+type:\s*(.+)$/);
    if (itemMatch) {
      if (current?.type && current?.name) {
        deps.push({
          type: current.type as DependencyType,
          name: current.name,
          install: current.install || '',
          optional: current.optional,
        });
      }
      current = { type: itemMatch[1].trim() as DependencyType };
      continue;
    }

    if (!current) continue;

    // Parse fields within a list item
    const nameMatch = line.match(/^\s+name:\s*(.+)$/);
    if (nameMatch) {
      current.name = nameMatch[1].trim();
      continue;
    }

    const installMatch = line.match(/^\s+install:\s*["']?(.+?)["']?\s*$/);
    if (installMatch) {
      current.install = installMatch[1].trim();
      continue;
    }

    const optionalMatch = line.match(/^\s+optional:\s*(true|false)\s*$/);
    if (optionalMatch) {
      current.optional = optionalMatch[1] === 'true';
      continue;
    }
  }

  // Push last item
  if (current?.type && current?.name) {
    deps.push({
      type: current.type as DependencyType,
      name: current.name,
      install: current.install || '',
      optional: current.optional,
    });
  }

  // Validate: only allow known types
  return deps.filter((d) => ['bin', 'npm', 'python', 'mcp'].includes(d.type));
}

// ============================================================================
// Dependency Checkers (hardcoded per type — no arbitrary commands)
// ============================================================================

const SPAWN_TIMEOUT = 5000; // 5 seconds

function spawnCheck(cmd: string, args: string[]): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    try {
      const child = execFile(cmd, args, { timeout: SPAWN_TIMEOUT, windowsHide: true }, (error, stdout, stderr) => {
        if (error) {
          resolve({ ok: false, output: stderr || error.message });
        } else {
          resolve({ ok: true, output: stdout.trim() });
        }
      });
      // Ensure we don't hang
      child.on('error', () => resolve({ ok: false, output: 'spawn failed' }));
    } catch {
      resolve({ ok: false, output: 'spawn failed' });
    }
  });
}

/**
 * Check if a system binary is available on PATH.
 */
async function checkBin(name: string): Promise<DependencyCheckResult & { type: 'bin' }> {
  // Sanitize: only allow alphanumeric, dash, underscore, dot
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '');
  if (!safeName) {
    return { type: 'bin', name, status: 'error', install: '', error: 'Invalid binary name' };
  }

  const whichCmd = process.platform === 'win32' ? 'where' : 'command';
  const whichArgs = process.platform === 'win32' ? [safeName] : ['-v', safeName];

  const result = await spawnCheck(whichCmd, whichArgs);

  if (result.ok) {
    // Try to get version
    const verResult = await spawnCheck(safeName, ['--version']);
    const version = verResult.ok ? verResult.output.split('\n')[0]?.slice(0, 80) : undefined;
    return { type: 'bin', name, status: 'installed', install: '', version };
  }

  return { type: 'bin', name, status: 'missing', install: '' };
}

/**
 * Check if an npm package is globally installed.
 * Uses `npm list -g --depth=0` (read-only, no side effects).
 */
async function checkNpm(name: string): Promise<DependencyCheckResult & { type: 'npm' }> {
  // Sanitize: only allow npm-valid package name chars
  const safeName = name.replace(/[^a-zA-Z0-9@/_.-]/g, '');
  if (!safeName) {
    return { type: 'npm', name, status: 'error', install: '', error: 'Invalid package name' };
  }

  const result = await spawnCheck('npm', ['list', '-g', '--depth=0', safeName]);

  if (result.ok && !result.output.includes('(empty)') && !result.output.includes('ERR!')) {
    // Extract version from output like "├── puppeteer@23.1.0"
    const verMatch = result.output.match(new RegExp(`${safeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@(\\S+)`));
    return { type: 'npm', name, status: 'installed', install: '', version: verMatch?.[1] };
  }

  return { type: 'npm', name, status: 'missing', install: '' };
}

/**
 * Check if a Python module is importable.
 * Uses `python3 -c "import <module>"` — read-only, no side effects.
 */
async function checkPython(name: string): Promise<DependencyCheckResult & { type: 'python' }> {
  // Strict sanitization: only allow Python identifier chars
  const safeName = name.replace(/[^a-zA-Z0-9_]/g, '');
  if (!safeName) {
    return { type: 'python', name, status: 'error', install: '', error: 'Invalid module name' };
  }

  // First check if python3 exists
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const pythonCheck = await spawnCheck(process.platform === 'win32' ? 'where' : 'command', process.platform === 'win32' ? [pythonCmd] : ['-v', pythonCmd]);

  if (!pythonCheck.ok) {
    return { type: 'python', name, status: 'error', install: '', error: 'python3 not found' };
  }

  const result = await spawnCheck(pythonCmd, ['-c', `import ${safeName}; print(getattr(${safeName}, '__version__', 'installed'))`]);

  if (result.ok) {
    const version = result.output.trim() !== 'installed' ? result.output.trim().slice(0, 30) : undefined;
    return { type: 'python', name, status: 'installed', install: '', version };
  }

  return { type: 'python', name, status: 'missing', install: '' };
}

/**
 * Check if an MCP server is configured in Margay.
 */
async function checkMcp(name: string): Promise<DependencyCheckResult & { type: 'mcp' }> {
  try {
    const mcpServers = (await ProcessConfig.get('mcp.config')) as IMcpServer[] | null;
    if (!mcpServers || !Array.isArray(mcpServers)) {
      return { type: 'mcp', name, status: 'missing', install: '' };
    }

    const server = mcpServers.find((s) => s.name === name);
    if (!server) {
      return { type: 'mcp', name, status: 'missing', install: '' };
    }

    // Dependency semantics: "installed" = configured + enabled.
    // Connection status is a runtime detail — MCP servers aren't connected
    // until a conversation actually uses them. Checking `status === 'connected'`
    // here would make the dependency always appear missing at check time.
    if (server.enabled) {
      return { type: 'mcp', name, status: 'installed', install: '' };
    }

    return { type: 'mcp', name, status: 'missing', install: '', error: 'Configured but disabled' };
  } catch {
    return { type: 'mcp', name, status: 'error', install: '', error: 'Failed to read MCP config' };
  }
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Check all dependencies for a single skill.
 */
export async function checkSkillDependencies(skillDir: string): Promise<SkillDependencyReport> {
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const skillName = path.basename(skillDir);

  let content: string;
  try {
    content = await fs.readFile(skillMdPath, 'utf-8');
  } catch {
    return { skillName, dependencies: [], allSatisfied: true, requiredMissing: 0 };
  }

  const deps = parseDependenciesFromFrontmatter(content);
  if (deps.length === 0) {
    return { skillName, dependencies: [], allSatisfied: true, requiredMissing: 0 };
  }

  const results: DependencyCheckResult[] = await Promise.all(
    deps.map(async (dep) => {
      let result: DependencyCheckResult;
      switch (dep.type) {
        case 'bin':
          result = await checkBin(dep.name);
          break;
        case 'npm':
          result = await checkNpm(dep.name);
          break;
        case 'python':
          result = await checkPython(dep.name);
          break;
        case 'mcp':
          result = await checkMcp(dep.name);
          break;
        default:
          result = { type: dep.type, name: dep.name, status: 'error', install: dep.install, error: `Unknown type: ${dep.type}` };
      }
      // Attach install hint from frontmatter
      result.install = dep.install;
      return result;
    })
  );

  // Count deps that are NOT installed (both 'missing' and 'error' are failures)
  const requiredMissing = results.filter((r) => r.status !== 'installed').length;

  return {
    skillName,
    dependencies: results,
    allSatisfied: requiredMissing === 0,
    requiredMissing,
  };
}

/**
 * Check dependencies for all installed skills.
 */
export async function checkAllSkillDependencies(skillsDir: string): Promise<SkillDependencyReport[]> {
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const reports: SkillDependencyReport[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (entry.name === '_builtin') continue;

      const skillDir = path.join(skillsDir, entry.name);
      const report = await checkSkillDependencies(skillDir);
      // Only include skills that actually have dependencies
      if (report.dependencies.length > 0) {
        reports.push(report);
      }
    }

    return reports;
  } catch {
    return [];
  }
}

/**
 * Run a single dependency install command via the user's terminal.
 * Returns the command string — actual execution is delegated to the frontend
 * via shell.openInTerminal IPC.
 */
export function getInstallCommand(dep: DependencyCheckResult): string {
  return dep.install;
}
