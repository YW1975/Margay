/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { getDatabase } from '@process/database';
import { randomUUID } from 'crypto';

export interface MemoryEntry {
  id: string;
  scope: 'assistant' | 'workspace' | 'org';
  ownerId?: string;
  category: 'fact' | 'preference' | 'decision' | 'context' | 'summary';
  summary: string;
  filePath?: string;
  sourceConversationId?: string;
  sourceAssistantId?: string;
  createdAt?: number;
  updatedAt?: number;
  metadata?: Record<string, unknown>;
}

/**
 * MemoryStore — SQLite index layer for the four-layer memory system.
 *
 * Provides idempotent upsert (INSERT OR REPLACE) so repeated session starts
 * never create duplicate rows.
 */
export class MemoryStore {
  /**
   * Index a memory entry (upsert). Safe to call multiple times with same id.
   */
  static upsert(entry: Omit<MemoryEntry, 'id'> & { id?: string }): { success: boolean; id?: string; error?: string } {
    const id = entry.id || randomUUID();
    try {
      const db = getDatabase();
      const result = db.upsertMemoryEntry({
        id,
        scope: entry.scope,
        ownerId: entry.ownerId,
        category: entry.category,
        summary: entry.summary,
        filePath: entry.filePath,
        sourceConversationId: entry.sourceConversationId,
        sourceAssistantId: entry.sourceAssistantId,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : undefined,
      });
      if (!result.success) {
        return { success: false, error: result.error };
      }
      return { success: true, id };
    } catch (error: any) {
      console.error('[MemoryStore] upsert failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Query memory entries by scope and optional owner.
   */
  static query(scope: 'assistant' | 'workspace' | 'org', ownerId?: string): MemoryEntry[] {
    try {
      const db = getDatabase();
      const result = db.getMemoryEntries(scope, ownerId);
      if (!result.success || !result.data) return [];
      return result.data.map((row) => ({
        id: row.id,
        scope: row.scope as MemoryEntry['scope'],
        ownerId: row.ownerId ?? undefined,
        category: row.category as MemoryEntry['category'],
        summary: row.summary,
        filePath: row.filePath ?? undefined,
        sourceConversationId: row.sourceConversationId ?? undefined,
        sourceAssistantId: row.sourceAssistantId ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      }));
    } catch (error) {
      console.error('[MemoryStore] query failed:', error);
      return [];
    }
  }

  /**
   * Delete a memory entry.
   */
  static delete(id: string): boolean {
    try {
      const db = getDatabase();
      const result = db.deleteMemoryEntry(id);
      return result.success && !!result.data;
    } catch (error) {
      console.error('[MemoryStore] delete failed:', error);
      return false;
    }
  }
}
