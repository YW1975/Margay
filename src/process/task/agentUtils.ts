/**
 * @license
 * Copyright 2025 Margay (forked from AionUi)
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
}

/**
 * 为首次消息注入预设规则（不注入 skills — skills 通过 SkillDistributor 分发，引擎原生发现）
 * Inject preset rules for first message (no skill injection — skills distributed via SkillDistributor, discovered natively by engines)
 *
 * 注意：使用直接前缀方式而非 XML 标签，以确保 Claude Code CLI 等外部 agent 能正确识别
 * Note: Use direct prefix instead of XML tags to ensure external agents like Claude Code CLI can recognize it
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
