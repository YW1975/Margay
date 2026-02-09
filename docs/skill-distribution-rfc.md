# Skill Distribution Architecture RFC

## Status: Draft Rev 3
## Author: Ralph (Lead Developer)
## Scope: Remove injection paths, complete distribution coverage, define install/sync UX, extension compatibility

---

## 1. Executive Summary

AionUi currently uses a hybrid approach: SkillDistributor (already implemented) distributes skills via symlink/copy to engine directories, but legacy injection paths still exist and are used alongside. This RFC proposes removing all injection paths and completing the distribution-only architecture.

**Key design principle**: AionUi DISTRIBUTES skills to engine directories; engines DISCOVER and LOAD them natively.

**Extension coverage**: This RFC also defines the compatibility boundaries between three extension types — skills, MCP servers, and engine plugins/extensions — that AionUi manages or interacts with across the three engines.

---

## 2. Current State

### 2.1 Already Implemented (SkillDistributor)
- `src/process/task/SkillDistributor.ts` — Full distribution with symlink-first, copy fallback (Windows)
- Provenance tracking: `.aionui-managed` marker + `.aionui-manifest.json`
- Stale entry cleanup (only removes AionUi-managed entries)
- Engine-specific exports: `distributeForClaude()`, `distributeForCodex()`, `computeGeminiDisabledSkills()`
- Already called from `AcpAgentManager.sendMessage()` for Claude/custom backends

### 2.2 Already Implemented (McpService)
- `src/process/services/mcpServices/McpService.ts` — Unified MCP distribution
- Per-engine agents: `ClaudeMcpAgent`, `GeminiMcpAgent`, `CodexMcpAgent`, `QwenMcpAgent`, `IflowMcpAgent`, `AionuiMcpAgent`
- Global config: `ConfigStorage['mcp.config']: IMcpServer[]`
- Sync: `syncMcpToAgents()` distributes enabled servers to all engines via CLI commands
- Detect: `getAgentMcpConfigs()` reads MCP from each engine's config

### 2.3 Legacy Injection Paths (to remove)

| Component | File | What it does |
|-----------|------|-------------|
| `buildSystemInstructions()` | `agentUtils.ts:28-49` | Full body injection for Gemini |
| `prepareFirstMessageWithSkillsIndex()` | `agentUtils.ts:76-130` | Skill index injection for ACP |
| `loadSkillsContent()` | `initStorage.ts:763+` | Reads SKILL.md for injection |

### 2.4 Not Yet Distributed
- ACP backends other than Claude/custom (Codex, etc.) — need `distributeForCodex()` call
- Gemini — already uses native SkillManager via skillsDir, but `buildSystemInstructions()` still injects full body

---

## 3. Three Extension Types

AionUi manages or interacts with three extension types across three engines. Each has different distribution mechanics, conflict rules, and sync scope.

### 3.1 Extension Type Definitions

| Extension Type | What it provides | Storage format | AionUi role |
|---------------|-----------------|----------------|-------------|
| **Skill** | Prompt instructions (markdown) | `SKILL.md` + optional `scripts/`, `references/` | DISTRIBUTE files to engine directories |
| **MCP Server** | Tools + resources via protocol | Config entry (command + args + env) | SYNC config to engine CLI configs |
| **Engine Plugin/Extension** | Engine-specific features | Varies per engine | OBSERVE only — detect and record, never modify |

### 3.2 Per-Engine Compatibility Matrix

#### Skills

| Capability | Gemini CLI | Claude Code | Codex |
|-----------|------------|-------------|-------|
| Discovery directory | `skillsDir` config | `.claude/skills/` | `.agents/skills/` |
| Frontmatter fields | `name` + `description` only | 9 fields (7 proprietary) | Standard + `openai.yaml` sidecar |
| Activation method | `activate_skill` tool (lazy load) | Auto/manual `/name` | Auto-match |
| AionUi distribution fn | `computeGeminiDisabledSkills()` | `distributeForClaude()` | `distributeForCodex()` |
| Distribution method | Pass disabledSkills to Config | Symlink/copy to `.claude/skills/` | Symlink/copy to `.agents/skills/` |

#### MCP Servers

| Capability | Gemini CLI | Claude Code | Codex |
|-----------|------------|-------------|-------|
| Supported transports | stdio, sse, http | stdio only | stdio only |
| Config location | Gemini CLI user/project config | `~/.claude/config.json` | Codex CLI config |
| AionUi distribution agent | `GeminiMcpAgent` | `ClaudeMcpAgent` | `CodexMcpAgent` |
| Distribution method | Pass to aioncli-core `start()` params | `claude mcp add -s user` CLI | `codex mcp add` CLI |
| Detect method | aioncli-core native + AionUi config | `claude mcp list` CLI | `codex mcp list` CLI |

#### Engine Plugins/Extensions

