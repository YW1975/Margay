#!/usr/bin/env npx tsx
/**
 * X (Twitter) API v2 wrapper for social-ops skill.
 * Supports: scan (read timeline/mentions), post, reply.
 * All write operations are dry-run by default.
 *
 * Usage:
 *   npx tsx x-api.ts scan --user <username>
 *   npx tsx x-api.ts post "content"
 *   npx tsx x-api.ts reply --tweet-id <id> "content"
 *   npx tsx x-api.ts post "content" --execute --confirm-token=<token>
 *
 * Env: X_BEARER_TOKEN (or in ~/.margay-config/social-ops.env)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// --- Config ---

const ENV_FILE = path.join(os.homedir(), '.margay-config', 'social-ops.env');
const AUDIT_LOG = path.join(os.homedir(), '.margay-config', 'social-ops-audit.jsonl');
const BASE_URL = 'https://api.x.com/2';

function loadEnv(): void {
  if (fs.existsSync(ENV_FILE)) {
    const lines = fs.readFileSync(ENV_FILE, 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

function getToken(): string {
  loadEnv();
  const token = process.env.X_BEARER_TOKEN;
  if (!token) {
    console.error('[ERROR] X_BEARER_TOKEN not set. See assets/credentials-setup.md');
    process.exit(1);
  }
  return token;
}

// --- Audit ---

function appendAudit(entry: Record<string, unknown>): void {
  const dir = path.dirname(AUDIT_LOG);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(AUDIT_LOG, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n');
}

// --- API helpers ---

async function xFetch(endpoint: string, options: RequestInit = {}): Promise<unknown> {
  const token = getToken();
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`X API ${res.status}: ${body}`);
  }
  return res.json();
}

// --- Commands ---

async function scan(username: string): Promise<void> {
  // Get user ID
  const userRes = (await xFetch(`/users/by/username/${username}?user.fields=public_metrics`)) as {
    data: { id: string; public_metrics: Record<string, number> };
  };
  const userId = userRes.data.id;

  // Get recent tweets
  const tweetsRes = (await xFetch(`/users/${userId}/tweets?max_results=10&tweet.fields=public_metrics,created_at`)) as {
    data?: Array<{ id: string; text: string; public_metrics: Record<string, number>; created_at: string }>;
  };

  console.log(`## X Scan — @${username} — ${new Date().toISOString()}\n`);
  if (!tweetsRes.data || tweetsRes.data.length === 0) {
    console.log('No recent tweets found.');
    return;
  }
  console.log('| Post | Likes | RTs | Replies | Quote |');
  console.log('|------|-------|-----|---------|-------|');
  for (const tweet of tweetsRes.data) {
    const m = tweet.public_metrics;
    const excerpt = tweet.text.slice(0, 60).replace(/\n/g, ' ');
    console.log(`| "${excerpt}..." | ${m.like_count} | ${m.retweet_count} | ${m.reply_count} | ${m.quote_count} |`);
  }

  appendAudit({ action: 'scan', platform: 'x', username, mode: 'read' });
}

async function post(content: string, execute: boolean, confirmToken?: string): Promise<void> {
  if (!execute) {
    console.log(`[DRY-RUN] Would post to X:\n\n${content}\n\nCharacters: ${content.length}/280`);
    appendAudit({ action: 'post', platform: 'x', content: content.slice(0, 100), mode: 'dry-run' });
    return;
  }
  if (!confirmToken) {
    console.error('[BLOCKED] Write requires --confirm-token. Use --execute --confirm-token=<token>');
    appendAudit({ action: 'post', platform: 'x', mode: 'blocked', reason: 'missing confirmation' });
    return;
  }

  // Need OAuth 2.0 User Context for posting (Bearer token is app-only)
  // For now, use OAuth 1.0a via X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
  loadEnv();
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.error('[ERROR] OAuth 1.0a credentials required for posting. Set X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET.');
    return;
  }

  // TODO: Implement OAuth 1.0a request signing (HMAC-SHA1).
  // The X API v2 POST /tweets endpoint requires OAuth 1.0a user context.
  // For now, this will fail with 401 — fails safe (no accidental posts).
  const res = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: content }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[ERROR] Failed to post: ${res.status} ${body}`);
    appendAudit({ action: 'post', platform: 'x', mode: 'error', status: res.status });
    return;
  }

  const result = (await res.json()) as { data: { id: string } };
  console.log(`[SUCCESS] Posted: https://x.com/i/status/${result.data.id}`);
  appendAudit({ action: 'post', platform: 'x', tweetId: result.data.id, mode: 'execute' });
}

async function reply(tweetId: string, content: string, execute: boolean, confirmToken?: string): Promise<void> {
  if (!execute) {
    console.log(`[DRY-RUN] Would reply to tweet ${tweetId}:\n\n${content}`);
    appendAudit({ action: 'reply', platform: 'x', tweetId, content: content.slice(0, 100), mode: 'dry-run' });
    return;
  }
  if (!confirmToken) {
    console.error('[BLOCKED] Write requires --confirm-token.');
    return;
  }

  // TODO: Implement OAuth 1.0a request signing (same as post)
  const res = await fetch('https://api.x.com/2/tweets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: content, reply: { in_reply_to_tweet_id: tweetId } }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[ERROR] Failed to reply: ${res.status} ${body}`);
    appendAudit({ action: 'reply', platform: 'x', tweetId, mode: 'error', status: res.status });
    return;
  }

  const result = (await res.json()) as { data: { id: string } };
  console.log(`[SUCCESS] Replied: https://x.com/i/status/${result.data.id}`);
  appendAudit({ action: 'reply', platform: 'x', tweetId, replyId: result.data.id, mode: 'execute' });
}

// --- CLI ---

const args = process.argv.slice(2);
const action = args[0];
const execute = args.includes('--execute');
const confirmTokenArg = args.find((a) => a.startsWith('--confirm-token='));
const confirmToken = confirmTokenArg?.split('=')[1];

if (action === 'scan') {
  const userIdx = args.indexOf('--user');
  const username = userIdx >= 0 ? args[userIdx + 1] : undefined;
  if (!username) {
    console.error('Usage: npx tsx x-api.ts scan --user <username>');
    process.exit(1);
  }
  scan(username).catch((e) => console.error('[ERROR]', e.message));
} else if (action === 'post') {
  const content = args[1];
  if (!content || content.startsWith('--')) {
    console.error('Usage: npx tsx x-api.ts post "content" [--execute --confirm-token=<token>]');
    process.exit(1);
  }
  post(content, execute, confirmToken).catch((e) => console.error('[ERROR]', e.message));
} else if (action === 'reply') {
  const tweetIdIdx = args.indexOf('--tweet-id');
  const tweetId = tweetIdIdx >= 0 ? args[tweetIdIdx + 1] : undefined;
  const content = args.find((a, i) => i > 0 && !a.startsWith('--') && i !== tweetIdIdx + 1);
  if (!tweetId || !content) {
    console.error('Usage: npx tsx x-api.ts reply --tweet-id <id> "content" [--execute --confirm-token=<token>]');
    process.exit(1);
  }
  reply(tweetId, content, execute, confirmToken).catch((e) => console.error('[ERROR]', e.message));
} else if (action === '--test') {
  console.log('[TEST] x-api.ts loaded successfully. Bearer token:', getToken() ? 'present' : 'missing');
} else {
  console.error('Usage: npx tsx x-api.ts <scan|post|reply|--test> [options]');
  process.exit(1);
}
