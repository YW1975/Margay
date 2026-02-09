/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import path from 'path';
import os from 'os';

// --- Mock initStorage before importing SkillDistributor ---
const testRoot = path.join(os.tmpdir(), `aionui-skill-test-${process.pid}`);
const mockSkillsDir = path.join(testRoot, 'skills');
const mockBuiltinDir = path.join(testRoot, 'skills', '_builtin');

jest.mock('../../src/process/initStorage', () => ({
  getSkillsDir: () => mockSkillsDir,
  getBuiltinSkillsDir: () => mockBuiltinDir,
}));

import { shouldDistributeSkill, computeGeminiDisabledSkills, hasProvenanceMarker, PROVENANCE_MARKER, distributeForClaude, detectEngineNativeSkills } from '../../src/process/task/SkillDistributor';

// --- Helpers ---

function createSkillDir(baseDir: string, name: string): void {
  const dir = path.join(baseDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\n`);
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

  describe('computeGeminiDisabledSkills — whitelist to blacklist conversion', () => {
    beforeEach(() => {
      cleanTestRoot();
      // Create mock skill structure
      mkdirSync(mockBuiltinDir, { recursive: true });
      createSkillDir(mockBuiltinDir, 'cron');
      createSkillDir(mockBuiltinDir, 'shell-bg');
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

  describe('copy-mode provenance marker — ownership detection', () => {
    const targetDir = path.join(testRoot, 'target-engine', '.claude', 'skills');

    beforeEach(() => {
      cleanTestRoot();
      mkdirSync(mockBuiltinDir, { recursive: true });
      createSkillDir(mockBuiltinDir, 'cron');
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
      // Simulate: manifest says "pptx" is AionUi-managed, but the directory
      // was replaced by the engine (no provenance marker inside).
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

  describe('detectEngineNativeSkills — engine-native skill detection', () => {
    const workspace = path.join(testRoot, 'detect-workspace');
    const claudeSkillsDir = path.join(workspace, '.claude', 'skills');
    const codexSkillsDir = path.join(workspace, '.agents', 'skills');

    beforeEach(() => {
      cleanTestRoot();
      mkdirSync(mockBuiltinDir, { recursive: true });
      createSkillDir(mockBuiltinDir, 'cron');
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
      // Distribute first to create AionUi-managed symlinks
      distributeForClaude(workspace);

      const results = detectEngineNativeSkills(workspace);
      // All entries are AionUi-managed symlinks, so nothing should be detected
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
});
