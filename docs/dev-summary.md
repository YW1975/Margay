# AionUi Bug Fix & Enhancement - Development Summary

**Branch**: `ocelot`
**Commit**: `d5fa1f63`
**Date**: 2026-02-07
**Scope**: 23 files changed, 675 insertions(+), 122 deletions(-)

---

## 1. Background

User reported 4 bugs in AionUi's ACP agent integration:

1. **Blocking commands hang** — long-running commands (e.g. `npm run dev`) provide no output until completion/timeout
2. **Slow UI feedback** — generic "Processing..." during ACP cold start (5-10s), no connection phase indication
3. **ESC cancel leaves orphan processes** — `child.kill()` only kills direct child, CLI's subprocesses keep running
4. **No stderr feedback** — stderr logged to console only, user sees generic "disconnected unexpectedly" on errors

Additionally, user requested a new feature: button to interact with execute-type tool call commands.

---

## 2. Implementation Steps

### Step 1: Process Tree Termination (Bug 3)

**Problem**: `AcpConnection.disconnect()` called `child.kill()` (SIGTERM to direct child only). CLI agents spawn their own subprocesses which continued running after ESC cancel.

**Fix**:
- Installed `tree-kill` dependency
- `AcpConnection.disconnect()`: replaced `child.kill()` with `treeKill(pid, 'SIGTERM')`
- `CodexConnection.stop()`: same change
- `AcpAgentManager.kill()`: added override to call `this.agent.stop()` before `super.kill()`, ensuring force-kill path also triggers tree termination

**Files**: `AcpConnection.ts`, `CodexConnection.ts`, `AcpAgentManager.ts`, `package.json`

**Lisa key review**: Caught that `WorkerManage.kill()` → `ForkTask.kill()` path bypassed `AcpConnection.disconnect()`. Fixed with `AcpAgentManager.kill()` override.

---

### Step 2: ACP Tool Call Duplicate Key & Status Overwrite (Bug 1)

**Problem**: ACP execute tool calls follow a 4-message lifecycle:
```
tool_call (pending, empty)  →  tool_call (pending, with input)
  →  tool_call_update (no status, has toolResponse in _meta)
  →  tool_call_update (completed, with content)
```
Two issues:
1. Second `tool_call` with same `toolCallId` created duplicate React key in message list
2. First `tool_call_update` (no status field) overwrote existing status to `undefined`

**Research process**: Captured runtime ACP trace by adding targeted logging to `AcpConnection.ts:354`. Discovered the 4-message lifecycle, `toolResponse` in `_meta`, and the duplicate/overwrite root causes.

**Fix**:
- `hooks.ts`: Fixed `composeMessageWithIndex` — index not updated after push, causing duplicates
- `AcpAdapter.ts`: `createOrUpdateAcpToolCall` now merges second `tool_call` into existing entry; `updateAcpToolCall` only overwrites status/content when defined (not undefined)
- `acpTypes.ts`: `ToolCallUpdateStatus.status` now optional; added `rawOutput` and `_meta.claudeCode.toolResponse` fields

**Files**: `hooks.ts`, `AcpAdapter.ts`, `acpTypes.ts`

**Lisa key review**: Pushed back on initial "ACP protocol doesn't support streaming" claim. Required runtime evidence before drawing conclusions. This led to the correct, evidence-based analysis.

---

### Step 3: Connection Phase UX (Bug 2)

**Problem**: During ACP first-connect (5-10s), `ThoughtDisplay` showed generic "Processing...". The `acpStatus` state was already tracked but not surfaced to UI.

**Fix**:
- `AcpSendBox.tsx`: In `useAcpMessage` hook, mapped `agent_status` events to `ThoughtDisplay` data:
  - `connecting` → "Connecting to Claude Code..."
  - `connected` → "Connected to Claude Code"
  - `authenticated` → "Authenticated with Claude Code"
  - `session_active` / `disconnected` / `error` → clear thought
- Used existing i18n keys (`acp.status.*`)

**Files**: `AcpSendBox.tsx`

**Lisa key review**: Suggested also clearing thought on `disconnected`/`error` to avoid stale phase text. Applied.

---

### Step 4: Stderr Forward to UI (Bug 4)

**Problem**: `AcpConnection.ts:306-308` logged stderr to `console.error` only. When ACP process crashed or auth failed, user saw generic error without the actual reason.

