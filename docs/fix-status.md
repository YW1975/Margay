# AionUi Bug Fix & Feature Status

> Updated: 2026-02-09
> Branch: `ocelot`
> Coverage: Committed fixes (3 commits) + uncommitted work (Steps 9-10)

---

## Completed Fixes (Committed)

### F1. ACP Tool Call Handling — Duplicate Keys & Status Overwrite
- **Commit**: `d5fa1f63` (Step 2)
- **Root cause**: `composeMessageWithIndex` didn't update index after push; `updateAcpToolCall` overwrote status with `undefined`
- **Fix**: `hooks.ts` index fix + `AcpAdapter.ts` conditional merge + `acpTypes.ts` optional status
- **Tests**: 75 passed

### F2. ACP Connection Phase UX — "Processing..." During Init
- **Commit**: `d5fa1f63` (Step 3)
- **Fix**: `AcpSendBox.tsx` maps `agent_status` events to ThoughtDisplay phases (connecting/connected/authenticated)

### F3. ACP Stderr Forwarding — Generic Error Messages
- **Commit**: `d5fa1f63` (Step 4)
- **Root cause**: `AcpConnection.ts` logged stderr to console only
- **Fix**: Ring buffer (10 lines, 2000 chars) + forward to UI error messages on disconnect

### F4. ACP Permission Granularity — "Always Allow" Per-Command
- **Commit**: `a236a8fe` (Step 6)
- **Root cause**: `ApprovalStore.serializeKey()` included `rawInput.command` in cache key
- **Fix**: Execute kind now approved per `{kind, title}` instead of per-command
- **Manual test**: Passed (user confirmed 2/8)

