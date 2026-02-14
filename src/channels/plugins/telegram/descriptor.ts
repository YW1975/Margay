/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { registerDescriptor } from '../../core/registry';
import type { IPluginDescriptor, IPluginCredentials, ITestConnectionResult } from '../../types';
import { TelegramPlugin } from './TelegramPlugin';

const telegramDescriptor: IPluginDescriptor = {
  type: 'telegram',
  displayName: 'Telegram',
  description: 'Telegram Bot via long-polling (no public URL required)',
  connectionModes: ['polling', 'webhook'],
  defaultConnectionMode: 'polling',
  credentialFields: [
    {
      key: 'token',
      label: 'Bot Token',
      required: true,
      secret: true,
      placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
    },
  ],
  async testConnection(credentials: IPluginCredentials): Promise<ITestConnectionResult> {
    const result = await TelegramPlugin.testConnection(credentials.token || '');
    return {
      success: result.success,
      botUsername: result.botInfo?.username,
      error: result.error,
    };
  },
  pluginConstructor: TelegramPlugin,
};

registerDescriptor(telegramDescriptor);