**Fix**:
- `AcpConnection.ts`: Added `stderrBuffer` ring buffer (max 10 lines, 2000 chars). `getRecentStderr()` method. Buffer reset on new connect and after disconnect read.
  - Startup spawn error path: augmented with stderr
  - Startup non-zero exit path: augmented with stderr
  - Startup dead-process path: augmented with stderr
  - Runtime handleProcessExit: stderr passed to `onDisconnect` callback
- `AcpAgent index.ts`: `handleDisconnect` accepts optional stderr; `emitErrorMessage` appends "Recent stderr output" section

**Files**: `AcpConnection.ts`, `index.ts` (AcpAgent)

**Lisa key review**: Caught two missing startup paths (spawn error, dead-process check) where stderr wasn't forwarded. Both fixed.

---

### Step 5: Copy Command Button (originally "Open in Terminal")

**Evolution**:
1. Initially planned as "Open in Terminal" button on execute-type tool calls
2. Implemented cross-platform terminal opening (macOS osascript, Windows cmd, Linux x-terminal-emulator)
3. Manual testing revealed fundamental issues:
   - Complex commands with nested quotes fail through AppleScript multi-layer escaping
   - Re-running server commands causes port conflicts (original ACP process still running)
   - Button appears post-execution, but the real need is pre-execution interception
4. **Pivoted** to "Copy Command" button per user discussion

**Final implementation**:
- `MessageToolGroupSummary.tsx`: `CopyCommandButton` component — `navigator.clipboard.writeText(command)` with success toast
- `MessageAcpToolCall.tsx`: same component for consistency (though this component is not currently rendered due to message grouping)
- 6 locale files: `messages.copyCommand` key
- Infrastructure preserved: `terminalUtils.ts` + `shellBridge.openInTerminal` kept for future agent skill

**Files**: `MessageToolGroupSummary.tsx`, `MessageAcpToolCall.tsx`, `ipcBridge.ts`, `shellBridge.ts`, `terminalUtils.ts`, 6 locale files

