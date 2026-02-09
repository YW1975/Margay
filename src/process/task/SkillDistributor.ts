/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SkillDistributor - Distributes AionUi-managed skills to engine discovery directories.
 *
 * Instead of injecting skill content into messages, this module creates symlinks
 * (or copies on Windows) from ~/.aionui/skills/ to each engine's native discovery
 * directory, letting each engine discover and activate skills natively.
 *
 * Supports: Claude Code (.claude/skills/), Codex (.agents/skills/), Gemini (skillsDir config)
 */

import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { getSkillsDir, getBuiltinSkillsDir } from '../initStorage';

const MANIFEST_FILENAME = '.aionui-manifest.json';
const PROVENANCE_MARKER = '.aionui-managed';

type DistributionMode = 'symlink' | 'copy';

interface ManifestData {
  managedBy: 'aionui';
  skills: string[];
}

/**
 * Determine which skills should be distributed based on enabledSkills filter.
 *
 * Canonical semantics:
 * - undefined → all skills (builtins + all optional)
 * - [] → all skills (same as undefined)
 * - ['pptx','docx'] → builtins + listed skills only
 */
function shouldDistributeSkill(skillName: string, isBuiltin: boolean, enabledSkills?: string[]): boolean {
  if (isBuiltin) return true;
  if (!enabledSkills || enabledSkills.length === 0) return true;
  return enabledSkills.includes(skillName);
}

/**
 * Check if an entry in the target directory is managed by AionUi (is a symlink pointing to ~/.aionui/skills/).
 */
function isAionUiManagedSymlink(entryPath: string, aionuiSkillsDir: string): boolean {
  try {
    const stats = lstatSync(entryPath);
    if (!stats.isSymbolicLink()) return false;
    const target = readlinkSync(entryPath);
    // Resolve to absolute for comparison
    const resolvedTarget = path.isAbsolute(target) ? target : path.resolve(path.dirname(entryPath), target);
    return resolvedTarget.startsWith(aionuiSkillsDir);
  } catch {
    return false;
  }
}

/**
 * Read the AionUi manifest from a target directory (used for copy-mode tracking on Windows).
 */