| Capability | Gemini CLI | Claude Code | Codex |
|-----------|------------|-------------|-------|
| Plugin type | Gemini extensions (aioncli-core native) | Claude Code plugins (not public API) | `openai.yaml` agent config |
| Config location | Internal to aioncli-core | Internal to Claude Code | `{workspace}/.agents/openai.yaml` |
| AionUi management | None — runs inside worker process | None — runs inside subprocess | None — user-authored sidecar |
| AionUi detection | Not detectable (opaque) | Not detectable (opaque) | Detectable (file exists) but not managed |
| AionUi sync | Never | Never | Never |

### 3.3 Interaction Rules Between Extension Types

```
Skills ──────── Provide instructions (prompt context)
                   │
                   │ Skills may reference MCP tools by description
                   │ (e.g. "use the browser tool to...") but MUST NOT
                   │ reference tools by engine-specific name.
                   │
                   │ Skills MUST NOT declare MCP server requirements.
                   │ If a skill needs an MCP tool, the user must
                   │ install both independently.
                   │
MCP Servers ──── Provide tools + resources (protocol)
                   │
                   │ MCP servers are independent of skills.
                   │ MCP servers MUST NOT reference skills.
                   │ A user may install both; they coexist without
                   │ interaction. The only connection: a skill's
                   │ markdown body may describe tools that an MCP
                   │ server provides (informational, not a hard link).
                   │
Engine Plugins ── Engine-specific features (opaque to AionUi)
                   │
                   │ AionUi does not manage, create, modify, or
                   │ delete engine plugins. They are the user's or
                   │ engine's responsibility entirely.
                   │
                   │ If an engine creates or installs a plugin during
                   │ a conversation, AionUi does not detect, record,
                   │ or act on this event. See Section 4.3 for policy.
```

---

## 4. Install Origin × Extension Type × Target Scope Decision Table

This is the central decision matrix. For every combination of install origin and extension type, the table specifies the default scope and user options.

### 4.1 Decision Table

| Install Origin | Extension Type | Default Scope | User Options | AionUi Behavior |
|---------------|---------------|---------------|--------------|-----------------|
| **Settings Import** | Skill | Workspace current agent | "Enable for all compatible" toggle | Copy to `~/.aionui/skills/`, distribute on next msg send |
| **Settings > MCP > Add** | MCP Server | All engines (global) | Enable/disable per server | `syncMcpToAgents()` pushes to all engine configs |
| **Settings** | Engine Plugin | N/A | N/A | AionUi cannot install engine plugins |
| **In-chat agent-created** | Skill | Engine-local only | "Import to AionUi" in Settings | Detect as engine-native → skip → show in Settings UI |
| **In-chat agent-created** | MCP Server | Engine-local only | "Import to AionUi" in Settings > MCP | Detect via `getAgentMcpConfigs()` → show source badge |
| **In-chat engine/plugin install** | Engine Plugin | Engine-local only | None | AionUi does not detect or act. Completely opaque. |

### 4.2 Settings-Based Skill Install (Primary Path)

When a user installs a skill via Settings > Skills > Import:
1. Copied to `~/.aionui/config/skills/{name}/` (global storage)
2. Distributed to the CURRENT agent's engine directory on next message send
3. NOT auto-distributed to other engines

**Rationale (surprise-minimization)**:
- User installed in one context → effect should be predictable and scoped
- Auto-syncing to all agents across workspace violates least surprise
- Different engines have different capabilities; a skill may work in Claude but not Gemini

### 4.3 In-Chat Install (Agent-Initiated) — Per Extension Type

#### Skills created by agent during conversation

**Default behavior**: Skill stays engine-local. AionUi does NOT auto-import.

**Detection**: On next message send, `SkillDistributor` runs and encounters an engine-native entry. Per collision rule (Section 6.3), engine-native entries are never touched.

**User-initiated import**:
1. User opens Settings > Skills
2. Skills page shows "Detected in {engine}" badge for engine-native skills
3. User clicks "Import to AionUi" → copies to `~/.aionui/config/skills/{name}/`
4. On next message send, skill distributes to the current assistant's engine

#### MCP servers added by agent during conversation

**Default behavior**: MCP server stays in that engine's config. AionUi does NOT auto-sync.

**Detection**: Already implemented — `getAgentMcpConfigs()` reads MCP from each engine via CLI commands. The Settings > MCP page shows server source (which engine it was detected from).

**User-initiated sync**: User can add the detected server to AionUi's global MCP config, then sync to other engines.

#### Engine plugins/extensions installed during conversation

**Default behavior**: AionUi takes no action. Plugin is completely opaque.

**Detection**: Gemini and Claude Code plugins are not detectable (opaque to AionUi). Codex `openai.yaml` is detectable (file exists) but AionUi does not act on it.

**Sync**: Never. Plugins are engine-specific by definition and cannot be cross-distributed.

