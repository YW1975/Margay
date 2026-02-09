/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, utimesSync } from 'fs';
import path from 'path';
import os from 'os';

// --- Mock initStorage before importing SkillDistributor ---
const testRoot = path.join(os.tmpdir(), `aionui-skill-test-${process.pid}`);
const mockSkillsDir = path.join(testRoot, 'skills');
const mockBuiltinDir = path.join(testRoot, 'skills', '_builtin');

jest.mock('../../src/process/initStorage', () => ({
  getSkillsDir: () => mockSkillsDir,
}));

import { shouldDistributeSkill, computeGeminiDisabledSkills, hasProvenanceMarker, readSkillMetadata, writeSkillMetadata, PROVENANCE_MARKER, SKILL_METADATA_FILENAME, distributeForClaude, distributeForGemini, detectEngineNativeSkills, detectGlobalSkills } from '../../src/process/task/SkillDistributor';

// --- Helpers ---

function createSkillDir(baseDir: string, name: string): void {
  const dir = path.join(baseDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\n`);
}

function createSkillWithMetadata(baseDir: string, name: string, builtin: boolean): void {
  createSkillDir(baseDir, name);
  const dir = path.join(baseDir, name);
  writeSkillMetadata(dir, builtin);
}

function cleanTestRoot(): void {
  try {
    rmSync(testRoot, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

// --- Tests ---

describe('SkillDistributor', () => {
  describe('shouldDistributeSkill — canonical enabledSkills semantics', () => {
    it('builtin always distributes regardless of enabledSkills', () => {
      expect(shouldDistributeSkill('cron', true, undefined)).toBe(true);
      expect(shouldDistributeSkill('cron', true, [])).toBe(true);
      expect(shouldDistributeSkill('cron', true, ['pptx'])).toBe(true);
    });

    it('optional distributes when enabledSkills is undefined (all skills)', () => {
      expect(shouldDistributeSkill('pptx', false, undefined)).toBe(true);
    });

    it('optional distributes when enabledSkills is empty (all skills)', () => {
      expect(shouldDistributeSkill('pptx', false, [])).toBe(true);
    });

    it('optional distributes when listed in enabledSkills', () => {
      expect(shouldDistributeSkill('pptx', false, ['pptx', 'docx'])).toBe(true);
    });

    it('optional does NOT distribute when not listed in enabledSkills', () => {
      expect(shouldDistributeSkill('pptx', false, ['docx'])).toBe(false);
    });
  });

  describe('skill metadata — .aionui-skill.json read/write', () => {
    beforeEach(() => {
      cleanTestRoot();
      mkdirSync(mockSkillsDir, { recursive: true });
    });

    afterEach(() => {
      cleanTestRoot();
    });

    it('writeSkillMetadata creates valid metadata file', () => {
      const dir = path.join(testRoot, 'meta-test');
      mkdirSync(dir, { recursive: true });
      writeSkillMetadata(dir, true);

      const metaPath = path.join(dir, SKILL_METADATA_FILENAME);
      expect(existsSync(metaPath)).toBe(true);

      const content = JSON.parse(readFileSync(metaPath, 'utf-8'));
      expect(content.managedBy).toBe('aionui');
      expect(content.builtin).toBe(true);
    });

    it('readSkillMetadata reads valid metadata', () => {
      const dir = path.join(testRoot, 'meta-read');
      mkdirSync(dir, { recursive: true });
      writeSkillMetadata(dir, false);

      const meta = readSkillMetadata(dir);
      expect(meta).not.toBeNull();
      expect(meta!.managedBy).toBe('aionui');
      expect(meta!.builtin).toBe(false);
    });

    it('readSkillMetadata returns null for missing metadata', () => {
      const dir = path.join(testRoot, 'no-meta');
      mkdirSync(dir, { recursive: true });

      const meta = readSkillMetadata(dir);
      expect(meta).toBeNull();
    });

    it('readSkillMetadata returns null for invalid JSON', () => {
      const dir = path.join(testRoot, 'bad-meta');
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, SKILL_METADATA_FILENAME), 'not json');

      const meta = readSkillMetadata(dir);
      expect(meta).toBeNull();
    });
  });

  describe('computeGeminiDisabledSkills — whitelist to blacklist conversion', () => {
    beforeEach(() => {
      cleanTestRoot();
      // Rev 4: Use flat storage with metadata instead of _builtin/ directory
      mkdirSync(mockSkillsDir, { recursive: true });
      createSkillWithMetadata(mockSkillsDir, 'cron', true);
      createSkillWithMetadata(mockSkillsDir, 'shell-bg', true);
      createSkillDir(mockSkillsDir, 'pptx');
      createSkillDir(mockSkillsDir, 'docx');
      createSkillDir(mockSkillsDir, 'xlsx');
    });

    afterEach(() => {
      cleanTestRoot();
    });

    it('returns undefined when enabledSkills is undefined (no filtering)', () => {
      expect(computeGeminiDisabledSkills(undefined)).toBeUndefined();
    });

    it('returns undefined when enabledSkills is empty (no filtering)', () => {
      expect(computeGeminiDisabledSkills([])).toBeUndefined();
    });

    it('disables optional skills NOT in enabledSkills', () => {
      const disabled = computeGeminiDisabledSkills(['pptx']);
      expect(disabled).toBeDefined();
      expect(disabled).toContain('docx');
      expect(disabled).toContain('xlsx');
      expect(disabled).not.toContain('pptx');
    });

    it('never disables builtin skills', () => {
      const disabled = computeGeminiDisabledSkills(['pptx']);
      expect(disabled).not.toContain('cron');
      expect(disabled).not.toContain('shell-bg');
    });

    it('returns undefined when all optional skills are enabled', () => {
      expect(computeGeminiDisabledSkills(['pptx', 'docx', 'xlsx'])).toBeUndefined();
    });
  });

  describe('computeGeminiDisabledSkills — legacy _builtin/ backward compat', () => {
    beforeEach(() => {
      cleanTestRoot();
      // Legacy: Use _builtin/ subdirectory
      mkdirSync(mockBuiltinDir, { recursive: true });
      createSkillDir(mockBuiltinDir, 'cron');
      createSkillDir(mockSkillsDir, 'pptx');
    });

    afterEach(() => {
      cleanTestRoot();
    });

    it('legacy _builtin/ skills are still classified as builtin', () => {
      const disabled = computeGeminiDisabledSkills(['pptx']);
      // cron is in _builtin/ and should not be disabled
      expect(disabled).toBeUndefined(); // only pptx is optional and it's enabled
    });
  });

  describe('copy-mode provenance marker — ownership detection', () => {
    const targetDir = path.join(testRoot, 'target-engine', '.claude', 'skills');

    beforeEach(() => {
      cleanTestRoot();
      mkdirSync(mockSkillsDir, { recursive: true });
      createSkillWithMetadata(mockSkillsDir, 'cron', true);
      createSkillDir(mockSkillsDir, 'pptx');
    });

    afterEach(() => {
      cleanTestRoot();
    });

    it('hasProvenanceMarker returns false for non-existent directory', () => {
      expect(hasProvenanceMarker('/tmp/nonexistent-dir-xyz')).toBe(false);
    });

    it('hasProvenanceMarker returns false for directory without marker', () => {
      const dir = path.join(testRoot, 'no-marker');
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'SKILL.md'), '# test');
      expect(hasProvenanceMarker(dir)).toBe(false);
    });

    it('hasProvenanceMarker returns true for directory with marker', () => {
      const dir = path.join(testRoot, 'with-marker');
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, PROVENANCE_MARKER), 'managed-by-aionui\n');
      expect(hasProvenanceMarker(dir)).toBe(true);
    });

    it('engine-managed copy (no marker) is NOT deleted even if manifest lists it', () => {
      mkdirSync(targetDir, { recursive: true });

      // Create an engine-managed "pptx" directory (no marker)
      const enginePptx = path.join(targetDir, 'pptx');
      mkdirSync(enginePptx, { recursive: true });
      writeFileSync(path.join(enginePptx, 'SKILL.md'), '# Engine pptx');
      writeFileSync(path.join(enginePptx, 'custom-engine-file.txt'), 'engine content');

      // Write a stale manifest that claims "pptx" is AionUi-managed
      const manifest = { managedBy: 'aionui', skills: ['pptx'] };
      writeFileSync(path.join(targetDir, '.aionui-manifest.json'), JSON.stringify(manifest));

      // Run distribution — "pptx" should be SKIPPED because no provenance marker
      const workspace = path.join(testRoot, 'target-engine');
      distributeForClaude(workspace, ['pptx']);

      // Verify: engine's custom file still exists (not deleted)
      expect(existsSync(path.join(enginePptx, 'custom-engine-file.txt'))).toBe(true);
    });

    it('AionUi-managed copy (with marker) IS updated during distribution', () => {
      mkdirSync(targetDir, { recursive: true });

      // Create an AionUi-managed "pptx" directory WITH provenance marker
      const aionuiPptx = path.join(targetDir, 'pptx');
      mkdirSync(aionuiPptx, { recursive: true });
      writeFileSync(path.join(aionuiPptx, 'SKILL.md'), '# Old AionUi pptx');
      writeFileSync(path.join(aionuiPptx, PROVENANCE_MARKER), 'managed-by-aionui\n');

      // Write manifest that lists "pptx"
      const manifest = { managedBy: 'aionui', skills: ['pptx'] };
      writeFileSync(path.join(targetDir, '.aionui-manifest.json'), JSON.stringify(manifest));

      // Run distribution
      const workspace = path.join(testRoot, 'target-engine');
      distributeForClaude(workspace, ['pptx']);

      // Verify: pptx directory exists (was updated, not left stale)
      expect(existsSync(path.join(targetDir, 'pptx'))).toBe(true);
    });

    it('stale AionUi copy without marker is preserved during cleanup', () => {
      mkdirSync(targetDir, { recursive: true });

      // Create a directory named "old-skill" (no marker, but manifest lists it)
      const staleDir = path.join(targetDir, 'old-skill');
      mkdirSync(staleDir, { recursive: true });
      writeFileSync(path.join(staleDir, 'SKILL.md'), '# Old skill');
      // No provenance marker!

      // Write manifest listing "old-skill" as AionUi-managed
      const manifest = { managedBy: 'aionui', skills: ['old-skill'] };
      writeFileSync(path.join(targetDir, '.aionui-manifest.json'), JSON.stringify(manifest));

      // Run distribution with no skills matching "old-skill"
      const workspace = path.join(testRoot, 'target-engine');
      distributeForClaude(workspace, ['pptx']);

      // Verify: old-skill directory is NOT removed (no provenance marker = not ours to delete)
      expect(existsSync(staleDir)).toBe(true);
    });

    it('newly installed skill is distributed on subsequent distributeForClaude call (enabledSkills undefined)', () => {
      mkdirSync(targetDir, { recursive: true });

      // Initial distribution with one optional skill
      const workspace = path.join(testRoot, 'target-engine');
      distributeForClaude(workspace, undefined);

      // Verify: pptx is distributed
      expect(existsSync(path.join(targetDir, 'pptx'))).toBe(true);

      // Simulate installing a NEW skill after conversation started
      createSkillDir(mockSkillsDir, 'newly-installed');

      // Re-distribute (simulates sendMessage calling distributeForClaude again)
      distributeForClaude(workspace, undefined);

      // Verify: newly installed skill is now visible
      expect(existsSync(path.join(targetDir, 'newly-installed'))).toBe(true);
      // Original skill still present
      expect(existsSync(path.join(targetDir, 'pptx'))).toBe(true);
    });

    it('newly installed skill is NOT distributed when enabledSkills excludes it', () => {
      mkdirSync(targetDir, { recursive: true });

      // Initial distribution with explicit enabledSkills
      const workspace = path.join(testRoot, 'target-engine');
      distributeForClaude(workspace, ['pptx']);

      // Verify: pptx is distributed
      expect(existsSync(path.join(targetDir, 'pptx'))).toBe(true);

      // Simulate installing a NEW skill after conversation started
      createSkillDir(mockSkillsDir, 'newly-installed');

      // Re-distribute with same enabledSkills that does NOT include 'newly-installed'
      distributeForClaude(workspace, ['pptx']);

      // Verify: newly installed skill is NOT distributed (not in enabledSkills)
      expect(existsSync(path.join(targetDir, 'newly-installed'))).toBe(false);
      // Original skill still present
      expect(existsSync(path.join(targetDir, 'pptx'))).toBe(true);
    });

    it('stale AionUi copy WITH marker IS removed during cleanup', () => {
      mkdirSync(targetDir, { recursive: true });

      // Create a directory named "old-skill" WITH marker (legitimately ours)
      const staleDir = path.join(targetDir, 'old-skill');
      mkdirSync(staleDir, { recursive: true });
      writeFileSync(path.join(staleDir, 'SKILL.md'), '# Old skill');
      writeFileSync(path.join(staleDir, PROVENANCE_MARKER), 'managed-by-aionui\n');

      // Write manifest listing "old-skill"
      const manifest = { managedBy: 'aionui', skills: ['old-skill'] };
      writeFileSync(path.join(targetDir, '.aionui-manifest.json'), JSON.stringify(manifest));

      // Run distribution with no skills matching "old-skill"
      const workspace = path.join(testRoot, 'target-engine');
      distributeForClaude(workspace, ['pptx']);

      // Verify: old-skill directory IS removed (marker + manifest = safe to delete)
      expect(existsSync(staleDir)).toBe(false);
    });
  });

  describe('mtime-based refresh — needsUpdate via distributeForClaude', () => {
    const targetDir = path.join(testRoot, 'mtime-workspace', '.claude', 'skills');

    beforeEach(() => {
      cleanTestRoot();
      mkdirSync(mockSkillsDir, { recursive: true });
      createSkillWithMetadata(mockSkillsDir, 'cron', true);
      createSkillDir(mockSkillsDir, 'pptx');
    });

    afterEach(() => {
      cleanTestRoot();
    });

    it('skips re-copy when target SKILL.md is current', () => {
      const workspace = path.join(testRoot, 'mtime-workspace');

      // First distribution: creates copy
      distributeForClaude(workspace, ['pptx']);
      expect(existsSync(path.join(targetDir, 'pptx', 'SKILL.md'))).toBe(true);

      // Read target content
      const contentBefore = readFileSync(path.join(targetDir, 'pptx', 'SKILL.md'), 'utf-8');

      // Modify target content directly (simulating engine edit)
      writeFileSync(path.join(targetDir, 'pptx', 'SKILL.md'), contentBefore + '\n# Engine edit');

      // Second distribution: source mtime hasn't changed, so should skip
      distributeForClaude(workspace, ['pptx']);

      // Target should still have the engine edit (not overwritten)
      const contentAfter = readFileSync(path.join(targetDir, 'pptx', 'SKILL.md'), 'utf-8');
      expect(contentAfter).toContain('# Engine edit');
    });

    it('re-copies when source SKILL.md is newer', () => {
      const workspace = path.join(testRoot, 'mtime-workspace');

      // First distribution
      distributeForClaude(workspace, ['pptx']);

      // Update source SKILL.md with a newer timestamp
      const sourcePath = path.join(mockSkillsDir, 'pptx', 'SKILL.md');
      const futureTime = new Date(Date.now() + 60000);
      writeFileSync(sourcePath, readFileSync(sourcePath, 'utf-8') + '\n# Updated');
      utimesSync(sourcePath, futureTime, futureTime);

      // Second distribution: should re-copy because source is newer
      distributeForClaude(workspace, ['pptx']);

      const targetContent = readFileSync(path.join(targetDir, 'pptx', 'SKILL.md'), 'utf-8');
      expect(targetContent).toContain('# Updated');
    });
  });

  describe('path injection — injectSkillPath for script-heavy skills', () => {
    const targetDir = path.join(testRoot, 'inject-workspace', '.claude', 'skills');

    beforeEach(() => {
      cleanTestRoot();
      mkdirSync(mockSkillsDir, { recursive: true });
      createSkillWithMetadata(mockSkillsDir, 'cron', true);
    });

    afterEach(() => {
      cleanTestRoot();
    });

    it('injects path hint AFTER frontmatter when skill contains root-level scripts', () => {
      const skillDir = path.join(mockSkillsDir, 'scripted');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: scripted\ndescription: A script skill\n---\n# Scripted');
      writeFileSync(path.join(skillDir, 'run.py'), 'print("hello")');

      const workspace = path.join(testRoot, 'inject-workspace');
      distributeForClaude(workspace, undefined);

      const deployedSkillMd = readFileSync(path.join(targetDir, 'scripted', 'SKILL.md'), 'utf-8');
      // Frontmatter must remain at file start (^---)
      expect(deployedSkillMd).toMatch(/^---\n/);
      // Path hint appears after frontmatter
      expect(deployedSkillMd).toContain('[Skill scripts directory:');
      // Frontmatter is intact
      expect(deployedSkillMd).toContain('name: scripted');
    });

    it('injects path hint when scripts are in subdirectories', () => {
      const skillDir = path.join(mockSkillsDir, 'nested-scripts');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: nested-scripts\ndescription: Nested\n---\n# Nested');
      // Scripts in subdirectory (realistic layout like pptx/scripts/html2pptx.js)
      mkdirSync(path.join(skillDir, 'scripts'), { recursive: true });
      writeFileSync(path.join(skillDir, 'scripts', 'convert.py'), 'print("convert")');

      const workspace = path.join(testRoot, 'inject-workspace');
      distributeForClaude(workspace, undefined);

      const deployedSkillMd = readFileSync(path.join(targetDir, 'nested-scripts', 'SKILL.md'), 'utf-8');
      expect(deployedSkillMd).toMatch(/^---\n/);
      expect(deployedSkillMd).toContain('[Skill scripts directory:');
    });

    it('does NOT inject path hint for non-script skills', () => {
      const skillDir = path.join(mockSkillsDir, 'no-script');
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(path.join(skillDir, 'SKILL.md'), '---\nname: no-script\ndescription: No scripts\n---\n# No Script');

      const workspace = path.join(testRoot, 'inject-workspace');
      distributeForClaude(workspace, undefined);

      const deployedSkillMd = readFileSync(path.join(targetDir, 'no-script', 'SKILL.md'), 'utf-8');
      expect(deployedSkillMd).not.toContain('[Skill scripts directory:');
    });
  });

  describe('distributeForGemini — Gemini workspace distribution', () => {
    const geminiTargetDir = path.join(testRoot, 'gemini-workspace', '.gemini', 'skills');

    beforeEach(() => {
      cleanTestRoot();
      mkdirSync(mockSkillsDir, { recursive: true });
      createSkillWithMetadata(mockSkillsDir, 'cron', true);
      createSkillDir(mockSkillsDir, 'pptx');
    });

    afterEach(() => {
      cleanTestRoot();
    });

    it('distributes skills to .gemini/skills/ directory', () => {
      const workspace = path.join(testRoot, 'gemini-workspace');
      distributeForGemini(workspace, undefined);

      expect(existsSync(path.join(geminiTargetDir, 'cron', 'SKILL.md'))).toBe(true);
      expect(existsSync(path.join(geminiTargetDir, 'pptx', 'SKILL.md'))).toBe(true);
    });

    it('respects enabledSkills filter', () => {
      const workspace = path.join(testRoot, 'gemini-workspace');
      distributeForGemini(workspace, ['pptx']);

      // cron is builtin, always distributed
      expect(existsSync(path.join(geminiTargetDir, 'cron', 'SKILL.md'))).toBe(true);
      // pptx is enabled
      expect(existsSync(path.join(geminiTargetDir, 'pptx', 'SKILL.md'))).toBe(true);
    });
  });

  describe('detectEngineNativeSkills — engine-native skill detection', () => {
    const workspace = path.join(testRoot, 'detect-workspace');
    const claudeSkillsDir = path.join(workspace, '.claude', 'skills');
    const codexSkillsDir = path.join(workspace, '.agents', 'skills');
    const geminiSkillsDir = path.join(workspace, '.gemini', 'skills');

    beforeEach(() => {
      cleanTestRoot();
      mkdirSync(mockSkillsDir, { recursive: true });
      createSkillWithMetadata(mockSkillsDir, 'cron', true);
      createSkillDir(mockSkillsDir, 'pptx');
    });

    afterEach(() => {
      cleanTestRoot();
    });

    it('returns empty array when no engine directories exist', () => {
      const results = detectEngineNativeSkills(workspace);
      expect(results).toEqual([]);
    });

    it('skips AionUi-managed symlinks', () => {
      // Distribute first to create AionUi-managed copies
      distributeForClaude(workspace);

      const results = detectEngineNativeSkills(workspace);
      // All entries are AionUi-managed copies, so nothing should be detected
      expect(results).toEqual([]);
    });

    it('skips AionUi-managed copies (with provenance marker)', () => {
      mkdirSync(claudeSkillsDir, { recursive: true });

      // Create a copy with provenance marker
      const copyDir = path.join(claudeSkillsDir, 'managed-copy');
      mkdirSync(copyDir, { recursive: true });
      writeFileSync(path.join(copyDir, 'SKILL.md'), '# Managed copy');
      writeFileSync(path.join(copyDir, PROVENANCE_MARKER), 'managed-by-aionui\n');

      // Write manifest listing it
      const manifest = { managedBy: 'aionui', skills: ['managed-copy'] };
      writeFileSync(path.join(claudeSkillsDir, '.aionui-manifest.json'), JSON.stringify(manifest));

      const results = detectEngineNativeSkills(workspace);
      expect(results).toEqual([]);
    });

    it('returns engine-native entries with correct engine label', () => {
      // Create engine-native skill in Claude directory
      mkdirSync(claudeSkillsDir, { recursive: true });
      const nativeDir = path.join(claudeSkillsDir, 'claude-helper');
      mkdirSync(nativeDir, { recursive: true });
      writeFileSync(path.join(nativeDir, 'SKILL.md'), '---\nname: claude-helper\ndescription: Agent-created\n---\n# Helper');

      // Create engine-native skill in Codex directory
      mkdirSync(codexSkillsDir, { recursive: true });
      const codexNativeDir = path.join(codexSkillsDir, 'codex-tool');
      mkdirSync(codexNativeDir, { recursive: true });
      writeFileSync(path.join(codexNativeDir, 'SKILL.md'), '# Codex tool');

      const results = detectEngineNativeSkills(workspace);
      expect(results).toHaveLength(2);

      const claudeResult = results.find((r) => r.engine === 'claude');
      expect(claudeResult).toBeDefined();
      expect(claudeResult!.name).toBe('claude-helper');
      expect(claudeResult!.hasSkillMd).toBe(true);

      const codexResult = results.find((r) => r.engine === 'codex');
      expect(codexResult).toBeDefined();
      expect(codexResult!.name).toBe('codex-tool');
      expect(codexResult!.hasSkillMd).toBe(true);
    });

    it('detects Gemini engine-native skills', () => {
      mkdirSync(geminiSkillsDir, { recursive: true });
      const geminiNativeDir = path.join(geminiSkillsDir, 'gemini-helper');
      mkdirSync(geminiNativeDir, { recursive: true });
      writeFileSync(path.join(geminiNativeDir, 'SKILL.md'), '# Gemini helper');

      const results = detectEngineNativeSkills(workspace);
      expect(results).toHaveLength(1);
      expect(results[0].engine).toBe('gemini');
      expect(results[0].name).toBe('gemini-helper');
    });

    it('handles missing workspace gracefully', () => {
      const results = detectEngineNativeSkills('/tmp/nonexistent-workspace-xyz');
      expect(results).toEqual([]);
    });

    it('detects entries without SKILL.md (hasSkillMd = false)', () => {
      mkdirSync(claudeSkillsDir, { recursive: true });

      // Create a directory without SKILL.md
      const noSkillMd = path.join(claudeSkillsDir, 'incomplete-skill');
      mkdirSync(noSkillMd, { recursive: true });
      writeFileSync(path.join(noSkillMd, 'README.md'), '# Not a proper skill');

      const results = detectEngineNativeSkills(workspace);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('incomplete-skill');
      expect(results[0].hasSkillMd).toBe(false);
    });

    it('skips hidden directories (dotfiles)', () => {
      mkdirSync(claudeSkillsDir, { recursive: true });

      // Create a hidden directory
      const hiddenDir = path.join(claudeSkillsDir, '.hidden-skill');
      mkdirSync(hiddenDir, { recursive: true });
      writeFileSync(path.join(hiddenDir, 'SKILL.md'), '# Hidden');

      // Create a visible engine-native skill
      const visibleDir = path.join(claudeSkillsDir, 'visible-skill');
      mkdirSync(visibleDir, { recursive: true });
      writeFileSync(path.join(visibleDir, 'SKILL.md'), '# Visible');

      const results = detectEngineNativeSkills(workspace);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('visible-skill');
    });
  });

  describe('detectGlobalSkills — home directory skill detection', () => {
    const fakeHome = path.join(testRoot, 'fake-home');
    const claudeGlobalDir = path.join(fakeHome, '.claude', 'skills');
    const geminiGlobalDir = path.join(fakeHome, '.gemini', 'skills');

    beforeEach(() => {
      cleanTestRoot();
    });

    afterEach(() => {
      cleanTestRoot();
    });

    it('returns empty array when no global directories exist', () => {
      mkdirSync(fakeHome, { recursive: true });
      const results = detectGlobalSkills(fakeHome);
      expect(results).toEqual([]);
    });

    it('detects skills in ~/.claude/skills/', () => {
      mkdirSync(claudeGlobalDir, { recursive: true });
      const skillDir = path.join(claudeGlobalDir, 'global-claude-skill');
      mkdirSync(skillDir);
      writeFileSync(path.join(skillDir, 'SKILL.md'), '# Global Claude skill');

      const results = detectGlobalSkills(fakeHome);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('global-claude-skill');
      expect(results[0].engine).toBe('claude');
      expect(results[0].hasSkillMd).toBe(true);
    });

    it('detects skills in ~/.gemini/skills/', () => {
      mkdirSync(geminiGlobalDir, { recursive: true });
      const skillDir = path.join(geminiGlobalDir, 'global-gemini-skill');
      mkdirSync(skillDir);
      writeFileSync(path.join(skillDir, 'SKILL.md'), '# Global Gemini skill');

      const results = detectGlobalSkills(fakeHome);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('global-gemini-skill');
      expect(results[0].engine).toBe('gemini');
      expect(results[0].hasSkillMd).toBe(true);
    });

    it('detects skills from both engines', () => {
      mkdirSync(claudeGlobalDir, { recursive: true });
      mkdirSync(geminiGlobalDir, { recursive: true });

      const claudeSkill = path.join(claudeGlobalDir, 'skill-a');
      mkdirSync(claudeSkill);
      writeFileSync(path.join(claudeSkill, 'SKILL.md'), '# A');

      const geminiSkill = path.join(geminiGlobalDir, 'skill-b');
      mkdirSync(geminiSkill);
      writeFileSync(path.join(geminiSkill, 'SKILL.md'), '# B');

      const results = detectGlobalSkills(fakeHome);
      expect(results).toHaveLength(2);
      expect(results.find((r) => r.engine === 'claude')?.name).toBe('skill-a');
      expect(results.find((r) => r.engine === 'gemini')?.name).toBe('skill-b');
    });

    it('skips hidden directories and non-directories', () => {
      mkdirSync(claudeGlobalDir, { recursive: true });

      // Hidden dir
      const hiddenDir = path.join(claudeGlobalDir, '.hidden');
      mkdirSync(hiddenDir);
      writeFileSync(path.join(hiddenDir, 'SKILL.md'), '# Hidden');

      // File (not a directory)
      writeFileSync(path.join(claudeGlobalDir, 'not-a-dir.md'), '# file');

      // Visible dir
      const visibleDir = path.join(claudeGlobalDir, 'visible');
      mkdirSync(visibleDir);
      writeFileSync(path.join(visibleDir, 'SKILL.md'), '# Visible');

      const results = detectGlobalSkills(fakeHome);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('visible');
    });

    it('reports hasSkillMd = false when SKILL.md is missing', () => {
      mkdirSync(claudeGlobalDir, { recursive: true });
      const noMdDir = path.join(claudeGlobalDir, 'no-md');
      mkdirSync(noMdDir);
      writeFileSync(path.join(noMdDir, 'README.md'), '# No SKILL.md');

      const results = detectGlobalSkills(fakeHome);
      expect(results).toHaveLength(1);
      expect(results[0].hasSkillMd).toBe(false);
    });
  });
});