function readManifest(targetDir: string): ManifestData | null {
  const manifestPath = path.join(targetDir, MANIFEST_FILENAME);
  try {
    if (!existsSync(manifestPath)) return null;
    const raw = readFileSync(manifestPath, 'utf-8');
    const data = JSON.parse(raw);
    if (data?.managedBy === 'aionui' && Array.isArray(data.skills)) {
      return data as ManifestData;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write the AionUi manifest to a target directory.
 */
function writeManifest(targetDir: string, skills: string[]): void {
  const manifestPath = path.join(targetDir, MANIFEST_FILENAME);
  const data: ManifestData = { managedBy: 'aionui', skills };
  try {
    writeFileSync(manifestPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.warn(`[SkillDistributor] Failed to write manifest to ${targetDir}:`, error);
  }
}

/**
 * Check if a copied skill directory contains the AionUi provenance marker.
 * The marker is written inside each AionUi-managed copy and proves ownership
 * even if the manifest is stale. Both manifest listing AND marker must agree.
 */
function hasProvenanceMarker(skillDir: string): boolean {
  try {
    return existsSync(path.join(skillDir, PROVENANCE_MARKER));
  } catch {
    return false;
  }
}

/**
 * Write the provenance marker inside a copied skill directory.
 */
function writeProvenanceMarker(skillDir: string): void {
  try {
    writeFileSync(path.join(skillDir, PROVENANCE_MARKER), 'managed-by-aionui\n', 'utf-8');
  } catch {
    // Non-fatal: marker write failure doesn't block distribution
  }
}

/**
 * Check if an entry is AionUi-managed via manifest AND provenance marker.
 * Requires both: manifest lists the skill AND the directory contains the marker file.
 * This prevents stale manifests from causing deletion of engine-managed entries.
 */
function isAionUiManagedCopy(skillName: string, manifest: ManifestData | null, targetPath: string): boolean {
  if (!manifest || !manifest.skills.includes(skillName)) return false;
  return hasProvenanceMarker(targetPath);
}

/**
 * Distribute a single skill to the target directory.
 * Returns the distribution mode used, or null if skipped.
 */
function distributeSkillEntry(sourcePath: string, targetPath: string, aionuiSkillsDir: string, manifest: ManifestData | null): DistributionMode | null {
  const skillName = path.basename(targetPath);

  // Check if target already exists
  if (existsSync(targetPath) || lstatSafe(targetPath)) {
    if (isAionUiManagedSymlink(targetPath, aionuiSkillsDir)) {
      // AionUi-managed symlink — verify target matches
      const currentTarget = readlinkSync(targetPath);
      const resolvedCurrent = path.isAbsolute(currentTarget) ? currentTarget : path.resolve(path.dirname(targetPath), currentTarget);
      if (resolvedCurrent === sourcePath) {
        return 'symlink'; // Already correct, no-op
      }
      // Different source, update symlink
      unlinkSync(targetPath);
    } else if (isAionUiManagedCopy(skillName, manifest, targetPath)) {
      // AionUi-managed copy (Windows fallback) — update by removing and re-copying
      rmSync(targetPath, { recursive: true, force: true });
    } else {
      // Engine-managed or third-party entry — skip
      console.log(`[SkillDistributor] Skipped '${skillName}': already exists (engine-managed)`);
      return null;
    }
  }

  // Try symlink first
  try {
    symlinkSync(sourcePath, targetPath);
    return 'symlink';
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'EPERM' && err.code !== 'EACCES') {
      console.warn(`[SkillDistributor] Symlink failed for '${path.basename(targetPath)}':`, err.message);
      return null;
    }
  }

  // Fallback: copy (Windows without Developer Mode)
  try {
    cpSync(sourcePath, targetPath, { recursive: true, force: false });
    writeProvenanceMarker(targetPath);
    return 'copy';
  } catch (error) {
    console.warn(`[SkillDistributor] Copy fallback failed for '${path.basename(targetPath)}':`, error);
    return null;
  }
}

/**
 * Safe lstat that returns null instead of throwing for non-existent paths.
 * Needed to detect dangling symlinks (existsSync returns false for dangling symlinks).
 */
function lstatSafe(p: string): boolean {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reconcile: remove stale AionUi-managed entries from target directory.
 * Only removes entries that are AionUi-managed (symlinks to ~/.aionui/skills/ or listed in manifest).
 * Never touches engine-managed entries.
 */
function cleanupStaleEntries(targetDir: string, desiredSkillNames: Set<string>, aionuiSkillsDir: string, usedCopyMode: boolean): void {
  if (!existsSync(targetDir)) return;

  try {
    const entries = readdirSync(targetDir, { withFileTypes: true });
    const manifest = usedCopyMode ? readManifest(targetDir) : null;

    for (const entry of entries) {
      if (entry.name === MANIFEST_FILENAME) continue;
      if (desiredSkillNames.has(entry.name)) continue;

      const entryPath = path.join(targetDir, entry.name);

      // Check if AionUi-managed via symlink
      if (isAionUiManagedSymlink(entryPath, aionuiSkillsDir)) {
        try {
          unlinkSync(entryPath);
          console.log(`[SkillDistributor] Removed stale symlink: ${entry.name}`);
        } catch (error) {
          console.warn(`[SkillDistributor] Failed to remove stale symlink '${entry.name}':`, error);
        }
        continue;
      }

      // Check if AionUi-managed via manifest AND provenance marker (copy mode)
      if (manifest && manifest.skills.includes(entry.name) && hasProvenanceMarker(entryPath)) {
        try {
          rmSync(entryPath, { recursive: true, force: true });
          console.log(`[SkillDistributor] Removed stale copy: ${entry.name}`);
        } catch (error) {
          console.warn(`[SkillDistributor] Failed to remove stale copy '${entry.name}':`, error);
        }
      }
      // Else: engine-managed, don't touch
    }
  } catch (error) {
    console.warn(`[SkillDistributor] Failed to cleanup stale entries in ${targetDir}:`, error);
  }
}

/**
 * Get the list of all available skill names (builtin + optional) from AionUi skills directory.
 */
function discoverAllSkillNames(): { builtins: string[]; optional: string[] } {
  const skillsDir = getSkillsDir();
  const builtinDir = getBuiltinSkillsDir();
  const builtins: string[] = [];
  const optional: string[] = [];

  // Discover builtin skills
  if (existsSync(builtinDir)) {
    try {
      const entries = readdirSync(builtinDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (existsSync(path.join(builtinDir, entry.name, 'SKILL.md'))) {
          builtins.push(entry.name);
        }
      }
    } catch (error) {
      console.warn('[SkillDistributor] Failed to discover builtin skills:', error);
    }
  }

  // Discover optional skills
  if (existsSync(skillsDir)) {
    try {
      const entries = readdirSync(skillsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name === '_builtin') continue;
        if (existsSync(path.join(skillsDir, entry.name, 'SKILL.md'))) {
          optional.push(entry.name);
        }
      }
    } catch (error) {
      console.warn('[SkillDistributor] Failed to discover optional skills:', error);
    }
  }

  return { builtins, optional };
}

/**
 * Core distribution logic: distribute skills to a target engine directory.
 */
function distributeToEngineDir(targetDir: string, enabledSkills?: string[]): void {
  const skillsDir = getSkillsDir();
  const builtinDir = getBuiltinSkillsDir();
  const { builtins, optional } = discoverAllSkillNames();

  // Compute desired set
  const desiredSkillNames = new Set<string>();
  const desiredEntries: Array<{ name: string; sourcePath: string }> = [];

  for (const name of builtins) {
    if (shouldDistributeSkill(name, true, enabledSkills)) {
      desiredSkillNames.add(name);
      desiredEntries.push({ name, sourcePath: path.join(builtinDir, name) });
    }
  }

  for (const name of optional) {
    if (shouldDistributeSkill(name, false, enabledSkills)) {
      desiredSkillNames.add(name);
      desiredEntries.push({ name, sourcePath: path.join(skillsDir, name) });
    }
  }

  // Ensure target directory exists
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Read existing manifest upfront (needed for copy-mode ownership detection)
  const existingManifest = readManifest(targetDir);

  // Distribute each skill
  let usedCopyMode = existingManifest !== null; // If manifest exists, copy mode was used before
  const distributedSkills: string[] = [];

  for (const { name, sourcePath } of desiredEntries) {
    const targetPath = path.join(targetDir, name);
    const mode = distributeSkillEntry(sourcePath, targetPath, skillsDir, existingManifest);
    if (mode === 'copy') usedCopyMode = true;
    if (mode) {
      distributedSkills.push(name);
    }
  }

  // Cleanup stale entries (always check manifest if one existed)
  cleanupStaleEntries(targetDir, desiredSkillNames, skillsDir, usedCopyMode);

  // Write/update manifest if copy mode was used at any point
  if (usedCopyMode) {
    writeManifest(targetDir, distributedSkills);
  }

  if (distributedSkills.length > 0) {
    console.log(`[SkillDistributor] Distributed ${distributedSkills.length} skills to ${targetDir}`);
  }
}

/**
 * Distribute AionUi skills to Claude Code's discovery directory.
 * Claude Code discovers skills from {workspace}/.claude/skills/
 */
export function distributeForClaude(workspace: string, enabledSkills?: string[]): void {
  const targetDir = path.join(workspace, '.claude', 'skills');
  try {
    distributeToEngineDir(targetDir, enabledSkills);
  } catch (error) {
    console.error('[SkillDistributor] Failed to distribute for Claude:', error);
  }
}

/**
 * Distribute AionUi skills to Codex CLI's discovery directory.
 * Codex discovers skills from {workspace}/.agents/skills/
 */
export function distributeForCodex(workspace: string, enabledSkills?: string[]): void {
  const targetDir = path.join(workspace, '.agents', 'skills');
  try {
    distributeToEngineDir(targetDir, enabledSkills);
  } catch (error) {
    console.error('[SkillDistributor] Failed to distribute for Codex:', error);
  }
}

/**
 * Compute disabledSkills for Gemini's native SkillManager.
 *
 * Gemini's aioncli-core SkillManager scans the entire skillsDir and uses
 * disabledSkills to filter. We convert AionUi's enabledSkills (whitelist)
 * to disabledSkills (blacklist) for the native engine.
 *
 * @param enabledSkills - AionUi's enabledSkills from preset/conversation
 * @returns disabledSkills array for aioncli-core, or undefined if no filtering needed
 */
/** Exported for testing. */
export { shouldDistributeSkill, hasProvenanceMarker, PROVENANCE_MARKER };

// --- Engine-native skill detection ---

export type EngineNativeSkill = {
  name: string;
  engine: 'claude' | 'codex';
  path: string;
  hasSkillMd: boolean;
};

/**
 * Detect skills in engine discovery directories that are NOT managed by AionUi.
 * These are "engine-native" skills — created by the agent during a conversation
 * or manually placed by the user in the engine directory.
 *
 * Only scans Claude (.claude/skills/) and Codex (.agents/skills/) workspace directories.
 * Gemini is excluded because its skillsDir IS the AionUi skills directory.
 */
export function detectEngineNativeSkills(workspace: string): EngineNativeSkill[] {
  const results: EngineNativeSkill[] = [];
  const aionuiSkillsDir = getSkillsDir();

  const engineDirs: Array<{ dir: string; engine: 'claude' | 'codex' }> = [
    { dir: path.join(workspace, '.claude', 'skills'), engine: 'claude' },
    { dir: path.join(workspace, '.agents', 'skills'), engine: 'codex' },
  ];

  for (const { dir, engine } of engineDirs) {
    if (!existsSync(dir)) continue;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    const manifest = readManifest(dir);

    for (const entry of entries) {
      if (entry.name === MANIFEST_FILENAME) continue;
      if (entry.name.startsWith('.')) continue;

      const entryPath = path.join(dir, entry.name);

      // Skip AionUi-managed entries (symlinks or copies with provenance marker)
      if (isAionUiManagedSymlink(entryPath, aionuiSkillsDir)) continue;
      if (isAionUiManagedCopy(entry.name, manifest, entryPath)) continue;

      results.push({
        name: entry.name,
        engine,
        path: entryPath,
        hasSkillMd: existsSync(path.join(entryPath, 'SKILL.md')),
      });
    }
  }

  return results;
}

export function computeGeminiDisabledSkills(enabledSkills?: string[]): string[] | undefined {
  // No filtering: all skills available
  if (!enabledSkills || enabledSkills.length === 0) {
    return undefined;
  }

  const { optional } = discoverAllSkillNames();

  // Disabled = optional skills NOT in enabledSkills (builtins are never disabled)
  const disabled = optional.filter((name) => !enabledSkills.includes(name));

  return disabled.length > 0 ? disabled : undefined;
}