**Lisa key reviews**:
- Caught error detail discarded in catch block
- Caught TypeScript type mismatch (`React.MouseEvent` vs Arco's `Event`)

---

## 3. Key Discovery: Message Rendering Pipeline

During Step 5 manual testing, discovered that `MessageAcpToolCall.tsx` is **never rendered directly**. The actual rendering flow:

```
MessageList.tsx processedList memo
  → intercepts acp_tool_call messages
  → groups by conversation turn into tool_summary virtual messages
  → renders via MessageToolGroupSummary.tsx ("View Steps" collapsible panel)
```

This is why the button initially added to `MessageAcpToolCall.tsx` was invisible. Moved to `MessageToolGroupSummary.tsx`.

---

## 4. Architecture Document

Created `docs/architecture.md` — comprehensive functional architecture reference:

| Section | Content |
|---------|---------|
| System Architecture | Electron multi-process model |
| Functional Layers | UI → Presentation → Engine → Capability → Platform |
| Module ↔ Code | 8 subsystem tables with key file paths |
| Data Flow | Conversation lifecycle diagram |
| IPC Bridge Map | All 12 bridge domains |
| Agent Backend | BaseAgentManager inheritance tree |
| Skills Injection | Gemini (full body) vs ACP (index + on-demand) |
| Plugin Platform | Telegram/Lark → Agent → Reply flow |
| Concept Summary | Plugin/Assistant/Agent/Rules/Skills/MCP taxonomy |

**Lisa review**: Caught 4 IPC API name mismatches (channel API, googleAuth domain, approval.check, bridge file count). All corrected.

---

## 5. Test Results

| Metric | Value |
|--------|-------|
| Total tests | 75 (34 new + 41 existing) |
| Failed | 0 |
| Suites | 4 |
| TypeScript | 0 errors (`tsc --noEmit`) |
| ESLint | 0 errors (pre-commit hook) |
| Manual test | Copy Command button visible and functional |

New test file: `tests/unit/test_terminal_utils.ts` — 34 tests covering:
- `escapeAppleScript`: backslashes, double quotes, newlines, unicode
- `escapeWindowsCmd`: metacharacters, double quotes, pipes
- `escapeBashSingleQuote`: single quotes, spaces, metacharacters
- `buildTerminalCommand`: all 3 platforms, cwd handling, unsupported platform error, edge cases

---

## 6. Files Changed (23 total)

### New Files (2)
| File | Purpose |
|------|---------|
| `src/common/terminalUtils.ts` | Cross-platform terminal command builder (pure functions) |
| `tests/unit/test_terminal_utils.ts` | 34 unit tests for terminal utils |

### Modified Files (21)
| File | Changes |
|------|---------|
| `src/agent/acp/AcpConnection.ts` | tree-kill, stderr buffer, startup error paths |
| `src/agent/acp/AcpAdapter.ts` | tool_call merge, conditional status update |
| `src/agent/acp/index.ts` | stderr in disconnect error message |
| `src/agent/codex/connection/CodexConnection.ts` | tree-kill |
| `src/process/task/AcpAgentManager.ts` | kill() override for tree termination |
| `src/common/ipcBridge.ts` | shell.openInTerminal provider |
| `src/process/bridge/shellBridge.ts` | openInTerminal implementation (temp script approach) |
| `src/types/acpTypes.ts` | ToolCallUpdateStatus: optional status, rawOutput, _meta |
| `src/renderer/messages/hooks.ts` | composeMessageWithIndex index fix |
| `src/renderer/messages/MessageToolGroupSummary.tsx` | CopyCommandButton, ToolAcpMapper command field |
| `src/renderer/messages/acp/MessageAcpToolCall.tsx` | CopyCommandButton (consistency) |
| `src/renderer/pages/conversation/acp/AcpSendBox.tsx` | Connection phase ThoughtDisplay |
| `src/renderer/i18n/locales/en-US.json` | copyCommand key |
| `src/renderer/i18n/locales/zh-CN.json` | copyCommand key |
| `src/renderer/i18n/locales/zh-TW.json` | copyCommand key |
| `src/renderer/i18n/locales/ja-JP.json` | copyCommand key |
| `src/renderer/i18n/locales/ko-KR.json` | copyCommand key |
| `src/renderer/i18n/locales/tr-TR.json` | copyCommand key |
| `CLAUDE.md` | ACP Pipeline docs, Turkish locale |
| `package.json` | tree-kill dependency |
| `package-lock.json` | lock file update |

---

## 7. Ralph-Lisa Collaboration Stats

| Metric | Value | Note |
|--------|-------|------|
| Total entries | 68+ | Snapshot-dependent; grows with each submission. Count as of Round 12: Ralph 35 + Lisa 33 |
| Lisa PASS | 22 | |
| Lisa NEEDS_WORK | 10 | |
| Lisa CONSENSUS | 1 | |
| Ralph CONSENSUS | 9 | |
| Steps completed | 5 + architecture doc | |

### Lisa's High-Value Catches

| Round | Issue | Impact |
|-------|-------|--------|
| Step 1 R1 | Force-kill path bypasses tree-kill | Would leave orphan processes on WorkerManage.kill() |
| Step 2 R1-2 | "Protocol doesn't support streaming" overclaimed | Led to proper runtime trace investigation |
| Step 4 R1 | Missing startup-failure stderr paths | 2 of 3 startup error paths had no stderr |
| Step 4 R3 | spawnError + dead-process still missing stderr | Caught remaining 2 edge cases |
| Step 5 R3 | Error detail discarded in catch | Users couldn't diagnose terminal launch failures |
| Step 5 R6 | TypeScript type mismatch (React.MouseEvent vs Event) | Would fail tsc build |
| Arch R9 | 4 IPC API name mismatches in docs | Would mislead implementers |

---

## 8. Known Limitations & Future Work

| Item | Status | Notes |
|------|--------|-------|
| ACP execute output streaming | Not feasible now | Backend sends batch output only, no incremental updates. Protocol allows it but backends don't emit it |
| Terminal interception (pre-execution) | Future agent skill | The real need: intercept commands before ACP runs them, let user choose to run in terminal instead |
| Force-kill tree termination test | No regression test | OS-level process management difficult to unit test |
| composeMessageWithIndex edge case | Low risk | Empty list + same-flush follow-up (Lisa non-blocking note) |
| Copy Command port conflict warning | Not implemented | User may copy and run a command that conflicts with still-running ACP process |
