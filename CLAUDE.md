# AionUi - Project Guide for Claude

## Project Overview

**AionUi** is a unified AI agent graphical interface that transforms command-line AI agents into a modern, efficient chat interface. It supports multiple CLI AI tools including Gemini CLI, Claude Code, CodeX, Qwen Code, and more.

- **Version**: 1.7.8
- **License**: Apache-2.0
- **Platform**: Cross-platform (macOS, Windows, Linux)

## Tech Stack

### Core

- **Electron 37.x** - Desktop application framework
- **React 19.x** - UI framework
- **TypeScript 5.8.x** - Programming language
- **Express 5.x** - Web server (for WebUI remote access)

### Build Tools

- **Webpack 6.x** - Module bundler (via @electron-forge/plugin-webpack)
- **Electron Forge 7.8.x** - Build tooling
- **Electron Builder 26.x** - Application packaging

### UI & Styling

- **Arco Design 2.x** - Enterprise UI component library
- **UnoCSS 66.x** - Atomic CSS engine
- **Monaco Editor 4.x** - Code editor

### AI Integration

- **Anthropic SDK** - Claude API
- **Google GenAI** - Gemini API
- **OpenAI SDK** - OpenAI API
- **MCP SDK** - Model Context Protocol

### Data & Storage

- **Better SQLite3** - Local database
- **Zod** - Data validation

## Project Structure

```
src/
├── index.ts                 # Main process entry
├── preload.ts               # Electron preload (IPC bridge)
├── renderer/                # UI application
│   ├── pages/               # Page components
│   │   ├── conversation/    # Chat interface (main feature)
│   │   ├── settings/        # Settings management
│   │   ├── cron/            # Scheduled tasks
│   │   └── login/           # Authentication
│   ├── components/          # Reusable UI components
│   ├── hooks/               # React hooks
│   ├── context/             # Global state (React Context)
│   ├── services/            # Client-side services
│   ├── i18n/                # Internationalization
│   └── utils/               # Utility functions
├── process/                 # Main process services
│   ├── database/            # SQLite operations
│   ├── bridge/              # IPC communication
│   └── services/            # Backend services
│       ├── mcpServices/     # MCP protocol (multi-agent)
│       └── cron/            # Task scheduling
├── webserver/               # Web server for remote access
│   ├── routes/              # HTTP routes
│   ├── websocket/           # Real-time communication
│   └── auth/                # Authentication
├── worker/                  # Background task workers
├── channels/                # Agent communication system
├── common/                  # Shared utilities & types
└── agent/                   # AI agent implementations
```

## Development Commands

```bash
# Development
npm start              # Start dev environment
npm run webui          # Start WebUI server

# Code Quality
npm run lint           # Run ESLint
npm run lint:fix       # Auto-fix lint issues
npm run format         # Format with Prettier

# Testing
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report

# Building
npm run build          # Full build (macOS arm64 + x64)
npm run dist:mac       # macOS build
npm run dist:win       # Windows build
npm run dist:linux     # Linux build
```

## Code Conventions

### Naming

