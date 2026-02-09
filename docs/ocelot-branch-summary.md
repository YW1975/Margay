# Ocelot Branch — Change Summary

**Branch**: `ocelot` (based on `main`)
**Date**: 2026-02-07 ~ 2026-02-09
**Commits**: 3 (committed) + Steps 9-10 (uncommitted, 21 files, +500/-76)
**Files changed**: 47 committed (+1,951 / -780) + 21 uncommitted

---

## Commits

| # | Hash | Date | Subject |
|---|------|------|---------|
| 1 | `d5fa1f63` | 2026-02-07 | fix(acp): resolve tool call handling, UX feedback, and add copy command button |
| 2 | `a236a8fe` | 2026-02-08 | feat: add permission persistence, subprocess cleanup, shell-bg skill, and UX fixes |
| 3 | `0a6cdb2a` | 2026-02-08 | feat: skill architecture overhaul, sidebar and workspace fixes |

---

## Changes Overview

### Step 1: ACP Tool Call Handling & UX (Commit 1)

**Problem**: ACP (Claude Code) agent had multiple UI and data-handling issues — duplicate React keys, status overwrite, missing error feedback, no command copy button.

**Changes**:

| File | Change |
|------|--------|
| `src/renderer/messages/hooks.ts` | Fix duplicate React key by updating index after push in `composeMessageWithIndex` |
| `src/agent/acp/AcpAdapter.ts` | Fix status overwrite by conditionally merging fields; merge duplicate `tool_call` messages by `toolCallId` instead of creating new entries |
| `src/renderer/pages/conversation/acp/AcpSendBox.tsx` | Show connection phase (connecting/connected/authenticated) in ThoughtDisplay during ACP init |
| `src/agent/acp/AcpConnection.ts` | Add stderr ring buffer (10 lines, 2000 chars) with forwarding to UI error messages on disconnect |
| `src/renderer/messages/MessageToolGroupSummary.tsx` | Add Copy Command button for execute-type tool calls in "View Steps" panel |
| `src/common/terminalUtils.ts` | New: Cross-platform terminal command builder with per-platform escaping (AppleScript/cmd/bash) |
| `src/process/bridge/shellBridge.ts` | New: Shell IPC bridge (`shellBridge.openInTerminal`) for future agent skill use |
| `src/common/ipcBridge.ts` | Register `shell.openInTerminal` IPC channel |
| `src/agent/acp/index.ts` | Minor fixes to ACP agent tool call flow |
| `src/agent/codex/connection/CodexConnection.ts` | Minor fix in Codex connection |
| `src/process/task/AcpAgentManager.ts` | Initial `kill()` override for ACP process cleanup |
| `src/types/acpTypes.ts` | Extend ACP type definitions with new fields |
| `src/renderer/messages/acp/MessageAcpToolCall.tsx` | Update tool call rendering for new fields |
| `tests/unit/test_terminal_utils.ts` | New: 34 unit tests for terminalUtils (all platforms + edge cases) |
| `src/renderer/i18n/locales/*.json` (6 files) | Add i18n keys for copy command button (en-US, zh-CN, zh-TW, ja-JP, ko-KR, tr-TR) |
| `CLAUDE.md` | Add ACP pipeline architecture docs; add Turkish to supported locale list |

**Test Results**: 75/75 tests passed, 0 failures

---

### Step 2: Shell-bg Skill Auto-Enable (Commit 2)

**Problem**: Gemini agent running long-lived server commands (e.g. `npm run dev`) blocks the entire conversation indefinitely.

**Changes**:

| File | Change |
|------|--------|
| `src/process/task/GeminiAgentManager.ts:137` | Add `'shell-bg'` to built-in `allEnabledSkills` alongside `'cron'` |
| `skills/_builtin/shell-bg/SKILL.md` (new) | 103-line skill file: command classification rules (foreground/background/uncertain), background execution template (redirect + `&` + `sleep` + PID report), context memory rules, process management instructions |

**Behavior**: All Gemini conversations auto-load the shell-bg skill via `loadSkillsContent()` → `buildSystemInstructions()` pipeline. ACP agents are unaffected.

**Test Results**: 75/75 tests passed, 0 failures

---

### Step 3: macOS Titlebar Overlap Fix (Commit 2)

**Problem**: macOS traffic-light buttons (close/minimize/maximize) were covered by sidebar toggle button when sidebar is collapsed.

**Changes**:

| File | Change |
|------|--------|
| `src/renderer/components/Titlebar/index.tsx:66` | Collapsed-state `marginLeft`: `60px` → `80px` (only when `isMacRuntime && showSiderToggle`) |

