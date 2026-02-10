/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SkillDistributor - Distributes Margay-managed skills to engine discovery directories.
 *
 * Rev 4: All-copy distribution with mtime-based refresh, flat storage with
 * .margay-skill.json metadata, and path injection for script-heavy skills.
 *
 * Supports: Claude Code (.claude/skills/), Codex (.agents/skills/), Gemini (.gemini/skills/)
 */

import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { getSkillsDir } from '../initStorage';

const MANIFEST_FILENAME = '.margay-manifest.json';
const PROVENANCE_MARKER = '.margay-managed';
const SKILL_METADATA_FILENAME = '.margay-skill.json';

type DistributionMode = 'copy';

interface ManifestData {
  managedBy: 'margay';
  skills: string[];
}

interface SkillMetadata {
  managedBy: 'margay';
  builtin: boolean;
  sourceDir?: string;
}

/**
 * Read .margay-skill.json metadata from a skill directory.
 */
function readSkillMetadata(skillDir: string): SkillMetadata | null {
  const metadataPath = path.join(skillDir, SKILL_METADATA_FILENAME);
  try {
    if (!existsSync(metadataPath)) return null;
    const raw = readFileSync(metadataPath, 'utf-8');
    const data = JSON.parse(raw);
    if (data?.managedBy === 'margay' && typeof data.builtin === 'boolean') {
      return data as SkillMetadata;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write .margay-skill.json metadata to a skill directory.
 */
function writeSkillMetadata(skillDir: string, builtin: boolean): void {
  const metadataPath = path.join(skillDir, SKILL_METADATA_FILENAME);
  const data: SkillMetadata = { managedBy: 'margay', builtin, sourceDir: skillDir };
  try {
    writeFileSync(metadataPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.warn(`[SkillDistributor] Failed to write skill metadata to ${skillDir}:`, error);
  }
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
 * Check if an entry in the target directory is managed by Margay (is a symlink pointing to ~/.margay/skills/).
 */
function isMargayManagedSymlink(entryPath: string, margaySkillsDir: string): boolean {
  try {
    const stats = lstatSync(entryPath);
    if (!stats.isSymbolicLink()) return false;
    const target = readlinkSync(entryPath);
    // Resolve to absolute for comparison
    const resolvedTarget = path.isAbsolute(target) ? target : path.resolve(path.dirname(entryPath), target);
    return resolvedTarget.startsWith(margaySkillsDir);
  } catch {
    return false;
  }
}

/**
 * Read the Margay manifest from a target directory (used for copy-mode tracking on Windows).
 */
function readManifest(targetDir: string): ManifestData | null {
  const manifestPath = path.join(targetDir, MANIFEST_FILENAME);
  try {
    if (!existsSync(manifestPath)) return null;
    const raw = readFileSync(manifestPath, 'utf-8');
    const data = JSON.parse(raw);
    if (data?.managedBy === 'margay' && Array.isArray(data.skills)) {
      return data as ManifestData;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Write the Margay manifest to a target directory.
 */
function writeManifest(targetDir: string, skills: string[]): void {
  const manifestPath = path.join(targetDir, MANIFEST_FILENAME);
  const data: ManifestData = { managedBy: 'margay', skills };
  try {
    writeFileSync(manifestPath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.warn(`[SkillDistributor] Failed to write manifest to ${targetDir}:`, error);
  }
}

/**
 * Check if a copied skill directory contains the Margay provenance marker.
 * The marker is written inside each Margay-managed copy and proves ownership
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
    writeFileSync(path.join(skillDir, PROVENANCE_MARKER), 'managed-by-margay\n', 'utf-8');
  } catch {
    // Non-fatal: marker write failure doesn't block distribution
  }
}

/**
 * Check if an entry is Margay-managed via manifest AND provenance marker.
 * Requires both: manifest lists the skill AND the directory contains the marker file.
 * This prevents stale manifests from causing deletion of engine-managed entries.
 */
function isMargayManagedCopy(skillName: string, manifest: ManifestData | null, targetPath: string): boolean {
  if (!manifest || !manifest.skills.includes(skillName)) return false;
  return hasProvenanceMarker(targetPath);
}

/**
 * Check if source SKILL.md is newer than target SKILL.md (mtime comparison).
 * Returns true if target needs updating.
 */
function needsUpdate(sourcePath: string, targetPath: string): boolean {
  try {
    const sourceSkillMd = path.join(sourcePath, 'SKILL.md');
    const targetSkillMd = path.join(targetPath, 'SKILL.md');
    if (!existsSync(targetSkillMd)) return true;
    const sourceStat = statSync(sourceSkillMd);
    const targetStat = statSync(targetSkillMd);
    return sourceStat.mtimeMs > targetStat.mtimeMs;
  } catch {
    return true; // If we can't compare, re-copy to be safe
  }
}

/**
 * Distribute a single skill to the target directory.
 * Rev 4: copy-only (no symlinks), with mtime check and legacy symlink migration.
 * Returns the distribution mode used, or null if skipped.
 */
function distributeSkillEntry(sourcePath: string, targetPath: string, margaySkillsDir: string, manifest: ManifestData | null): DistributionMode | null {
  const skillName = path.basename(targetPath);

  // Check if target already exists
  if (existsSync(targetPath) || lstatSafe(targetPath)) {
    // Legacy symlink migration: replace Margay symlinks with copies
    if (isMargayManagedSymlink(targetPath, margaySkillsDir)) {
      unlinkSync(targetPath);
      // Fall through to copy below
    } else if (isMargayManagedCopy(skillName, manifest, targetPath)) {
      // Margay-managed copy — check mtime before re-copying
      if (!needsUpdate(sourcePath, targetPath)) {
        return 'copy'; // Already current, no-op
      }
      rmSync(targetPath, { recursive: true, force: true });
      // Fall through to copy below
    } else {
      // Engine-managed or third-party entry — skip
      console.log(`[SkillDistributor] Skipped '${skillName}': already exists (engine-managed)`);
      return null;
    }
  }

  // Copy skill to target directory
  try {
    cpSync(sourcePath, targetPath, { recursive: true, force: false });
    writeProvenanceMarker(targetPath);
    injectSkillPath(targetPath);
    return 'copy';
  } catch (error) {
    console.warn(`[SkillDistributor] Copy failed for '${skillName}':`, error);
    return null;
  }
}

/**
 * Recursively check if a directory contains script files (*.py, *.js, *.sh).
 */
function hasScriptFiles(dir: string, depth = 0): boolean {
  if (depth > 3) return false; // Limit recursion depth
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (!entry.isDirectory() && /\.(py|js|sh)$/i.test(entry.name)) return true;
      if (entry.isDirectory()) {
        if (hasScriptFiles(path.join(dir, entry.name), depth + 1)) return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Inject absolute skill directory path into deployed SKILL.md for script-heavy skills.
 * Only modifies the DEPLOYED copy, never the source.
 * Recursively scans for *.py, *.js, *.sh files; if found, injects path hint AFTER
 * YAML frontmatter to preserve `^---` parsing required by aioncli-core skillLoader.
 */
function injectSkillPath(skillDir: string): void {
  try {
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    if (!existsSync(skillMdPath)) return;

    // Recursive check for script files
    if (!hasScriptFiles(skillDir)) return;

    const content = readFileSync(skillMdPath, 'utf-8');
    const pathHint = `\n[Skill scripts directory: ${skillDir}]\n`;

    // Don't inject twice
    if (content.includes('[Skill scripts directory:')) return;

    // Inject AFTER frontmatter to preserve ^--- parsing
    const frontmatterEnd = content.match(/^---\s*\n[\s\S]*?\n---\s*\n/);
    if (frontmatterEnd) {
      const insertPos = frontmatterEnd[0].length;
      writeFileSync(skillMdPath, content.slice(0, insertPos) + pathHint + content.slice(insertPos), 'utf-8');
    } else {
      // No frontmatter: prepend as before
      writeFileSync(skillMdPath, pathHint + '\n' + content, 'utf-8');
    }
  } catch {
    // Non-fatal: path injection failure doesn't block distribution
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
 * Reconcile: remove stale Margay-managed entries from target directory.
 * Only removes entries that are Margay-managed (symlinks to ~/.margay/skills/ or listed in manifest).
 * Never touches engine-managed entries.
 */
function cleanupStaleEntries(targetDir: string, desiredSkillNames: Set<string>, margaySkillsDir: string, usedCopyMode: boolean): void {
  if (!existsSync(targetDir)) return;

  try {
    const entries = readdirSync(targetDir, { withFileTypes: true });
    const manifest = usedCopyMode ? readManifest(targetDir) : null;

    for (const entry of entries) {
      if (entry.name === MANIFEST_FILENAME) continue;
      if (desiredSkillNames.has(entry.name)) continue;

      const entryPath = path.join(targetDir, entry.name);

      // Check if Margay-managed via symlink
      if (isMargayManagedSymlink(entryPath, margaySkillsDir)) {
        try {
          unlinkSync(entryPath);
          console.log(`[SkillDistributor] Removed stale symlink: ${entry.name}`);
        } catch (error) {
          console.warn(`[SkillDistributor] Failed to remove stale symlink '${entry.name}':`, error);
        }
        continue;
      }

      // Check if Margay-managed via manifest AND provenance marker (copy mode)
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
 * Get the list of all available skill names (builtin + optional) from Margay skills directory.
 * Uses .margay-skill.json metadata for classification (Rev 4 flat storage).
 * Backward compatible: skills without metadata in _builtin/ are still treated as builtin.
 */
function discoverAllSkillNames(): { builtins: string[]; optional: string[] } {
  const skillsDir = getSkillsDir();
  const builtins: string[] = [];
  const optional: string[] = [];

  if (!existsSync(skillsDir)) return { builtins, optional };

  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '_builtin') continue; // Skip legacy dir (will be migrated)
      if (entry.name.startsWith('.')) continue; // Skip hidden/metadata

      const skillDir = path.join(skillsDir, entry.name);
      if (!existsSync(path.join(skillDir, 'SKILL.md'))) continue;

      // Check metadata for builtin classification
      const metadata = readSkillMetadata(skillDir);
      if (metadata?.builtin) {
        builtins.push(entry.name);
      } else {
        optional.push(entry.name);
      }
    }
  } catch (error) {
    console.warn('[SkillDistributor] Failed to discover skills:', error);
  }

  // Backward compat: also check legacy _builtin/ directory
  const legacyBuiltinDir = path.join(skillsDir, '_builtin');
  if (existsSync(legacyBuiltinDir)) {
    try {
      const entries = readdirSync(legacyBuiltinDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (existsSync(path.join(legacyBuiltinDir, entry.name, 'SKILL.md'))) {
          if (!builtins.includes(entry.name)) {
            builtins.push(entry.name);
          }
        }
      }
    } catch (error) {
      console.warn('[SkillDistributor] Failed to discover legacy builtin skills:', error);
    }
  }

  return { builtins, optional };
}

/**
 * Core distribution logic: distribute skills to a target engine directory.
 */
function distributeToEngineDir(targetDir: string, enabledSkills?: string[]): void {
  const skillsDir = getSkillsDir();
  const { builtins, optional } = discoverAllSkillNames();

  // Compute desired set — all skills sourced from flat skillsDir (with legacy _builtin/ fallback)
  const desiredSkillNames = new Set<string>();
  const desiredEntries: Array<{ name: string; sourcePath: string }> = [];

  const resolveSkillSource = (name: string): string => {
    // Flat storage: skill at top-level
    const flatPath = path.join(skillsDir, name);
    if (existsSync(flatPath)) return flatPath;
    // Legacy fallback: skill in _builtin/
    const legacyPath = path.join(skillsDir, '_builtin', name);
    if (existsSync(legacyPath)) return legacyPath;
    return flatPath; // Default to flat (will fail gracefully)
  };

  for (const name of builtins) {
    if (shouldDistributeSkill(name, true, enabledSkills)) {
      desiredSkillNames.add(name);
      desiredEntries.push({ name, sourcePath: resolveSkillSource(name) });
    }
  }

  for (const name of optional) {
    if (shouldDistributeSkill(name, false, enabledSkills)) {
      desiredSkillNames.add(name);
      desiredEntries.push({ name, sourcePath: resolveSkillSource(name) });
    }
  }

  // Ensure target directory exists
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  // Read existing manifest upfront (needed for copy-mode ownership detection)
  const existingManifest = readManifest(targetDir);

  // Rev 4: always copy mode — distribute each skill
  const distributedSkills: string[] = [];

  for (const { name, sourcePath } of desiredEntries) {
    const targetPath = path.join(targetDir, name);
    const mode = distributeSkillEntry(sourcePath, targetPath, skillsDir, existingManifest);
    if (mode) {
      distributedSkills.push(name);
    }
  }

  // Cleanup stale entries (always check manifest for ownership)
  cleanupStaleEntries(targetDir, desiredSkillNames, skillsDir, true);

  // Always write manifest (copy-only mode)
  writeManifest(targetDir, distributedSkills);

  if (distributedSkills.length > 0) {
    console.log(`[SkillDistributor] Distributed ${distributedSkills.length} skills to ${targetDir}`);
  }
}

/**
 * Distribute Margay skills to Claude Code's discovery directory.
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
 * Distribute Margay skills to Codex CLI's discovery directory.
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
 * Distribute Margay skills to Gemini CLI's discovery directory.
 * Rev 4: Gemini now uses workspace .gemini/skills/ for engine-native detection parity.
 * Note: aioncli-core still loads skills from its own path; this is for UI display only.
 * Distribution is bootstrap-only (not per-send).
 */
export function distributeForGemini(workspace: string, enabledSkills?: string[]): void {
  const targetDir = path.join(workspace, '.gemini', 'skills');
  try {
    distributeToEngineDir(targetDir, enabledSkills);
  } catch (error) {
    console.error('[SkillDistributor] Failed to distribute for Gemini:', error);
  }
}

/**
 * Compute disabledSkills for Gemini's native SkillManager.
 *
 * Gemini's aioncli-core SkillManager scans the entire skillsDir and uses
 * disabledSkills to filter. We convert Margay's enabledSkills (whitelist)
 * to disabledSkills (blacklist) for the native engine.
 *
 * @param enabledSkills - Margay's enabledSkills from preset/conversation
 * @returns disabledSkills array for aioncli-core, or undefined if no filtering needed
 */
/** Exported for testing. */
export { shouldDistributeSkill, hasProvenanceMarker, readSkillMetadata, writeSkillMetadata, PROVENANCE_MARKER, SKILL_METADATA_FILENAME };

// --- Engine-native skill detection ---

export type EngineNativeSkill = {
  name: string;
  engine: 'claude' | 'codex' | 'gemini';
  path: string;
  hasSkillMd: boolean;
};

/**
 * Detect skills in engine discovery directories that are NOT managed by Margay.
 * These are "engine-native" skills — created by the agent during a conversation
 * or manually placed by the user in the engine directory.
 *
 * Rev 4: scans Claude, Codex, and Gemini workspace directories.
 */
export function detectEngineNativeSkills(workspace: string): EngineNativeSkill[] {
  const results: EngineNativeSkill[] = [];
  const margaySkillsDir = getSkillsDir();

  const engineDirs: Array<{ dir: string; engine: 'claude' | 'codex' | 'gemini' }> = [
    { dir: path.join(workspace, '.claude', 'skills'), engine: 'claude' },
    { dir: path.join(workspace, '.agents', 'skills'), engine: 'codex' },
    { dir: path.join(workspace, '.gemini', 'skills'), engine: 'gemini' },
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

      // Skip Margay-managed entries (symlinks or copies with provenance marker)
      if (isMargayManagedSymlink(entryPath, margaySkillsDir)) continue;
      if (isMargayManagedCopy(entry.name, manifest, entryPath)) continue;

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

// --- Global skill detection ---

export type GlobalSkill = {
  name: string;
  engine: 'claude' | 'gemini';
  path: string;
  hasSkillMd: boolean;
};

/**
 * Detect skills installed at global (home directory) engine paths.
 * These are read-only from Margay's perspective — users or agents installed
 * them directly at ~/.claude/skills/ or ~/.gemini/skills/.
 *
 * Unlike engine-native skills (workspace-scoped), global skills persist
 * across all workspaces.
 */
export function detectGlobalSkills(homedir: string): GlobalSkill[] {
  const results: GlobalSkill[] = [];

  const globalDirs: Array<{ dir: string; engine: 'claude' | 'gemini' }> = [
    { dir: path.join(homedir, '.claude', 'skills'), engine: 'claude' },
    { dir: path.join(homedir, '.gemini', 'skills'), engine: 'gemini' },
  ];

  for (const { dir, engine } of globalDirs) {
    if (!existsSync(dir)) continue;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;

      const entryPath = path.join(dir, entry.name);
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
