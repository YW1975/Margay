/**
 * Model Eval v2.0 — Preflight resolver.
 * Queries API availability for each model and writes a locked manifest.
 *
 * Usage:
 *   npx tsx scripts/model-eval/resolve-models.ts
 *
 * Reads API keys from models_test.key in project root.
 * Outputs: scripts/model-eval/model-manifest.json
 */

import fs from 'node:fs';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const KEY_FILE = path.resolve(PROJECT_ROOT, 'models_test.key');
const MANIFEST_FILE = path.resolve(__dirname, 'model-manifest.json');

const PING_TIMEOUT_MS = 5_000;

interface ModelEntry {
  provider: string;
  primaryModel: string;
  fallbackModel: string | null;
  mode: 'gemini-engine' | 'openai-api';
  baseUrl: string;
  keyName: string;
  /** Resolved after ping */
  status: 'locked' | 'fallback' | 'skip';
  resolvedModel: string;
  skipReason?: string;
}

interface ModelManifest {
  version: string;
  resolvedAt: string;
  models: ModelEntry[];
}

// --- v2.0 model definitions ---
// Each entry is a distinct model to evaluate (same provider can appear multiple times).
// This evaluates model characteristics, not provider-vs-provider.
const MODEL_DEFS: Omit<ModelEntry, 'status' | 'resolvedModel' | 'skipReason'>[] = [
  // --- OpenAI ---
  {
    provider: 'OpenAI-Chat',
    primaryModel: 'gpt-5.2',
    fallbackModel: 'gpt-4.1',
    mode: 'openai-api',
    baseUrl: 'https://api.openai.com/v1',
    keyName: 'openai',
  },
  {
    provider: 'OpenAI-Mini',
    primaryModel: 'gpt-4.1-mini',
    fallbackModel: 'gpt-4.1-nano',
    mode: 'openai-api',
    baseUrl: 'https://api.openai.com/v1',
    keyName: 'openai',
  },
  // --- Google ---
  {
    provider: 'Gemini-Pro',
    primaryModel: 'gemini-3-pro',
    fallbackModel: 'gemini-2.5-pro',
    mode: 'gemini-engine',
    baseUrl: '',
    keyName: 'gemini',
  },
  {
    provider: 'Gemini-Flash',
    primaryModel: 'gemini-3-flash',
    fallbackModel: 'gemini-2.5-flash',
    mode: 'gemini-engine',
    baseUrl: '',
    keyName: 'gemini',
  },
  // --- Anthropic ---
  {
    provider: 'Claude-Opus',
    primaryModel: 'anthropic/claude-opus-4.6',
    fallbackModel: 'anthropic/claude-opus-4.5',
    mode: 'openai-api',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyName: 'openrouter',
  },
  {
    provider: 'Claude-Sonnet',
    primaryModel: 'anthropic/claude-sonnet-4.5',
    fallbackModel: 'anthropic/claude-sonnet-4',
    mode: 'openai-api',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyName: 'openrouter',
  },
  // --- DeepSeek ---
  {
    provider: 'DeepSeek-Chat',
    primaryModel: 'deepseek-chat',
    fallbackModel: null,
    mode: 'openai-api',
    baseUrl: 'https://api.deepseek.com',
    keyName: 'deepseek',
  },
  {
    provider: 'DeepSeek-Coder',
    primaryModel: 'deepseek-coder',
    fallbackModel: null,
    mode: 'openai-api',
    baseUrl: 'https://api.deepseek.com',
    keyName: 'deepseek',
  },
  // --- MiniMax ---
  {
    provider: 'MiniMax',
    primaryModel: 'MiniMax-M1',
    fallbackModel: null,
    mode: 'openai-api',
    baseUrl: 'https://api.minimax.chat/v1',
    keyName: 'minimax',
  },
  // --- Qwen ---
  {
    provider: 'Qwen-Chat',
    primaryModel: 'qwen/qwen3-max-thinking',
    fallbackModel: 'qwen/qwen3-max',
    mode: 'openai-api',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyName: 'openrouter',
  },
  {
    provider: 'Qwen-Coder',
    primaryModel: 'qwen/qwen3-coder',
    fallbackModel: 'qwen/qwen3-coder-next',
    mode: 'openai-api',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyName: 'openrouter',
  },
  // --- Zhipu ---
  {
    provider: 'Zhipu-GLM',
    primaryModel: 'z-ai/glm-5',
    fallbackModel: null,
    mode: 'openai-api',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyName: 'openrouter',
  },
  // --- Kimi ---
  {
    provider: 'Kimi',
    primaryModel: 'moonshotai/kimi-k2.5',
    fallbackModel: null,
    mode: 'openai-api',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyName: 'openrouter',
  },
  // --- Baidu ---
  {
    provider: 'Baidu-ERNIE',
    primaryModel: 'baidu/ernie-4.5-300b-a47b',
    fallbackModel: null,
    mode: 'openai-api',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyName: 'openrouter',
  },
];