**Scope**: Only macOS desktop. Windows/Linux (uses `showWindowControls` branch) and WebUI (`isDesktopRuntime=false`) unaffected. Expanded (210px) and mobile (0px) states unchanged.

**Test Results**: Lint passed; visual regression verification required

---

### Step 4: Gemini Permission Prompt Persistence (Commit 2)

**Problem**: Gemini "Always Allow" decisions were stored in-memory only (per `GeminiApprovalStore` Map). Lost on new conversation or app restart — users forced to re-approve the same commands repeatedly.

**Root Cause**: `GeminiApprovalStore` is created fresh per `GeminiAgentManager` instance. No DB persistence layer existed.

**Changes**:

| File | Change |
|------|--------|
| `src/process/database/schema.ts:111` | `CURRENT_DB_VERSION`: 10 → 11 |
| `src/process/database/migrations.ts` | New `migration_v11`: `gemini_approvals` table (id, action, identifier, created_at, UNIQUE(action, identifier)) + index on action |
| `src/process/database/index.ts` | 4 new CRUD methods: `getGeminiApprovals()`, `saveGeminiApproval()`, `deleteGeminiApproval()`, `clearGeminiApprovals()` |
| `src/agent/gemini/GeminiApprovalStore.ts` | New `loadFromPersistedData(rows)`: bulk load `{action, identifier}` into in-memory Map |
| `src/process/task/GeminiAgentManager.ts` | New `loadPersistedApprovals()`: load from DB on construction; New `persistApprovals(keys)`: save to DB on `ProceedAlways`; both with explicit error logging on `result.success === false` |

**Behavior**:
- On GeminiAgentManager construction: load all persisted approvals from DB
- On user "Always Allow": save approval keys to DB + in-memory
- New conversations inherit all previous approvals automatically
- Error resilience: DB failures logged as warnings, session-level approvals still work

**Test Results**: 75/75 tests passed, tsc 0 errors, eslint 0 errors

---

### Step 5: Gemini Subprocess Cleanup — kill() Override (Commit 2)

**Problem**: When a conversation is deleted, `ForkTask.kill()` only terminates the worker (UtilityProcess) via `fcp.kill()`. Shell subprocesses spawned inside the worker with `detached: true` survive because `AbortSignal` never fires.

**Root Cause Analysis**:
- ShellExecutionService creates process groups (`detached: true`, PGID = shell PID)
- `ForkTask.kill()` immediately kills the UtilityProcess
- Worker-side abort handlers never fire → orphaned background processes

**Changes**:

