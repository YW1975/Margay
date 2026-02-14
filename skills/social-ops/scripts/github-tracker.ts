#!/usr/bin/env npx tsx
/**
 * GitHub repository tracker for social-ops skill.
 * Uses `gh` CLI for authenticated access.
 * Read-only: scan repo stats, issues, PRs, releases.
 *
 * Usage:
 *   npx tsx github-tracker.ts scan --repo <owner/repo>
 *   npx tsx github-tracker.ts issues --repo <owner/repo> [--limit <n>]
 *   npx tsx github-tracker.ts prs --repo <owner/repo> [--limit <n>]
 *
 * Requires: gh CLI installed and authenticated.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const AUDIT_LOG = path.join(os.homedir(), '.margay-config', 'social-ops-audit.jsonl');

function appendAudit(entry: Record<string, unknown>): void {
  const dir = path.dirname(AUDIT_LOG);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(AUDIT_LOG, JSON.stringify({ ...entry, timestamp: new Date().toISOString() }) + '\n');
}

function gh(cmd: string): string {
  try {
    return execSync(`gh ${cmd}`, { encoding: 'utf-8', timeout: 30000 }).trim();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('not found') || msg.includes('ENOENT')) {
      console.error('[ERROR] gh CLI not found. Install: https://cli.github.com/');
      process.exit(1);
    }
    throw e;
  }
}

function ghJson<T>(cmd: string): T {
  const output = gh(cmd);
  return JSON.parse(output) as T;
}

interface RepoInfo {
  stargazerCount: number;
  forkCount: number;
  openIssues: { totalCount: number };
  pullRequests: { totalCount: number };
  description: string;
  name: string;
  owner: { login: string };
}

async function scan(repo: string): Promise<void> {
  const info = ghJson<RepoInfo>(`api graphql -f query='{ repository(owner:"${repo.split('/')[0]}", name:"${repo.split('/')[1]}") { stargazerCount forkCount openIssues: issues(states:OPEN) { totalCount } pullRequests(states:OPEN) { totalCount } description name owner { login } } }' --jq '.data.repository'`);

  // Recent activity
  const recentIssues = gh(`issue list --repo ${repo} --limit 5 --json number,title,author,createdAt --state open`);
  const recentPRs = gh(`pr list --repo ${repo} --limit 5 --json number,title,author,createdAt --state open`);

  console.log(`## GitHub Scan — ${repo} — ${new Date().toISOString()}\n`);
  console.log(`> ${info.description || 'No description'}\n`);

  console.log('| Metric | Value |');
  console.log('|--------|-------|');
  console.log(`| Stars | ${info.stargazerCount.toLocaleString()} |`);
  console.log(`| Forks | ${info.forkCount.toLocaleString()} |`);
  console.log(`| Open Issues | ${info.openIssues.totalCount} |`);
  console.log(`| Open PRs | ${info.pullRequests.totalCount} |`);

  const issues = JSON.parse(recentIssues) as Array<{ number: number; title: string; author: { login: string }; createdAt: string }>;
  if (issues.length > 0) {
    console.log('\n### Recent Issues\n');
    console.log('| # | Title | Author | Date |');
    console.log('|---|-------|--------|------|');
    for (const issue of issues) {
      console.log(`| #${issue.number} | ${issue.title.slice(0, 50)} | @${issue.author.login} | ${issue.createdAt.slice(0, 10)} |`);
    }
  }

  const prs = JSON.parse(recentPRs) as Array<{ number: number; title: string; author: { login: string }; createdAt: string }>;
  if (prs.length > 0) {
    console.log('\n### Recent PRs\n');
    console.log('| # | Title | Author | Date |');
    console.log('|---|-------|--------|------|');
    for (const pr of prs) {
      console.log(`| #${pr.number} | ${pr.title.slice(0, 50)} | @${pr.author.login} | ${pr.createdAt.slice(0, 10)} |`);
    }
  }

  appendAudit({ action: 'scan', platform: 'github', repo, mode: 'read' });
}

async function listIssues(repo: string, limit: number): Promise<void> {
  const output = gh(`issue list --repo ${repo} --limit ${limit} --json number,title,author,labels,createdAt,comments --state open`);
  const issues = JSON.parse(output) as Array<{
    number: number;
    title: string;
    author: { login: string };
    labels: Array<{ name: string }>;
    createdAt: string;
    comments: Array<unknown>;
  }>;

  console.log(`## GitHub Issues — ${repo} — ${new Date().toISOString()}\n`);
  console.log('| # | Title | Author | Labels | Comments | Date |');
  console.log('|---|-------|--------|--------|----------|------|');
  for (const issue of issues) {
    const labels = issue.labels.map((l) => l.name).join(', ') || '-';
    console.log(`| #${issue.number} | ${issue.title.slice(0, 40)} | @${issue.author.login} | ${labels} | ${issue.comments.length} | ${issue.createdAt.slice(0, 10)} |`);
  }
  appendAudit({ action: 'issues', platform: 'github', repo, limit, mode: 'read' });
}

async function listPRs(repo: string, limit: number): Promise<void> {
  const output = gh(`pr list --repo ${repo} --limit ${limit} --json number,title,author,createdAt,reviewDecision --state open`);
  const prs = JSON.parse(output) as Array<{
    number: number;
    title: string;
    author: { login: string };
    createdAt: string;
    reviewDecision: string;
  }>;

  console.log(`## GitHub PRs — ${repo} — ${new Date().toISOString()}\n`);
  console.log('| # | Title | Author | Review | Date |');
  console.log('|---|-------|--------|--------|------|');
  for (const pr of prs) {
    console.log(`| #${pr.number} | ${pr.title.slice(0, 40)} | @${pr.author.login} | ${pr.reviewDecision || '-'} | ${pr.createdAt.slice(0, 10)} |`);
  }
  appendAudit({ action: 'prs', platform: 'github', repo, limit, mode: 'read' });
}

// --- CLI ---

const args = process.argv.slice(2);
const action = args[0];

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const repo = getArg('--repo');

if (action === 'scan') {
  if (!repo) {
    console.error('Usage: npx tsx github-tracker.ts scan --repo <owner/repo>');
    process.exit(1);
  }
  scan(repo).catch((e) => console.error('[ERROR]', e.message));
} else if (action === 'issues') {
  if (!repo) {
    console.error('Usage: npx tsx github-tracker.ts issues --repo <owner/repo>');
    process.exit(1);
  }
  const limit = parseInt(getArg('--limit') || '10', 10);
  listIssues(repo, limit).catch((e) => console.error('[ERROR]', e.message));
} else if (action === 'prs') {
  if (!repo) {
    console.error('Usage: npx tsx github-tracker.ts prs --repo <owner/repo>');
    process.exit(1);
  }
  const limit = parseInt(getArg('--limit') || '10', 10);
  listPRs(repo, limit).catch((e) => console.error('[ERROR]', e.message));
} else if (action === '--test') {
  try {
    const version = gh('--version');
    console.log(`[TEST] github-tracker.ts loaded. gh CLI: ${version.split('\n')[0]}`);
  } catch {
    console.log('[TEST] github-tracker.ts loaded. gh CLI: not found');
  }
} else {
  console.error('Usage: npx tsx github-tracker.ts <scan|issues|prs|--test> [options]');
  process.exit(1);
}
