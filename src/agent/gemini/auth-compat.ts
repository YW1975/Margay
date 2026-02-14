/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Compatibility layer for aioncli-specific auth features not in Google's gemini-cli-core.
 *
 * Google's v0.24.0 AuthType only has Gemini/Vertex/GCP auth types.
 * aioncli added USE_OPENAI and USE_ANTHROPIC for multi-model support.
 * These are needed by Margay's multi-provider architecture.
 */

import { AuthType as GoogleAuthType, UserAccountManager, getOauthClient, type Config } from './core-facade';
export { GoogleAuthType };

// Extend AuthType with multi-model auth types (from aioncli fork)
export const AuthType = {
  ...GoogleAuthType,
  USE_OPENAI: 'openai-api-key' as const,
  USE_ANTHROPIC: 'anthropic-api-key' as const,
};

export type AuthType = GoogleAuthType | typeof AuthType.USE_OPENAI | typeof AuthType.USE_ANTHROPIC;

/** Returns true if the auth type is handled by Google's gemini-cli-core engine. */
export function isGoogleNativeAuthType(authType: AuthType | null | undefined): authType is GoogleAuthType {
  if (!authType) return false;
  return authType !== AuthType.USE_OPENAI && authType !== AuthType.USE_ANTHROPIC;
}

// Compatibility: aioncli's getOauthInfoWithCache returns { email: string } | null
const userAccountManager = new UserAccountManager();

export async function getOauthInfoWithCache(_proxy?: string): Promise<{ email: string } | null> {
  const email = userAccountManager.getCachedGoogleAccount();
  return email ? { email } : null;
}

// Compatibility: aioncli's loginWithOauth maps to Google's getOauthClient
export async function loginWithOauth(authType: GoogleAuthType, config: Config) {
  return getOauthClient(authType, config);
}
