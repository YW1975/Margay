/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { BaseApprovalStore, type IApprovalKey } from '@/common/approval';

/**
 * Gemini-specific approval key
 * Supports exec, edit, and info action types
 */
export type GeminiApprovalKey = IApprovalKey & {
  action: 'exec' | 'edit' | 'info';
  /** For exec type: command name (e.g., 'curl', 'npm') */
  identifier?: string;
};

/**
 * Validate if a string is a valid command name for storage
 * Valid command names: start with letter or underscore, contain only alphanumeric, underscore, or hyphen
 * This filters out special shell characters like '[', ']', '(', ')' that may be parsed as commands
 */
function isValidCommandName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(name);
}

/**
 * Parse commandType string into individual commands
 * Handles comma-separated commands from piped operations (e.g., "curl, grep")
 * Filters out invalid command names (e.g., special shell characters)
 */
function parseCommandTypes(commandType: string): string[] {
  return commandType
    .split(',')
    .map((cmd) => cmd.trim())
    .filter(Boolean)
    .filter(isValidCommandName);
}

/**
 * GeminiApprovalStore - Session-level approval cache for Gemini permissions
 * with workspace-scoped persistence support.
 *
 * Stores "always allow" decisions so that identical operations
 * can be auto-approved without prompting the user again.
 *
 * Approval scopes:
 * - Global (workspace_scope = ''): applies to all workspaces (cross-session)
 * - Workspace (workspace_scope = path): applies only within that workspace (cross-session)
 * - Session (in-memory only): applies only within current session
 *
 * Key design:
 * - Uses action + identifier as cache key
 * - For exec: identifier is command name (e.g., 'curl', 'npm')
 * - For edit/info: no identifier needed (generic approval)
 * - Workspace-scoped keys use @workspace suffix in the map
 */
export class GeminiApprovalStore extends BaseApprovalStore<GeminiApprovalKey> {
  /**
   * Create approval keys from confirmation data
   * For exec confirmations with multiple commands, returns keys for each command
   */
  static createKeysFromConfirmation(action: string, commandType?: string): GeminiApprovalKey[] {
    if (action === 'exec' && commandType) {
      const commands = parseCommandTypes(commandType);
      return commands.map((cmd) => ({
        action: 'exec' as const,
        identifier: cmd,
      }));
    }

    if (action === 'edit') {
      return [{ action: 'edit' as const }];
    }

    if (action === 'info') {
      return [{ action: 'info' as const }];
    }

    return [];
  }

  /**
   * Create exec approval keys from command list
   */
  static createExecKeys(commands: string[]): GeminiApprovalKey[] {
    return commands.filter(isValidCommandName).map((cmd) => ({
      action: 'exec' as const,
      identifier: cmd,
    }));
  }

  /**
   * Serialize key with optional workspace scope for map storage
   */
  private serializeKeyWithScope(key: GeminiApprovalKey, workspace?: string): string {
    const base = JSON.stringify({
      action: key.action,
      identifier: key.identifier || '',
    });
    return workspace ? `${base}@${workspace}` : base;
  }

  /**
   * Approve keys for a specific workspace scope (stored in memory + persisted to DB)
   */
  approveForWorkspace(keys: IApprovalKey[], workspace: string): void {
    for (const key of keys) {
      this.map.set(this.serializeKeyWithScope(key as GeminiApprovalKey, workspace), true);
    }
  }

  /**
   * Check if all keys are approved, considering both global and workspace scope.
   * A key is approved if it's approved globally OR for the given workspace.
   */
  allApprovedWithWorkspace(keys: IApprovalKey[], workspace?: string): boolean {
    if (keys.length === 0) return false;
    return keys.every((k) => {
      const gk = k as GeminiApprovalKey;
      // Check global approval
      if (this.map.get(this.serializeKey(gk)) === true) return true;
      // Check workspace-scoped approval
      if (workspace && this.map.get(this.serializeKeyWithScope(gk, workspace)) === true) return true;
      return false;
    });
  }

  /**
   * Load approvals from persisted data (e.g., database rows)
   * Used to restore approvals on agent startup
   * Supports workspace_scope column from v16 migration
   */
  loadFromPersistedData(rows: Array<{ action: string; identifier: string; workspace_scope?: string }>): void {
    for (const row of rows) {
      const key = { action: row.action, identifier: row.identifier } as GeminiApprovalKey;
      if (row.workspace_scope) {
        // Workspace-scoped approval
        this.map.set(this.serializeKeyWithScope(key, row.workspace_scope), true);
      } else {
        // Global approval
        this.approve(key);
      }
    }
  }
}
