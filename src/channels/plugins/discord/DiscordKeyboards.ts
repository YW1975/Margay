/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

import type { IParsedButtonAction } from './DiscordAdapter';

/**
 * Discord Keyboards (Message Components)
 *
 * Discord uses ActionRow + Button components attached to messages.
 * Unlike Telegram's persistent reply keyboards, Discord buttons are
 * always inline (attached to a specific message).
 *
 * All builder functions return ActionRowBuilder[] (ready for components field).
 */

// ==================== Response Action Components ====================

/**
 * Build response action buttons (shown after AI response completes)
 */
export function buildResponseActionsRow(): ActionRowBuilder<ButtonBuilder>[] {
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('chat.regenerate').setLabel('🔄 Regenerate').setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId('chat.continue').setLabel('💬 Continue').setStyle(ButtonStyle.Secondary))];
}

/**
 * Build error recovery buttons
 */
export function buildErrorRecoveryRow(): ActionRowBuilder<ButtonBuilder>[] {
  return [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('chat.regenerate').setLabel('🔄 Retry').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('session.new').setLabel('🆕 New Session').setStyle(ButtonStyle.Secondary))];
}

// ==================== Tool Confirmation Components ====================

/**
 * Build tool confirmation buttons for Gemini tool calls.
 *
 * @param callId - Tool call ID for tracking
 * @param options - Array of { label, value } options
 * @returns ActionRowBuilder[] ready for message components
 */
export function buildToolConfirmationRow(callId: string, options: Array<{ label: string; value: string }>): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();
  let count = 0;

  for (const opt of options) {
    // Determine button style based on value
    let style = ButtonStyle.Secondary;
    if (opt.value.startsWith('proceed')) style = ButtonStyle.Success;
    if (opt.value === 'cancel') style = ButtonStyle.Danger;

    currentRow.addComponents(new ButtonBuilder().setCustomId(`confirm:${callId}:${opt.value}`).setLabel(opt.label).setStyle(style));
    count++;

    // Discord allows max 5 buttons per row; start new row after 3 for readability
    if (count % 3 === 0) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
  }

  // Push the last row if it has buttons
  if (count % 3 !== 0) {
    rows.push(currentRow);
  }

  return rows;
}

// ==================== Interaction Parsing ====================

/**
 * Parse a button interaction's customId into structured data.
 *
 * Custom ID formats:
 * - `confirm:{callId}:{value}` — tool confirmation
 * - `{registered.action.name}` — direct action name (e.g. `chat.regenerate`, `session.new`)
 *
 * Button custom IDs use registered ActionExecutor names directly so
 * the routing works without an extra mapping layer.
 *
 * @returns Parsed data or null if unrecognised
 */
export function parseButtonInteraction(customId: string): IParsedButtonAction | null {
  if (!customId) return null;

  // Tool confirmation: confirm:{callId}:{value}
  if (customId.startsWith('confirm:')) {
    const parts = customId.split(':');
    if (parts.length >= 3) {
      return { category: 'confirm', callId: parts[1], value: parts[2] };
    }
    return null;
  }

  // Direct action name (e.g. chat.regenerate, session.new)
  return { category: 'action', action: customId };
}
