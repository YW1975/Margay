/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 *
 * Typed storage — replaces @office-ai/platform storage module.
 * Uses the bridge's buildProvider for cross-process communication.
 *
 * Original concept from @office-ai/platform (MIT License).
 */

import { buildProvider } from './platform-bridge';

export function buildStorage<S extends Record<string, any> = Record<string, any>>(
  group: string
): {
  get<K extends keyof S>(key: K): Promise<S[K]>;
  set<K extends keyof S>(key: K, data: S[K]): Promise<any>;
  clear(): Promise<any>;
  remove(key: keyof S): Promise<void>;
  interceptor(
    interceptor: Partial<{
      set<K extends keyof S>(key: K, data: S[K]): Promise<S[K]>;
      get<K extends keyof S>(key: K): Promise<S[K]>;
      clear(): Promise<any>;
      remove<K extends keyof S>(key: K): Promise<any>;
    }>
  ): void;
} {
  const getProvider = buildProvider<any, string>(group + '.storage.get');
  const setProvider = buildProvider<any, { key: string; data: unknown }>(group + '.storage.set');
  const removeProvider = buildProvider<void, string>(group + '.storage.remove');
  const clearProvider = buildProvider<any, void>(group + '.storage.clear');

  return {
    get<K extends keyof S>(key: K): Promise<S[K]> {
      return getProvider.invoke(key as string);
    },
    set<K extends keyof S>(key: K, data: S[K]): Promise<any> {
      return setProvider.invoke({ key: key as string, data });
    },
    clear(): Promise<any> {
      return clearProvider.invoke();
    },
    remove(key: keyof S): Promise<void> {
      return removeProvider.invoke(key as string);
    },
    interceptor(interceptor: any): void {
      if (interceptor.get) getProvider.provider(interceptor.get);
      if (interceptor.set) setProvider.provider((params: { key: string; data: unknown }) => interceptor.set(params.key, params.data));
      if (interceptor.clear) clearProvider.provider(interceptor.clear);
      if (interceptor.remove) removeProvider.provider(interceptor.remove);
    },
  };
}
