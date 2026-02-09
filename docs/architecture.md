# Margay Functional Architecture

## Overview

Margay is a multi-process Electron desktop application that provides a unified chat interface for multiple AI agent backends. It supports plugin-based platform integration, reusable skill modules, and standardized tool sharing via MCP.

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Electron Shell                                  │
│                                                                              │
│  ┌─────────────────────┐   IPC Bridge    ┌──────────────────────────────┐   │
│  │   Renderer Process  │ ◄═════════════► │       Main Process           │   │
│  │   (React UI)        │  contextBridge  │   (Node.js + Electron)       │   │
│  └─────────────────────┘                 └──────────┬───────────────────┘   │
│                                                      │                       │
│                                            ┌─────────┼─────────┐            │
│                                            ▼         ▼         ▼            │
│                                     ┌──────────┐ ┌───────┐ ┌────────┐      │
│                                     │ Worker   │ │  Web  │ │Channel │      │
│                                     │ Process  │ │Server │ │Manager │      │
│                                     │(fork)    │ │(Express│ │(Plugin)│      │
│                                     └──────────┘ └───────┘ └────────┘      │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Functional Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE LAYER                             │
│                                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │
│  │ Chat     │ │ Settings │ │ Cron     │ │ Preview  │ │ New Chat    │ │
│  │ Window   │ │ Page     │ │ Tasks    │ │ Panel    │ │ Guide       │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘ │
├───────┼─────────────┼────────────┼────────────┼──────────────┼────────┤
│       ▼             ▼            ▼            ▼              ▼        │
│                     PRESENTATION LAYER                                 │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Assistant Presets                                                │  │
│  │ "Cowork" "PPTX Generator" "UI/UX Pro" "Beautiful Mermaid" ...   │  │
│  │                                                                  │  │
│  │ Each = Agent Type + Rules (markdown) + Enabled Skills            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                       AGENT ENGINE LAYER                                │
│                                                                         │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────────┐  │
│  │ Gemini Engine   │ │  ACP Engine     │ │  Codex Engine           │  │
│  │                 │ │                 │ │                         │  │
│  │ Direct API call │ │ CLI subprocess  │ │ OpenAI Codex API        │  │
│  │ Google Gemini   │ │ 14 backends:    │ │                         │  │
│  │                 │ │ claude, qwen,   │ │                         │  │
│  │                 │ │ goose, kimi,    │ │                         │  │
│  │                 │ │ opencode ...    │ │                         │  │
│  └────────┬────────┘ └────────┬────────┘ └────────────┬────────────┘  │
├───────────┼────────────────────┼──────────────────────┼────────────────┤
│           ▼                    ▼                      ▼                │
│                    CAPABILITY LAYER                                     │
│                                                                         │
│  ┌────────────────────────┐  ┌─────────────────────────────────────┐  │
│  │ Skills (技能模块)       │  │ MCP (工具协议)                      │  │
│  │                        │  │                                     │  │
│  │ Reusable knowledge     │  │ Standardized tool sharing           │  │
│  │ injected as prompts    │  │ across agent backends               │  │
│  │                        │  │                                     │  │
│  │ pptx, pdf, docx, xlsx  │  │ File ops, Web search,              │  │
│  │ cron, mermaid,         │  │ OAuth, Custom servers               │  │
│  │ skill-creator ...      │  │                                     │  │
│  └────────────────────────┘  └─────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                      PLATFORM LAYER                                     │
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │  Desktop     │ │  WebUI       │ │  Telegram    │ │  Lark        │ │
│  │  (Electron)  │ │  (Express+WS)│ │  Bot Plugin  │ │  Bot Plugin  │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Module ↔ Code Mapping

### 3.1 Main Process (Node.js)

| Module | Function | Key Files |
|--------|----------|-----------|
| **App Bootstrap** | Electron init, window creation | `src/index.ts` |
| **IPC Bridge** | Renderer ↔ Main communication | `src/process/bridge/index.ts` + 21 bridge files |
| **Database** | SQLite persistence | `src/process/database/index.ts`, `schema.ts`, `migrations.ts` |
| **Init** | Storage, agents, rules setup | `src/process/initStorage.ts`, `src/process/initAgent.ts` |
| **Worker Manager** | Fork child processes for agents | `src/worker/index.ts`, `src/worker/fork/ForkTask.ts` |

### 3.2 Agent Engine

| Module | Function | Key Files |
|--------|----------|-----------|
| **Base Manager** | Abstract agent lifecycle | `src/process/task/BaseAgentManager.ts` |
| **Gemini** | Google Gemini API integration | `src/process/task/GeminiAgentManager.ts` |
| **ACP** | CLI-based agents (Claude, Qwen...) | `src/process/task/AcpAgentManager.ts` |
| **Codex** | OpenAI Codex integration | `src/process/task/CodexAgentManager.ts` |
| **ACP Connection** | Child process + JSON-RPC | `src/agent/acp/AcpConnection.ts` |
| **ACP Adapter** | Message transform + merge | `src/agent/acp/AcpAdapter.ts` |
| **ACP Agent** | Session lifecycle, events | `src/agent/acp/index.ts` |
| **Codex Connection** | Codex CLI process | `src/agent/codex/connection/CodexConnection.ts` |
| **Worker: ACP** | Forked process for ACP | `src/worker/acp.ts` |
| **Worker: Gemini** | Forked process for Gemini | `src/worker/gemini.ts` |
| **Worker: Codex** | Forked process for Codex | `src/worker/codex.ts` |

### 3.3 Assistant & Skills

| Module | Function | Key Files |
|--------|----------|-----------|
| **Preset Definitions** | 10 built-in assistants | `src/common/presets/assistantPresets.ts` |
| **Skill Manager** | Discover, load, cache skills | `src/process/task/AcpSkillManager.ts` |
| **Agent Utils** | Skill injection, first message prep | `src/process/task/agentUtils.ts` |
| **Rule Files** | Assistant behavior rules (md) | `assistant/{preset}/*.md` |
| **Skill Files** | Skill definitions (md) | `skills/_builtin/{name}/SKILL.md`, `skills/{name}/SKILL.md` |
| **Runtime Config** | User overrides | `~/.aionui-config/assistants/`, `~/.aionui-config/skills/` |
| **Settings UI** | Manage assistants & skills | `src/renderer/pages/settings/AssistantManagement.tsx` |
| **FS Bridge** | Read/write rules & skills | `src/process/bridge/fsBridge.ts` |

### 3.4 MCP (Model Context Protocol)

| Module | Function | Key Files |
|--------|----------|-----------|
| **MCP Service** | Orchestrator | `src/process/services/mcpServices/McpService.ts` |
| **MCP Protocol** | Interface definition | `src/process/services/mcpServices/McpProtocol.ts` |
| **Claude MCP** | Claude backend MCP | `src/process/services/mcpServices/agents/ClaudeMcpAgent.ts` |
| **Gemini MCP** | Gemini backend MCP | `src/process/services/mcpServices/agents/GeminiMcpAgent.ts` |
| **Qwen MCP** | Qwen backend MCP | `src/process/services/mcpServices/agents/QwenMcpAgent.ts` |
| **OAuth** | MCP server auth | `src/process/services/mcpServices/McpOAuthService.ts` |
| **MCP Bridge** | IPC for MCP operations | `src/process/bridge/mcpBridge.ts` |

### 3.5 Channel & Plugin

| Module | Function | Key Files |
|--------|----------|-----------|
| **Channel Manager** | Plugin orchestrator (singleton) | `src/channels/core/ChannelManager.ts` |
| **Session Manager** | User session lifecycle | `src/channels/core/SessionManager.ts` |
| **Plugin Manager** | Plugin lifecycle & registry | `src/channels/gateway/PluginManager.ts` |
| **Action Executor** | Message → action routing | `src/channels/gateway/ActionExecutor.ts` |
| **Base Plugin** | Abstract plugin class | `src/channels/plugins/BasePlugin.ts` |
| **Telegram** | Telegram bot adapter | `src/channels/plugins/telegram/TelegramPlugin.ts` |
| **Lark** | Lark/Feishu bot adapter | `src/channels/plugins/lark/LarkPlugin.ts` |
| **Pairing** | Desktop ↔ bot user binding | `src/channels/pairing/PairingService.ts` |
| **Message Service** | Agent ↔ plugin message relay | `src/channels/agent/ChannelMessageService.ts` |
| **Channel Bridge** | IPC for channel operations | `src/process/bridge/channelBridge.ts` |

### 3.6 Renderer (React UI)

| Module | Function | Key Files |
|--------|----------|-----------|
| **App Entry** | React root, router | `src/renderer/main.tsx`, `router.tsx`, `layout.tsx` |
| **Chat Page** | Main conversation UI | `src/renderer/pages/conversation/index.tsx` |
| **Chat: ACP** | ACP sendbox & messages | `src/renderer/pages/conversation/acp/AcpSendBox.tsx` |
| **Chat: Gemini** | Gemini sendbox | `src/renderer/pages/conversation/gemini/GeminiSendBox.tsx` |
| **Chat: Codex** | Codex sendbox | `src/renderer/pages/conversation/codex/CodexSendBox.tsx` |
| **Message List** | Message routing & grouping | `src/renderer/messages/MessageList.tsx` |
| **Tool Group** | "View Steps" panel | `src/renderer/messages/MessageToolGroupSummary.tsx` |
| **ACP Tool Call** | Tool call card (unused) | `src/renderer/messages/acp/MessageAcpToolCall.tsx` |
| **Message Hooks** | Message state & merging | `src/renderer/messages/hooks.ts` |
| **Preview** | File preview panel | `src/renderer/pages/conversation/preview/` |
| **Settings** | Settings pages | `src/renderer/pages/settings/` |
| **Cron** | Scheduled tasks UI | `src/renderer/pages/cron/` |
| **New Chat Guide** | Assistant selection | `src/renderer/pages/guid/index.tsx` |
| **Markdown** | Markdown renderer | `src/renderer/components/Markdown.tsx` |
| **ThoughtDisplay** | Agent thinking indicator | `src/renderer/components/ThoughtDisplay.tsx` |
| **i18n** | 6 locales | `src/renderer/i18n/locales/{locale}.json` |

### 3.7 WebUI (Remote Access)

| Module | Function | Key Files |
|--------|----------|-----------|
| **Server** | Express + WebSocket | `src/webserver/index.ts`, `setup.ts` |
| **Auth** | JWT authentication | `src/webserver/auth/` |
| **Routes** | HTTP API endpoints | `src/webserver/routes/` |
| **WebSocket** | Real-time messaging | `src/webserver/websocket/` |
| **WebUI Bridge** | IPC for web server | `src/process/bridge/webuiBridge.ts` |

### 3.8 Shared / Common

| Module | Function | Key Files |
|--------|----------|-----------|
| **IPC Definitions** | All IPC channel types | `src/common/ipcBridge.ts` |
| **Chat Types** | Message types & interfaces | `src/common/chatLib.ts` |
| **Storage Types** | Conversation & config types | `src/common/storage.ts` |
| **ACP Types** | Backend configs, protocol types | `src/types/acpTypes.ts` |
| **Terminal Utils** | Cross-platform terminal cmds | `src/common/terminalUtils.ts` |
| **API Key Manager** | Rotate API keys | `src/common/ApiKeyManager.ts` |
| **Update System** | Auto-update types | `src/common/update/`, `src/common/updateTypes.ts` |

---

## 4. Data Flow: Conversation Lifecycle

```
User selects Assistant          FS reads rules & skills
        │                              │
        ▼                              ▼
┌─────────────────┐          ┌──────────────────┐
│ guid/index.tsx  │ ───────► │ fsBridge.ts      │
│ (New Chat UI)   │          │ readAssistantRule │
└────────┬────────┘          │ loadSkillsContent │
         │                   └──────────────────┘
         ▼
┌─────────────────┐     IPC      ┌──────────────────────┐
│ conversation    │ ═══════════► │ conversationBridge.ts │
│ .create.invoke  │              │ create conversation   │
└────────┬────────┘              └──────────┬───────────┘
         │                                  │
         │                                  ▼
         │                       ┌──────────────────────┐
         │                       │ AgentManager          │
         │                       │ (Gemini/ACP/Codex)    │
         │                       │                       │
         │                       │ 1. Inject rules       │
         │                       │ 2. Inject skills      │
         │                       │ 3. Start worker       │
         │                       └──────────┬───────────┘
         │                                  │ fork
         │                                  ▼
         │                       ┌──────────────────────┐
         │                       │ Worker Process        │
         │                       │ (acp.ts/gemini.ts)    │
         │                       │                       │
         │                       │ Agent ↔ AI Backend    │
         │                       └──────────┬───────────┘
         │                                  │ stream
         ▼                                  ▼
┌─────────────────┐     IPC      ┌──────────────────────┐
│ AcpSendBox.tsx  │ ◄═══════════ │ responseStream       │
│ hooks.ts        │              │ (messages emitter)    │
│ MessageList.tsx │              └──────────────────────┘
└─────────────────┘
```

---

## 5. IPC Bridge Map

```
src/common/ipcBridge.ts (Type Definitions)
        │
        ├── shell.*              ◄── shellBridge.ts
        │   ├── openFile
        │   ├── showItemInFolder
        │   ├── openExternal
        │   └── openInTerminal
        │
        ├── conversation.*       ◄── conversationBridge.ts
        │   ├── create / get / update / remove
        │   ├── sendMessage / stop
        │   ├── responseStream (emitter)
        │   ├── confirmMessage
        │   ├── confirmation.* (add/update/confirm/list/remove)
        │   └── approval.check
        │
        ├── fs.*                 ◄── fsBridge.ts
        │   ├── readAssistantRule / writeAssistantRule
        │   ├── listAvailableSkills / importSkill
        │   └── scanForSkills / detectCommonSkillPaths
        │
        ├── mcpService.*         ◄── mcpBridge.ts
        │   ├── getAgentMcpConfigs
        │   ├── syncMcpToAgents / removeMcpFromAgents
        │   └── mcpOAuth.* (login/check/callback)
        │
        ├── channel.*            ◄── channelBridge.ts
        │   ├── getPluginStatus / enablePlugin / disablePlugin / testPlugin
        │   ├── getPendingPairings / approvePairing / rejectPairing
        │   ├── getAuthorizedUsers / revokeUser / getActiveSessions
        │   └── pairingRequested / pluginStatusChanged / userAuthorized (emitters)
        │
        ├── database.*           ◄── databaseBridge.ts
        ├── dialog.*             ◄── dialogBridge.ts
        ├── application.*        ◄── applicationBridge.ts
        ├── model.*              ◄── modelBridge.ts
        ├── cron.*               ◄── cronBridge.ts
        ├── googleAuth.*         ◄── authBridge.ts
        │   ├── login / logout / status
        ├── webui.*              ◄── webuiBridge.ts
        └── windowControls.*     ◄── windowControlsBridge.ts
```

---

## 6. Agent Backend Architecture

```
                    ┌─────────────────────────┐
                    │   BaseAgentManager       │
                    │   (abstract)             │
                    └─────────┬───────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │   Gemini     │ │    ACP       │ │   Codex      │
   │   Manager    │ │   Manager    │ │   Manager    │
   └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
          │                │                 │
          ▼                ▼                 ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │ Google       │ │ AcpAgent     │ │ Codex        │
   │ Gemini API   │ │              │ │ Connection   │
   │              │ │ AcpConnection│ │              │
   │              │ │ (spawn CLI)  │ │              │
   │              │ │              │ │              │
   │              │ │ AcpAdapter   │ │              │
   │              │ │ (msg xform)  │ │              │
   └──────────────┘ └──────┬───────┘ └──────────────┘
                           │
           ┌───────────────┼────────────────┐
           ▼               ▼                ▼
    ┌────────────┐  ┌────────────┐   ┌────────────┐
    │ claude CLI │  │ qwen CLI   │   │ goose CLI  │  ... 14 backends
    └────────────┘  └────────────┘   └────────────┘
```

---

## 7. Skills Injection Flow

```
                    Assistant Preset
                    enabledSkills: ["pptx", "pdf", "cron"]
                            │
                            ▼
                  ┌─────────────────────┐
                  │  AcpSkillManager    │
                  │                     │
                  │  1. Scan _builtin/  │    skills/_builtin/cron/SKILL.md
                  │  2. Scan skills/    │    skills/pptx/SKILL.md
                  │  3. Build index     │    skills/pdf/SKILL.md
                  └─────────┬───────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
     ┌─────────────────┐        ┌─────────────────┐
     │  Gemini Agent   │        │   ACP Agent     │
     │                 │        │                 │
     │ Full skill body │        │ Skills INDEX    │
     │ in system       │        │ in 1st message  │
     │ instructions    │        │                 │
     └─────────────────┘        │ Agent requests: │
                                │ [LOAD_SKILL: x] │
                                │       │         │
                                │       ▼         │
                                │ Full body via   │
                                │ Read file tool  │
                                └─────────────────┘
```

---

## 8. Plugin Platform Flow

```
  Telegram User                           Desktop User
       │                                       │
       ▼                                       ▼
┌──────────────┐                     ┌──────────────────┐
│ TelegramBot  │                     │  Pairing Code    │
│ receives msg │                     │  generated in UI │
└──────┬───────┘                     └────────┬─────────┘
       │                                      │
       ▼                                      ▼
┌──────────────┐     Pair Code        ┌──────────────────┐
│ Telegram     │ ◄══════════════════► │ PairingService   │
│ Plugin       │     validates        └──────────────────┘
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Plugin       │
│ Manager      │
└──────┬───────┘
       │
       ▼
┌──────────────┐      ┌───────────────┐      ┌──────────────┐
│ Action       │ ───► │ Channel       │ ───► │ Agent        │
│ Executor     │      │ MessageSvc    │      │ Manager      │
└──────────────┘      └───────────────┘      └──────┬───────┘
                                                     │
                                                     ▼
                                              ┌──────────────┐
                                              │ AI Response  │
                                              └──────┬───────┘
                                                     │
                                                     ▼
                                              ┌──────────────┐
                                              │ Telegram Bot │
                                              │ sends reply  │
                                              └──────────────┘
```

---

## 9. Concept Relationship Summary

```
Plugin ──uses──► Agent ──powered by──► AI Backend (Gemini API / CLI)
                  │                          │
                  │                          │
              configured by             enhanced by
                  │                          │
                  ▼                          ▼
              Assistant                 MCP Servers
              (preset)                  (shared tools)
                  │
                  │
            bundles
                  │
              ┌───┴───┐
              ▼       ▼
           Rules    Skills
          (行为)    (能力)
```

| Concept | Layer | What it is | Analogy |
|---------|-------|------------|---------|
| **Plugin** | Platform | Chat platform connector | "门" (入口) |
| **Assistant** | Presentation | Role profile with config | "角色皮肤" |
| **Agent** | Engine | AI backend runtime | "引擎" |
| **Rules** | Knowledge | Behavior instructions | "剧本" |
| **Skills** | Knowledge | Reusable tool modules | "工具箱" |
| **MCP** | Protocol | Standardized tool sharing | "工具插座" |
