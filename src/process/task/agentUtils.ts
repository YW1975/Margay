/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';

/**
 * 归一化附加目录列表
 * Normalize additional directories list
 *
 * - Trims whitespace, filters empty/non-string entries
 * - Resolves to absolute paths, deduplicates
 * - Removes entries that resolve to the workspace root
 */
export const normalizeAdditionalDirs = (workspace: string, additionalDirs?: string[]): string[] | undefined => {
  if (!Array.isArray(additionalDirs) || additionalDirs.length === 0) {
    return undefined;
  }

  const workspaceRoot = path.resolve(workspace);
  const normalized = Array.from(
    new Set(
      additionalDirs
        .map((dir) => (typeof dir === 'string' ? dir.trim() : ''))
        .filter((dir) => dir.length > 0)
        .map((dir) => path.resolve(dir))
    )
  ).filter((dir) => dir !== workspaceRoot);

  return normalized.length > 0 ? normalized : undefined;
};

/**
 * 首次消息处理配置
 * First message processing configuration
 */
export interface FirstMessageConfig {
  /** 预设上下文/规则 / Preset context/rules */
  presetContext?: string;
  /** 主工作区（会话 cwd） / Primary workspace (session cwd) */
  workspace?: string;
  /** 附加可访问目录 / Additional accessible directories */
  additionalDirs?: string[];
  /** 助手 ID（用于加载 L2 助手记忆） / Assistant ID (for loading L2 assistant memory) */
  assistantId?: string;
  /** ACP 后端 ID（用于读取 agent 原生记忆） / ACP backend ID (for reading agent native memory) */
  agentBackend?: string;
}

/**
 * 加载组织记忆原始内容（L2 助手记忆 + L3 工作空间记忆）
 * Load raw organizational memory content (L2 assistant + L3 workspace)
 *
 * Shared by all engines: ACP/Codex use via loadMemorySections(), Gemini uses directly for userMemory.
 */
export function loadMemoryStrings(assistantId?: string, workspace?: string): { assistantMemory?: string; workspaceMemory?: string } {
  try {
    // Lazy import to avoid circular dependencies — only used in main process
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getMemoryDir } = require('../initStorage');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MemoryFileManager } = require('../services/memory/MemoryFileManager');
    const memoryDir = getMemoryDir();
    const fileManager = new MemoryFileManager(memoryDir);

    let assistantMemory: string | undefined;
    let workspaceMemory: string | undefined;

    // L2: Assistant memory
    if (assistantId) {
      const memoryPath = fileManager.getAssistantMemoryPath(assistantId);
      const content = fileManager.readAssistantMemory(assistantId);
      if (content?.trim()) {
        assistantMemory = content;
        indexMemoryEntry('assistant', assistantId, content, memoryPath);
      }
    }

    // L3: Workspace memory
    if (workspace) {
      const memoryPath = fileManager.getWorkspaceMemoryPath(workspace);
      const content = fileManager.readWorkspaceMemory(workspace);
      if (content?.trim()) {
        workspaceMemory = content;
        const hash = MemoryFileManager.computeWorkspaceHash(workspace);
        indexMemoryEntry('workspace', hash, content, memoryPath);
      }
    }

    return { assistantMemory, workspaceMemory };
  } catch (error) {
    console.warn('[agentUtils] Failed to load memory:', error);
    return {};
  }
}

/**
 * 加载格式化的记忆段落（用于首条消息前缀注入）
 * Load formatted memory sections (for first-message prefix injection)
 */
function loadMemorySections(assistantId?: string, workspace?: string): string[] {
  const { assistantMemory, workspaceMemory } = loadMemoryStrings(assistantId, workspace);
  const sections: string[] = [];
  if (assistantMemory) {
    sections.push(`[Assistant Memory - Cross Session]\n${assistantMemory}`);
  }
  if (workspaceMemory) {
    sections.push(`[Workspace Context]\n${workspaceMemory}`);
  }
  return sections;
}

/**
 * Best-effort lazy indexing of memory into SQLite.
 * Non-blocking: errors are silently ignored since the file is the source of truth.
 */
function indexMemoryEntry(scope: 'assistant' | 'workspace', ownerId: string, content: string, filePath: string): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MemoryStore } = require('../services/memory/MemoryStore');
    // Use scope:ownerId as deterministic ID for idempotent upsert
    const id = `${scope}:${ownerId}`;
    const firstLine = content.trim().split('\n')[0]?.slice(0, 200) || '';
    const result = MemoryStore.upsert({
      id,
      scope,
      ownerId,
      category: 'summary',
      summary: firstLine,
      filePath,
    });
    if (!result.success) {
      console.warn(`[agentUtils] Memory indexing failed for ${scope}:${ownerId}:`, result.error);
    }
  } catch (error) {
    console.warn(`[agentUtils] Memory indexing error for ${scope}:${ownerId}:`, error);
  }
}

/**
 * 为首次消息注入预设规则和记忆
 * Inject preset rules and memory for first message
 *
 * 注意：使用直接前缀方式而非 XML 标签，以确保 Claude Code CLI 等外部 agent 能正确识别
 * Note: Use direct prefix instead of XML tags to ensure external agents like Claude Code CLI can recognize it
 *
 * Prompt structure:
 *   [Assistant Rules]              — presetContext (existing)
 *   [Assistant Memory]             — L2 cross-session memory (new)
 *   [Workspace Context]            — L3 workspace memory (new)
 *   [Workspace Access]             — additional directories (existing)
 *   [User Request]                 — original content (existing)
 *
 * @param content - 原始消息内容 / Original message content
 * @param config - 首次消息配置 / First message configuration
 * @returns 注入预设规则后的消息内容 / Message content with preset rules injected
 */
export async function prepareFirstMessage(content: string, config: FirstMessageConfig): Promise<string> {
  const sections: string[] = [];

  if (config.presetContext) {
    sections.push(`[Assistant Rules - You MUST follow these instructions]\n${config.presetContext}`);
  }

  // L2 + L3 memory injection
  const memorySections = loadMemorySections(config.assistantId, config.workspace);
  sections.push(...memorySections);

  // Agent native memory (ACP backends only)
  if (config.agentBackend && config.workspace) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { readAgentNativeMemory } = require('../services/memory/AgentMemoryAdapter');
      const nativeMemory = readAgentNativeMemory(config.agentBackend, config.workspace);
      if (nativeMemory) {
        sections.push(`[Agent Memory - Cross Session]\n${nativeMemory}`);
      }
    } catch {
      // Non-fatal: agent native memory is supplementary
    }
  }

  // additionalDirs is already normalized by normalizeAdditionalDirs() at conversation creation time
  const additionalDirs = config.additionalDirs ?? [];
  if (additionalDirs.length > 0) {
    const primaryWorkspace = config.workspace?.trim() || '(not set)';
    const additionalDirList = additionalDirs.map((dir) => `- ${dir}`).join('\n');
    sections.push(`[Workspace Access]\nPrimary workspace (cwd): ${primaryWorkspace}\nAdditional accessible directories:\n${additionalDirList}\nUse absolute paths when operating outside the primary workspace.`);
  }

  if (sections.length === 0) {
    return content;
  }

  return `${sections.join('\n\n')}\n\n[User Request]\n${content}`;
}
