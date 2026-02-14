/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ApprovalStore - Session-level approval cache for ACP permissions
 *
 * This implementation is inspired by Codex CLI's ApprovalStore.
 * It caches "always allow" decisions so that identical or similar operations
 * can be auto-approved without prompting the user again.
 *
 * Key design:
 * - Uses serialized keys (tool kind + title + rawInput) as cache identifiers
 * - Only caches "allow_always" decisions
 * - Scoped to a single conversation/session
 */

/**
 * Key for ACP tool approval
 */
export interface AcpApprovalKey {
  kind: string; // 'execute', 'edit', 'read', etc.
  title: string; // Tool name/title
  rawInput?: {
    command?: string;
    description?: string;
    [key: string]: unknown;
  };
}

/**
 * Serialize an approval key to a string for use as a cache key
 *
 * Approval granularity by kind:
 * - execute: per-tool (kind + title only). "Always Allow" on any bash command
 *   approves ALL future bash commands in the session. This is coarser than
 *   Gemini's per-command-name granularity, but avoids excessive permission prompts.
 * - edit/read/fetch: per-type (kind + title only). "Always Allow" on one edit
 *   approves ALL future edits in the session, regardless of file path.
 *   Issue 2 fix: removed per-path granularity to reduce excessive permission prompts.
 */
function serializeKey(key: AcpApprovalKey): string {
  // Issue 2: Intentionally exclude path/file_path from the key for ALL operations.
  // This makes "Always Allow" apply to the entire operation type (edit, read, execute)
  // rather than per-file, matching the coarser granularity already used for execute.
  return JSON.stringify({
    kind: key.kind || 'unknown',
    title: key.title || '',
    rawInput: {},
  });
}

/**
 * AcpApprovalStore - Caches approval decisions for the ACP session
 */
export class AcpApprovalStore {
  private map: Map<string, string> = new Map(); // key -> optionId

  /**
   * Get cached decision for a key
   */
  get(key: AcpApprovalKey): string | undefined {
    const serialized = serializeKey(key);
    return this.map.get(serialized);
  }

  /**
   * Store a decision for a key
   * Only stores allow_always decisions (the only type worth caching)
   */
  put(key: AcpApprovalKey, optionId: string): void {
    if (optionId === 'allow_always') {
      const serialized = serializeKey(key);
      this.map.set(serialized, optionId);
    }
  }

  /**
   * Check if key has allow_always status
   */
  isApprovedForSession(key: AcpApprovalKey): boolean {
    return this.get(key) === 'allow_always';
  }

  /**
   * Clear all cached approvals
   */
  clear(): void {
    this.map.clear();
  }

  /**
   * Get the number of cached approvals
   */
  get size(): number {
    return this.map.size;
  }
}

/**
 * Create an AcpApprovalKey from permission request data
 */
export function createAcpApprovalKey(toolCall: { kind?: string; title?: string; rawInput?: Record<string, unknown> }): AcpApprovalKey {
  return {
    kind: toolCall.kind || 'unknown',
    title: toolCall.title || '',
    rawInput: toolCall.rawInput as AcpApprovalKey['rawInput'],
  };
}
