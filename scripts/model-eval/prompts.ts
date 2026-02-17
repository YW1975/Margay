/**
 * Versioned prompt set for model evaluation.
 * v3.0 — 2026-02-15: T1-T18 (aligned with model-evaluation-plan.md) + M1-M10 (Margay scenarios)
 *
 * Test types:
 *   text       — standard text prompt/response
 *   vision     — requires image input (skip if unsupported)
 *   func-call  — requires tool/function calling format
 *   multi-turn — uses messages[] array for conversation history
 *   streaming  — tests SSE streaming output
 *   error      — tests error handling (intentionally bad request)
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolParam {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface EvalPrompt {
  id: string;
  category: string;
  /** Single-turn prompt (used when messages[] is absent) */
  prompt: string;
  /** Multi-turn messages (overrides prompt when present) */
  messages?: ChatMessage[];
  /** Expected content keywords for basic pass/fail check */
  expectKeywords?: string[];
  /** Max tokens to generate */
  maxTokens?: number;
  /**
   * Test type — determines how the runner executes the prompt:
   *   text (default) — standard chat completion
   *   func-call     — pass tools[] in request, check for tool_call in response
   *   multi-turn    — use messages[] array
   *   streaming     — send with stream=true, validate SSE chunks
   *   error         — send intentionally bad request, validate error response
   */
  testType?: 'text' | 'func-call' | 'multi-turn' | 'streaming' | 'error';
  /** Tool definitions for func-call tests */
  tools?: ToolParam[];
}

// =============================================
// T1-T18: Aligned with model-evaluation-plan.md
// =============================================