**Conflict**: None. Since AionUi doesn't manage plugins, there are no conflicts to resolve.

### 4.4 Sequence Diagram — In-Chat Skill Install → Import → Cross-Engine Distribution

```
Agent (Claude)          .claude/skills/      AionUi SkillDistributor    ~/.aionui/skills/
     │                        │                        │                       │
     ├─ creates my-tool/ ────►│                        │                       │
     │                        │                        │                       │
     │  (next msg send)       │                        │                       │
     │                        │◄── distributeForClaude()│                       │
     │                        │    detects my-tool/     │                       │
     │                        │    (engine-native)      │                       │
     │                        │    → SKIP (no touch)    │                       │
     │                        │                        │                       │
     │  (user opens Settings) │                        │                       │
     │                        │    UI: "Detected in     │                       │
     │                        │     Claude (not managed)"│                      │
     │                        │                        │                       │
     │  (user clicks Import)  │                        │                       │
     │                        │───copy to──────────────┼──────►my-tool/        │
     │                        │                        │                       │
     │  (next msg to Gemini)  │                        │                       │
     │                        │    distributeForGemini()│◄─── reads my-tool/   │
     │                        │    → symlink created    │                       │
```

### 4.5 Scope Transitions — State Machine

```
                    ┌─────────────────────────────────┐
                    │         NOT INSTALLED            │
                    │  (extension doesn't exist)       │
                    └──────────┬──────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
            Settings Import        Agent creates in
            (user action)          engine directory
                    │                     │
                    ▼                     ▼
         ┌──────────────────┐   ┌──────────────────┐
         │  AIONUI-MANAGED  │   │  ENGINE-NATIVE   │
         │                  │   │  (single engine)  │
         │  Stored in       │   │                   │
         │  ~/.aionui/...   │   │  Not managed by   │
         │                  │   │  AionUi           │
         └────────┬─────────┘   └────────┬──────────┘
                  │                       │
       On msg send (auto)         User clicks "Import"
       distributeFor*()           in Settings
                  │                       │
                  ▼                       ▼
         ┌──────────────────┐   ┌──────────────────┐
         │  DISTRIBUTED     │   │  AIONUI-MANAGED  │
         │  (current agent) │   │  (then distributes│
         │                  │   │   on next send)   │
         │  Symlink/copy in │   └──────────────────┘
         │  engine directory │
         └────────┬─────────┘
                  │
       User toggles "Enable       User disables in
       for all compatible"        assistant config
       in Settings                (enabledSkills)
                  │                       │
                  ▼                       ▼
         ┌──────────────────┐   ┌──────────────────┐
         │  DISTRIBUTED     │   │  NOT DISTRIBUTED  │
         │  (all engines)   │   │  (for this asst.) │
         │                  │   │                   │
         │  All engines get │   │  Exists in        │
         │  symlink on send │   │  ~/.aionui/ but   │
         └──────────────────┘   │  excluded by      │
                                │  enabledSkills    │
                                └──────────────────┘

Note: This state machine applies to SKILLS only.
MCP servers use a simpler model: global config → sync to all engines.
Engine plugins have no AionUi state transitions (always opaque).
```

### 4.6 Secondary Actions (explicit user-initiated)
- **"Enable for all compatible agents"**: In Settings > Skills, a toggle per-skill to mark as "distribute to all engines". Default: off.
- **"Disable for this assistant"**: In Assistant edit, per-skill checkbox already exists (enabledSkills). No change needed.

### 4.7 Never Auto-Sync
- Installing a skill in one conversation does NOT auto-distribute to other agents
- Distribution only happens at conversation start / message send time
- Each assistant's `enabledSkills` controls what gets distributed

---

## 5. Deterministic Identity and Conflict Model

### 5.1 Canonical Identity Key

Every managed extension is identified by a deterministic key:

```
{type}:{source}:{name}
```

| Component | Values | Description |
|-----------|--------|-------------|
| `type` | `skill`, `mcp`, `plugin` | Extension type — prevents cross-domain collisions |
| `source` | `builtin`, `user`, `engine-native` | Ownership/provenance origin |
| `name` | Lowercase + hyphens, max 64 chars | Unique within type+source namespace |

**Full key examples**:
- `skill:builtin:cron` — AionUi builtin skill
- `skill:user:my-analyzer` — User-installed skill
- `skill:engine-native:claude-helper` — Created by Claude Code agent, not managed by AionUi
- `mcp:user:chrome-devtools` — User-configured MCP server
- `mcp:engine-native:gemini-search` — MCP server detected from Gemini config
- `plugin:engine-native:codex-yaml` — Codex openai.yaml detected (observed only)

### 5.2 Version and Checksum Guidance

AionUi does NOT enforce versioning for this phase. However, the identity model supports future versioning:

