/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IProvider, TProviderWithModel } from '@/common/storage';
import { ConfigStorage } from '@/common/storage';

/**
 * Resolve the default Gemini model from saved config + available providers.
 * Shared by guid page and inline conversation creation (ConversationTabs).
 *
 * Resolution order:
 * 1. Saved model from ConfigStorage ('gemini.defaultModel')
 * 2. Fallback to first available provider's first model
 */
export async function resolveDefaultModel(modelConfig?: IProvider[]): Promise<TProviderWithModel | null> {
  // Fetch provider list if not supplied
  const providers = modelConfig ?? (await ipcBridge.mode.getModelConfig.invoke().then((data) => (data || []).filter((p) => !!p.model.length)));

  if (!providers || providers.length === 0) return null;

  const savedModel = await ConfigStorage.get('gemini.defaultModel');

  // New format: { id, useModel }
  const isNewFormat = savedModel && typeof savedModel === 'object' && 'id' in savedModel;

  let provider: IProvider | undefined;
  let useModel: string;

  if (isNewFormat) {
    const { id, useModel: saved } = savedModel;
    const exact = providers.find((m) => m.id === id);
    if (exact && exact.model.includes(saved)) {
      provider = exact;
      useModel = saved;
    } else {
      provider = providers[0];
      useModel = provider?.model[0] ?? '';
    }
  } else if (typeof savedModel === 'string') {
    // Old format: model name string (backward compat)
    provider = providers.find((m) => m.model.includes(savedModel)) || providers[0];
    useModel = provider?.model.includes(savedModel) ? savedModel : (provider?.model[0] ?? '');
  } else {
    provider = providers[0];
    useModel = provider?.model[0] ?? '';
  }

  if (!provider || !useModel) return null;

  return { ...provider, useModel };
}
