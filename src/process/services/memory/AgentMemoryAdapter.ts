/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AgentMemoryAdapter — Read native memory from ACP agent backends.
 *
 * Each ACP backend (Claude Code, Goose, etc.) may store cross-session memory
 * in its own location. This adapter reads ONLY Margay-related memories
 * (scoped by workspace path) and returns them for injection alongside
 * Margay's L2/L3 memory.
 *
 * Scope isolation: each adapter resolves the agent's project-level memory
 * using the Margay workspace path, so memories from unrelated projects
 * are never imported.
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

interface IAgentMemoryAdapter {
  /** Read agent-native memory scoped to a Margay workspace. */
  readNativeMemory(workspace: string): string | undefined;
}

// ---------------------------------------------------------------------------
// Claude Code adapter
// ---------------------------------------------------------------------------

/**
 * Claude Code stores per-project auto memory at:
 *   ~/.claude/projects/{path-key}/memory/MEMORY.md
 *
 * where {path-key} = absolute workspace path with '/' replaced by '-'.
 * e.g. /Users/alice/myproject → -Users-alice-myproject
 */
class ClaudeCodeMemoryAdapter implements IAgentMemoryAdapter {
  readNativeMemory(workspace: string): string | undefined {
    try {
      const absPath = path.resolve(workspace);
      const pathKey = absPath.replace(/\//g, '-');
      const memoryFile = path.join(homedir(), '.claude', 'projects', pathKey, 'memory', 'MEMORY.md');

      if (!existsSync(memoryFile)) return undefined;

      const content = readFileSync(memoryFile, 'utf-8');
      return content.trim() || undefined;
    } catch {
      return undefined;
    }
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** Backend ID → adapter. Backend IDs match AcpBackend type in acpTypes.ts. */
const ADAPTERS: Record<string, IAgentMemoryAdapter> = {
  claude: new ClaudeCodeMemoryAdapter(),
};

/**
 * Read agent-native memory for a given ACP backend and workspace.
 * Returns undefined if no adapter exists for the backend or no memory is found.
 */
export function readAgentNativeMemory(backend: string, workspace: string): string | undefined {
  const adapter = ADAPTERS[backend];
  if (!adapter) return undefined;
  return adapter.readNativeMemory(workspace);
}