| Scenario | Current Behavior | Future Extension |
|----------|-----------------|-----------------|
| Skill update (same name) | Symlink always points to latest in `~/.aionui/skills/` | Add `version` frontmatter field; SkillDistributor compares |
| MCP server update | User updates config in Settings; `syncMcpToAgents()` re-syncs | Add `updatedAt` comparison for incremental sync |
| Builtin skill upgrade (app update) | `initBuiltinAssistantRules()` copies new version; symlinks auto-resolve | Add checksum comparison to avoid unnecessary copies |

**Upgrade conflict rule**: When AionUi updates a builtin skill (e.g., app update ships new `cron` SKILL.md):
- Source of truth: `~/.aionui/config/skills/_builtin/{name}/SKILL.md`
- `initBuiltinAssistantRules()` overwrites builtins on startup (existing behavior)
- Symlinks in engine directories auto-resolve (point to source)
- Copies (Windows) are replaced on next `distributeFor*()` call

**No version pinning**: Users cannot pin a skill to a specific version. The latest version in `~/.aionui/skills/` always wins. This is intentional simplicity for this phase.

### 5.3 Storage vs Runtime Identity

In the filesystem, entries use `name` only:
```
~/.aionui/config/skills/
  _builtin/
    cron/SKILL.md          → identity: skill:builtin:cron
    shell-bg/SKILL.md      → identity: skill:builtin:shell-bg
  my-analyzer/SKILL.md     → identity: skill:user:my-analyzer

.claude/skills/
  cron/  (symlink → ~/.aionui/...)  → identity: skill:builtin:cron (AionUi-managed)
  helper/ (no symlink, no marker)   → identity: skill:engine-native:helper
```

`source` is derived at runtime:
- Entries under `_builtin/` → `builtin`
- Other entries in `~/.aionui/config/skills/` → `user`
- Entries only in engine directory (no AionUi source) → `engine-native`

`type` is derived from context:
- Entries in skill discovery directories → `skill`
- Entries in `ConfigStorage['mcp.config']` or engine MCP config → `mcp`
- Entries detected as engine-specific config → `plugin`

### 5.4 Ownership / Provenance Detection

Three ownership levels for skills:

| Level | Detection | Example |
|-------|-----------|---------|
| **Engine-native** | No symlink to ~/.aionui, no `.aionui-managed` marker | User manually created `.claude/skills/my-skill/` |
| **AionUi-managed (symlink)** | Symlink target starts with `~/.aionui/skills/` | SkillDistributor-created symlink |
| **AionUi-managed (copy)** | Listed in `.aionui-manifest.json` AND has `.aionui-managed` marker | Windows fallback copy |

Two ownership levels for MCP servers:

| Level | Detection | Example |
|-------|-----------|---------|
| **Engine-native** | Detected via `<engine> mcp list` but NOT in AionUi's `mcp.config` | User ran `claude mcp add` manually |
| **AionUi-managed** | Present in `ConfigStorage['mcp.config']` | Added via Settings > MCP |

One ownership level for plugins:

| Level | Detection | Example |
|-------|-----------|---------|
| **Engine-native** | Always. AionUi never manages plugins. | Codex `openai.yaml`, Gemini extensions |

**Rule**: AionUi NEVER modifies or deletes engine-native entries. Only AionUi-managed entries can be updated/removed. This applies to all three extension types.

### 5.5 Collision Handling — Skills

When distributing skill `X` to target directory:

| Target has | AionUi action |
|-----------|--------------|
| Nothing | Create symlink/copy |
| AionUi-managed symlink (same source) | No-op |
| AionUi-managed symlink (different source) | Update symlink |
| AionUi-managed copy | Replace |
| Engine-native entry with same name | **Skip** (log warning, do not overwrite) |

Already implemented in `distributeSkillEntry()`.

### 5.6 Collision Handling — MCP Servers

When syncing MCP server to engine config:

| Engine config has | AionUi action |
|------------------|--------------|
| Nothing with this name | Install via CLI (`<engine> mcp add`) |
| AionUi-managed server (same config) | No-op |
| AionUi-managed server (different config) | Update via CLI (`<engine> mcp remove` + `mcp add`) |
| Engine-native server with same name | **Skip** (already implemented — `syncMcpToAgents` checks detect results) |

### 5.7 Collision Handling — Plugins

AionUi never distributes plugins. No collision handling needed.

### 5.8 Cross-Domain Collision Policy

Different extension types CANNOT collide with each other because they occupy separate namespaces:

