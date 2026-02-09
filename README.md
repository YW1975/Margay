# Margay

**Unified AI Agent GUI** — Transform your command-line AI agents into a modern, efficient chat interface.

Margay brings together multiple CLI AI tools under one roof: a polished desktop app (and optional WebUI) that lets you switch between agents, manage skills, schedule tasks, and collaborate — all without leaving the interface.

<!-- [screenshot placeholder — add app screenshots here] -->

## Features

- **Multi-Agent Support** — Use Claude Code, Gemini CLI, Codex, Qwen, Goose, Kimi, and 10+ more agents from a single app
- **Skill System** — Extensible skill framework with unified distribution across all engines (Claude, Gemini, Codex). Skills are reusable knowledge modules (documents, scripts, tools) that get injected into agent conversations to extend their capabilities
- **Smart Assistants** — 10 pre-configured assistant presets that bundle agent type + behavior rules + enabled skills for common workflows (Cowork, PPTX Generator, UI/UX Pro, Beautiful Mermaid, and more)
- **MCP Tools** — Model Context Protocol integration for standardized tool sharing across agent backends
- **WebUI Remote Access** — Access your agents from any browser via Express + WebSocket server, with JWT authentication and password management
- **Scheduled Tasks** — Cron-based task automation with agent execution and concurrency guard
- **Channel Plugins** — Extend Margay to Telegram and Lark/Feishu bots with pairing-based user binding
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
| Goose          | ACP      | Block's open-source agent                         |
| Kimi CLI       | ACP      | Moonshot AI agent                                 |
| OpenCode       | ACP      | Open-source coding agent                          |
| Augment Code   | ACP      | AI-powered dev tool                               |
| OpenClaw       | ACP      | Community agent                                   |
| Qoder CLI      | ACP      | Qodo coding agent                                 |
| GitHub Copilot | ACP      | GitHub AI assistant                               |
| Factory Droid  | ACP      | Factory AI agent                                  |
| iFlow CLI      | ACP      | iFlow agent                                       |
| Custom Agents  | ACP      | Bring your own CLI agent                          |

> **ACP** (Agent Communication Protocol) connects to CLI agents via JSON-RPC subprocess. **Embedded** means the engine runs directly within Margay with no external CLI required.

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

