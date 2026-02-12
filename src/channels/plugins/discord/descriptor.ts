/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { registerDescriptor } from '../../core/registry';
import type { IPluginDescriptor, IPluginCredentials, ITestConnectionResult } from '../../types';
import { DiscordPlugin } from './DiscordPlugin';

const discordDescriptor: IPluginDescriptor = {
  type: 'discord',
  displayName: 'Discord',
  description: 'Discord Bot via WebSocket Gateway (invite bot to server or use DMs)',
  connectionModes: ['websocket'],
  defaultConnectionMode: 'websocket',
  credentialFields: [
    {
      key: 'token',
      label: 'Bot Token',
      required: true,
      secret: true,
      placeholder: 'MTIzNDU2Nzg5MDEyMzQ1Njc4.GHJklm.abc...',
    },
  ],
  async testConnection(credentials: IPluginCredentials): Promise<ITestConnectionResult> {
    const result = await DiscordPlugin.testConnection(credentials.token || '');
    return {
      success: result.success,
      botUsername: result.botInfo?.username,
      error: result.error,
    };
  },
  pluginConstructor: DiscordPlugin,
};

registerDescriptor(discordDescriptor);
