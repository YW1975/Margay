/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import type Database from 'better-sqlite3';

/**
 * Initialize database schema with all tables and indexes
 */
export function initSchema(db: Database.Database): void {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  // Enable Write-Ahead Logging for better performance
  try {
    db.pragma('journal_mode = WAL');
  } catch (error) {
    console.warn('[Database] Failed to enable WAL mode, using default journal mode:', error);
    // Continue with default journal mode if WAL fails
  }

  // Users table (账户系统)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      avatar_path TEXT,
      jwt_secret TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  `);

  // Conversations table (会话表 - 存储TChatConversation)
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('gemini', 'acp', 'codex')),
      extra TEXT NOT NULL,
      model TEXT,
      status TEXT CHECK(status IN ('pending', 'running', 'finished')),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
    CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
  `);

  // Messages table (消息表 - 存储TMessage)
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      msg_id TEXT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      position TEXT CHECK(position IN ('left', 'right', 'center', 'pop')),
      status TEXT CHECK(status IN ('finish', 'pending', 'error', 'work')),
      created_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
    CREATE INDEX IF NOT EXISTS idx_messages_msg_id ON messages(msg_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at);
  `);

  console.log('[Database] Schema initialized successfully');
}

/**
 * Get database version for migration tracking
 * Uses SQLite's built-in user_version pragma
 */
export function getDatabaseVersion(db: Database.Database): number {
  try {
    const result = db.pragma('user_version', { simple: true }) as number;
    return result;
  } catch {
    return 0;
  }
}

/**
 * Set database version
 * Uses SQLite's built-in user_version pragma
 */
export function setDatabaseVersion(db: Database.Database, version: number): void {
  db.pragma(`user_version = ${version}`);
}

/**
 * Current database schema version
 * Update this when adding new migrations in migrations.ts
 */
export const CURRENT_DB_VERSION = 16;

/**
 * Repair DDL for migrated tables — used by verifySchemaIntegrity()
 * Each entry creates a table IF NOT EXISTS with current schema + indexes.
 * Must match the final schema after all migrations.
 */
export const MIGRATED_TABLE_REPAIR_DDL: Array<{ name: string; ddl: string }> = [
  {
    // Canonical: v6 (created) → v9 (added lark) → v13 (removed CHECK on type)
    name: 'assistant_plugins',
    ddl: `
      CREATE TABLE IF NOT EXISTS assistant_plugins (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        config TEXT NOT NULL,
        status TEXT CHECK(status IN ('created', 'initializing', 'ready', 'starting', 'running', 'stopping', 'stopped', 'error')),
        last_connected INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_assistant_plugins_type ON assistant_plugins(type);
      CREATE INDEX IF NOT EXISTS idx_assistant_plugins_enabled ON assistant_plugins(enabled);
    `,
  },
  {
    // Canonical: v6 (created) — unchanged
    name: 'assistant_users',
    ddl: `
      CREATE TABLE IF NOT EXISTS assistant_users (
        id TEXT PRIMARY KEY,
        platform_user_id TEXT NOT NULL,
        platform_type TEXT NOT NULL,
        display_name TEXT,
        authorized_at INTEGER NOT NULL,
        last_active INTEGER,
        session_id TEXT,
        UNIQUE(platform_user_id, platform_type)
      );
      CREATE INDEX IF NOT EXISTS idx_assistant_users_platform ON assistant_users(platform_type, platform_user_id);
    `,
  },
  {
    // Canonical: v6 (created) — unchanged
    name: 'assistant_sessions',
    ddl: `
      CREATE TABLE IF NOT EXISTS assistant_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        agent_type TEXT NOT NULL CHECK(agent_type IN ('gemini', 'acp', 'codex')),
        conversation_id TEXT,
        workspace TEXT,
        created_at INTEGER NOT NULL,
        last_activity INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES assistant_users(id) ON DELETE CASCADE,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_assistant_sessions_user ON assistant_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_assistant_sessions_conversation ON assistant_sessions(conversation_id);
    `,
  },
  {
    // Canonical: v6 (created) — unchanged
    name: 'assistant_pairing_codes',
    ddl: `
      CREATE TABLE IF NOT EXISTS assistant_pairing_codes (
        code TEXT PRIMARY KEY,
        platform_user_id TEXT NOT NULL,
        platform_type TEXT NOT NULL,
        display_name TEXT,
        requested_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'expired'))
      );
      CREATE INDEX IF NOT EXISTS idx_assistant_pairing_expires ON assistant_pairing_codes(expires_at);
      CREATE INDEX IF NOT EXISTS idx_assistant_pairing_status ON assistant_pairing_codes(status);
    `,
  },
  {
    // Canonical: v9 (created) — unchanged
    name: 'cron_jobs',
    ddl: `
      CREATE TABLE IF NOT EXISTS cron_jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        schedule_kind TEXT NOT NULL,
        schedule_value TEXT NOT NULL,
        schedule_tz TEXT,
        schedule_description TEXT NOT NULL,
        payload_message TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        conversation_title TEXT,
        agent_type TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        next_run_at INTEGER,
        last_run_at INTEGER,
        last_status TEXT,
        last_error TEXT,
        run_count INTEGER DEFAULT 0,
        retry_count INTEGER DEFAULT 0,
        max_retries INTEGER DEFAULT 3
      );
      CREATE INDEX IF NOT EXISTS idx_cron_jobs_conversation ON cron_jobs(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_cron_jobs_next_run ON cron_jobs(next_run_at) WHERE enabled = 1;
      CREATE INDEX IF NOT EXISTS idx_cron_jobs_agent_type ON cron_jobs(agent_type);
    `,
  },
  {
    name: 'gemini_approvals',
    ddl: `
      CREATE TABLE IF NOT EXISTS gemini_approvals (
        action TEXT NOT NULL,
        identifier TEXT NOT NULL DEFAULT '',
        workspace_scope TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (action, identifier, workspace_scope)
      );
      CREATE INDEX IF NOT EXISTS idx_gemini_approvals_action ON gemini_approvals(action);
      CREATE INDEX IF NOT EXISTS idx_gemini_approvals_workspace ON gemini_approvals(workspace_scope);
    `,
  },
  {
    name: 'assistant_memories',
    ddl: `
      CREATE TABLE IF NOT EXISTS assistant_memories (
        id TEXT PRIMARY KEY,
        scope TEXT NOT NULL CHECK(scope IN ('assistant', 'workspace', 'org')),
        owner_id TEXT,
        category TEXT NOT NULL CHECK(category IN ('fact', 'preference', 'decision', 'context', 'summary')),
        summary TEXT NOT NULL,
        file_path TEXT,
        source_conversation_id TEXT,
        source_assistant_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_memories_scope ON assistant_memories(scope);
      CREATE INDEX IF NOT EXISTS idx_memories_owner ON assistant_memories(owner_id);
      CREATE INDEX IF NOT EXISTS idx_memories_updated ON assistant_memories(updated_at DESC);
    `,
  },
];

/**
 * Verify schema integrity — repair missing tables and indexes.
 * Called after migrations to ensure all critical tables exist.
 */
export function verifySchemaIntegrity(db: Database.Database): void {
  for (const table of MIGRATED_TABLE_REPAIR_DDL) {
    const row = db.prepare("SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name=?").get(table.name) as { c: number };
    if (row.c === 0) {
      console.warn(`[Database] Missing table '${table.name}', recreating...`);
    }
    // Always run DDL — CREATE TABLE/INDEX IF NOT EXISTS is idempotent
    // This also heals missing indexes even when the table exists
    db.exec(table.ddl);
  }
}
