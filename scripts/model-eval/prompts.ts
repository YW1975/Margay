/**
 * Versioned prompt set for model evaluation.
 * v1.0 — 2026-02-14: T1-T10 (generic capabilities)
 * v2.0 — 2026-02-15: + M1-M10 (Margay-specific scenarios)
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface EvalPrompt {
  id: string;
  category:
    | 'basic'
    | 'reasoning'
    | 'code'
    | 'practical'
    | 'multilingual'
    | 'margay-scenario';
  /** Single-turn prompt (used for T1-T10 and most M prompts) */
  prompt: string;
  /** Multi-turn messages (used for M3; overrides `prompt` when present) */
  messages?: ChatMessage[];
  /** Expected content keywords for basic pass/fail check */
  expectKeywords?: string[];
  /** Max tokens to generate */
  maxTokens?: number;
}

export const EVAL_PROMPTS: EvalPrompt[] = [
  // =============================================
  // T1-T10: Generic Capabilities (v1.0)
  // =============================================

  // --- Basic Capabilities ---
  {
    id: 'T1-chinese',
    category: 'basic',
    prompt: '用一句话解释量子纠缠，要求小学生能理解。',
    expectKeywords: ['量子', '纠缠'],
  },
  {
    id: 'T2-english',
    category: 'basic',
    prompt: 'Explain the difference between TCP and UDP in exactly 3 bullet points.',
    expectKeywords: ['TCP', 'UDP'],
  },
  {
    id: 'T3-reasoning',
    category: 'reasoning',
    prompt:
      'A farmer has 17 sheep. All but 9 run away. How many sheep does the farmer have left? Explain your reasoning step by step.',
    expectKeywords: ['9'],
  },
  {
    id: 'T4-math',
    category: 'reasoning',
    prompt: 'What is the sum of the first 100 positive integers? Show your work.',
    expectKeywords: ['5050'],
  },
  {
    id: 'T5-code-gen',
    category: 'code',
    prompt:
      'Write a Python function that checks if a string is a valid palindrome, ignoring spaces and punctuation. Include type hints and a docstring.',
    expectKeywords: ['def', 'palindrome'],
  },
  {
    id: 'T6-code-debug',
    category: 'code',
    prompt: `Fix the bug in this JavaScript code and explain what was wrong:
\`\`\`javascript
function fibonacci(n) {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  return fibonacci(n) + fibonacci(n - 1);
}
\`\`\``,
    expectKeywords: ['fibonacci(n - 1)', 'fibonacci(n - 2)'],
  },
  // --- Practical Tasks ---
  {
    id: 'T7-report',
    category: 'practical',
    prompt:
      '请为一家 AI 初创公司撰写一份 2026 年 Q1 季度工作总结提纲，包含：团队成长、产品迭代、客户反馈、下季度计划四个部分。每部分 2-3 个要点。',
    expectKeywords: ['团队', '产品', '客户', '计划'],
  },
  {
    id: 'T8-data-analysis',
    category: 'practical',
    prompt: `Given this CSV data, identify the top 3 products by revenue and calculate the total revenue:
Product,Units,Price
Widget A,150,29.99
Widget B,89,49.99
Widget C,210,19.99
Widget D,45,99.99
Widget E,178,14.99

Provide your answer as a markdown table.`,
    expectKeywords: ['Widget'],
  },
  {
    id: 'T9-instruction-following',
    category: 'practical',
    prompt:
      'List exactly 5 countries in Asia. Format: numbered list. Do not include any other text before or after the list.',
    expectKeywords: ['1.', '2.', '3.', '4.', '5.'],
  },
  {
    id: 'T10-translation',
    category: 'multilingual',
    prompt:
      'Translate the following to Japanese, preserving technical terms in English: "The microservices architecture uses API gateways for load balancing and circuit breaking."',
    expectKeywords: ['API', 'microservice'],
  },

  // =============================================
  // M1-M10: Margay-Specific Scenarios (v2.0)
  // =============================================

  {
    id: 'M1-system-prompt',
    category: 'margay-scenario',
    prompt: `You are a cat-themed personal assistant named "Whiskers". You must:
1. Start every response with a cat emoji (🐱)
2. Refer to the user as "hooman"
3. End responses with a cat pun

User message: What's the weather like today?

Respond in character.`,
    expectKeywords: ['🐱', 'hooman'],
    maxTokens: 256,
  },
  {
    id: 'M2-tool-use',
    category: 'margay-scenario',
    prompt: `You have access to the following tools:
- search_files(pattern: string): Search for files matching a glob pattern
- read_file(path: string): Read a file's contents
- run_command(cmd: string): Execute a shell command

The user says: "帮我搜索项目中所有的 TODO 注释"

Respond with the tool calls you would make, using this JSON format:
\`\`\`json
{"tool": "tool_name", "args": {"param": "value"}}
\`\`\``,
    expectKeywords: ['search_files', 'TODO'],
    maxTokens: 512,
  },
  {
    id: 'M3-multi-turn',
    category: 'margay-scenario',
    prompt: '', // Uses messages[] instead
    messages: [
      {
        role: 'user',
        content:
          'I\'m building a React app with TypeScript. The main component is called Dashboard and it lives in src/components/Dashboard.tsx.',
      },
      {
        role: 'assistant',
        content:
          'Got it! You have a React + TypeScript app with a Dashboard component at src/components/Dashboard.tsx. How can I help you with it?',
      },
      {
        role: 'user',
        content: 'I want to add a dark mode toggle. Where should I put the theme state?',
      },
      {
        role: 'assistant',
        content:
          'For a theme toggle, I\'d recommend using React Context. Create a ThemeContext provider at src/contexts/ThemeContext.tsx and wrap your app with it. The Dashboard can then consume the context.',
      },
      {
        role: 'user',
        content:
          'Good idea. Now, what was the file path of my main component again? And can you write the ThemeContext file based on our discussion?',
      },
    ],
    expectKeywords: ['Dashboard', 'src/components/Dashboard.tsx', 'ThemeContext'],
    maxTokens: 1024,
  },
  {
    id: 'M4-code-workspace',
    category: 'margay-scenario',
    prompt: `Here is a project structure:
\`\`\`
src/
├── main/
│   ├── index.ts          # Electron main process entry
│   ├── ipc/
│   │   ├── handlers.ts   # IPC handler registration
│   │   └── channels.ts   # Channel name constants
│   └── services/
│       ├── ConfigService.ts  # App configuration (singleton)
│       └── UpdateService.ts  # Auto-update logic
├── renderer/
│   ├── App.tsx           # Root React component
│   ├── pages/
│   │   ├── chat/
│   │   │   ├── ChatPage.tsx
│   │   │   └── MessageList.tsx
│   │   └── settings/
│   │       └── SettingsPage.tsx
│   └── store/
│       └── useAppStore.ts  # Zustand store
└── common/
    ├── types.ts          # Shared TypeScript interfaces
    └── constants.ts      # Shared constants
\`\`\`

Questions:
1. If I want to add a new IPC channel for "export chat history", which files need to be modified?
2. Where should the export logic live — main process or renderer?
3. What's the data flow from user clicking "Export" to the file being saved?`,
    expectKeywords: ['channels.ts', 'handlers.ts', 'main'],
    maxTokens: 1024,
  },
  {
    id: 'M5-skill-trigger',
    category: 'margay-scenario',
    prompt: `You are an AI assistant with the following skills available:
- pdf: Create and manipulate PDF documents
- cron: Schedule recurring tasks
- xlsx: Create and edit spreadsheets
- mermaid: Generate diagrams

The user says: "帮我把这个会议记录生成一份 PDF 报告，然后每周五下午自动发送"

Which skills should be triggered? List them and explain why.`,
    expectKeywords: ['pdf', 'cron'],
    maxTokens: 512,
  },
  {
    id: 'M6-mixed-lang',
    category: 'margay-scenario',
    prompt: `把下面的 JavaScript function 改成 async/await 风格，变量名保持英文，注释全部用中文：

\`\`\`javascript
function fetchUserData(userId) {
  return fetch('/api/users/' + userId)
    .then(response => response.json())
    .then(data => {
      console.log('User loaded:', data.name);
      return data;
    })
    .catch(error => {
      console.error('Failed to load user:', error);
      throw error;
    });
}
\`\`\``,
    expectKeywords: ['async', 'await', '// '],
    maxTokens: 512,
  },
  {
    id: 'M7-long-context',
    category: 'margay-scenario',
    prompt: `Below is a technical specification document. Read it carefully and answer the questions at the end.

---
# Margay Agent Communication Protocol (ACP) Specification v3.1

## 1. Overview
ACP is a JSON-RPC 2.0 based protocol for communication between the Margay host application and external AI agent processes (Claude, Codex, OpenCode). Each agent runs as a child process with stdin/stdout JSON-RPC transport.

## 2. Connection Lifecycle
2.1. Host spawns agent process with environment variables: MARGAY_SESSION_ID, MARGAY_WORKSPACE_DIR, MARGAY_TOOLS_MANIFEST.
2.2. Agent sends \`initialize\` request within 5 seconds (timeout = AGENT_INIT_TIMEOUT_MS = 5000).
2.3. Host responds with capabilities: { tools: [...], permissions: {...}, model: "..." }.
2.4. Agent sends \`ready\` notification.
2.5. Communication proceeds with request/response pairs.
2.6. Either side can send \`shutdown\` notification for graceful termination.

## 3. Message Types
3.1. Request: { jsonrpc: "2.0", id: number, method: string, params?: object }
3.2. Response: { jsonrpc: "2.0", id: number, result?: any, error?: { code: number, message: string } }
3.3. Notification: { jsonrpc: "2.0", method: string, params?: object } (no id, no response expected)

## 4. Tool Permission Model
4.1. Tools are classified into three tiers: auto-allow, prompt-user, deny.
4.2. auto-allow: read_file, search_files, list_directory — no user confirmation needed.
4.3. prompt-user: write_file, run_command, delete_file — requires user approval via ACP approval flow.
4.4. deny: system_shutdown, format_disk — always rejected.
4.5. Approval flow: Agent sends \`tool.request\` → Host shows UI prompt → User approves/denies → Host sends \`tool.response\`.
4.6. Approval granularity: per-tool-class (e.g., approve "write_file" once = approve all write_file calls in session).
4.7. Approval timeout: 120 seconds. If user doesn't respond, request is auto-denied with error code -32001.

## 5. Error Codes
5.1. -32700: Parse error
5.2. -32600: Invalid request
5.3. -32601: Method not found
5.4. -32602: Invalid params
5.5. -32603: Internal error
5.6. -32001: Permission denied (user denied or timeout)
5.7. -32002: Agent not ready
5.8. -32003: Session expired

## 6. Rate Limiting
6.1. Max 100 tool calls per minute per agent session.
6.2. Max 10 concurrent pending tool requests.
6.3. Exceeding limits returns error code -32603 with message "rate_limit_exceeded".

## 7. Reconnection
7.1. If agent process crashes, host may restart it with the same session ID.
7.2. Agent must re-initialize but host preserves conversation history.
7.3. Max 3 reconnection attempts with exponential backoff (1s, 2s, 4s).

---

Questions:
1. What is the timeout for the initialize handshake?
2. Which error code is returned when a user denies a tool permission?
3. If an agent crashes, how many times will the host try to reconnect?
4. Can a read_file tool call proceed without user confirmation?`,
    expectKeywords: ['5000', '-32001', '3', 'auto-allow'],
    maxTokens: 512,
  },
  {
    id: 'M8-agent-routing',
    category: 'margay-scenario',
    prompt: `You are the Margay orchestrator. You have these agents available:
- gemini: Fast, good at general tasks, supports tools and code. Always available (embedded).
- claude: Excellent at reasoning and writing, supports tools. External process.
- codex: Specialized for code generation and editing. External process.

The user says: "用 Claude 帮我 review 这段代码的安全性，然后用 Codex 把发现的问题修复掉，最后用 Gemini 写一份中文的安全审计报告。"

Plan the execution:
1. Which agent handles each step?
2. What data flows between steps?
3. What happens if Claude is unavailable?`,
    expectKeywords: ['claude', 'codex', 'gemini'],
    maxTokens: 768,
  },
  {
    id: 'M9-error-recovery',
    category: 'margay-scenario',
    prompt: `A user is running a TypeScript Electron app and sees this error:

\`\`\`
Error: ENOENT: no such file or directory, open '/Users/dev/.margay-config/agents/claude/config.json'
    at Object.openSync (node:fs:601:3)
    at readFileSync (node:fs:469:35)
    at ClaudeConnection.loadConfig (src/agent/claude/ClaudeConnection.ts:45:28)
    at ClaudeConnection.initialize (src/agent/claude/ClaudeConnection.ts:31:10)
    at AgentManager.startAgent (src/agent/AgentManager.ts:78:22)
\`\`\`

Provide:
1. Root cause analysis
2. Immediate fix (what the user should do)
3. Code-level fix (how to prevent this in the codebase)`,
    expectKeywords: ['ENOENT', 'config.json', 'mkdir'],
    maxTokens: 768,
  },
  {
    id: 'M10-format-follow',
    category: 'margay-scenario',
    prompt: `Generate a JSON configuration file for a model provider with the following exact structure. Do NOT add any extra fields or explanations outside the JSON block.

Required structure:
\`\`\`json
{
  "provider": "<name>",
  "models": [
    {
      "id": "<model-id>",
      "displayName": "<human-readable name>",
      "contextWindow": <number>,
      "pricing": {
        "input": <dollars per 1M tokens>,
        "output": <dollars per 1M tokens>
      },
      "capabilities": ["chat", "code", "vision"]
    }
  ],
  "defaultModel": "<model-id>",
  "apiVersion": "2026-02"
}
\`\`\`

Fill in realistic values for the provider "DeepSeek" with 2 models: deepseek-v3.2 and deepseek-coder-v3.`,
    expectKeywords: ['"provider"', '"DeepSeek"', '"deepseek-v3.2"', '"deepseek-coder-v3"'],
    maxTokens: 768,
  },
];

export const PROMPT_SET_VERSION = '2.0';
