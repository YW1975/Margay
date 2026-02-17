/**
 * Database Migration Structure Test
 *
 * Validates migration definitions are well-formed and complete.
 * Note: actual SQLite execution requires Electron runtime (better-sqlite3
 * is compiled for Electron's Node version). Runtime migration is verified
 * during manual app startup testing.
 */
import { describe, it, expect } from '@jest/globals';
import { ALL_MIGRATIONS } from '@process/database/migrations';
import { CURRENT_DB_VERSION } from '@process/database/schema';

describe('Database Migrations Structure', () => {
  it('should have CURRENT_DB_VERSION = 16', () => {
    expect(CURRENT_DB_VERSION).toBe(16);
  });

  it('should have exactly CURRENT_DB_VERSION migrations', () => {
    expect(ALL_MIGRATIONS).toHaveLength(CURRENT_DB_VERSION);
  });

  it('should have sequential version numbers starting from 1', () => {
    ALL_MIGRATIONS.forEach((m, i) => {
      expect(m.version).toBe(i + 1);
    });
  });

  it('every migration should have name, up, and down', () => {
    ALL_MIGRATIONS.forEach((m) => {
      expect(m.name).toBeTruthy();
      expect(typeof m.name).toBe('string');
      expect(typeof m.up).toBe('function');
      expect(typeof m.down).toBe('function');
    });
  });

  it('should have unique version numbers', () => {
    const versions = ALL_MIGRATIONS.map((m) => m.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('should have unique migration names', () => {
    const names = ALL_MIGRATIONS.map((m) => m.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('v13 should be the CHECK constraint removal for assistant_plugins', () => {
    const v13 = ALL_MIGRATIONS.find((m) => m.version === 13);
    expect(v13).toBeDefined();
    expect(v13!.name.toLowerCase()).toContain('check');
  });

  it('v14 should be the CHECK constraint removal for conversations', () => {
    const v14 = ALL_MIGRATIONS.find((m) => m.version === 14);
    expect(v14).toBeDefined();
    expect(v14!.name.toLowerCase()).toContain('check');
  });

  it('v15 should be the assistant_memories table', () => {
    const v15 = ALL_MIGRATIONS.find((m) => m.version === 15);
    expect(v15).toBeDefined();
    expect(v15!.name.toLowerCase()).toContain('memor');
  });

  it('v16 should add workspace_scope to gemini_approvals', () => {
    const v16 = ALL_MIGRATIONS.find((m) => m.version === 16);
    expect(v16).toBeDefined();
    expect(v16!.name.toLowerCase()).toContain('workspace');
  });
});