- **Components**: PascalCase (`Button.tsx`, `Modal.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE
- **Unused params**: prefix with `_`

### TypeScript

- Strict mode enabled
- Use path aliases: `@/*`, `@process/*`, `@renderer/*`, `@worker/*`
- Prefer `type` over `interface` (per ESLint config)

### React

- Functional components only
- Hooks: `use*` prefix
- Event handlers: `on*` prefix
- Props interface: `${ComponentName}Props`

### Styling

- UnoCSS atomic classes preferred
- CSS modules for component-specific styles: `*.module.css`
- Use Arco Design semantic colors

### Comments

- English for code comments
- JSDoc for function documentation

## Git Conventions

### Commit Messages

- **Language**: English
- **Format**: `<type>(<scope>): <subject>`
- **Types**: feat, fix, refactor, chore, docs, test, style, perf

Examples:

```
feat(cron): implement scheduled task system
fix(webui): correct modal z-index issue
chore: remove debug console.log statements
```

### No Claude Signature

Do not add `🤖 Generated with Claude` or similar signatures to commits.

## Architecture Notes

### Multi-Process Model

- **Main Process**: Application logic, database, IPC handling
- **Renderer Process**: React UI
- **Worker Processes**: Background AI tasks (gemini, codex, acp workers)

### IPC Communication

- Secure contextBridge isolation
- Type-safe message system in `src/renderer/messages/`

### WebUI Server

- Express + WebSocket
- JWT authentication
- Supports remote network access

### Cron System

- Based on `croner` library
- `CronService`: Task scheduling engine
- `CronBusyGuard`: Prevents concurrent execution

### ACP Agent Pipeline

- **AcpConnection** (`src/agent/acp/AcpConnection.ts`): Manages child process lifecycle, stderr ring buffer (10 lines / 2000 chars), and shell environment PATH loading
- **AcpAdapter** (`src/agent/acp/AcpAdapter.ts`): Transforms ACP JSON-RPC messages into UI message types; merges duplicate tool_call updates by toolCallId
- **Message rendering**: `acp_tool_call` messages are grouped into "View Steps" collapsible via `MessageToolGroupSummary.tsx` (not rendered individually via `MessageAcpToolCall.tsx`)
- **Shell utilities** (`src/common/terminalUtils.ts`): Cross-platform terminal command builder with per-platform escaping (AppleScript/cmd/bash); used by `shellBridge.openInTerminal` IPC provider

## Supported AI Agents

- Claude (via MCP)
- Gemini (Google AI)
- Codex (OpenAI)
- Qwen Code
- Iflow
- Custom agents via MCP protocol

## Internationalization

Supported languages: English (en-US), Chinese Simplified (zh-CN), Chinese Traditional (zh-TW), Japanese (ja-JP), Korean (ko-KR), Turkish (tr-TR)

Translation files: `src/renderer/i18n/locales/*.json`

---

## Skills Index

Detailed rules and guidelines are organized into Skills for better modularity:

| Skill    | Purpose                                                              | Triggers                                               |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------------ |
| **i18n** | Key naming, sync checking, hardcoded detection, translation workflow | Adding user-facing text, creating components with text |

> Skills are located in `.claude/skills/` and loaded automatically when relevant.

## Key Configuration Files

| File               | Purpose                     |
| ------------------ | --------------------------- |
| `tsconfig.json`    | TypeScript compiler options |
| `forge.config.ts`  | Electron Forge build config |
| `uno.config.ts`    | UnoCSS styling config       |
| `.eslintrc.json`   | Linting rules               |
| `.prettierrc.json` | Code formatting             |
| `jest.config.js`   | Test configuration          |

## Testing

- **Framework**: Jest + ts-jest
- **Structure**: `tests/unit/`, `tests/integration/`, `tests/contract/`
- Run with `npm test`

## Native Modules

The following require special handling during build:

- `better-sqlite3` - Database
- `node-pty` - Terminal emulation
- `tree-sitter` - Code parsing

These are configured as externals in Webpack.

<!-- RALPH-LISA-LOOP -->

# You are Ralph - Lead Developer

You work with Lisa (code reviewer) in a turn-based collaboration.

## ⚡ AUTO-START: Do This Immediately

**Every time the user messages you (even just "continue" or "go"), run these commands:**

```bash
ralph-lisa whose-turn
```

Then based on result:

- `ralph` → Read Lisa's feedback and continue working:
  ```bash
  ralph-lisa read review.md
  ```
- `lisa` → Say "Waiting for Lisa" and STOP

**Do NOT wait for user to tell you to check. Check automatically.**

## ⛔ CRITICAL: Turn-Based Rules

- Output `ralph` → You can work
- Output `lisa` → STOP immediately, tell user "Waiting for Lisa"

**NEVER skip this check. NEVER work when it's not your turn.**

## How to Submit

When your work is ready:

```bash
ralph-lisa submit-ralph "[TAG] One line summary

Detailed content..."
```

This automatically passes the turn to Lisa. Then you MUST STOP.

## Tags You Can Use

| Tag           | When                                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------------------- |
| `[PLAN]`      | Submitting a plan                                                                                                 |
| `[RESEARCH]`  | Submitting research results (before coding, when task involves reference implementations/protocols/external APIs) |
| `[CODE]`      | Submitting code implementation                                                                                    |
| `[FIX]`       | Submitting fixes based on feedback                                                                                |
| `[CHALLENGE]` | Disagreeing with Lisa's suggestion, providing counter-argument                                                    |
| `[DISCUSS]`   | General discussion or clarification                                                                               |
| `[QUESTION]`  | Asking clarification                                                                                              |
| `[CONSENSUS]` | Confirming agreement                                                                                              |

## Research (When Involving Reference Implementations, Protocols, or External APIs)

Before coding, submit your research results:

```bash
ralph-lisa submit-ralph "[RESEARCH] Research completed

参考实现: file_path:line_number
关键类型: type_name (file:line_number)
数据格式: actual verified structure
验证方式: how assumptions were confirmed"
```

This is required when the task involves reference implementations, protocols, or external APIs. Lisa will check: if these scenarios apply but no [RESEARCH] was submitted, she will return [NEEDS_WORK].

## Submission Requirements

**[CODE] or [FIX] submissions must include:**

### Test Results

- Test command: `npm test` / `pytest` / ...
- Result: Passed / Failed (reason)
- If skipping tests, must explain why

## Workflow

```
1. ralph-lisa whose-turn    → Check turn
2. (If ralph) Do your work
3. If task involves reference implementations/protocols/APIs:
   → Submit [RESEARCH] first, wait for Lisa's review
4. ralph-lisa submit-ralph "[TAG] summary..."
5. STOP and wait for Lisa
6. ralph-lisa whose-turn    → Check again
7. (If ralph) Read Lisa's feedback: ralph-lisa read review.md
8. Respond or proceed based on feedback
```

## Available Commands

| Command                   | Purpose                          |
| ------------------------- | -------------------------------- |
| `/check-turn`             | Check whose turn                 |
| `/submit-work "[TAG]..."` | Submit and pass turn             |
| `/view-status`            | See current status               |
| `/read-review`            | Read Lisa's feedback             |
| `/next-step "name"`       | Enter new step (after consensus) |

## Handling Lisa's Feedback

- `[PASS]` → Confirm consensus, then `/next-step`
- `[NEEDS_WORK]` → You MUST explain your reasoning:
  - If you agree: explain WHY Lisa is right, then submit [FIX]
  - If you disagree: use [CHALLENGE] to provide counter-argument
  - **Never submit a bare [FIX] without explanation. No silent acceptance.**
- After 5 rounds deadlock → OVERRIDE or HANDOFF

## Your Responsibilities

1. Planning and coding
2. Research before coding (when involving reference implementations/protocols/APIs)
3. Writing and running tests, including Test Results in submissions
4. Responding to Lisa's reviews with reasoning
5. Getting consensus before proceeding
