/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * 首次消息处理配置
 * First message processing configuration
 */
export interface FirstMessageConfig {
  /** 预设上下文/规则 / Preset context/rules */
  presetContext?: string;
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
  if (!config.presetContext) {
    return content;
  }

  return `[Assistant Rules - You MUST follow these instructions]\n${config.presetContext}\n\n[User Request]\n${content}`;
}