| Domain A | Domain B | Can collide? | Reason |
|----------|----------|-------------|--------|
| skill:*:foo | mcp:*:foo | No | Skills are files in skill dirs; MCP is config entries. Different storage. |
| skill:*:foo | plugin:*:foo | No | Skills are AionUi-managed files; plugins are engine-internal. Different storage. |
| mcp:*:foo | plugin:*:foo | No | MCP is config; plugins are engine-internal. Different storage. |
| skill:builtin:foo | skill:user:foo | Prevented | Import rejects duplicate names via `fsBridge.importSkill()` |
| skill:*:foo | skill:engine-native:foo | Handled | At distribution time: engine-native wins (Section 5.5) |
| mcp:user:foo | mcp:engine-native:foo | Handled | At sync time: engine-native wins (Section 5.6) |

### 5.9 Merge Precedence

When the same `name` exists from multiple sources within the same type:

```
engine-native (highest — user/agent-created in engine, never touched)
  > user (installed via Settings Import)
    > builtin (AionUi default)
```

This applies to both skills and MCP servers.

### 5.10 Config Precedence (Skills Only)

```
global defaults (all skills enabled)
  < assistant config (enabledSkills per assistant)
```

Current: only `assistant.enabledSkills` exists. This RFC does not add workspace or conversation-level overrides (non-goal for this phase).

---

## 6. MCP Distribution (Already Implemented — No Changes Needed)

MCP server distribution is a separate, already-working system. This section documents it for completeness and to clarify boundaries with skill distribution.

### 6.1 Current MCP Flow

```
User adds MCP server ──► ConfigStorage['mcp.config'] ──► syncMcpToAgents()
                              (global)                       │
                                                    ┌────────┼────────┐
                                                    ▼        ▼        ▼
                                              ClaudeMcp  GeminiMcp  CodexMcp
                                                Agent      Agent     Agent
                                                    │        │        │
                                              `claude    Pass to   `codex
                                              mcp add`  aioncli    mcp add`
                                                        start()
```

### 6.2 MCP vs Skill Distribution Comparison

| Aspect | Skills | MCP Servers |
|--------|--------|-------------|
| What's distributed | Files (SKILL.md) | Config entries (command + args + env) |
| Distribution method | Symlink/copy to engine directory | CLI commands or process params |
| Timing | On message send | On user action (Settings > MCP > Sync) |
| Scope | Per-assistant (enabledSkills) | Global (all engines get all enabled servers) |
| Provenance tracking | `.aionui-managed` marker + manifest | Managed via CLI add/remove |
| Conflict rule | Engine-native wins (skip) | Engine-native wins (skip) |

---

## 7. Sequence Diagrams

### 7.1 Settings-Based Skill Install

```
User                  Settings UI             fsBridge           ~/.aionui/skills/
 │                        │                      │                      │
 ├─ clicks Import ───────►│                      │                      │
 │                        ├─ selectFolder() ────►│                      │
 │                        │◄─ path ──────────────┤                      │
 │                        ├─ importSkill(path) ──►│                      │
 │                        │                      ├─ check duplicate ───►│
 │                        │                      │  (reject if exists)  │
 │                        │                      ├─ copy to skills/ ───►│
 │                        │◄─ success ───────────┤                      │
 │◄─ "Skill installed" ──┤                      │                      │
 │                        │                      │                      │
 │  (next message send)   │                      │                      │
 │                        │          AcpAgentManager / GeminiAgentManager│
 │                        │                      │                      │
 │                        │          distributeFor*() ◄─── reads ───────┤
 │                        │          → symlink to engine dir             │
```

### 7.2 Agent Switch (Claude → Gemini)

```
User                  ConversationTab      AcpAgentManager      GeminiAgentManager
 │                        │                      │                      │
 ├─ selects Gemini ──────►│                      │                      │
 │                        ├─ stop() ────────────►│                      │
 │                        │                      ├─ await disconnect()  │
 │                        │                      ├─ clear bootstrap     │
 │                        │                      ├─ clear sessionId     │
 │                        │◄─ stopped ───────────┤                      │
 │                        │                      │                      │
 │                        ├─ navigate(/guid) ────►                      │
 │                        │  (user picks Gemini)  │                      │
 │                        │                      │                      │
 │  (sends first message) │                      │                      │
 │                        │                      │   ┌─── initAgent() ──┤
 │                        │                      │   │  computeGemini   │
 │                        │                      │   │  DisabledSkills()│
 │                        │                      │   │  getMcpServers() │
 │                        │                      │   │  aioncli start() │
 │                        │                      │   └──────────────────┤
 │                        │                      │                      │
 │                        │                      │   Skills: native     │
 │                        │                      │   discovery via      │
 │                        │                      │   skillsDir config   │
 │                        │                      │                      │
 │                        │                      │   MCP: passed as     │
 │                        │                      │   start() params     │
```

### 7.3 MCP Server Sync (Existing — No Changes)

