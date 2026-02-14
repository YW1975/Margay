#!/usr/bin/env npx tsx
/**
 * Reddit API wrapper for social-ops skill.
 * Supports: scan (read posts/comments), post, reply.
 * All write operations are dry-run by default.
 *
 * Usage:
 *   npx tsx reddit-api.ts scan --user <username>
 *   npx tsx reddit-api.ts scan --subreddit <name>
 *   npx tsx reddit-api.ts post --subreddit <name> --title "title" --body "body"
 *   npx tsx reddit-api.ts reply --thing-id <t1_xxx> "content"
 *   npx tsx reddit-api.ts post ... --execute --confirm-token=<token>
 *
 * Env: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
 *      (or in ~/.margay-config/social-ops.env)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const ENV_FILE = path.join(os.homedir(), '.margay-config', 'social-ops.env');
const AUDIT_LOG = path.join(os.homedir(), '.margay-config', 'social-ops-audit.jsonl');
const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const API_BASE = 'https://oauth.reddit.com';

let cachedToken: { token: string; expiresAt: number } | null = null;

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

function appendAudit(entry: Record<string, unknown>): void {
  const dir = path.dirname(AUDIT_LOG);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(AUDIT_LOG, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n');
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  loadEnv();
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    console.error('[ERROR] Reddit credentials not set. See assets/credentials-setup.md');
    process.exit(1);
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'margay-social-ops/1.0',
    },
    body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Reddit auth failed ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

async function redditFetch(endpoint: string, options: RequestInit = {}): Promise<unknown> {
  const token = await getAccessToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'margay-social-ops/1.0',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Reddit API ${res.status}: ${body}`);
  }
  return res.json();
}

// --- Commands ---

async function scanUser(username: string): Promise<void> {
  const data = (await redditFetch(`/user/${username}/submitted?sort=new&limit=10`)) as {
    data: { children: Array<{ data: { title: string; score: number; num_comments: number; permalink: string; subreddit: string } }> };
  };

  console.log(`## Reddit Scan — u/${username} — ${new Date().toISOString()}\n`);
  if (!data.data.children.length) {
    console.log('No recent posts found.');
    return;
  }
  console.log('| Post | Subreddit | Upvotes | Comments |');
  console.log('|------|-----------|---------|----------|');
  for (const child of data.data.children) {
    const p = child.data;
    const title = p.title.slice(0, 50);
    console.log(`| "${title}..." | r/${p.subreddit} | ${p.score} | ${p.num_comments} |`);
  }
  appendAudit({ action: 'scan', platform: 'reddit', username, mode: 'read' });
}

async function scanSubreddit(subreddit: string): Promise<void> {
  const data = (await redditFetch(`/r/${subreddit}/hot?limit=10`)) as {
    data: { children: Array<{ data: { title: string; score: number; num_comments: number; author: string } }> };
  };

  console.log(`## Reddit Scan — r/${subreddit} — ${new Date().toISOString()}\n`);
  console.log('| Post | Author | Upvotes | Comments |');
  console.log('|------|--------|---------|----------|');
  for (const child of data.data.children) {
    const p = child.data;
    const title = p.title.slice(0, 50);
    console.log(`| "${title}..." | u/${p.author} | ${p.score} | ${p.num_comments} |`);
  }
  appendAudit({ action: 'scan', platform: 'reddit', subreddit, mode: 'read' });
}

async function post(subreddit: string, title: string, body: string, execute: boolean, confirmToken?: string): Promise<void> {
  if (!execute) {
    console.log(`[DRY-RUN] Would post to r/${subreddit}:\n\nTitle: ${title}\nBody: ${body.slice(0, 200)}...`);
    appendAudit({ action: 'post', platform: 'reddit', subreddit, title, mode: 'dry-run' });
    return;
  }
  if (!confirmToken) {
    console.error('[BLOCKED] Write requires --confirm-token.');
    appendAudit({ action: 'post', platform: 'reddit', mode: 'blocked' });
    return;
  }

  const res = await redditFetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `sr=${encodeURIComponent(subreddit)}&kind=self&title=${encodeURIComponent(title)}&text=${encodeURIComponent(body)}&api_type=json`,
  });

  const result = res as { json: { data: { url: string } } };
  console.log(`[SUCCESS] Posted: ${result.json.data.url}`);
  appendAudit({ action: 'post', platform: 'reddit', subreddit, url: result.json.data.url, mode: 'execute' });
}

async function reply(thingId: string, content: string, execute: boolean, confirmToken?: string): Promise<void> {
  if (!execute) {
    console.log(`[DRY-RUN] Would reply to ${thingId}:\n\n${content}`);
    appendAudit({ action: 'reply', platform: 'reddit', thingId, content: content.slice(0, 100), mode: 'dry-run' });
    return;
  }
  if (!confirmToken) {
    console.error('[BLOCKED] Write requires --confirm-token.');
    appendAudit({ action: 'reply', platform: 'reddit', thingId, mode: 'blocked' });
    return;
  }

  const res = await redditFetch('/api/comment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `thing_id=${encodeURIComponent(thingId)}&text=${encodeURIComponent(content)}&api_type=json`,
  });

  const result = res as { json: { data: { things: Array<{ data: { id: string } }> } } };
  const commentId = result.json?.data?.things?.[0]?.data?.id;
  console.log(`[SUCCESS] Replied: comment ${commentId || 'created'}`);
  appendAudit({ action: 'reply', platform: 'reddit', thingId, commentId, mode: 'execute' });
}

// --- CLI ---

const args = process.argv.slice(2);
const action = args[0];
const execute = args.includes('--execute');
const confirmTokenArg = args.find((a) => a.startsWith('--confirm-token='));
const confirmToken = confirmTokenArg?.split('=')[1];

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

if (action === 'scan') {
  const username = getArg('--user');
  const subreddit = getArg('--subreddit');
  if (username) {
    scanUser(username).catch((e) => console.error('[ERROR]', e.message));
  } else if (subreddit) {
    scanSubreddit(subreddit).catch((e) => console.error('[ERROR]', e.message));
  } else {
    console.error('Usage: npx tsx reddit-api.ts scan --user <username> | --subreddit <name>');
    process.exit(1);
  }
} else if (action === 'post') {
  const subreddit = getArg('--subreddit');
  const title = getArg('--title');
  const body = getArg('--body');
  if (!subreddit || !title || !body) {
    console.error('Usage: npx tsx reddit-api.ts post --subreddit <name> --title "title" --body "body"');
    process.exit(1);
  }
  post(subreddit, title, body, execute, confirmToken).catch((e) => console.error('[ERROR]', e.message));
} else if (action === 'reply') {
  const thingId = getArg('--thing-id');
  const content = args.find((a, i) => i > 0 && !a.startsWith('--') && args[i - 1] !== '--thing-id');
  if (!thingId || !content) {
    console.error('Usage: npx tsx reddit-api.ts reply --thing-id <t1_xxx> "content"');
    process.exit(1);
  }
  reply(thingId, content, execute, confirmToken).catch((e) => console.error('[ERROR]', e.message));
} else if (action === '--test') {
  loadEnv();
  console.log('[TEST] reddit-api.ts loaded. Client ID:', process.env.REDDIT_CLIENT_ID ? 'present' : 'missing');
} else {
  console.error('Usage: npx tsx reddit-api.ts <scan|post|reply|--test> [options]');
  process.exit(1);
}