// --- Key loading ---
function loadKeys(): Record<string, string> {
  const content = fs.readFileSync(KEY_FILE, 'utf-8');
  const keys: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const cleanLine = trimmed.replace(/^\(.*?\)/, '').trim();
    if (!cleanLine) continue;
    const colonIdx = cleanLine.indexOf(':');
    if (colonIdx <= 0) continue;
    const provider = cleanLine.slice(0, colonIdx).trim().toLowerCase();
    const key = cleanLine.slice(colonIdx + 1).trim();
    if (key) keys[provider] = key;
  }
  return keys;
}

// --- Ping a model via OpenAI-compatible API ---
async function pingOpenAI(model: string, baseUrl: string, apiKey: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    // OpenAI direct API (gpt-5.x) requires max_completion_tokens; others use max_tokens
    const isOpenAIDirect = baseUrl.includes('api.openai.com');
    const tokenLimit = isOpenAIDirect
      ? { max_completion_tokens: 8 }
      : { max_tokens: 8 };

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(baseUrl.includes('openrouter')
          ? { 'HTTP-Referer': 'https://margay.app', 'X-Title': 'Margay Model Eval' }
          : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say "ok".' }],
        ...tokenLimit,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.log(`    HTTP ${resp.status}: ${body.slice(0, 120)}`);
      return false;
    }
    // Accept any 200 with choices — some reasoning models return empty content
    // when max_tokens is too low for both thinking and generation
    const data = (await resp.json()) as { choices?: unknown[] };
    return Array.isArray(data.choices) && data.choices.length > 0;
  } catch (err: any) {
    console.log(`    ${err.name === 'AbortError' ? 'timeout' : err.message?.slice(0, 100)}`);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Ping Gemini engine model ---
async function pingGemini(model: string, apiKey: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    // Use Gemini REST API directly for ping (faster than loading core)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say "ok".' }] }],
        generationConfig: { maxOutputTokens: 8 },
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.log(`    HTTP ${resp.status}: ${body.slice(0, 120)}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.log(`    ${err.name === 'AbortError' ? 'timeout' : err.message?.slice(0, 100)}`);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Main ---
async function main() {
  console.log('=== Model Eval v2.0 — Resolve Models ===\n');

  const keys = loadKeys();
  console.log(`Loaded keys: ${Object.keys(keys).join(', ')}\n`);

  const manifest: ModelManifest = {
    version: '2.0',
    resolvedAt: new Date().toISOString(),
    models: [],
  };

  for (const def of MODEL_DEFS) {
    const apiKey = keys[def.keyName];
    if (!apiKey) {
      console.log(`[SKIP] ${def.provider}: no ${def.keyName} key`);
      manifest.models.push({
        ...def,
        status: 'skip',
        resolvedModel: '',
        skipReason: `no ${def.keyName} key`,
      });
      continue;
    }

    // Ping primary
    console.log(`[PING] ${def.provider} — ${def.primaryModel}`);
    const primaryOk =
      def.mode === 'gemini-engine'
        ? await pingGemini(def.primaryModel, apiKey)
        : await pingOpenAI(def.primaryModel, def.baseUrl, apiKey);

    if (primaryOk) {
      console.log(`  ✓ ${def.primaryModel}`);
      manifest.models.push({ ...def, status: 'locked', resolvedModel: def.primaryModel });
      continue;
    }

    // Try fallback
    if (def.fallbackModel) {
      console.log(`  ✗ primary failed, trying fallback: ${def.fallbackModel}`);

      const fallbackOk =
        def.mode === 'gemini-engine'
          ? await pingGemini(def.fallbackModel, apiKey)
          : await pingOpenAI(def.fallbackModel, def.baseUrl, apiKey);

      if (fallbackOk) {
        console.log(`  ✓ fallback ${def.fallbackModel}`);
        manifest.models.push({
          ...def,
          status: 'fallback',
          resolvedModel: def.fallbackModel,
        });
        continue;
      }
    }

    console.log(`  ✗ ${def.provider} — all models unavailable`);
    manifest.models.push({
      ...def,
      status: 'skip',
      resolvedModel: '',
      skipReason: 'primary and fallback both unavailable',
    });
  }

  // Write manifest
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));

  const locked = manifest.models.filter((m) => m.status === 'locked').length;
  const fallback = manifest.models.filter((m) => m.status === 'fallback').length;
  const skip = manifest.models.filter((m) => m.status === 'skip').length;
  console.log(`\n=== Done: ${locked} locked, ${fallback} fallback, ${skip} skipped ===`);
  console.log(`Manifest: ${MANIFEST_FILE}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