```
User               Settings > MCP          McpService           Per-Engine Agents
 │                        │                      │                      │
 ├─ adds server ─────────►│                      │                      │
 │                        ├─ save to config ────►│                      │
 │                        ├─ testConnection() ──►│                      │
 │                        │◄─ test result ───────┤                      │
 │                        │                      │                      │
 ├─ clicks Sync ─────────►│                      │                      │
 │                        ├─ syncMcpToAgents() ─►│                      │
 │                        │                      ├─ filter enabled ─────┤
 │                        │                      ├─ for each agent: ───►│
 │                        │                      │  installMcpServers() │
 │                        │                      │  (claude mcp add,    │
 │                        │                      │   codex mcp add,     │
 │                        │                      │   gemini start param)│
 │                        │◄─ sync results ──────┤                      │
 │◄─ "Synced to N agents"┤                      │                      │
```

### 7.4 Distribution Timing — Consolidated View

| Event | Skill Distribution | MCP Distribution |
|-------|-------------------|-----------------|
| Conversation start | No (on first msg send) | No |
| First message send (ACP) | `distributeFor*(workspace)` | Already synced (global) |
| First message send (Gemini) | `computeGeminiDisabledSkills()` | `getMcpServers()` → `start()` |
| Settings > Skills > Import | Copy to `~/.aionui/skills/` | N/A |
| Settings > MCP > Add+Sync | N/A | `syncMcpToAgents()` |
| Assistant enabledSkills change | Takes effect on next msg send | N/A |
| MCP server enable/disable | N/A | Takes effect on next sync |
| Agent switch | New engine gets distribution on next msg send | MCP already synced globally |

---

## 8. Migration Plan

### Phase 1: Add missing distribution calls (low risk)

1. In `AcpAgentManager.sendMessage()`, extend distribution to Codex backends:
   ```typescript
   if (this.options.workspace) {
     if (this.options.backend === 'claude' || this.options.backend === 'custom') {
       distributeForClaude(this.options.workspace, this.options.enabledSkills);
     } else if (this.options.backend === 'codex') {
       distributeForCodex(this.options.workspace, this.options.enabledSkills);
     }
   }
   ```

2. In Gemini agent init, pass `disabledSkills` to Config constructor:
   ```typescript
   const disabledSkills = computeGeminiDisabledSkills(enabledSkills);
   // Pass to config.initialize() or config.setDisabledSkills()
   ```

### Phase 2: Remove injection paths (medium risk)

3. Remove `buildSystemInstructions()` from `agentUtils.ts`
4. Remove `prepareFirstMessageWithSkillsIndex()` from `agentUtils.ts`
5. Remove `loadSkillsContent()` from `initStorage.ts`
6. Remove callers of these functions

### Phase 3: Add engine-native skill detection to Settings UI

7. In Settings > Skills page, scan engine discovery directories for entries not managed by AionUi
8. Show "Detected in {engine}" badge for engine-native skills
9. Provide "Import to AionUi" action that copies to `~/.aionui/config/skills/{name}/`
10. On next message send, imported skill distributes to the current assistant's engine

### Phase 4: Verify and clean up

11. Verify Gemini `activate_skill` tool works with native discovery
12. Verify Claude Code discovers AionUi skills from `.claude/skills/`
13. Verify CronCommandDetector still works (no dependency on injection)
14. Delete dead code paths

### Rollback Strategy

- **Phase 1 is additive** — can be reverted by removing the new distribution calls
- **Phase 2**: Keep injection functions in code but commented out for 1 release cycle. If native discovery fails for any engine, uncomment as emergency fallback.
- **Phase 3 is additive** — UI-only; no impact on distribution logic
- **Git revert**: All changes in a single branch; clean revert possible.

---

## 9. Acceptance Criteria

| # | Criterion | Verification | Phase |
|---|-----------|-------------|-------|
| 1 | Gemini `activate_skill` correctly lazy-loads builtin skills | Manual: start Gemini chat, ask to use cron → skill activates | 1, 4 |
| 2 | Claude Code discovers skills from `.claude/skills/` | Manual: start Claude chat, verify skills are listed | 1, 4 |
| 3 | Codex discovers skills from `.agents/skills/` | Manual: start Codex chat, verify skills work | 1, 4 |
| 4 | `buildSystemInstructions()` removed | Code: function deleted, no callers | 2 |
| 5 | `prepareFirstMessageWithSkillsIndex()` removed | Code: function deleted, no callers | 2 |
| 6 | `loadSkillsContent()` removed | Code: function deleted, no callers | 2 |
| 7 | CronCommandDetector unaffected | Test: cron skill commands still parsed from output | 4 |
| 8 | Existing tests pass | Automated: npm test (94+ tests) | All |
| 9 | Engine-native skills not deleted | Test: manually place skill in .claude/skills/, verify AionUi doesn't touch it | 4 |
| 10 | Engine-native skills shown in Settings | Manual: create skill in engine dir, see "Detected in {engine}" in Settings | 3 |
| 11 | In-chat-created skill can be imported | Manual: let agent create skill → see in Settings → import → distributes to other engines | 3 |
| 12 | MCP distribution unaffected | Manual: add MCP server, sync, verify all engines receive it | All |
| 13 | Cross-domain no-collision | Verify: skill named "foo" and MCP server named "foo" coexist without interference | All |

