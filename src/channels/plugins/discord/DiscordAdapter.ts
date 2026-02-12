/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Message as DiscordMessage } from 'discord.js';
import type { IUnifiedIncomingMessage, IUnifiedMessageContent, IUnifiedOutgoingMessage, IUnifiedUser } from '../../types';

/**
 * DiscordAdapter - Converts between Discord and Unified message formats
 *
 * Handles:
 * - Discord Message → UnifiedIncomingMessage
 * - Button Interaction → UnifiedIncomingMessage (with parsed action)
 * - UnifiedOutgoingMessage → Discord MessageCreateOptions
 * - Message splitting for 2000-char limit
 */

// ==================== Constants ====================

/** Discord message character limit */
export const DISCORD_MESSAGE_LIMIT = 2000;

// ==================== Incoming Message Conversion ====================

/**
 * Parsed button interaction data (from DiscordKeyboards.parseButtonInteraction)
 */
export interface IParsedButtonAction {
  category: string;
  action?: string;
  callId?: string;
  value?: string;
  params?: Record<string, string>;
}

/**
 * Convert Discord message (or button interaction) to unified incoming message.
 *
 * @param messageOrInteraction - Discord Message or button Interaction
 * @param isDM - Whether the message is from a DM channel
 * @param parsedAction - If present, this is a button interaction (not a regular message)
 */
export function toUnifiedIncomingMessage(messageOrInteraction: DiscordMessage | any, isDM: boolean, parsedAction?: IParsedButtonAction): IUnifiedIncomingMessage | null {
  // Button interaction path
  if (parsedAction) {
    const interaction = messageOrInteraction;
    const user = interaction.user || interaction.member?.user;
    if (!user) return null;

    return {
      id: interaction.id,
      platform: 'discord',
      chatId: interaction.channelId || interaction.channel?.id || '',
      user: {
        id: user.id,
        username: user.username,
        displayName: user.globalName || user.username,
      },
      content: {
        type: 'action',
        text: parsedAction.action || '',
      },
      timestamp: Date.now(),
      action: {
        type: parsedAction.category as 'platform' | 'system' | 'chat',
        name: parsedAction.action || '',
        params: parsedAction.params,
      },
      raw: interaction,
    };
  }

  // Regular message path
  const message = messageOrInteraction as DiscordMessage;
  const user = toUnifiedUser(message);
  if (!user) return null;

  const content = extractMessageContent(message);

  return {
    id: message.id,
    platform: 'discord',
    chatId: message.channelId,
    user,
    content,
    timestamp: message.createdTimestamp,
    replyToMessageId: message.reference?.messageId || undefined,
    raw: message,
  };
}

/**
 * Convert Discord message author to unified user format
 */
function toUnifiedUser(message: DiscordMessage): IUnifiedUser | null {
  const author = message.author;
  if (!author) return null;

  return {
    id: author.id,
    username: author.username,
    displayName: author.globalName || author.displayName || author.username,
  };
}

/**
 * Extract message content from a Discord message.
 * Strips bot mentions from guild messages.
 */
function extractMessageContent(message: DiscordMessage): IUnifiedMessageContent {
  // Strip bot mention (e.g. <@123456> or <@!123456>)
  const text = (message.content || '').replace(/<@!?\d+>\s*/g, '').trim();

  // Handle image attachments
  if (message.attachments.size > 0) {
    const attachment = message.attachments.first()!;
    const contentType = attachment.contentType || '';

    if (contentType.startsWith('image/')) {
      return {
        type: 'photo',
        text: text || '',
        attachments: [
          {
            type: 'photo',
            fileId: attachment.id,
            fileName: attachment.name || undefined,
            mimeType: contentType,
            size: attachment.size,
          },
        ],
      };
    }

    return {
      type: 'document',
      text: text || '',
      attachments: [
        {
          type: 'document',
          fileId: attachment.id,
          fileName: attachment.name || undefined,
          mimeType: contentType || undefined,
          size: attachment.size,
        },
      ],
    };
  }

  return { type: 'text', text };
}

// ==================== Outgoing Message Conversion ====================

/**
 * Options for sending messages via Discord
 */
export interface DiscordSendOptions {
  content?: string;
  components?: any[]; // ActionRowBuilder[]
}

/**
 * Convert unified outgoing message to Discord send options
 */
export function toDiscordSendOptions(message: IUnifiedOutgoingMessage): DiscordSendOptions {
  const options: DiscordSendOptions = {
    content: message.text || '',
  };

  // Platform-specific markup (ActionRow arrays from DiscordKeyboards)
  if (message.replyMarkup) {
    options.components = message.replyMarkup as any[];
  }

  return options;
}

// ==================== Message Length Utilities ====================

/**
 * Split long text into chunks that fit Discord's 2000-char limit.
 * Prefers splitting at newlines, then spaces.
 */
export function splitMessage(text: string, maxLength: number = DISCORD_MESSAGE_LIMIT): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let splitIndex = maxLength;

    // Look for newline within the last 20% of the chunk
    const searchStart = Math.floor(maxLength * 0.8);
    const lastNewline = remaining.lastIndexOf('\n', maxLength);
    if (lastNewline > searchStart) {
      splitIndex = lastNewline + 1;
    } else {
      const lastSpace = remaining.lastIndexOf(' ', maxLength);
      if (lastSpace > searchStart) {
        splitIndex = lastSpace + 1;
      }
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks;
}
