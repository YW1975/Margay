# AionUi v2 Upgrade Requirements

**Date**: 2026-02-08
**Branch**: TBD (from `ocelot`)
**Scope**: Shell command fix, Skill architecture overhaul, UI fixes

---

## Requirement 1: Shell Command No-Return Fix

### 1.1 Problem Statement

Running shell commands via Gemini's `run_shell_command` tool causes the system to hang indefinitely. Confirmed in Gemini engine; Claude Code (ACP) tested OK; Codex not yet tested.

Console output shows repeating cycle:
```
[PolicyEngine.check] toolCall.name: run_shell_command, stringifiedArgs: undefined
[PolicyEngine.check] NO MATCH - using default decision: ask_user
[Workspace] Read directory aborted: readDirectoryRecursive aborted!
[StreamMonitor] State changed to: connecting → connected → disconnected
```
Repeats 3 times, then `[ToolCallGuard] Tool run_shell_command-xxx is protected`.

### 1.2 Root Cause Analysis

#### `stringifiedArgs: undefined` — NOT a bug

`PolicyEngine.check()` (`policy-engine.js:175-181`) only computes `stringifiedArgs` when rules have `argsPattern`:
```javascript
if (toolCall.args &&
    (this.rules.some(rule => rule.argsPattern) ||
     this.checkers.some(checker => checker.argsPattern))) {
    stringifiedArgs = stableStringify(toolCall.args);
}
```
AionUi has no rules with `argsPattern`, so `stringifiedArgs` is always `undefined`. This is normal behavior. `NO MATCH → ask_user` is the default decision.

#### Actual blocking point

The blocking occurs at `shell.js:182` inside `@office-ai/aioncli-core`:
```
handleMessage() line 500
  → await scheduler.schedule(toolCallRequests, signal)
    → CoreToolScheduler._processNextInQueue()
      → shouldConfirmExecute() → PolicyEngine → ask_user
      → awaiting_approval → UI shows confirmation dialog
      → user approves → handleConfirmationResponse()
      → scheduled → attemptExecutionOfScheduledCalls()
        → toolExecutor.execute()
          → ShellToolInvocation.execute()
            → const result = await resultPromise;   ← BLOCKS HERE
```

`await resultPromise` waits for the child process to exit. For long-running/server processes, it never exits.

#### Built-in inactivity timeout exists but insufficient

`ShellToolInvocation.execute()` has `shellToolInactivityTimeout` (default 300s / 5 minutes). It resets on each output event. Problems:
- If the script produces output periodically, timeout keeps resetting → never fires
- If the script produces no output, it fires after 5 minutes → kills the process and returns timeout message
- AionUi does NOT pass `shellToolInactivityTimeout` to Config (uses default)
- AionUi does NOT pass `outputUpdateHandler` to CoreToolScheduler → no live output streaming to UI

### 1.3 Two Scenarios to Support

#### Case 1: Foreground task scripts

Commands that process data and exit (e.g., `node process.js`, `npm run build`).

**Fix**: Add safety timeout at AionUi level + `outputUpdateHandler` for live output.
- Wrap `scheduler.schedule()` with `Promise.race` timeout
- Pass `outputUpdateHandler` to `CoreToolScheduler` for live output streaming
- When timeout fires, abort signal → child process killed → partial output returned
- Tree-kill for process cleanup (same pattern as ACP Bug 3 fix)

#### Case 2: Background/server processes

Commands designed to run indefinitely (e.g., `node server.js`, `npm run dev`).

**Fix**: New `shell-bg` skill that teaches the agent to:
1. Classify commands as foreground/background/uncertain
2. For background commands: append `&`, capture initial output, report PID
3. For uncertain: ask the user
4. Remember user's answer within the conversation

This leverages `run_shell_command`'s existing `&` support — when command ends with `&`, the shell exits after the background process starts, and Background PIDs are captured.

### 1.4 Implementation Plan

#### Code changes (Gemini path)

**File: `src/agent/gemini/index.ts`**