---

## 10. Non-Goals (This Phase)

- Workspace-level or conversation-level skill overrides
- Engine-specific frontmatter generation
- Skill marketplace or remote skill installation
- Cross-agent auto-sync of installed skills (user must explicitly enable per-skill)
- MCP-skill dependency declarations (skills must not require specific MCP servers)
- Engine plugin/extension management (AionUi observes only, never manages)
- Version pinning for skills (latest in `~/.aionui/skills/` always wins)
- Unified extension browser (skills, MCP, plugins in one UI) — each has its own Settings page

---

## 11. Risk Table

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Gemini activate_skill regression | Low | High | Test before removing injection; keep commented fallback |
| Claude Code discovery path change | Low | Medium | Pin claude-code-acp version; monitor releases |
| Codex skill format incompatibility | Medium | Low | Codex is least-used; can defer if issues arise |
| Engine-native skill deletion | Very Low | High | Provenance marker + manifest double-check already implemented |
| CronCommandDetector breakage | Very Low | Medium | Cron parses output, not input; independent of skill loading |
| MCP sync disruption during migration | Very Low | Low | MCP system untouched by this RFC; separate codepath |
| In-chat skill detection false positive | Low | Low | Only show "Detected" badge; import is manual user action |
| Cross-domain name confusion in UI | Low | Low | UI always shows extension type prefix/icon |

---

## 12. Test Matrix

| Test | Type | What it verifies |
|------|------|-----------------|
| SkillDistributor unit tests | Existing (94) | Symlink/copy/cleanup/provenance logic |
| Gemini native skill activation | Manual | activate_skill tool + lazy loading |
| Claude skill discovery | Manual | .claude/skills/ detection |
| Codex skill discovery | Manual | .agents/skills/ detection |
| Cron command detection | Manual | [CRON_CREATE] still works after injection removal |
| Engine-native entry safety | Manual | Place manual skill → verify not deleted |
| enabledSkills filtering | Manual | Disabled skills not distributed |
| Windows copy fallback | Manual (if available) | cpSync + manifest + marker |
| In-chat install → import flow | Manual | Agent creates skill → Settings detects → user imports → distributes |
| MCP sync after migration | Manual | Add MCP server → sync → all engines receive config |
| Agent switch preserves skills | Manual | Switch Claude→Gemini → skills correctly distributed to new engine |
| Cross-domain coexistence | Manual | Skill "foo" + MCP "foo" both work without interference |
| Identity key correctness | Manual | Verify runtime source derivation matches filesystem layout |

---

## 13. Rev 4 — Unified Distribution Redesign (2026-02-09)

Based on manual verification testing of all three engines, Rev 3 has four critical issues. This section documents the redesign decisions.

### 13.1 Problems Found in Manual Testing

| Problem | Engine | Root Cause |
|---------|--------|------------|
| Skills not discovered | Claude Code | **Bug #14836** (OPEN): `/skills` doesn't follow symlinks |
| `_builtin/` skills not loaded | Gemini | `loadSkillsFromDir` doesn't recurse into subdirectories |
| Gemini uses separate flow | Gemini | aioncli-core SkillManager + `skillsDir`, not unified SkillDistributor |
| Script paths broken | All | SKILL.md references scripts relative to skill dir, engines CWD is workspace root |

### 13.2 Design Decisions

#### D1: All Copy, No Symlink

**Decision**: `distributeToEngine()` always uses `fs.cpSync()`, never `symlinkSync()`.

**Rationale**:
- Claude Code bug #14836 — symlinks not followed (OPEN, 9+ confirmations, no fix date)
- Script path injection (D3) requires modifying SKILL.md during deployment, can't do with symlinks
- Cross-platform consistency (Windows already used copy fallback)
- Cost negligible — skill directories are typically < 100KB total

**Impact**: Remove symlink logic from `distributeSkillEntry()`. Simplify provenance to copy-only (manifest + marker).

#### D2: Flat Storage, Remove `_builtin/` Subdirectory

**Decision**: All skills stored at `~/.aionui/skills/{name}/`, no nesting.

**Before**:
```
~/.aionui/skills/
├── _builtin/
│   ├── cron/SKILL.md
│   └── shell-bg/SKILL.md
└── pptx/SKILL.md
```

**After**:
```
~/.aionui/skills/
├── cron/
│   ├── SKILL.md
│   └── .aionui-skill.json    # { "builtin": true }
├── shell-bg/
│   ├── SKILL.md
│   └── .aionui-skill.json
└── pptx/
    ├── SKILL.md
    └── .aionui-skill.json    # { "builtin": false, "source": "import" }
```