### F5. Shell Command Output Not Displayed
- **Commit**: `a236a8fe` (Step 6)
- **Root cause**: Three-layer data loss (type missing field → Adapter drops → component doesn't render)
- **Fix**: `acpTypes.ts` + `AcpAdapter.ts` + `MessageToolGroupSummary.tsx` (View Steps panel)
- **Manual test**: Passed (user confirmed 2/8)

### F6. ACP Subprocess Cleanup — Orphan Processes on Delete
- **Commit**: `a236a8fe` (Step 6)
- **Root cause**: `kill()` was fire-and-forget, treeKill async not awaited
- **Fix**: Grace period pattern (500ms grace + 1500ms hard timeout)

### F7. Gemini Permission Persistence
- **Commit**: `a236a8fe` (Step 4)
- **Root cause**: `GeminiApprovalStore` was per-instance in-memory Map, lost on new conversation
- **Fix**: DB table `gemini_approvals` (v11 migration) + load on construction + save on "Always Allow"
- **Manual test**: Passed (user confirmed 2/8)

### F8. Gemini Orphan Background Processes
- **Commit**: `a236a8fe` (Step 5b)
- **Root cause**: ShellExecutionService removes abort handler on shell exit; backgrounded processes (`&`) survive
- **Fix**: patch-package for aioncli-core + PGID tracking + `killAllTrackedProcessGroups()`

### F9. Workspace Directory Migration — "Internal Error"
- **Commit**: `0a6cdb2a` (Step 8b)
- **Root cause**: Stale `acpSessionId` copied to new conversation via spread operator
- **Fix**: Clear `acpSessionId` and `acpSessionUpdatedAt` during workspace migration

### F10. ACP Bootstrap Retry — Cached Failure
- **Commit**: `0a6cdb2a` (Step 8c)
- **Root cause**: `initAgent()` cached rejected Promise in `this.bootstrap`, preventing retry
- **Fix**: Clear-on-reject pattern

### F11. ACP Tool Rendering White Screen
- **Commit**: `0a6cdb2a` (Step 8e)
- **Root cause**: ACP content objects `{type, text}` passed as React child in `<pre>` — not valid
- **Fix**: `safeText()` helper extracts string from both plain strings and ACP content objects

### F12. Mobile Sidebar Collapse — Inaccessible Expand Button
- **Commit**: `0a6cdb2a` (Step 8a)
- **Root cause**: Mobile sidebar collapsed to width 0, expand button and logo hidden
- **Fix**: Unified `collapsedWidth={64}`, deterministic `marginLeft`

### F13. Skill Architecture Overhaul — Remove Injection, Use Native Distribution
- **Commit**: `0a6cdb2a` (Step 7)
- **Root cause**: Skills injected into messages, consuming context and bypassing engine-native discovery
- **Fix**: `SkillDistributor.ts` (symlink/copy + provenance) + remove `buildSystemInstructions()`, `prepareFirstMessageWithSkillsIndex()`, `loadSkillsContent()`, `AcpSkillManager.ts`
- **Tests**: 94 passed (19 new)

---

## Completed Fixes (Uncommitted — Steps 9-10)

### F14. ACP Reconnect After Stop
- **Step**: 9a
- **Root cause**: `stop()` doesn't await disconnect; old session ID cached
- **Fix**: Async stop, await disconnect, clear sessionId on stop
- **Files**: `AcpConnection.ts`, `AcpAgent index.ts`, `AcpAgentManager.ts`, `acpConversationBridge.ts`

### F15. Agent Switch — Same Workspace
- **Step**: 9b
- **Root cause**: New tab clones current conversation type via spread, locks to same agent
- **Fix**: New tab navigates to Welcome/Guid page for fresh agent selection
- **Files**: `ConversationTabs.tsx`, `guid/index.tsx`

### F16. Independent Skills Management Page
- **Step**: 9c
- **Root cause**: Skill management only accessible inside Assistant edit dialog
- **Fix**: Standalone `/settings/skills` page with browse, import, quick-scan
- **Files**: `SkillsManagement.tsx` (new), `SkillsSettings.tsx` (new), `SettingsSider.tsx`, `router.tsx`

### F17. Agent Backend Management
- **Step**: 9d
- **Fix**: UI for enabling/disabling agent backends
- **Files**: `BackendManagement.tsx` (new), `AgentModalContent.tsx`, `storage.ts`

### F18. Engine-Native Skill Detection + Import UI
- **Step**: 10 (Skill Distribution RFC Phase 3)
- **Fix**: Detect skills created by agents in engine directories (`.claude/skills/`, `.agents/skills/`), show in Settings with engine badges, allow import to AionUi
- **Files**: `SkillDistributor.ts` (+detectEngineNativeSkills), `ipcBridge.ts`, `fsBridge.ts`, `SkillsManagement.tsx`, 6 i18n locales
- **Tests**: 101 passed (7 new)

---

## Pending Issues

### P1. macOS Menu Bar Shows "Electron"
- **Source**: User feedback (2/8)
- **Severity**: Low (cosmetic)
- **Root cause**: `appMenu.ts:18` uses `app.name` which defaults to "Electron" in dev mode
- **Fix**: Call `app.setName('AionUi')` early in main process, or use `productName` constant
- **Estimated effort**: 1 line

---

## Architecture Issues (Documented, Deferred)

### A1. app.exit() Cannot Guarantee Async Cleanup
- **Source**: Step 5 Lisa review discussion
- **Impact**: All agents (Gemini + ACP) — async tree-kill may not complete on app exit/restart
- **Root cause**: `applicationBridge.ts` calls `WorkerManage.clear()` then immediately `app.exit(0)`
- **Fix direction**: Make restart flow async, await graceful shutdown
- **Ralph-Lisa consensus**: Separate issue, cross-agent architectural problem

### A2. ShellExecutionService Patch Not Upstreamed
- **Source**: Step 5b
- **Impact**: `patch-package` dependency for `@office-ai/aioncli-core`
- **Fix direction**: Port patch to aioncli-core source repo

---

## Design Documents

| Document | Status | Description |
|----------|--------|-------------|
| [Skill Distribution RFC](./skill-distribution-rfc.md) | Accepted (Rev 3) | Architecture for native engine skill distribution, extension type compatibility, identity model |
| [Next Phase Plan](./next-phase-plan-2026-02-08.md) | Issues 1-4 implemented, 5-7 deferred | ACP reconnect, agent switch, settings restructure, agent config, fork, agent collaboration, task system |
| [Architecture](./architecture.md) | Current | System architecture reference |

---

## Test Summary

| Phase | Tests | Suites | tsc | eslint |
|-------|-------|--------|-----|--------|
| Commit 1 (`d5fa1f63`) | 75 | 4 | 0 errors | 0 errors |
| Commit 2 (`a236a8fe`) | 75 | 4 | 0 errors | 0 errors |
| Commit 3 (`0a6cdb2a`) | 94 | 5 | 0 errors | 0 errors |
| Step 10 (uncommitted) | 101 | 5 | 0 errors | 0 errors |