1. Add `outputUpdateHandler` to `CoreToolScheduler` initialization (line 312-383):
```typescript
this.scheduler = new CoreToolScheduler({
  outputUpdateHandler: (callId, output) => {
    this.onStreamEvent({
      type: 'tool_output',
      data: { callId, output },
      msg_id: this.activeMsgId ?? uuid(),
    });
  },
  // ... existing options
});
```

2. Add timeout wrapper around `scheduler.schedule()` (line 500):
```typescript
const TOOL_EXECUTION_TIMEOUT_MS = 300000; // 5 minutes
await Promise.race([
  this.scheduler.schedule(toolCallRequests, abortController.signal),
  new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      abortController.abort();
      reject(new Error('Tool execution timed out after 5 minutes'));
    }, TOOL_EXECUTION_TIMEOUT_MS);
    abortController.signal.addEventListener('abort', () => clearTimeout(timer));
  }),
]);
```

3. Handle timeout error gracefully in `.catch()` block — emit user-friendly message.

#### Skill: `shell-bg`

Create `skills/_builtin/shell-bg/SKILL.md` — teaches agent to detect and handle background processes. Uses only `name` + `description` frontmatter for cross-engine compatibility.

Content: Classify commands (foreground/background/uncertain), background execution template with `&`, context memory for user preferences, process management (kill, ps).

#### Cross-engine considerations

| Engine | Shell command blocking? | Fix needed? |
|--------|------------------------|-------------|
| Gemini | YES — `run_shell_command` via `CoreToolScheduler` blocks | Timeout + outputHandler + skill |
| Claude Code (ACP) | NO — tested OK. ACP has 5-min timeout + pause/resume | Skill only (for background process awareness) |
| Codex | UNTESTED — needs verification | TBD after testing |

The `shell-bg` skill should be engine-agnostic (no tool name references). Each engine's agent knows its own tools.

---

## Requirement 2: Skill Architecture Overhaul

### 2.1 Problem Statement

AionUi has a custom skill loading/injection system that duplicates what the three underlying CLI tools now natively support:

- **Gemini CLI** (`@office-ai/aioncli-core`): `SkillManager` + `activate_skill` tool + lazy loading (since v0.23.0, stable in v0.27.0)
- **Claude Code**: Built-in skill system with `.claude/skills/` discovery + description budget + auto/manual activation
- **Codex CLI**: `.agents/skills/` discovery + progressive disclosure (since late 2025)

### 2.2 Current AionUi Skill System (to be removed/refactored)

| Component | File | What it does | Action |
|-----------|------|-------------|--------|
| `buildSystemInstructions()` | `agentUtils.ts` | Full body injection for Gemini | **REMOVE** — let aioncli-core handle |
| `loadSkillsContent()` | `initStorage.ts` | Reads SKILL.md content for injection | **REMOVE** — no longer needed for injection |
| `prepareFirstMessageWithSkillsIndex()` | `agentUtils.ts` | Skill index injection for ACP | **REMOVE** — Claude Code discovers natively |
| `AcpSkillManager` | `AcpSkillManager.ts` | Skill discovery + index for ACP | **REMOVE** — Claude Code has own discovery |
| `GeminiAgent.filterSkills()` | `index.ts:269-273` | Post-init filtering by enabledSkills | **REPLACE** — use `disabledSkills` config |
| `initBuiltinAssistantRules()` skill copy | `initStorage.ts` | Copy `_builtin/` to user dir | **KEEP but refactor** — still needed for distribution |

### 2.3 New Architecture: AionUi as Skill Distributor

```
AionUi's role: DISTRIBUTE skills, not LOAD them.

skills/_builtin/          ← AionUi source of builtin skills
  cron/SKILL.md
  shell-bg/SKILL.md

On conversation start:
  → Detect engine type (gemini/claude/codex)
  → Ensure skills exist in engine's expected location:
      Gemini:  ~/.aionui/skills/  (via skillsDir config)
      Claude:  {workspace}/.claude/skills/  (or symlink)
      Codex:   {workspace}/.agents/skills/  (or symlink)
  → Engine discovers and loads skills natively

AionUi continues to:
  → Process agent output (CronCommandDetector, MessageMiddleware)
  → Manage preset-based skill enablement (via disabledSkills)
  → Provide skill installation/management UI (future)
```