**Rationale**: All engines scan one level deep. `_builtin/` caused Gemini `loadSkillsFromDir` to miss skills. Builtin vs custom tracked via `.aionui-skill.json` metadata, not directory structure.

#### D3: SKILL.md Path Injection for Script-Heavy Skills

**Decision**: During deployment copy, prepend a path hint to SKILL.md for skills containing executable scripts (*.py, *.js, *.sh).

**Injected content** (1 line):
```
[Skill directory: /absolute/path/to/{engine}/skills/{name}/]
```

**Rationale**:
- SKILL.md scripts reference paths relative to skill dir (e.g., `python ooxml/scripts/unpack.py`)
- Engines run with CWD at workspace root, not skill dir
- LLM reads SKILL.md as instructions → can interpret absolute path hint → generates correct commands
- Only injected for skills with executables, pure instruction skills unaffected
- Original SKILL.md in central storage stays unmodified

**Path lifecycle**: Path = workspace + engine dir + skill name. Workspace is 1:1 with conversation. Path stable for entire conversation. New conversation → new workspace → new copy → new path. No stale path issue in normal usage.

#### D4: Gemini Unified to SkillDistributor

**Decision**: Distribute to `{workspace}/.gemini/skills/` via `distributeToEngine()`, same as Claude and Codex. Remove `computeGeminiDisabledSkills()` and `skillsDir` parameter dependency on aioncli-core.

**Rationale**: Gemini CLI v0.23.0+ natively supports `.gemini/skills/` directory discovery. No need for aioncli-core SkillManager.

**Unified API**:
```typescript
distributeToEngine(workspace: string, engine: 'claude' | 'gemini' | 'codex', enabledSkills?: string[])
// Resolves target dir:
//   claude → {workspace}/.claude/skills/
//   gemini → {workspace}/.gemini/skills/
//   codex  → {workspace}/.agents/skills/
```

#### D5: Global Skill Detection

**Decision**: Scan engine global directories (`~/.claude/skills/`, `~/.gemini/skills/`) and display in Settings as read-only "Global" entries.

**Rationale**: Users install global skills outside AionUi (e.g., via `claude code` CLI). AionUi should be aware of them for visibility, but not manage them.

**Behavior**: Detect only, never modify/delete. No enable/disable control (engine handles that natively).

#### D6: mtime-Based Update Detection

**Decision**: On each `sendMessage()`, compare source SKILL.md mtime vs deployed copy. Re-copy if source is newer.

**Flow**:
```
Target not exist       → copy (new skill, mid-conversation install)
Target exists, stale   → re-copy (skill content updated)
Target exists, current → skip (no-op, near-zero cost)
```

**Cost**: One `fs.statSync()` per skill per message. Negligible.

### 13.3 Workspace CWD Finding

Research confirmed (`initAgent.ts:23-37`): when user selects a project directory, engine subprocess CWD = that directory. Temp workspace only created when no directory selected.

| User Action | CWD | Project `.claude/skills/` visible |
|-------------|-----|----------------------------------|
| Selected `/my-project/` | `/my-project/` | Yes |
| No folder selected | `~/.aionui/workDir/{backend}-temp-{ts}` | No |

**Implication**: AionUi deploys skills to `{CWD}/.{engine}/skills/`. When CWD = user's project, deployed skills coexist with project-native skills. Deployed files should be `.gitignore`d.

### 13.4 Engine Skill Discovery Summary (Verified)

| Engine | Discovery Dir | Hot Reload | Symlinks | Global Dir |
|--------|--------------|------------|----------|------------|
| Claude Code | `.claude/skills/` | Per-turn re-read | Broken (#14836) | `~/.claude/skills/` |
| Gemini CLI v0.23+ | `.gemini/skills/` | `activate_skill` lazy load | Works | `~/.gemini/skills/` |
| Codex | `.agents/skills/` | Recursive scan | Works (dir-level) | Unknown |

### 13.5 Updated Migration Plan

Replaces Section 8 migration plan:

```
Phase 1: Storage migration
  ├── Flatten _builtin/ → top-level, add .aionui-skill.json metadata
  └── Migration script on first run

Phase 2: Unified distributor
  ├── distributeToEngine() — single function, all copy, three target dirs
  ├── SKILL.md path injection for script-heavy skills
  ├── mtime-based update detection
  └── Remove symlink logic

Phase 3: Gemini unification
  ├── Add distributeToEngine(workspace, 'gemini') call in GeminiAgentManager
  ├── Remove computeGeminiDisabledSkills()
  └── Remove skillsDir parameter dependency

Phase 4: Global skill detection
  ├── Scan ~/.claude/skills/, ~/.gemini/skills/
  └── Show in Settings as read-only "Global" entries

Phase 5: Cleanup
  ├── Remove legacy symlink code
  └── Update tests
```
