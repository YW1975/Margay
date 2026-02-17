/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

/**
 * MemoryFileManager — reads/writes MEMORY.md files for the four-layer memory system.
 *
 * Storage layout (under memoryBaseDir):
 *   assistant/{assistantId}/MEMORY.md   — L2 per-assistant cross-session memory
 *   workspace/{hash}/MEMORY.md          — L3 per-workspace shared memory
 */
export class MemoryFileManager {
  private baseDir: string;

  constructor(memoryBaseDir: string) {
    this.baseDir = memoryBaseDir;
  }

  /**
   * Compute a stable short hash for a workspace absolute path.
   * Uses SHA-256, truncated to 12 hex chars.
   */
  static computeWorkspaceHash(workspacePath: string): string {
    const normalized = path.resolve(workspacePath);
    return createHash('sha256').update(normalized).digest('hex').slice(0, 12);
  }

  /**
   * Get the directory path for an assistant's memory.
   */
  getAssistantMemoryDir(assistantId: string): string {
    return path.join(this.baseDir, 'assistant', assistantId);
  }

  /**
   * Get the MEMORY.md file path for an assistant.
   */
  getAssistantMemoryPath(assistantId: string): string {
    return path.join(this.getAssistantMemoryDir(assistantId), 'MEMORY.md');
  }

  /**
   * Get the directory path for a workspace's memory.
   */
  getWorkspaceMemoryDir(workspacePath: string): string {
    const hash = MemoryFileManager.computeWorkspaceHash(workspacePath);
    return path.join(this.baseDir, 'workspace', hash);
  }

  /**
   * Get the MEMORY.md file path for a workspace.
   */
  getWorkspaceMemoryPath(workspacePath: string): string {
    return path.join(this.getWorkspaceMemoryDir(workspacePath), 'MEMORY.md');
  }

  /**
   * Read a MEMORY.md file. Returns empty string if not found.
   */
  readMemory(filePath: string): string {
    try {
      if (!existsSync(filePath)) return '';
      return readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.warn('[MemoryFileManager] Failed to read memory:', filePath, error);
      return '';
    }
  }

  /**
   * Read L2 assistant memory content.
   */
  readAssistantMemory(assistantId: string): string {
    return this.readMemory(this.getAssistantMemoryPath(assistantId));
  }

  /**
   * Read L3 workspace memory content.
   */
  readWorkspaceMemory(workspacePath: string): string {
    return this.readMemory(this.getWorkspaceMemoryPath(workspacePath));
  }

  /**
   * Write content to a MEMORY.md file. Creates parent directories if needed.
   */
  writeMemory(filePath: string, content: string): void {
    try {
      const dir = path.dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(filePath, content, 'utf-8');
    } catch (error) {
      console.error('[MemoryFileManager] Failed to write memory:', filePath, error);
    }
  }

  /**
   * Ensure base directory structure exists.
   */
  ensureDirectories(): void {
    const dirs = [path.join(this.baseDir, 'assistant'), path.join(this.baseDir, 'workspace')];
    for (const dir of dirs) {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }
}
