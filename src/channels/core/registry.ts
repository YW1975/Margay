/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IPluginDescriptor } from '../types';

// ---------------------------------------------------------------------------
// Plugin Descriptor Registry
//
// Lazy-initialized: getPluginDescriptors() / getDescriptor() call
// ensureRegistryInitialized() on first access so the registry is usable
// even if ChannelManager.initialize() failed.
// ---------------------------------------------------------------------------

const registry = new Map<string, IPluginDescriptor>();
let initialized = false;

/**
 * Register a plugin descriptor (called by platform descriptor modules).
 */
export function registerDescriptor(descriptor: IPluginDescriptor): void {
  registry.set(descriptor.type, descriptor);
  console.log(`[Registry] Registered descriptor: ${descriptor.type}`);
}

/**
 * Eagerly initialize all built-in descriptors.
 * Safe to call multiple times — no-ops after first call.
 */
export function initPluginRegistry(): void {
  if (initialized) return;

  // Import descriptors — each module calls registerDescriptor() at import time
  require('../plugins/telegram/descriptor');
  require('../plugins/lark/descriptor');
  require('../plugins/discord/descriptor');

  initialized = true;
  console.log(`[Registry] Initialized with ${registry.size} descriptor(s)`);
}

/**
 * Ensure registry is populated (lazy guard for read paths).
 */
function ensureRegistryInitialized(): void {
  if (!initialized) {
    initPluginRegistry();
  }
}

/**
 * Get all registered plugin descriptors.
 */
export function getPluginDescriptors(): IPluginDescriptor[] {
  ensureRegistryInitialized();
  return [...registry.values()];
}

/**
 * Get a single descriptor by platform type.
 */
export function getDescriptor(type: string): IPluginDescriptor | undefined {
  ensureRegistryInitialized();
  return registry.get(type);
}

/**
 * Check whether credentials satisfy a descriptor's required fields.
 */
export function hasValidCredentials(type: string, credentials?: Record<string, string>): boolean {
  const descriptor = getDescriptor(type);
  if (!descriptor) return false;
  if (!credentials) return false;

  return descriptor.credentialFields
    .filter((f) => f.required)
    .every((f) => {
      const val = credentials[f.key];
      return typeof val === 'string' && val.trim().length > 0;
    });
}