> **Native module issues?** If `npm install` fails on `better-sqlite3` or `node-pty`, see [Troubleshooting](#troubleshooting).

### WebUI Mode

Access Margay from any browser — no Electron window required.

```bash
npm run webui          # Local access (http://localhost:3000)
npm run webui:remote   # Remote network access (0.0.0.0)
```

For detailed WebUI setup across all platforms (Windows, macOS, Linux, Android/Termux), password reset, and environment variables, see [WEBUI_GUIDE.md](WEBUI_GUIDE.md).

## Skills & Assistants

Margay's extensibility is built on two concepts: **Skills** (reusable capability modules) and **Assistants** (pre-configured presets that bundle skills with agent behavior).

### Built-in Skills

| Skill            | Category   | Description                                                      |
| ---------------- | ---------- | ---------------------------------------------------------------- |
| **cron**         | System     | Scheduled task management with cron expressions                  |
| **shell-bg**     | System     | Smart background process detection for long-running services     |
| **pptx**         | Document   | PowerPoint creation/editing with HTML-to-PPTX conversion         |
| **docx**         | Document   | Word document creation, editing, and redlining workflows         |
| **pdf**          | Document   | PDF manipulation — extraction, merge/split, forms, OCR           |
| **xlsx**         | Document   | Excel spreadsheet processing                                     |
| **mermaid**      | Diagram    | Mermaid diagram rendering (SVG and ASCII output)                 |
| **moltbook**     | Social     | AI agent social network integration                              |
| **skill-creator**| Dev        | Create new custom skills                                         |

### Smart Assistants

| Assistant              | Description                                        |
| ---------------------- | -------------------------------------------------- |
| **Cowork**             | Autonomous task execution with full skill access    |
| **PPTX Generator**     | Specialized PowerPoint presentation creation       |
| **PDF to PPT**         | PDF to PowerPoint conversion workflow              |
| **Beautiful Mermaid**  | Diagram creation specialist with theme support     |
| **UI/UX Pro Max**      | Advanced UI/UX design assistance                   |
| **Planning with Files**| Manus-style file-based planning for complex tasks  |
| **Moltbook**           | Social network integration with heartbeat          |
| **Social Job Publisher**| Job posting automation across platforms            |
| **Game 3D**            | 3D game development assistant                      |
| **Human 3 Coach**      | Human coaching and mentoring                       |

### Custom Skills

You can create and import your own skills:

- **Project skills**: Place `SKILL.md` in `skills/<skill-name>/` within your project
- **User skills**: Store personal skills in `~/.aionui-config/skills/`
- **Skill format**: Each skill is a directory with a `SKILL.md` manifest and optional `scripts/`, `references/`, and `assets/` directories

## Architecture

Margay uses a multi-process Electron architecture:

```
┌──────────────────────────────────────────────────────────┐
│                     Electron Shell                        │
│                                                          │
│  Renderer Process        Main Process                    │
│  (React UI)    ◄═IPC═►  (Node.js + Electron)            │
│                              │                           │
│                    ┌─────────┼─────────┐                 │
│                    ▼         ▼         ▼                 │
│              Worker      WebServer   Channel             │
│              Process     (Express)   Manager             │
│              (fork)                  (Plugin)            │
└──────────────────────────────────────────────────────────┘
```

- **Main Process** — Application logic, SQLite database, IPC bridge (21 bridge modules)
- **Renderer Process** — React 19 UI with Arco Design components
- **Worker Processes** — Forked child processes running AI agent backends (ACP, Gemini, Codex)
- **WebServer** — Express 5 + WebSocket for remote browser access
- **Channel Manager** — Plugin system for Telegram/Lark bot integration

For the full architecture documentation with data flow diagrams, see [docs/architecture.md](docs/architecture.md).

## Tech Stack

| Category  | Technologies                                       |
| --------- | -------------------------------------------------- |
| Framework | Electron 37, React 19, TypeScript 5.8              |
| Build     | Webpack 6, Electron Forge 7.8, Electron Builder 26 |
| UI        | Arco Design 2, UnoCSS 66, Monaco Editor 4          |
| AI SDKs   | Anthropic, Google GenAI, OpenAI, MCP SDK           |
| Data      | Better SQLite3, Zod                                |
| Server    | Express 5, WebSocket (for WebUI)                   |

## Development

```bash
npm start              # Start dev environment
npm run lint           # Run ESLint
npm run lint:fix       # Auto-fix lint issues
npm run format         # Format with Prettier
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

### Building

```bash
npm run dist:mac       # macOS (arm64 + x64) → DMG
npm run dist:win       # Windows → EXE installer
npm run dist:linux     # Linux → deb + AppImage
```

For build script details and native module rebuild strategies, see [scripts/README.md](scripts/README.md).

### Environment Variables

| Variable               | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `AIONUI_PORT`          | Override WebUI listening port (default: 3000)    |
| `AIONUI_ALLOW_REMOTE`  | Allow remote access without `--remote` flag     |
| `AIONUI_HOST`          | Bind address (`0.0.0.0` for remote access)      |
| `MARGAY_DEV_PORT`      | Override dev server port                         |

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
│   ├── bridge/           # IPC communication (21 bridge modules)
│   └── services/         # Backend services (MCP, cron)
├── agent/                # AI agent implementations (ACP, Gemini, Codex)
├── channels/             # Plugin system (Telegram, Lark)
├── webserver/            # Express + WebSocket server
├── worker/               # Background task workers
└── common/               # Shared utilities & types
skills/                   # Skill modules (pptx, pdf, docx, mermaid, etc.)
assistant/                # Smart assistant presets and behavior rules
docs/                     # Architecture docs and development guides
scripts/                  # Build and packaging scripts
```

## Troubleshooting

### Native module build failures

If `npm install` fails with errors related to `better-sqlite3`, `node-pty`, or `tree-sitter`:

```bash
# Ensure you have build tools installed
# macOS:
xcode-select --install

# Ubuntu/Debian:
sudo apt install build-essential python3

# Windows:
npm install --global windows-build-tools
```

### WebUI connection issues

1. Check the console output for the actual port number (auto-increments if occupied)
2. For remote access, ensure `--remote` flag is passed or `AIONUI_ALLOW_REMOTE=true`
3. See [WEBUI_GUIDE.md](WEBUI_GUIDE.md) for firewall configuration per platform

### Password reset (WebUI)

```bash
npm run resetpass              # Reset admin password
npm run resetpass -- username  # Reset specific user
```

## Documentation

| Document                                            | Description                              |
| --------------------------------------------------- | ---------------------------------------- |
| [WEBUI_GUIDE.md](WEBUI_GUIDE.md)                   | WebUI setup for all platforms            |
| [docs/architecture.md](docs/architecture.md)        | Full architecture with diagrams          |
| [docs/skill-distribution-rfc.md](docs/skill-distribution-rfc.md) | Skill distribution design       |
| [scripts/README.md](scripts/README.md)              | Build scripts and native module handling |
| [.github/CICD_SETUP.md](.github/CICD_SETUP.md)     | CI/CD pipeline configuration             |

## Contributing

1. Fork the repository and create a feature branch
2. Follow the code style: `npm run lint` and `npm run format`
3. Write tests for new features: `npm test`
4. Use [conventional commits](https://www.conventionalcommits.org/): `feat(scope): description`

See [CODE_STYLE.md](CODE_STYLE.md) for detailed coding conventions.

## Acknowledgements

Margay is forked from [AionUi](https://github.com/iOfficeAI/AionUi) by iOfficeAI, licensed under Apache-2.0. We are grateful for the foundation they built.

## License

[Apache-2.0](LICENSE)

Copyright 2025 Margay (forked from AionUi, aionui.com)
