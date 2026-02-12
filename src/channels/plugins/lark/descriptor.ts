/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { registerDescriptor } from '../../core/registry';
import type { IPluginDescriptor, IPluginCredentials, ITestConnectionResult } from '../../types';
import { LarkPlugin } from './LarkPlugin';

const larkDescriptor: IPluginDescriptor = {
  type: 'lark',
  displayName: 'Lark / Feishu',
  description: 'Lark/Feishu Bot via WebSocket (no public URL required)',
  connectionModes: ['websocket'],
  defaultConnectionMode: 'websocket',
  credentialFields: [
    {
      key: 'appId',
      label: 'App ID',
      required: true,
      secret: false,
      placeholder: 'cli_xxxxxxxxxxxx',
    },
    {
      key: 'appSecret',
      label: 'App Secret',
      required: true,
      secret: true,
      placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    },
    {
      key: 'encryptKey',
      label: 'Encrypt Key',
      required: false,
      secret: true,
      placeholder: 'Optional — for event encryption',
    },
    {
      key: 'verificationToken',
      label: 'Verification Token',
      required: false,
      secret: true,
      placeholder: 'Optional — for event verification',
    },
  ],
  async testConnection(credentials: IPluginCredentials): Promise<ITestConnectionResult> {
    const result = await LarkPlugin.testConnection(credentials.appId || '', credentials.appSecret);
    return {
      success: result.success,
      botUsername: result.botInfo?.name,
      error: result.error,
    };
  },
  pluginConstructor: LarkPlugin,
};

registerDescriptor(larkDescriptor);