### 2.4 Skill Format Standard

Use **agentskills.io lowest common denominator** for cross-engine compatibility:

```yaml
---
name: skill-name          # Required, max 64 chars, lowercase + hyphens
description: ...           # Required, max 1024 chars
---
Markdown body (instructions)
```

Only `name` + `description` in frontmatter. All three engines support this. Do NOT use:
- Claude-specific: `argument-hint`, `hooks`, `context`, `agent`, `model`
- Codex-specific: `agents/openai.yaml` sidecar
- Even standard-optional: `license`, `metadata`, `allowed-tools` (Gemini CLI doesn't support them)

Skill body should NOT reference engine-specific tool names:
```markdown
# WRONG
Use `run_shell_command` to execute...

# RIGHT
When executing shell commands...
```

### 2.5 Gemini Path Detail

`@office-ai/aioncli-core` already has the complete native system:
- `config.js:1250`: `registerCoreTool(ActivateSkillTool, this)` — registered as core tool
- `config.js:477`: `if (this.skillsSupport)` → `discoverSkills()` + `setDisabledSkills()`
- `config.js:481`: Re-registers `ActivateSkillTool` with discovered skill names as Zod enum
- AionUi's `config.ts:271`: `skillsSupport: !!skillsDir` — already enabled

What to change:
1. Stop calling `buildSystemInstructions()` for skill injection
2. Stop calling `filterSkills()` after `config.initialize()`
3. Instead, pass `disabledSkills` to Config constructor (derived from preset's inverse of `enabledSkills`)
4. Let `activate_skill` tool handle lazy loading

### 2.6 ACP (Claude Code) Path Detail

Claude Code subprocess runs in the workspace directory and has its own skill discovery (`.claude/skills/`).

What to change:
1. Stop calling `prepareFirstMessageWithSkillsIndex()` for skill injection
2. Ensure AionUi's builtin skills (cron, shell-bg) are present in `.claude/skills/` before launching Claude Code subprocess
3. Symlink or copy from `~/.aionui/skills/` to `.claude/skills/`
4. Claude Code handles discovery, description budget, and activation natively

### 2.7 Codex Path Detail

Similar to ACP. Codex looks for `.agents/skills/`.

What to change:
1. Ensure skills are present in `.agents/skills/` before launching Codex
2. Codex handles discovery and activation natively

### 2.8 Preset System Migration

Current: `enabledSkills: ['skill-creator', 'pptx', 'docx', 'pdf', 'xlsx']` controls which skills are injected.

New: Convert to `disabledSkills` — all discovered skills are available unless explicitly disabled.

```typescript
// Current
this.config.getSkillManager().filterSkills(skill => enabledSet.has(skill.name));

// New: compute disabled list from preset
const allSkills = this.config.getSkillManager().getSkills().map(s => s.name);
const disabledSkills = allSkills.filter(s => !enabledSet.has(s));
// Pass via Config constructor or setDisabledSkills()
```

### 2.9 Cron Skill Compatibility

The cron skill (`_builtin/cron/SKILL.md`) teaches agents `[CRON_CREATE]` syntax. `CronCommandDetector` + `MessageMiddleware` parse agent output. This is independent of HOW the skill is loaded — works the same whether skill is full-body injected or lazy-loaded via `activate_skill`.

No changes needed to cron middleware. Only the skill distribution path changes.

---

## Requirement 3: UI Fixes

### 3.1 Sidebar Toggle Icon Overlap

**Problem**: The sidebar collapse/expand toggle icon is overlapped by macOS window control buttons (close/minimize/maximize) when the window width is narrow.

**Fix**: Add left padding or adjust positioning of the toggle icon to account for macOS traffic light buttons. On macOS, the traffic lights occupy approximately 70-80px from the left edge. The toggle icon should be positioned below or to the right of this zone.

**Files to investigate**: Sidebar/layout components in `src/renderer/pages/` or `src/renderer/components/`.

### 3.2 Permission Prompt Persistence

**Problem**: Every tool execution prompts the user for permission (run once / always allow / deny). User selects "always allow" but the next execution still prompts. The approval decision is not persisted across sessions.

**Expected behavior**: After granting "always allow" once per session startup (or permanently), do not prompt again for the same tool/action.

**Root cause investigation needed**:
- `GeminiAgentManager.confirm()` stores decisions via `GeminiApprovalStore` (`approvalStore.approveAll(keys)`)
- Check if `GeminiApprovalStore` persists to disk or is memory-only
- Check if the store survives across conversation switches
- Check if `PolicyEngine` rules are being re-initialized on each message, clearing approvals

**Desired behavior**: "Always allow" means:
- Persisted for the current session (at minimum)
- Ideally persisted across sessions (stored in settings/database)
- Applied globally, not per-conversation
- User can revoke in settings if needed

**Files to investigate**:
- `src/process/task/GeminiAgentManager.ts` — `confirm()`, `GeminiApprovalStore`
- `@office-ai/aioncli-core` PolicyEngine — rule persistence, `addRule()`, approval mode
- Config `approvalMode` — currently `ApprovalMode.DEFAULT`, could use `ApprovalMode.YOLO` but that's too permissive

---

## Supplementary Items (Identified During Research)

### S1: Tree-kill for Gemini Process Cleanup

When timeout fires and `abortController.abort()` is called, the direct child process is killed but subprocesses may survive (same issue as ACP Bug 3 fixed in ocelot branch).

Apply the same `tree-kill` pattern from `AcpConnection.disconnect()` to Gemini's abort/timeout path. The `ToolExecutor` provides a `setPidCallback` for shell commands — use this PID for tree-kill on abort.

### S2: `outputUpdateHandler` for Live Output

`CoreToolScheduler` accepts `outputUpdateHandler` option. `ShellTool.canUpdateOutput = true`. When passed, shell commands stream output to UI during execution (1-second interval updates).

Currently AionUi does NOT pass this handler. Adding it would:
- Show live command output during execution (before completion)
- Reset the inactivity timeout on each output event (keeping long-running scripts alive)
- Provide better UX even for foreground tasks

Need to define how `tool_output` events are rendered in the UI — possibly in the tool group summary or as a streaming text block.

### S3: Codex Engine Testing

Codex has not been tested for the shell command blocking issue. Need to verify:
- Does Codex's `run_shell_command` (or equivalent) have the same blocking behavior?
- Does Codex have its own timeout mechanism?
- Does the `shell-bg` skill work correctly with Codex?

### S4: Skill Directory for Each Engine

AionUi needs to ensure skills are placed in the correct directory for each engine:

| Engine | Skill directory | How AionUi configures |
|--------|----------------|----------------------|
| Gemini | `skillsDir` passed to `loadCliConfig()` | Already configured |
| Claude Code | `.claude/skills/` in workspace | Need to create/symlink |
| Codex | `.agents/skills/` in workspace | Need to create/symlink |

The workspace directory varies per conversation. AionUi needs a mechanism to set up skill directories before launching the engine subprocess.

### S5: Existing `ocelot` Branch Changes

The `ocelot` branch (commit `d5fa1f63`) already has 23 files changed with Steps 1-5 fixes:
- Process tree termination (tree-kill)
- ACP tool call duplicate key & status overwrite
- Connection phase UX
- Stderr forward to UI
- Copy Command button

The new changes should build on top of `ocelot`. Reference: `docs/dev-summary.md`.

---

## Research Reference: Three-Engine Skill System Comparison

### agentskills.io Standard (Base)

```yaml
---
name: skill-name          # Required, max 64, lowercase+hyphens
description: ...           # Required, max 1024
license: ...               # Optional
compatibility: ...         # Optional, max 500
metadata: {}               # Optional, arbitrary k/v
allowed-tools: ...         # Optional, experimental
---
```

Directory: `SKILL.md` + `scripts/` + `references/` + `assets/`

### Cross-Engine Compatibility Matrix

| Field | Claude Code | Gemini CLI | Codex |
|-------|-------------|------------|-------|
| `name` | Optional(!) | Required | Required |
| `description` | Recommended | Required | Required |
| `license` | Yes | **No** | Yes |
| `compatibility` | Yes | **No** | **No** |
| `metadata` | Yes | **No** | Yes |
| `allowed-tools` | Yes | **No** | Yes |

**Portable minimum**: `name` + `description` + Markdown body only.

### Claude Code Proprietary Extensions (7 fields)

`argument-hint`, `disable-model-invocation`, `user-invocable`, `model`, `context`, `agent`, `hooks`
Plus body-level: `$ARGUMENTS`, `` !`command` `` dynamic injection

### Gemini CLI

Strictest — only `name` + `description`. Known issue: [github.com/google-gemini/gemini-cli/issues/15895](https://github.com/google-gemini/gemini-cli/issues/15895)

### Codex

Closest to standard. Proprietary extensions in separate `agents/openai.yaml` sidecar file, keeping SKILL.md clean.

### Loading Strategies

| Engine | Startup | Activation |
|--------|---------|-----------|
| Claude Code | Descriptions (2% context budget) | User `/name` or model auto |
| Gemini CLI | name+description in system prompt | Model calls `activate_skill` tool |
| Codex | name+description (~100 tokens) | Model auto-matches |

### Key Code Locations in `@office-ai/aioncli-core`

| Component | File | Line |
|-----------|------|------|
| `ActivateSkillTool` | `tools/activate-skill.js` | Full file |
| `SkillManager` registration | `config/config.js` | 1250 |
| Skill discovery | `config/config.js` | 477-481 |
| `PolicyEngine.check()` | `policy/policy-engine.js` | 174-237 |
| `CoreToolScheduler.schedule()` | `core/coreToolScheduler.js` | 255-284 |
| `ShellToolInvocation.execute()` | `tools/shell.js` | 79-303 |
| Inactivity timeout | `tools/shell.js` | 92, 115-124 |
| `ToolExecutor.execute()` | `scheduler/tool-executor.js` | 17-81 |
| Confirmation flow | `core/coreToolScheduler.js` | 380-490 |

### Key Code Locations in AionUi

| Component | File | Line |
|-----------|------|------|
| Tool scheduling (blocking point) | `src/agent/gemini/index.ts` | 500 |
| Scheduler init (missing outputUpdateHandler) | `src/agent/gemini/index.ts` | 312-383 |
| Skill full-body injection (to remove) | `src/process/task/agentUtils.ts` | 28-49 |
| Skill index injection for ACP (to remove) | `src/process/task/agentUtils.ts` | 76-130 |
| AcpSkillManager (to remove) | `src/process/task/AcpSkillManager.ts` | Full file |
| Skill content loading (to remove) | `src/process/initStorage.ts` | 763+ |
| Builtin skill copy (to keep/refactor) | `src/process/initStorage.ts` | 356-407 |
| Config creation (skillsSupport) | `src/agent/gemini/cli/config.ts` | 271 |
| Post-init filterSkills (to replace) | `src/agent/gemini/index.ts` | 269-273 |
| GeminiApprovalStore | `src/process/task/GeminiAgentManager.ts` | 498-513 |
| Confirmation handler | `src/process/task/GeminiAgentManager.ts` | 326-363 |
| Cron middleware | `src/process/task/CronCommandDetector.ts` | Full file |
| Worker confirmation pipe | `src/worker/gemini.ts` | 19-34 |

---

## Priority & Sequencing

| # | Item | Priority | Dependency |
|---|------|----------|-----------|
| 1 | Shell command timeout + outputHandler | P0 | None |
| 2 | `shell-bg` skill creation | P0 | None |
| 3 | Permission prompt persistence (3.2) | P1 | None |
| 4 | Skill architecture: remove Gemini injection | P1 | Verify activate_skill works |
| 5 | Skill architecture: remove ACP injection | P1 | Verify Claude Code discovery |
| 6 | Skill distribution mechanism | P1 | #4, #5 |
| 7 | Sidebar icon overlap fix (3.1) | P2 | None |
| 8 | Codex testing | P2 | #1, #2 |
| 9 | Preset system migration (enabledSkills → disabledSkills) | P2 | #4 |
| 10 | Tree-kill for Gemini timeout | P1 | #1 |
