#!/usr/bin/env npx tsx
/**
 * Hacker News Firebase API wrapper for social-ops skill.
 * Read-only: scan user submissions, get comments, top stories.
 *
 * Usage:
 *   npx tsx hn-api.ts scan --user <username>
 *   npx tsx hn-api.ts story --id <storyId>
 *   npx tsx hn-api.ts top [--limit <n>]
 *
 * No auth required.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const API_BASE = 'https://hacker-news.firebaseio.com/v0';
const AUDIT_LOG = path.join(os.homedir(), '.margay-config', 'social-ops-audit.jsonl');

function appendAudit(entry: Record<string, unknown>): void {
  const dir = path.dirname(AUDIT_LOG);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(AUDIT_LOG, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n');
}

async function hnFetch(endpoint: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`HN API ${res.status}`);
  return res.json();
}

interface HNItem {
  id: number;
  title?: string;
  text?: string;
  by?: string;
  score?: number;
  descendants?: number;
  kids?: number[];
  type?: string;
  url?: string;
}

interface HNUser {
  id: string;
  karma: number;
  submitted?: number[];
}

async function scanUser(username: string): Promise<void> {
  const user = (await hnFetch(`/user/${username}.json`)) as HNUser;
  if (!user) {
    console.error(`[ERROR] User '${username}' not found.`);
    return;
  }

  const submissionIds = (user.submitted || []).slice(0, 15);
  const items = await Promise.all(submissionIds.map((id) => hnFetch(`/item/${id}.json`) as Promise<HNItem>));
  const stories = items.filter((item) => item && item.type === 'story');

  console.log(`## HN Scan — ${username} (karma: ${user.karma}) — ${new Date().toISOString()}\n`);
  if (stories.length === 0) {
    console.log('No recent stories found.');
    return;
  }
  console.log('| Submission | Points | Comments | ID |');
  console.log('|-----------|--------|----------|----|');
  for (const story of stories.slice(0, 10)) {
    const title = (story.title || '').slice(0, 50);
    console.log(`| "${title}..." | ${story.score || 0} | ${story.descendants || 0} | ${story.id} |`);
  }
  appendAudit({ action: 'scan', platform: 'hn', username, mode: 'read' });
}

async function getStory(storyId: number): Promise<void> {
  const story = (await hnFetch(`/item/${storyId}.json`)) as HNItem;
  if (!story) {
    console.error(`[ERROR] Item ${storyId} not found.`);
    return;
  }

  console.log(`## HN Story — ${story.title || storyId}`);
  console.log(`By: ${story.by} | Points: ${story.score} | Comments: ${story.descendants}`);
  if (story.url) console.log(`URL: ${story.url}`);
  console.log('');

  // Fetch top-level comments
  const commentIds = (story.kids || []).slice(0, 10);
  if (commentIds.length === 0) {
    console.log('No comments.');
    return;
  }
  const comments = await Promise.all(commentIds.map((id) => hnFetch(`/item/${id}.json`) as Promise<HNItem>));
  console.log('### Top Comments\n');
  for (const comment of comments) {
    if (!comment || !comment.text) continue;
    const text = comment.text.replace(/<[^>]+>/g, '').slice(0, 200);
    console.log(`**${comment.by}**: ${text}\n`);
  }
  appendAudit({ action: 'story', platform: 'hn', storyId, mode: 'read' });
}

async function topStories(limit: number): Promise<void> {
  const ids = (await hnFetch('/topstories.json')) as number[];
  const topIds = ids.slice(0, limit);
  const items = await Promise.all(topIds.map((id) => hnFetch(`/item/${id}.json`) as Promise<HNItem>));

  console.log(`## HN Top ${limit} Stories — ${new Date().toISOString()}\n`);
  console.log('| # | Title | Points | Comments | By |');
  console.log('|---|-------|--------|----------|----|');
  items.forEach((item, i) => {
    if (!item) return;
    const title = (item.title || '').slice(0, 60);
    console.log(`| ${i + 1} | "${title}" | ${item.score || 0} | ${item.descendants || 0} | ${item.by} |`);
  });
  appendAudit({ action: 'top', platform: 'hn', limit, mode: 'read' });
}

// --- CLI ---

const args = process.argv.slice(2);
const action = args[0];

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

if (action === 'scan') {
  const username = getArg('--user');
  if (!username) {
    console.error('Usage: npx tsx hn-api.ts scan --user <username>');
    process.exit(1);
  }
  scanUser(username).catch((e) => console.error('[ERROR]', e.message));
} else if (action === 'story') {
  const id = getArg('--id');
  if (!id) {
    console.error('Usage: npx tsx hn-api.ts story --id <storyId>');
    process.exit(1);
  }
  getStory(parseInt(id, 10)).catch((e) => console.error('[ERROR]', e.message));
} else if (action === 'top') {
  const limit = parseInt(getArg('--limit') || '10', 10);
  topStories(limit).catch((e) => console.error('[ERROR]', e.message));
} else if (action === '--test') {
  console.log('[TEST] hn-api.ts loaded successfully. No auth required.');
} else {
  console.error('Usage: npx tsx hn-api.ts <scan|story|top|--test> [options]');
  process.exit(1);
}
