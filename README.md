# Margay

**Unified AI Agent GUI** — Transform your command-line AI agents into a modern, efficient chat interface.

Margay brings together multiple CLI AI tools under one roof: a polished desktop app (and optional WebUI) that lets you switch between agents, manage skills, schedule tasks, and collaborate — all without leaving the interface.

<!-- [screenshot placeholder — add app screenshots here] -->

## Features

- **Multi-Agent Support** — Use Claude Code, Gemini CLI, Codex, Qwen, Goose, Kimi, and 10+ more agents from a single app
- **Skill System** — Extensible skill framework with unified distribution across all engines (Claude, Gemini, Codex)
- **MCP Tools** — Model Context Protocol integration for advanced tool use
- **WebUI Remote Access** — Access your agents from any browser via Express + WebSocket server
- **Scheduled Tasks** — Cron-based task automation with agent execution
- **Smart Assistants** — Pre-configured agent + skill + preset combinations for common workflows
- **Multi-Tab Workspace** — Multiple conversations with different agents in the same workspace
- **Preview Panel** — Real-time preview for 9+ file formats (PDF, Word, Excel, PPT, code, Markdown, images, HTML, Diff)
- **Internationalization** — English, Chinese (Simplified/Traditional), Japanese, Korean, Turkish

## Supported Agents

| Agent          | Protocol | Notes                                             |
| -------------- | -------- | ------------------------------------------------- |
| Claude Code    | ACP      | Full skill distribution support                   |
| Gemini CLI     | Embedded | Built-in with custom tools and multi-key rotation |
| Codex          | ACP      | OpenAI coding agent                               |
| Qwen Code      | ACP      | Alibaba coding agent                              |
| Goose          | ACP      | Block open-source agent                           |
| Kimi CLI       | ACP      | Moonshot AI agent                                 |
| OpenCode       | ACP      | Open-source coding agent                          |
| Augment Code   | ACP      | AI-powered dev tool                               |
| OpenClaw       | ACP      | Community agent                                   |
| Qoder CLI      | ACP      | Qodo coding agent                                 |
| GitHub Copilot | ACP      | GitHub AI assistant                               |
| Factory Droid  | ACP      | Factory AI agent                                  |
| iFlow CLI      | ACP      | iFlow agent                                       |
| Custom Agents  | ACP      | Bring your own CLI agent                          |

## Quick Start

### Prerequisites

- **Node.js 22+** (see `.nvmrc`)
- **Git**
- One or more supported AI agent CLIs installed (e.g., `claude`, `codex`); Gemini CLI is built-in and requires no separate installation

### Install and Run

```bash
git clone https://github.com/YW1975/Margay.git
cd Margay
nvm use 22
npm install
npm start
```

### WebUI Mode

```bash
npm run webui          # Local access
npm run webui:remote   # Remote network access
```

## Tech Stack

| Category  | Technologies                                       |
| --------- | -------------------------------------------------- |
| Framework | Electron 37, React 19, TypeScript 5.8              |
| Build     | Webpack 5, Electron Forge 7.8, Electron Builder 26 |
| UI        | Arco Design 2, UnoCSS 66, Monaco Editor 4          |
| AI SDKs   | Anthropic, Google GenAI, OpenAI, MCP SDK           |
| Data      | Better SQLite3, Zod                                |
| Server    | Express 5, WebSocket (for WebUI)                   |

## Development

```bash
npm run lint           # Run ESLint
npm run lint:fix       # Auto-fix lint issues
npm run format         # Format with Prettier
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

### Building

```bash
npm run dist:mac       # macOS (arm64 + x64)
npm run dist:win       # Windows
npm run dist:linux     # Linux (deb + AppImage)
```

## Project Structure

```
src/
├── index.ts              # Main process entry
├── preload.ts            # Electron preload (IPC bridge)
├── renderer/             # React UI application
│   ├── pages/            # Page components (conversation, settings, cron)
│   ├── components/       # Reusable UI components
│   ├── hooks/            # React hooks
│   ├── context/          # Global state (React Context)
│   └── i18n/             # Internationalization (6 locales)
├── process/              # Main process services
│   ├── database/         # SQLite operations
│   ├── bridge/           # IPC communication
│   └── services/         # Backend services (MCP, cron)
├── agent/                # AI agent implementations (ACP, Gemini)
├── channels/             # Agent communication system
├── webserver/            # Express + WebSocket server
├── worker/               # Background task workers
└── common/               # Shared utilities & types
```

## Acknowledgements

Margay is forked from [AionUi](https://github.com/iOfficeAI/AionUi) by iOfficeAI, licensed under Apache-2.0. We are grateful for the foundation they built.

## License

[Apache-2.0](LICENSE)

Copyright 2025 Margay (forked from AionUi, aionui.com)