const T_PROMPTS: EvalPrompt[] = [
  // --- T1: Basic Text Generation (text) ---
  {
    id: 'T1-text-gen',
    category: 'basic',
    prompt: '用一句话解释量子纠缠，要求小学生能理解。',
    expectKeywords: ['量子', '纠缠'],
  },

  // --- T2: Instruction Following ---
  {
    id: 'T2-instruction',
    category: 'instruction-following',
    prompt:
      '列出 5 个水果，每个用一个 emoji 开头，按字母顺序排列，用英文回答。',
    expectKeywords: ['Apple', 'Banana'],
    maxTokens: 256,
  },

  // --- T3: Code Generation (coding) ---
  {
    id: 'T3-coding',
    category: 'code',
    prompt: `Write a Python function \`merge_sorted(a, b)\` that merges two sorted lists into one sorted list. Include type hints. Do not use built-in sort.

Example:
  merge_sorted([1, 3, 5], [2, 4, 6]) → [1, 2, 3, 4, 5, 6]
  merge_sorted([], [1, 2]) → [1, 2]
  merge_sorted([1], []) → [1]`,
    expectKeywords: ['def merge_sorted', 'list'],
    maxTokens: 768,
  },

  // --- T4: Reasoning (classic puzzle) ---
  {
    id: 'T4-reasoning',
    category: 'reasoning',
    prompt:
      '一个房间里有 3 盏灯和 3 个开关在门外。你只能进房间一次。如何确定每个开关对应哪盏灯？请详细解释你的推理过程。',
    expectKeywords: ['热', '亮'],
    maxTokens: 512,
  },

  // --- T5: Function Calling ---
  {
    id: 'T5-func-call',
    category: 'function-calling',
    testType: 'func-call',
    prompt: '北京今天天气怎么样？用摄氏度。',
    tools: [
      {
        name: 'get_weather',
        description: '获取指定城市的天气',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: '城市名称' },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
              description: '温度单位',
            },
          },
          required: ['city'],
        },
      },
    ],
    expectKeywords: ['get_weather', '北京'],
    maxTokens: 256,
  },

  // --- T6: Multi-Turn Conversation ---
  {
    id: 'T6-multi-turn',
    category: 'multi-turn',
    testType: 'multi-turn',
    prompt: '',
    messages: [
      { role: 'user', content: '我叫张三，我是一名软件工程师。' },
      {
        role: 'assistant',
        content: '你好张三！很高兴认识你。作为软件工程师，你主要用什么编程语言呢？',
      },
      { role: 'user', content: '我刚才说我叫什么？我的职业是什么？' },
    ],
    expectKeywords: ['张三', '软件工程师'],
    maxTokens: 256,
  },

  // --- T7: Creative Writing ---
  {
    id: 'T7-creative',
    category: 'creative',
    prompt:
      '为一家卖猫粮的公司写一条 30 字以内的广告语，要求幽默、有记忆点。只输出广告语，不要其他内容。',
    expectKeywords: ['猫'],
    maxTokens: 128,
  },

  // --- T8: Multilingual ---
  {
    id: 'T8-multilingual',
    category: 'multilingual',
    prompt: `Translate the following to Japanese and Korean:
"The early bird catches the worm, but the second mouse gets the cheese."

Format:
Japanese: ...
Korean: ...`,
    expectKeywords: ['Japanese', 'Korean'],
    maxTokens: 512,
  },

  // --- T9: Report Writing (from JSON data) ---
  {
    id: 'T9-report',
    category: 'report-writing',
    prompt: `基于以下 JSON 数据，写一份产品运营月度复盘报告。

\`\`\`json
{
  "product": "Margay AI Assistant",
  "period": "2025-07 to 2025-12",
  "monthly_data": [
    {"month":"2025-07","users":12400,"active_rate":0.68,"paid_rate":0.045,"arpu":28.5,"refund_rate":0.012,"nps":42},
    {"month":"2025-08","users":15200,"active_rate":0.72,"paid_rate":0.052,"arpu":31.2,"refund_rate":0.008,"nps":48},
    {"month":"2025-09","users":18900,"active_rate":0.71,"paid_rate":0.058,"arpu":29.8,"refund_rate":0.015,"nps":45},
    {"month":"2025-10","users":22100,"active_rate":0.65,"paid_rate":0.061,"arpu":33.1,"refund_rate":0.022,"nps":38},
    {"month":"2025-11","users":25800,"active_rate":0.63,"paid_rate":0.055,"arpu":30.5,"refund_rate":0.028,"nps":35},
    {"month":"2025-12","users":28500,"active_rate":0.60,"paid_rate":0.048,"arpu":27.9,"refund_rate":0.031,"nps":32}
  ]
}
\`\`\`

要求：
1. 摘要（3 句话总结趋势）
2. 关键指标分析（用表格呈现同比/环比）
3. 问题诊断（找出异常数据并分析可能原因）
4. 下月行动建议（3 条具体可执行的）

格式用 Markdown，语言专业但不啰嗦。`,
    expectKeywords: ['摘要', '指标', '问题', '建议'],
    maxTokens: 2048,
  },

  // --- T10: Data Extraction (unstructured to JSON) ---
  {
    id: 'T10-extraction',
    category: 'data-extraction',
    prompt: `从以下混乱的网页抓取文本中提取所有产品信息，输出为 JSON 数组。

--- 原始文本 ---
最新优惠！！！ AirPods Pro 3代 ¥1899 蓝牙5.3/主动降噪/USB-C 评分4.8/5 有货
限时特惠>>> Samsung Galaxy S25 Ultra $1299.99 骁龙8Gen4/200MP/钛合金 评分 94% 预售中
清仓甩卖 小米14 Pro 原价3999现价¥3499 骁龙8Gen3/徕卡镜头/120Hz 评分4.5/5 仅剩3台
[广告] 赢取免费MacBook！点击这里→ www.scam.com
Google Pixel 9 Pro $899 Tensor G4/AI相机/7年更新 评分: 4.6 out of 5 缺货
OPPO Find X8 ¥4999 天玑9400/哈苏影像 rating: 88% 有货
--- 文本结束 ---

要求：
- 每个产品包含: name, price_cny, specs, rating_out_of_5, stock_status
- 价格统一转为人民币（美元按 7.2 汇率）
- 评分统一为 x/5 格式（百分制除以20）
- stock_status 统一为 'in_stock' / 'out_of_stock' / 'pre_order'
- 忽略广告等无关信息
- 输出合法 JSON`,
    expectKeywords: ['AirPods', 'Galaxy', 'price_cny', 'rating_out_of_5'],
    maxTokens: 1536,
  },

  // --- T11: App Development (CLI TODO tool) ---
  {
    id: 'T11-app-dev',
    category: 'app-development',
    prompt: `用 TypeScript 实现一个命令行 TODO 工具，要求：
1. 支持 add/list/done/delete 四个子命令
2. 数据存储在 ~/.todo.json
3. list 输出带序号和完成状态 (✓/✗)
4. done 标记完成（按序号）
5. delete 删除条目（按序号）
6. 输入校验：序号越界、空标题等要有友好错误提示
7. 不使用任何第三方依赖，只用 Node.js 内置模块

输出完整可运行的单文件代码。`,
    expectKeywords: ['add', 'list', 'done', 'delete', 'fs'],
    maxTokens: 2048,
  },

  // --- T12: Document QA (long context) ---
  {
    id: 'T12-doc-qa',
    category: 'document-qa',
    prompt: `Below is a technical specification. Read carefully and answer the 5 questions at the end.

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
Q1 (fact retrieval): What are the three tool permission tiers?
Q2 (detail location): What is the approval timeout in seconds, and what error code is returned on timeout?
Q3 (cross-section reasoning): If an agent crashes, describe the full recovery sequence including timing.
Q4 (implicit reasoning): What is the biggest security risk in this protocol design? (Not stated explicitly — infer from the spec.)
Q5 (design suggestion): If you wanted to add a "Slack channel plugin" to this system, what protocol changes would be needed?`,
    expectKeywords: ['auto-allow', 'prompt-user', 'deny', '-32001', '120'],
    maxTokens: 2048,
  },

  // --- T13: Codebase Comprehension ---
  {
    id: 'T13-codebase',
    category: 'codebase',
    prompt: `Read the following source code files and answer the questions.

--- File: src/agent/BaseAgentManager.ts ---
\`\`\`typescript
export abstract class BaseAgentManager {
  protected isKilled = false;
  protected worker: ChildProcess | null = null;

  async start(sessionId: string): Promise<void> {
    this.worker = this.spawnWorker(sessionId);
    this.worker.on('exit', (code) => this.onWorkerExit(code));
    await this.postMessagePromise('initialize', { sessionId }, 5000);
  }

  async sendMessage(content: string): Promise<string> {
    if (!this.worker) throw new Error('Agent not started');
    return this.postMessagePromise('message', { content }, 60000);
  }

  async kill(): Promise<void> {
    if (this.isKilled) return; // idempotent guard
    this.isKilled = true;
    this.worker?.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 500));
    if (this.worker && !this.worker.killed) {
      this.worker.kill('SIGKILL');
    }
  }

  protected abstract spawnWorker(sessionId: string): ChildProcess;
  protected abstract onWorkerExit(code: number | null): void;

  private postMessagePromise(method: string, params: any, timeoutMs: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      this.worker!.once('message', (msg: any) => {
        clearTimeout(timer);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      });
      this.worker!.send({ jsonrpc: '2.0', id: Date.now(), method, params });
    });
  }
}
\`\`\`

--- File: src/agent/GeminiAgentManager.ts ---
\`\`\`typescript
export class GeminiAgentManager extends BaseAgentManager {
  private reconnectAttempts = 0;
  private maxReconnects = 3;

  protected spawnWorker(sessionId: string): ChildProcess {
    return fork('./workers/gemini-worker.js', [], {
      env: { ...process.env, SESSION_ID: sessionId },
    });
  }

  protected onWorkerExit(code: number | null): void {
    if (this.isKilled) return; // intentional shutdown
    if (this.reconnectAttempts < this.maxReconnects) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts - 1) * 1000;
      setTimeout(() => this.start('recovered-session'), delay);
    }
  }

  override async kill(): Promise<void> {
    this.reconnectAttempts = this.maxReconnects; // prevent reconnection
    await super.kill();
  }
}
\`\`\`

Questions:
Q1: How does GeminiAgentManager.kill() ensure the agent doesn't reconnect after being killed?
Q2: If the worker crashes during the \`postMessagePromise('initialize', ...)\` call, what happens? Is there a bug?
Q3: Draw the complete call chain for sendMessage from invocation to worker receiving the message.
Q4: If you wanted to add a \`cancel()\` method to cancel the current in-flight request, which files and methods need changes? Be specific.`,
    expectKeywords: ['reconnectAttempts', 'postMessagePromise', 'kill'],
    maxTokens: 2048,
  },

  // --- T14: Data Analysis (CSV to insights) ---
  {
    id: 'T14-data-analysis',
    category: 'data-analysis',
    prompt: `分析以下电商订单数据：

\`\`\`csv
order_id,date,product,category,quantity,price,city,payment
1001,2025-12-01,无线耳机,电子,2,299,北京,微信
1002,2025-12-01,瑜伽垫,运动,1,89,上海,支付宝
1003,2025-12-02,机械键盘,电子,1,599,深圳,信用卡
1004,2025-12-02,蛋白粉,运动,3,198,北京,支付宝
1005,2025-12-03,手机壳,电子,5,29,广州,微信
1006,2025-12-03,跑步鞋,运动,1,899,上海,信用卡
1007,2025-12-04,显示器,电子,1,2499,北京,信用卡
1008,2025-12-04,哑铃套装,运动,1,459,深圳,微信
1009,2025-12-05,充电宝,电子,2,129,广州,支付宝
1010,2025-12-05,瑜伽裤,运动,2,169,上海,微信
1011,2025-12-06,蓝牙音箱,电子,1,399,北京,支付宝
1012,2025-12-06,筋膜枪,运动,1,599,深圳,信用卡
1013,2025-12-07,鼠标,电子,3,79,广州,微信
1014,2025-12-07,运动手环,运动,2,249,上海,支付宝
1015,2025-12-08,平板支架,电子,1,49,北京,微信
1016,2025-12-08,跳绳,运动,4,35,广州,支付宝
1017,2025-12-09,USB集线器,电子,2,89,深圳,信用卡
1018,2025-12-09,护膝,运动,2,129,北京,微信
1019,2025-12-10,数据线,电子,10,19,上海,支付宝
1020,2025-12-10,泡沫轴,运动,1,99,广州,微信
1021,2025-12-10,显示器,电子,1,45999,深圳,信用卡
\`\`\`

要求：
1. 按品类统计销售额和订单量，找出 top 品类
2. 按城市分析客单价差异
3. 按支付方式分析偏好分布
4. 发现数据中的异常值（如果有）
5. 给出 3 条运营建议

用 Markdown 表格呈现统计结果。`,
    // order 1021 has price=45999 for 显示器 — a clear anomaly (should be ~2499)
    expectKeywords: ['电子', '运动', '异常', '45999'],
    maxTokens: 2048,
  },

  // --- T15: Multi-Tool Orchestration ---
  {
    id: 'T15-multi-tool',
    category: 'multi-tool',
    testType: 'func-call',
    prompt: `帮我调查 DeepSeek V3 和 GPT-5.2 在代码生成任务上的最新评测对比。先搜索相关信息，然后整理成对比表格。如果需要计算性价比，可以用 Python。`,
    tools: [
      {
        name: 'search_web',
        description: '搜索网页',
        parameters: {
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        },
      },
      {
        name: 'read_url',
        description: '读取网页内容',
        parameters: {
          type: 'object',
          properties: { url: { type: 'string' } },
          required: ['url'],
        },
      },
      {
        name: 'run_python',
        description: '执行 Python 代码',
        parameters: {
          type: 'object',
          properties: { code: { type: 'string' } },
          required: ['code'],
        },
      },
    ],
    expectKeywords: ['search_web', 'DeepSeek'],
    maxTokens: 1024,
  },

  // --- T16: Streaming Compatibility ---
  {
    id: 'T16-streaming',
    category: 'compatibility',
    testType: 'streaming',
    prompt: '用一句话解释什么是机器学习。',
    expectKeywords: ['机器学习'],
    maxTokens: 128,
  },

  // --- T17: Error Handling Compatibility ---
  {
    id: 'T17-error-handling',
    category: 'compatibility',
    testType: 'error',
    prompt: '', // Will send intentionally oversized/malformed request
    expectKeywords: [], // Check for proper error code, not keywords
    maxTokens: 8,
  },

  // --- T18: Math Computation ---
  {
    id: 'T18-math',
    category: 'reasoning',
    prompt:
      'What is the sum of the first 100 positive integers? Show your work using the Gauss formula.',
    expectKeywords: ['5050'],
    maxTokens: 512,
  },
];