| File | Change |
|------|--------|
| `src/process/task/GeminiAgentManager.ts` | New `kill()` override: sends `stop()` IPC to fire abort → 300ms grace period (covers ShellExecutionService's 200ms SIGTERM→SIGKILL window) → `super.kill()`. Hard fallback: 1000ms timeout forces `super.kill()` if worker unresponsive. |

**Design (two-timer pattern)**:
```
kill() called
├── Hard timer: 1000ms → super.kill() (safety net)
└── Graceful: stop() → 300ms grace → super.kill()
    ├── stop() sends 'stop.stream' IPC
    ├── Worker: agent.stop() → abortController.abort()
    ├── Worker: ShellExecutionService abort handler → SIGTERM process group
    ├── 300ms grace covers SIGTERM→SIGKILL cycle
    └── super.kill() terminates worker
```

**Documented Residual Risk**: Exit/restart path (`app.exit(0)`, `process.on('exit')`) cannot run async cleanup. Pre-existing limitation affecting ALL agent types (including ACP). Proper fix requires making restart flow async (future work).

**Test Results**: 75/75 tests passed, 0 failures

---

### Step 5b: Orphan Background Process Fix — ShellExecutionService Patch (Commit 2)

**Problem**: Background processes (`cmd &`) survive conversation delete even with the kill() override, because ShellExecutionService has two guards that prevent cleanup:
1. `!exited` guard: abort handler checks `if (child.pid && !exited)` — skips kill if shell already exited
2. Listener removal: `cleanup()` calls `abortSignal.removeEventListener('abort', abortHandler)` — handler is REMOVED when shell exits

**Root Cause**: When AI runs `npm run dev &`, the shell exits immediately (the `&` backgrounds the command). The abort handler is removed on shell exit. When the user later deletes the conversation, `abort()` fires but no handler is listening.

**Changes**:

| File | Change |
|------|--------|
| `patches/@office-ai+aioncli-core+0.24.4.patch` (new) | Patch for both child_process AND PTY paths in ShellExecutionService: (1) Add `static trackedProcessGroups = new Set()` to track all spawned PGIDs; (2) Track child/ptyProcess PID immediately after spawn; (3) Remove `abortSignal.removeEventListener` from cleanup/onExit — handler persists; (4) Remove `!exited` guard — group kill fires even after shell exits; (5) Add try/catch around all kill calls (ESRCH safe); (6) New `static killAllTrackedProcessGroups()`: SIGTERM then 200ms then SIGKILL for ALL tracked groups |
| `src/worker/gemini.ts` | Import `ShellExecutionService`; call `killAllTrackedProcessGroups()` on `stop.stream`; add `process.on('exit')` safety net: SIGKILL all tracked PGIDs |
| `package.json` | `postinstall`: `patch-package && node scripts/postinstall.js` |

**Kill Chain**:
```
User deletes conversation
→ GeminiAgentManager.kill()
  → stop() IPC to worker
    → agent.stop() → abortController.abort()
    → Abort handlers fire for ALL executions (including completed shells with &)
    → process.kill(-shellPid, SIGTERM) kills process GROUP (bg children included)
    → killAllTrackedProcessGroups() catches any missed
  → 300ms grace period
  → super.kill() terminates worker
  → Worker exit handler: SIGKILL all survivors
```

**Note**: Patch is in `node_modules` via `patch-package`. Needs to be ported to aioncli-core source repo for permanent fix.

**Test Results**: 75/75 tests passed, tsc 0 errors, eslint 0 errors

---

### Step 6: Pending Issues Fix — ACP Permission, Shell Output, Subprocess (Commit 2)

#### Issue 1: ACP Permission Granularity

**Problem**: ACP "Always Allow" only approves the exact command string (`ls -la`). User expects approve-once for all shell commands.

**Changes**:

| File | Change |
|------|--------|
| `src/agent/acp/ApprovalStore.ts` | `serializeKey()` now excludes `rawInput.command` for execute kind — approval scope is per-tool (`kind + title`) instead of per-command. File operations (edit/read/fetch) remain per-path for safety. |

#### Issue 2: ACP Shell Output Not Displayed

**Problem**: Claude Code returns shell command output (`rawOutput`), but AcpAdapter drops it during merge — UI only shows "executed ls -la" without results.

**Data flow fix**:
```
Before: CLI → rawOutput ❌ dropped by AcpAdapter → UI shows nothing
After:  CLI → rawOutput ✅ passed through adapter → rendered in <pre> block
```

**Changes**:

| File | Change |
|------|--------|
| `src/types/acpTypes.ts:561` | Add `rawOutput?: string` to `ToolCallUpdate.update` interface |
| `src/agent/acp/AcpAdapter.ts:242` | Pass `rawOutput` through in `updateAcpToolCall()` merge |
| `src/renderer/messages/acp/MessageAcpToolCall.tsx:111-114` | Render `rawOutput` in `<pre>` block for execute-type tool calls |
| `src/renderer/messages/MessageToolGroupSummary.tsx` | Show output in "View Steps" collapsible panel with scrollable `<pre>` block |

#### Issue 3: ACP Subprocess Cleanup

**Problem**: `AcpAgentManager.kill()` used fire-and-forget `stop()` then immediate `super.kill()`. treeKill is async (spawns pgrep) and may not complete.

**Changes**:

| File | Change |
|------|--------|
| `src/process/task/AcpAgentManager.ts` | Rewrite `kill()` with grace period pattern: `stop()` → 500ms grace (for treeKill pgrep + SIGTERM dispatch) → `super.kill()`. Hard fallback: 1500ms timeout. |

**Test Results**: 75/75 tests passed, tsc 0 errors, eslint 0 errors (3 pre-existing warnings)

---

### Step 7: Skill Architecture Overhaul — Native Engine Discovery (Commit 3)

**Problem**: Skill content was injected into AI messages via `loadSkillsContent()` → `buildSystemInstructions()`, consuming context window tokens and bypassing each engine's native skill discovery mechanism.

**Solution**: Replace message injection with native engine discovery via symlinks/copies to each engine's discovery directory.

**Changes**:

| File | Change |
|------|--------|
| `src/process/task/SkillDistributor.ts` (new) | Core module: discovers skills from `~/.aionui/config/skills/` (shared) + `_builtin/`, distributes to engine dirs via symlinks (macOS/Linux) or copies (Windows). Includes provenance marker (`.aionui-managed`) for copy-mode ownership safety, manifest tracking, stale entry cleanup. |
| `src/process/task/AcpSkillManager.ts` (deleted) | Removed: old injection-based skill loading (399 lines) |
| `src/process/task/agentUtils.ts` | Stripped `loadSkillsContent()` and `buildSystemInstructions()` skill injection logic (-116 lines); `prepareFirstMessage()` simplified to only inject preset context |
| `src/process/task/AcpAgentManager.ts` | Call `distributeForClaude(workspace, enabledSkills)` to distribute skills to `{workspace}/.claude/skills/` |
| `src/process/task/CodexAgentManager.ts` | Call `distributeForCodex(workspace, enabledSkills)` to distribute skills to `{workspace}/.agents/skills/` |
| `src/process/task/GeminiAgentManager.ts` | Convert `enabledSkills` whitelist to `disabledSkills` blacklist via `computeGeminiDisabledSkills()` for native SkillManager |
| `src/agent/gemini/index.ts` | Pass `disabledSkills` to aioncli-core SkillManager config |
| `src/process/initStorage.ts` | Remove old `loadSkillsContent()` and `buildSkillsSystemInstruction()` functions (-75 lines) |
| `tests/unit/test_skill_distributor.ts` (new) | 19 regression tests: `shouldDistributeSkill` semantics (5), `computeGeminiDisabledSkills` whitelist→blacklist (5), copy-mode provenance marker ownership (7), post-start skill visibility (2) |

**Engine Discovery Paths**:
| Engine | Discovery Directory | Mechanism |
|--------|-------------------|-----------|
| Claude Code | `{workspace}/.claude/skills/` | Symlink/copy from shared dir |
| Codex | `{workspace}/.agents/skills/` | Symlink/copy from shared dir |
| Gemini | `~/.aionui/config/skills/` (direct) | Native SkillManager + `disabledSkills` filter |

**Provenance Marker System**: Copy-mode (Windows) uses `.aionui-managed` marker file inside each copied skill directory. Cleanup requires BOTH manifest listing AND marker file presence — prevents accidentally deleting engine-created skills.

**Test Results**: 94/94 tests passed (19 new), tsc 0 errors, eslint 0 errors

---

### Step 8: Sidebar, Workspace, and Post-Testing Fixes (Commit 3)

#### 8a: Mobile Sidebar Collapse

**Problem**: Narrowing the window completely hid the sidebar (width: 0, translateX: -100%), making the expand button inaccessible and blocking the product logo.

**Changes**:

| File | Change |
|------|--------|
| `src/renderer/layout.tsx` | Unified `collapsedWidth={64}` (removed `isMobile ? 0`); mobile sider uses `position: fixed` only when expanded (`isMobile && !collapsed`), collapsed mode uses normal document flow to avoid z-index overlap with titlebar; content area `width: 100vw` only when expanded |
| `src/renderer/components/Titlebar/index.tsx` | Removed `isMobile ? '0px'` branch; deterministic `marginLeft: collapsed ? '80px' : '210px'` |

#### 8b: Workspace Directory Migration

**Problem**: Switching workspace directory on an existing Claude conversation caused "internal error" because stale `acpSessionId` from the old workspace was passed to the new ACP process.

**Changes**:

| File | Change |
|------|--------|
| `src/renderer/pages/conversation/workspace/index.tsx` | Clear `acpSessionId` and `acpSessionUpdatedAt` from `newConversation.extra` during migration |

#### 8c: ACP Bootstrap Retry

**Problem**: If `initAgent()` failed (e.g., CLI not found), the rejected Promise was cached in `this.bootstrap`, preventing retry on subsequent `sendMessage()` calls.

**Changes**:

| File | Change |
|------|--------|
| `src/process/task/AcpAgentManager.ts` | Clear-on-reject pattern: `.catch()` sets `this.bootstrap = undefined` before re-throwing |

#### 8d: ACP CWD Normalization

**Problem**: `normalizeCwdForAgent()` didn't handle the case where `path.relative()` returns empty string (same directory), causing incorrect path routing.

**Changes**:

| File | Change |
|------|--------|
| `src/agent/acp/AcpConnection.ts` | Explicit `relative === ''` check returns `defaultPath` |

#### 8e: ACP Tool Rendering White Screen Fix

**Problem**: `ToolAcpMapper` in `MessageToolGroupSummary.tsx` passed `update.rawOutput` directly as React child in `<pre>` element. ACP content objects (`{type: "text", text: "..."}`) are not valid React children — caused "Objects are not valid as a React child" crash and white screen.

**Changes**:

| File | Change |
|------|--------|
| `src/renderer/messages/MessageToolGroupSummary.tsx` | New `safeText()` helper: extracts string from both plain strings and ACP content objects `{type, text}`. Applied to `rawOutput`, `rawInput.description`, `rawInput.command` in `ToolAcpMapper`. |

#### 8f: Skill Distribution Timing

**Problem**: `distributeForClaude()` was called inside `initAgent()`, guarded by `this.bootstrap` memoization — skills were only distributed once per agent lifecycle. Newly installed skills were invisible to existing Claude conversations.

**Changes**:

| File | Change |
|------|--------|
| `src/process/task/AcpAgentManager.ts` | Moved `distributeForClaude()` from `initAgent()` to `sendMessage()`, before the `initAgent()` call. Runs on every message send, picking up newly installed skills. `distributeForClaude()` is idempotent (existence checks, manifest diffing). |

**enabledSkills Policy**:
- `undefined` / `[]` → all optional skills distributed (newly installed skills automatically visible)
- Explicit list (e.g., `['pptx']`) → only listed skills (by design, user chose per-conversation)
- Builtins always distributed regardless of `enabledSkills`

**Test Results**: 94/94 tests passed, tsc 0 errors, eslint 0 errors

---

## Review Process (Ralph-Lisa Dual-Agent Loop)

All changes went through the Ralph-Lisa turn-based code review system. Key review milestones:

| Step | Rounds | Key Review Findings |
|------|--------|---------------------|
| Step 1 (ACP tool call) | Prior session | Completed in earlier session |
| Step 2 (shell-bg) | 2 | Clean pass. Lisa noted residual risk: no unit test for skill injection (non-blocking) |
| Step 3 (titlebar) | 1 | Clean pass. Correctly scoped to macOS only |
| Step 4 (permission persistence) | 5 | Lisa caught: (1) pipeline/commandType analysis was incorrect — `getCommandRoots()` correctly parses pipelines; (2) PolicyEngine statement was imprecise; (3) DB operation failures were silently swallowed. All fixed. |
| Step 5 (tree-kill) | 7 | Lisa caught: (1) fire-and-forget stop() races with super.kill(); (2) grace period needed for ShellExecutionService SIGTERM→SIGKILL window; (3) tree-kill is async on macOS (spawns pgrep), not synchronous. Led to scope narrowing — exit-path race is pre-existing cross-agent limitation. |
| Step 5b (orphan fix) | 5 | Lisa caught: (1) TypeScript type error — `killAllTrackedProcessGroups()` not in d.ts; (2) node_modules patch not reproducible without patch-package. Both fixed. |
| Step 6 (pending issues) | 4 | Lisa caught: inline comment wording inconsistency with block comment. Fixed. |
| Step 7 (skill architecture) | 8 | Lisa caught: (1) scope mismatch — Gemini part incomplete; (2) computeGeminiDisabledSkills destructuring unused `builtins`; (3) copy-mode ownership safety — missing per-entry provenance marker. All fixed. |
| Step 8 (sidebar+workspace) | 8 | Lisa caught: (1) incorrect sidebar baseline facts (desktop already had 64px); (2) macOS marginLeft still 0 in mobile mode; (3) pointerEvents:'none' blocks clicks; (4) bootstrap retry should use clear-on-reject; (5) Issue 4 enabledSkills policy gap. All fixed. |

Total review rounds across all steps: **40 rounds** of iterative review.

---

## Test Summary

| Check | Result |
|-------|--------|
| `npm test` | 5 suites, 94 tests, 0 failures |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint` | 0 errors (pre-existing warnings only) |
| Pre-commit hooks (lint-staged) | Passed |

---

## Files Changed (47 total, excluding package-lock.json)

### New Files (7)
- `patches/@office-ai+aioncli-core+0.24.4.patch` — ShellExecutionService process group tracking
- `skills/_builtin/shell-bg/SKILL.md` — Background process detection skill
- `src/common/terminalUtils.ts` — Cross-platform terminal command builder
- `src/process/bridge/shellBridge.ts` — Shell IPC bridge
- `src/process/task/SkillDistributor.ts` — Native engine skill distribution (symlink/copy + provenance marker)
- `tests/unit/test_terminal_utils.ts` — 34 unit tests for terminalUtils
- `tests/unit/test_skill_distributor.ts` — 19 unit tests for SkillDistributor

### Deleted Files (1)
- `src/process/task/AcpSkillManager.ts` — Old injection-based skill loading (replaced by SkillDistributor)

### Modified Files (39)
- `CLAUDE.md` — ACP pipeline docs, locale list update
- `package.json` — Add `tree-kill` dependency, `patch-package` postinstall
- `src/agent/acp/AcpAdapter.ts` — Conditional field merge, rawOutput passthrough
- `src/agent/acp/AcpConnection.ts` — Stderr ring buffer, PATH loading, CWD normalization empty-relative fix
- `src/agent/acp/ApprovalStore.ts` — Per-tool execute approval (not per-command)
- `src/agent/acp/index.ts` — Tool call flow fixes
- `src/agent/codex/connection/CodexConnection.ts` — Minor fix
- `src/agent/gemini/GeminiApprovalStore.ts` — `loadFromPersistedData()` method
- `src/agent/gemini/index.ts` — Pass `disabledSkills` to SkillManager config
- `src/common/ipcBridge.ts` — Register shell IPC channel
- `src/process/database/index.ts` — Gemini approval CRUD methods
- `src/process/database/migrations.ts` — v11 migration (gemini_approvals table)
- `src/process/database/schema.ts` — DB version 10 → 11
- `src/process/initStorage.ts` — Remove old skill injection functions (-75 lines)
- `src/process/task/AcpAgentManager.ts` — Grace-period `kill()`, bootstrap clear-on-reject, skill distribution moved to sendMessage()
- `src/process/task/CodexAgentManager.ts` — Call `distributeForCodex()` for native discovery
- `src/process/task/GeminiAgentManager.ts` — Permission persistence, `kill()` override, shell-bg skill, enabledSkills→disabledSkills conversion
- `src/process/task/agentUtils.ts` — Simplified: removed skill injection, `prepareFirstMessage()` only injects preset context
- `src/renderer/components/Titlebar/index.tsx` — Deterministic marginLeft (collapsed: 80px, expanded: 210px)
- `src/renderer/i18n/locales/en-US.json` — i18n key
- `src/renderer/i18n/locales/ja-JP.json` — i18n key
- `src/renderer/i18n/locales/ko-KR.json` — i18n key
- `src/renderer/i18n/locales/tr-TR.json` — i18n key
- `src/renderer/i18n/locales/zh-CN.json` — i18n key
- `src/renderer/i18n/locales/zh-TW.json` — i18n key
- `src/renderer/layout.tsx` — Mobile sidebar: unified collapsedWidth=64, fixed positioning only when expanded
- `src/renderer/messages/MessageToolGroupSummary.tsx` — Output display, safeText() for ACP content objects
- `src/renderer/messages/acp/MessageAcpToolCall.tsx` — rawOutput rendering, copy button
- `src/renderer/messages/hooks.ts` — Fix duplicate React key
- `src/renderer/pages/conversation/acp/AcpSendBox.tsx` — Connection phase display
- `src/renderer/pages/conversation/workspace/index.tsx` — Clear stale acpSessionId/acpSessionUpdatedAt on migration
- `src/types/acpTypes.ts` — rawOutput field, type extensions
- `src/worker/gemini.ts` — Process group cleanup on stop/exit

---

## Current Architecture: Skill System

### Skill 生命周期

```
用户操作                              自动执行
────────                              ────────
Settings → 安装 skill               → 保存到 ~/.aionui/config/skills/{name}/
Settings → 创建智能助手 → 勾选 skills → 保存 enabledSkills 到助手配置
新建会话 → 选择智能助手              → enabledSkills 传入 AgentManager
发消息                               → distributeForClaude/Codex() 自动分发
                                     → 引擎自动发现并加载
```

### Skill 存储

- **全局共享目录**: `~/.aionui/config/skills/` (= `app.getPath('userData')/config/skills`)
- **内置 skills**: `~/.aionui/config/skills/_builtin/` (如 `cron`, `shell-bg`)
- **用户安装 skills**: `~/.aionui/config/skills/{name}/` (如 `pptx`, `docx`)
- 所有引擎共享同一份源，通过 `SkillDistributor` 分发

### SkillDistributor 分发机制

| 引擎 | 目标目录 | 分发方式 | 触发时机 |
|------|---------|---------|---------|
| Claude Code | `{workspace}/.claude/skills/` | symlink (macOS/Linux) / copy (Windows) | 每次 `sendMessage()` 自动调用 |
| Codex | `{workspace}/.agents/skills/` | symlink / copy | 每次 `sendMessage()` 自动调用 |
| Gemini | `~/.aionui/config/skills/` (直接使用) | 不需要分发，原生 SkillManager 扫描 | agent 启动时传入 `skillsDir` |

### enabledSkills 过滤

- **来源**: 智能助手（Preset Assistant）配置，保存在 `assistant.enabledSkills`
- **配置入口**: Settings → 智能助手管理 → 创建/编辑助手 → 勾选 skills
- **传递路径**: 助手配置 → 新建会话 `extra.enabledSkills` → AgentManager → SkillDistributor
- **过滤规则**:
  - `undefined` / `[]` → 所有 skills 全部分发（普通会话，不选助手）
  - 显式列表 (如 `['pptx']`) → 只分发列出的 + 所有内置 skills
  - 内置 skills (`_builtin/*`) 始终分发，不受过滤影响
- **Gemini 特殊处理**: `enabledSkills` 白名单通过 `computeGeminiDisabledSkills()` 转换为 `disabledSkills` 黑名单，传给原生 SkillManager

### 引擎原生 Skill 发现与激活

| 引擎 | 发现方式 | 激活方式 |
|------|---------|---------|
| Claude Code | 扫描 `{workspace}/.claude/skills/` 目录 | 自动加载 SKILL.md 到上下文 |
| Codex | 扫描 `{workspace}/.agents/skills/` 目录 | 自动匹配并加载 |
| Gemini | SkillManager 扫描 `skillsDir`，name+description 注入 system prompt | 模型调用 `activate_skill` 工具 → lazy load 完整 skill body |

### Copy-mode 安全机制 (Windows)

- macOS/Linux 使用 symlink，删除 symlink 不影响源文件
- Windows 使用 copy，需要防止误删引擎自己创建的 skill
- 双重验证: manifest 清单 (`.aionui-manifest.json`) + provenance marker (`.aionui-managed`)
- 只有同时满足「manifest 列出」且「marker 存在」才允许删除/更新

### 关键代码位置

| 组件 | 文件 | 说明 |
|------|-----|------|
| SkillDistributor | `src/process/task/SkillDistributor.ts` | 核心分发逻辑 |
| Skill 安装 | `src/process/bridge/fsBridge.ts:765` | `importSkill` IPC handler |
| Skill 列表 | `src/process/bridge/fsBridge.ts:640` | `listSkills` IPC handler |
| 助手管理 UI | `src/renderer/pages/settings/AssistantManagement.tsx` | enabledSkills 配置 |
| 会话创建 | `src/renderer/pages/guid/index.tsx:763` | enabledSkills 传入会话 extra |
| Claude 分发触发 | `src/process/task/AcpAgentManager.ts:244` | `sendMessage()` 中调用 |
| Codex 分发触发 | `src/process/task/CodexAgentManager.ts` | `sendMessage()` 中调用 |
| Gemini 过滤 | `src/process/task/GeminiAgentManager.ts` | `computeGeminiDisabledSkills()` |

---

## Known Limitations & Future Work

1. **Exit-path subprocess cleanup**: `app.exit(0)` and `process.on('exit')` cannot run async cleanup. Affects ALL agent types. Fix requires making restart flow async.
2. **ShellExecutionService patch**: Currently via `patch-package`. Should be ported to `@office-ai/aioncli-core` source repo.
3. **No visual regression tests**: Titlebar margin and sidebar layout changes require manual macOS verification.
4. **No integration tests for DB persistence**: `loadPersistedApprovals()` / `persistApprovals()` involve UtilityProcess lifecycle.
5. **enabledSkills per-conversation scope**: Newly installed skills are only auto-visible in conversations where `enabledSkills` is `undefined/[]`. Conversations with explicit `enabledSkills` require manual update to include new skills.
6. **Windows copy-mode not tested**: SkillDistributor falls back to `cpSync` on Windows (no symlinks). Provenance marker logic is tested but actual Windows distribution is not verified.

---

### Step 9: Next-Phase Issues 1-4 (Uncommitted)

Based on [`docs/next-phase-plan-2026-02-08.md`](./next-phase-plan-2026-02-08.md) Issues 1-4.

#### 9a: ACP Reconnect Fix (Issue 1)

**Problem**: After stopping a Claude conversation and re-sending, user gets "conversation in progress" error because the old ACP session ID is still cached.

**Changes**:

| File | Change |
|------|--------|
| `src/agent/acp/AcpConnection.ts` | Improve disconnect reliability: await treeKill completion, clear session state |
| `src/agent/acp/index.ts` | `stop()` now async, awaits `disconnect()` completion |
| `src/process/task/AcpAgentManager.ts` | Clear `acpSessionId` after stop, force new session on next send |
| `src/process/bridge/acpConversationBridge.ts` | Handle reconnection state in conversation bridge |

#### 9b: Agent Switch (Issue 2)

**Problem**: New tab inherits current agent type via spread operator, no way to switch agent for same workspace.

**Changes**:

| File | Change |
|------|--------|
| `src/renderer/pages/conversation/ConversationTabs.tsx` | New tab navigates to Welcome/Guid page instead of cloning current conversation type (-59 lines) |
| `src/renderer/pages/guid/index.tsx` | Welcome page preserves workspace path from current tab context |

#### 9c: Settings Restructure — Independent Skills Page (Issue 3)

**Problem**: Skill management buried inside Assistant edit dialog. No global skill management entry.

**Changes**:

| File | Change |
|------|--------|
| `src/renderer/pages/settings/SkillsManagement.tsx` (new) | Standalone Skills management page: browse installed skills (builtin/custom), import new skills from folder, quick-scan common paths |
| `src/renderer/pages/settings/SkillsSettings.tsx` (new) | Settings route wrapper for Skills page |
| `src/renderer/pages/settings/SettingsSider.tsx` | Add Skills menu item to settings navigation |
| `src/renderer/router.tsx` | Add `/settings/skills` route |

#### 9d: Agent Backend Management (Issue 4)

**Changes**:

| File | Change |
|------|--------|
| `src/renderer/pages/settings/BackendManagement.tsx` (new) | Agent backend enable/disable UI |
| `src/renderer/components/SettingsModal/contents/AgentModalContent.tsx` | Link to backend management |
| `src/common/storage.ts` | Add storage type for disabled backends |

---

### Step 10: Skill Distribution — Engine-Native Detection (Uncommitted)

Implements Phase 3 of the [Skill Distribution Architecture RFC](./skill-distribution-rfc.md): detect and import engine-native skills.

**Commit 1 — Backend: Engine-native skill detection**

| File | Change |
|------|--------|
| `src/process/task/SkillDistributor.ts` | New `EngineNativeSkill` type + `detectEngineNativeSkills()`: scans `.claude/skills/` and `.agents/skills/` for entries not managed by AionUi (no symlink, no provenance marker) |
| `src/common/ipcBridge.ts` | New `fs.detectEngineNativeSkills` IPC channel |
| `src/process/bridge/fsBridge.ts` | Provider: calls `detectEngineNativeSkills()`, returns success/error response |
| `tests/unit/test_skill_distributor.ts` | 7 new tests: empty dirs, skip symlinks, skip copies with marker, correct engine label, missing workspace, hasSkillMd detection, skip dotfiles |

**Commit 2 — Frontend: Engine-native skills UI + i18n**

| File | Change |
|------|--------|
| `src/renderer/pages/settings/SkillsManagement.tsx` | New section: "Detected Skills" collapsible panel with engine badges (purple=Claude, blue=Codex), Import button, `hasSkillMd=false` warning + disabled import |
| 6 × `src/renderer/i18n/locales/*.json` | 6 new keys per locale: `engineNativeSkills`, `engineNativeDescription`, `importToAionUi`, `noSkillMd`, `skillImported`, `skillImportFailed` |

**Commit 3 — RFC editorial fix**

| File | Change |
|------|--------|
| `docs/skill-distribution-rfc.md:181` | Plugin detection wording aligned between Section 3.2 (per-engine matrix) and Section 4.3 (in-chat policy): Codex `openai.yaml` now explicitly noted as detectable |

**Test Results**: 101/101 tests passed (7 new), tsc 0 errors, eslint 0 errors

---

## Test Summary (Latest)

| Check | Result |
|-------|--------|
| `npm test` | 5 suites, 101 tests, 0 failures |
| `npx tsc --noEmit` | 0 errors |
| `npx eslint` | 0 errors |

---

## Known Limitations & Future Work

1. **Exit-path subprocess cleanup**: `app.exit(0)` and `process.on('exit')` cannot run async cleanup. Affects ALL agent types. Fix requires making restart flow async.
2. **ShellExecutionService patch**: Currently via `patch-package`. Should be ported to `@office-ai/aioncli-core` source repo.
3. **No visual regression tests**: Titlebar margin and sidebar layout changes require manual macOS verification.
4. **No integration tests for DB persistence**: `loadPersistedApprovals()` / `persistApprovals()` involve UtilityProcess lifecycle.
5. **enabledSkills per-conversation scope**: Newly installed skills are only auto-visible in conversations where `enabledSkills` is `undefined/[]`. Conversations with explicit `enabledSkills` require manual update to include new skills.
6. **Windows copy-mode not tested**: SkillDistributor falls back to `cpSync` on Windows (no symlinks). Provenance marker logic is tested but actual Windows distribution is not verified.
7. **Frontend component testing**: No existing component test infrastructure; engine-native skills UI verified via type-safety and linting only.
8. **Same-name skill across engines**: If same skill name exists in both Claude and Codex engine dirs, the shared `importingSkill` key by name disables both import buttons during import. Refinable later with engine-qualified key.

---

## Reference Documents

| Document | Purpose |
|----------|---------|
| [`docs/skill-distribution-rfc.md`](./skill-distribution-rfc.md) | Skill Distribution Architecture RFC (Rev 3) — design baseline |
| [`docs/fix-status.md`](./fix-status.md) | Bug fix and feature implementation status tracker |
| [`docs/next-phase-plan-2026-02-08.md`](./next-phase-plan-2026-02-08.md) | Next phase planning (Issues 1-7) |
| [`docs/architecture.md`](./architecture.md) | System architecture reference |
