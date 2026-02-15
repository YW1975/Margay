---
name: memory-manager
description: Manage cross-session memory for Margay assistants. Memory persists across conversations and is injected into future sessions automatically.
---

# Memory Manager

Manage cross-session memory for Margay assistants. Memory persists across conversations and is injected into future sessions automatically.

## Memory Layers

| Layer | Scope         | Path                                            | Shared                                 |
| ----- | ------------- | ----------------------------------------------- | -------------------------------------- |
| L2    | Per-assistant | `{memoryDir}/assistant/{assistantId}/MEMORY.md` | No — only this assistant               |
| L3    | Per-workspace | `{memoryDir}/workspace/{hash}/MEMORY.md`        | Yes — all assistants in this workspace |

**Memory directory location:**

- CLI-safe symlink (all platforms): `~/.margay-config/memory/`
- macOS native: `~/Library/Application Support/Margay/config/memory/`
- Linux native: `~/.config/Margay/config/memory/`

The `{hash}` is the first 12 hex chars of SHA-256 of the workspace absolute path.

## Save Memory

Write directly to the MEMORY.md file using your file editing tools.

### Assistant Memory (L2)

Save facts about the user, learned preferences, or session summaries:

```markdown
# Assistant Memory: {AssistantName}

## User Preferences

- User prefers concise responses in Chinese, code comments in English

## Learned Context

- Main project is Margay (Electron + TypeScript)

## Session Summaries

- 2026-02-15: Completed skill architecture redesign
```

### Workspace Memory (L3)

Save project-specific knowledge shared across all assistants:

```markdown
# Workspace: {ProjectName}

## Architecture

- Electron + TypeScript + React frontend
- SQLite database with migration system

## Decisions

- 2026-02-15: Adopted four-layer memory system
```

## Query Memory

List what memory files exist:

```bash
bash scripts/query-memory.sh
```

The script auto-detects the platform-specific memory directory. You can also pass a custom path:

```bash
bash scripts/query-memory.sh /custom/memory/path
```

## When to Save Memory

- User explicitly says "remember this" or "save this for next time"
- You learn an important user preference that should persist
- A significant architectural decision is made
- At the end of a productive session, summarize key outcomes

## When NOT to Save

- Temporary debugging context
- Information already in project documentation
- Sensitive data (passwords, tokens, keys)
