/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import type { Message as DiscordMessage, ClientUser } from 'discord.js';

import type { IChannelPluginConfig, IUnifiedOutgoingMessage } from '../../types';
import { BasePlugin } from '../BasePlugin';
import { splitMessage, DISCORD_MESSAGE_LIMIT, toDiscordSendOptions, toUnifiedIncomingMessage } from './DiscordAdapter';
import { parseButtonInteraction } from './DiscordKeyboards';

/**
 * DiscordPlugin - Discord Bot integration for Margay Channel system
 *
 * Uses discord.js v14 with WebSocket Gateway.
 * Supports DMs (all messages) and guild channels (@mention only).
 */
export class DiscordPlugin extends BasePlugin {
  readonly type = 'discord' as const;

  private client: Client | null = null;
  private botUser: ClientUser | null = null;

  // Track active users for status reporting
  private activeUsers: Set<string> = new Set();

  // Track sent messages for editing (streaming)
  private sentMessages: Map<string, DiscordMessage> = new Map();

  /**
   * Initialize the Discord client
   */
  protected async onInitialize(config: IChannelPluginConfig): Promise<void> {
    const token = config.credentials?.token;
    console.log(`[DiscordPlugin] onInitialize called, hasToken=${!!token}, pluginId=${config.id}`);

    if (!token) {
      throw new Error('Discord bot token is required');
    }

    // Create client with required intents
    this.client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages, GatewayIntentBits.MessageContent],
      partials: [Partials.Channel], // Required for DM support
    });

    this.setupHandlers();
    console.log(`[DiscordPlugin] Initialized plugin ${config.id}`);
  }

  /**
   * Start the Discord bot (login via WebSocket Gateway)
   */
  protected async onStart(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const token = this.config?.credentials?.token;
    if (!token) {
      throw new Error('Token not available');
    }

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Discord login timed out (30s)'));
      }, 30000);

      this.client!.once(Events.ClientReady, (readyClient) => {
        clearTimeout(timeout);
        this.botUser = readyClient.user;
        console.log(`[DiscordPlugin] Bot ready: ${readyClient.user.tag} (${readyClient.user.id})`);
        resolve();
      });

      this.client!.login(token).catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Stop the Discord bot
   */
  protected async onStop(): Promise<void> {
    if (this.client) {
      await this.client.destroy();
      this.client = null;
    }
    this.botUser = null;
    this.activeUsers.clear();
    this.sentMessages.clear();
    console.log('[DiscordPlugin] Stopped');
  }

  /**
   * Send a message to a Discord channel
   */
  async sendMessage(chatId: string, message: IUnifiedOutgoingMessage): Promise<string> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const channel = await this.client.channels.fetch(chatId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${chatId} not found or not text-based`);
    }

    const sendOptions = toDiscordSendOptions(message);
    const text = sendOptions.content || '';
    const chunks = splitMessage(text, DISCORD_MESSAGE_LIMIT);

    let lastMsg: DiscordMessage | null = null;
    for (let i = 0; i < chunks.length; i++) {
      const isLast = i === chunks.length - 1;
      const opts = {
        ...sendOptions,
        content: chunks[i],
        // Only attach components to the last chunk
        components: isLast ? sendOptions.components : undefined,
      };
      // channel.send() exists on TextBasedChannel
      lastMsg = await (channel as any).send(opts);
    }

    if (lastMsg) {
      this.sentMessages.set(lastMsg.id, lastMsg);
      return lastMsg.id;
    }
    throw new Error('Failed to send message');
  }

  /**
   * Edit an existing message (for streaming updates)
   */
  async editMessage(chatId: string, messageId: string, message: IUnifiedOutgoingMessage): Promise<void> {
    const cached = this.sentMessages.get(messageId);
    if (!cached) {
      console.warn(`[DiscordPlugin] Message ${messageId} not in cache, cannot edit`);
      return;
    }

    try {
      const sendOptions = toDiscordSendOptions(message);
      // Truncate to Discord limit
      if (sendOptions.content && sendOptions.content.length > DISCORD_MESSAGE_LIMIT) {
        sendOptions.content = sendOptions.content.substring(0, DISCORD_MESSAGE_LIMIT - 3) + '...';
      }
      await cached.edit(sendOptions);
    } catch (error: any) {
      // Ignore "Unknown Message" (already deleted) or "Missing Access"
      if (error.code === 10008 || error.code === 50001) {
        this.sentMessages.delete(messageId);
        return;
      }
      throw error;
    }
  }

  /**
   * Get active user count
   */
  getActiveUserCount(): number {
    return this.activeUsers.size;
  }

  /**
   * Get bot info
   */
  getBotInfo(): { username?: string; displayName?: string } | null {
    if (!this.botUser) return null;
    return {
      username: this.botUser.username,
      displayName: this.botUser.displayName || this.botUser.username,
    };
  }

  /**
   * Test connection with a Discord bot token
   */
  static async testConnection(token: string): Promise<{ success: boolean; botInfo?: { username?: string; displayName?: string }; error?: string }> {
    const testClient = new Client({
      intents: [GatewayIntentBits.Guilds],
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timed out')), 15000);
        testClient.once(Events.ClientReady, () => {
          clearTimeout(timeout);
          resolve();
        });
        testClient.login(token).catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });

      const user = testClient.user;
      await testClient.destroy();

      return {
        success: true,
        botInfo: user ? { username: user.username, displayName: user.displayName || user.username } : undefined,
      };
    } catch (error: any) {
      void testClient.destroy();
      let errorMessage = 'Connection failed';
      if (error.message?.includes('TOKEN_INVALID') || error.code === 'TokenInvalid') {
        errorMessage = 'Invalid bot token';
      } else if (error.message?.includes('timed out')) {
        errorMessage = 'Connection timed out';
      } else {
        errorMessage = error.message || 'Unknown error';
      }
      return { success: false, error: errorMessage };
    }
  }

  // ==================== Private Methods ====================

  /**
   * Setup event handlers
   */
  private setupHandlers(): void {
    if (!this.client) return;

    // Message handler
    this.client.on(Events.MessageCreate, (message: DiscordMessage) => {
      // Ignore bots (including self)
      if (message.author.bot) return;

      const isDM = !message.guild;
      const isMentioned = !isDM && this.botUser && message.mentions.has(this.botUser);

      // In guilds, only respond to @mentions; in DMs, respond to everything
      if (!isDM && !isMentioned) return;

      // Track user
      this.activeUsers.add(message.author.id);

      // Convert and emit (non-blocking)
      const unified = toUnifiedIncomingMessage(message, isDM);
      if (unified) {
        void this.emitMessage(unified).catch((error) => {
          console.error('[DiscordPlugin] Error handling message:', error);
        });
      }
    });

    // Button interaction handler
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isButton()) return;

      const parsed = parseButtonInteraction(interaction.customId);
      if (!parsed) {
        await interaction.deferUpdate();
        return;
      }

      this.activeUsers.add(interaction.user.id);

      if (parsed.category === 'confirm' && this.confirmHandler) {
        // Tool confirmation: confirm:{callId}:{value}
        await this.confirmHandler(interaction.user.id, 'discord', parsed.callId!, parsed.value!);
        // Remove buttons after confirmation
        try {
          await interaction.update({ components: [] });
        } catch {
          await interaction.deferUpdate();
        }
      } else {
        // Attach message context for action buttons (e.g., regenerate needs originalMessageId)
        if (!parsed.params) parsed.params = {};
        parsed.params.originalMessageId = interaction.message?.id || '';

        // Action button — convert to unified action message
        const unified = toUnifiedIncomingMessage(interaction as any, true, parsed);
        if (unified) {
          void this.emitMessage(unified).catch((error) => {
            console.error('[DiscordPlugin] Error handling interaction:', error);
          });
        }
        await interaction.deferUpdate();
      }
    });

    // Error handlers
    this.client.on(Events.Error, (error) => {
      console.error('[DiscordPlugin] Client error:', error);
      this.setError(error.message);
    });

    this.client.on(Events.ShardDisconnect, (event, shardId) => {
      console.warn(`[DiscordPlugin] Shard ${shardId} disconnected (code ${event.code})`);
    });

    this.client.on(Events.ShardReconnecting, (shardId) => {
      console.log(`[DiscordPlugin] Shard ${shardId} reconnecting...`);
    });

    this.client.on(Events.ShardResume, (shardId) => {
      console.log(`[DiscordPlugin] Shard ${shardId} resumed`);
    });

    console.log('[DiscordPlugin] Event handlers registered');
  }
}