// =============================================
// M1-M10: Margay-Specific Scenarios
// =============================================

const M_PROMPTS: EvalPrompt[] = [
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
    testType: 'multi-turn',
    prompt: '',
    messages: [
      {
        role: 'user',
        content:
          "I'm building a React app with TypeScript. The main component is called Dashboard and it lives in src/components/Dashboard.tsx.",
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
          "For a theme toggle, I'd recommend using React Context. Create a ThemeContext provider at src/contexts/ThemeContext.tsx and wrap your app with it. The Dashboard can then consume the context.",
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

## 3. Tool Permission Model
3.1. Tools classified: auto-allow, prompt-user, deny.
3.2. auto-allow: read_file, search_files, list_directory.
3.3. prompt-user: write_file, run_command, delete_file.
3.4. Approval timeout: 120 seconds → auto-denied with error code -32001.

## 4. Error Codes
4.1. -32001: Permission denied (user denied or timeout)
4.2. -32002: Agent not ready
4.3. -32003: Session expired

## 5. Reconnection
5.1. Max 3 reconnection attempts with exponential backoff (1s, 2s, 4s).
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

export const EVAL_PROMPTS: EvalPrompt[] = [...T_PROMPTS, ...M_PROMPTS];

export const PROMPT_SET_VERSION = '3.0';
