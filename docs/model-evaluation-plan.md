# 模型评估测试计划

> Date: 2026-02-13
> 目的: 验证各厂商模型的真实能力，建立 Model Catalog，替代正则猜测

---

## 一、评估范围

### 厂商 × 主力模型（2026-02 最新）

| 厂商 | 旗舰模型 | 性价比模型 | 协议 | Base URL | 文档 |
|------|---------|-----------|------|---------|------|
| **OpenAI** | gpt-5.2 ($1.75/$14) | gpt-4o-mini ($0.15/$0.60), o3 ($0.40/$1.60) | OpenAI | `https://api.openai.com/v1` | [docs](https://platform.openai.com/docs/models) |
| **Google** | gemini-3-pro ($2/$12) | gemini-2.5-flash ($0.30/$2.50) | Gemini | `https://generativelanguage.googleapis.com/v1beta` | [docs](https://ai.google.dev/gemini-api/docs) |
| **Anthropic** | claude-opus-4.6 ($5/$25) | claude-haiku-4.5 ($1/$5) | Anthropic | `https://api.anthropic.com` | [docs](https://docs.anthropic.com) |
| **DeepSeek** | deepseek-chat/V3.2 ($0.28/$0.42) | 同左（已经很便宜） | OpenAI 兼容 | `https://api.deepseek.com/v1` | [docs](https://api-docs.deepseek.com/) |
| **Kimi** | kimi-k2.5 ($0.60/$2.50) | moonshot-v1-8k ($0.20/$2.00) | OpenAI 兼容 | `https://api.moonshot.ai/v1` | [docs](https://platform.moonshot.ai/docs) |
| **MiniMax** | minimax-m2.5 (~$0.30/$2.40) | minimax-m2 ($0.26/$1.00) | OpenAI 兼容 | `https://api.minimax.io/v1` | [docs](https://platform.minimax.io/docs) |
| **Zhipu** | glm-5 (刚发布) | glm-4.7-flash ($0.06/$0.40) | OpenAI 兼容 | `https://open.bigmodel.cn/api/paas/v4` | [docs](https://open.bigmodel.cn/dev/api) |
| **Qwen** | qwen3-max ($1.20/$6.00) | qwen-turbo ($0.04/$0.08) | OpenAI 兼容 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | [docs](https://www.alibabacloud.com/help/en/model-studio/qwen-api-reference/) |

### 评估模型清单（共 ~22 个）

| 厂商 | 必测（旗舰） | 必测（性价比） | 可选 |
|------|-------------|---------------|------|
| OpenAI | gpt-5.2, o3 | gpt-4o-mini, o4-mini | gpt-4o |
| Google | gemini-3-pro-preview | gemini-2.5-flash | gemini-2.5-pro |
| Anthropic | claude-opus-4.6 | claude-haiku-4.5 | claude-sonnet-4.5 |
| DeepSeek | deepseek-chat (V3.2) | deepseek-reasoner (R1) | |
| Kimi | kimi-k2.5 | moonshot-v1-128k | |
| MiniMax | minimax-m2.5 | minimax-m2 | minimax-vl-01 |
| Zhipu | glm-5 (或 glm-4.7) | glm-4.7-flash | glm-4.6v |
| Qwen | qwen3-max | qwen-turbo | qwen-vl-max |

> 运行时会先调 models.list() 确认可用模型，上表作为目标清单。

### 评估维度

| 维度 | 测试项 | 评分方式 |
|------|--------|---------|
| **能力验证** | text, vision, function_calling, web_search, reasoning, image_gen | 二值: 支持/不支持 |
| **质量评分** | coding, reasoning, instruction_following, creative_writing, multilingual, report_writing, data_extraction, app_development, document_qa, codebase_comprehension, data_analysis, multi_tool_orchestration | 0-5 分 |
| **元数据** | context_limit, pricing (input/output per 1M tokens), latency | 数值 |
| **兼容性** | 流式输出, 错误码规范, 多轮对话, tool_choice 支持 | 通过/异常记录 |

---

## 二、测试用例

### T1: 基础文本生成（text）

```
Prompt: "用一句话解释量子纠缠，要求小学生能理解。"
评判: 有回复 → text=true; 质量看通俗程度和准确性
```

### T2: 指令遵循（instruction_following）

```
Prompt: "列出 5 个水果，每个用一个 emoji 开头，按字母顺序排列，用英文回答。"
评判:
  - 5 分: 5 个水果, emoji 开头, 字母序, 英文
  - 4 分: 缺一个要求
  - 3 分: 缺两个
  - 2 分: 有水果但格式全错
  - 1 分: 勉强相关
```

### T3: 代码生成（coding）

```
Prompt: "Write a Python function `merge_sorted(a, b)` that merges two sorted lists into one sorted list. Include type hints. Do not use built-in sort."
评判:
  - 正确性: 对 5 组测试输入的输出是否正确
  - 代码质量: type hints, edge cases, 时间复杂度 O(n+m)
  - 5 分: 全部正确 + 质量好
  - 3 分: 基本正确但有瑕疵
  - 1 分: 逻辑错误
```

### T4: 推理（reasoning）

```
Prompt: "一个房间里有 3 盏灯和 3 个开关在门外。你只能进房间一次。如何确定每个开关对应哪盏灯？"
评判:
  - 5 分: 正确答案（开一个等热→关→开另一个→进去看亮/热/冷）
  - 3 分: 思路对但不完整
  - 1 分: 错误
```

### T5: 视觉理解（vision）

```
Input: 一张包含文字和图表的截图（准备一张标准测试图片）
Prompt: "描述这张图片的内容，包括文字和图表中的数据。"
评判:
  - 支持: 能识别图片内容 → vision=true
  - 不支持: 报错或忽略图片 → vision=false
  - 质量: 识别准确度 0-5
```

### T6: Function Calling（function_calling）

```
Tools: [
  {
    "name": "get_weather",
    "description": "获取指定城市的天气",
    "parameters": {
      "type": "object",
      "properties": {
        "city": { "type": "string" },
        "unit": { "type": "string", "enum": ["celsius", "fahrenheit"] }
      },
      "required": ["city"]
    }
  }
]
Prompt: "北京今天天气怎么样？"
评判:
  - 支持: 返回 tool_call 且参数正确 → function_calling=true
  - 不支持: 纯文本回答或报错 → function_calling=false
  - 质量: 参数提取准确度
```

### T7: 多轮对话

```
Turn 1: "我叫张三"
Turn 2: "我刚才说我叫什么？"
评判: 正确回忆名字 → 多轮 OK; 遗忘 → 异常记录
```

### T8: 创意写作（creative_writing）

```
Prompt: "为一家卖猫粮的公司写一条 30 字以内的广告语，要求幽默、有记忆点。"
评判:
  - 5 分: 幽默、简洁、有创意
  - 3 分: 合格但平庸
  - 1 分: 无趣或超字数
```

### T9: 多语言（multilingual）

```
Prompt: "Translate the following to Japanese and Korean:\n'The early bird catches the worm, but the second mouse gets the cheese.'"
评判:
  - 5 分: 两种语言都自然流畅，谚语处理得当
  - 3 分: 翻译正确但生硬
  - 1 分: 明显错误
```

---

### 实战任务测试（T10-T16）

> 以下测试模拟日常真实工作场景，评估模型在复杂、多步骤任务中的实际表现。
> 每个测试提供完整的上下文材料，考察模型的理解力、结构化输出和实用性。

### T10: 写报告 — 从数据到结论（report_writing）

```
Context: 提供一段 JSON 数据（约 2000 tokens），包含某产品过去 12 个月的月度数据：
  用户数、活跃率、付费转化率、客单价、退款率、NPS 评分

Prompt: "基于以上数据，写一份产品运营月度复盘报告，要求：
1. 摘要（3 句话总结趋势）
2. 关键指标分析（用表格呈现同比/环比）
3. 问题诊断（找出异常数据并分析可能原因）
4. 下月行动建议（3 条具体可执行的）
格式用 Markdown，语言专业但不啰嗦。"

评判标准:
  - 结构完整性 (5 分): 摘要 + 表格 + 诊断 + 建议四部分齐全
  - 数据准确性 (5 分): 同比/环比计算正确，异常数据识别准确
  - 洞察质量 (5 分): 不是复读数字，有因果分析，建议可执行
  - 语言风格 (5 分): 专业简洁，无废话
  总分 20 分，归一化到 0-5
```

### T11: 数据抓取/分析 — 从非结构化到结构化（data_extraction）

```
Context: 提供一段混乱的文本（约 1500 tokens），模拟从网页抓取的原始内容，
  包含：产品名、价格（有的带 ¥ 有的带 $）、规格、评分（有的 4.5/5 有的 90%）、
  库存状态（"有货"/"缺货"/"预售"），格式不统一，有噪声和无关信息。

Prompt: "从以上文本中提取所有产品信息，输出为 JSON 数组，每个产品包含：
  name, price_cny, specs, rating_out_of_5, stock_status
要求：
- 价格统一转为人民币（美元按 7.2 汇率）
- 评分统一为 x/5 格式
- stock_status 统一为 'in_stock' / 'out_of_stock' / 'pre_order'
- 忽略无关信息"

评判标准:
  - 完整性 (5 分): 提取了所有产品，没遗漏
  - 准确性 (5 分): 字段值正确，格式转换正确
  - 规范性 (5 分): 输出是合法 JSON，字段名一致
  - 鲁棒性 (5 分): 正确处理了噪声和边界 case（如缺失字段、异常格式）
  总分 20 分，归一化到 0-5
  自动评分: JSON.parse 通过 + 字段逐一比对预期值
```

### T12: 写应用 — 完整小功能实现（app_development）

```
Prompt: "用 TypeScript 实现一个命令行 TODO 工具，要求：
1. 支持 add/list/done/delete 四个子命令
2. 数据存储在 ~/.todo.json
3. list 输出带序号和完成状态 (✓/✗)
4. done 标记完成（按序号）
5. delete 删除条目（按序号）
6. 输入校验：序号越界、空标题等要有友好错误提示
7. 不使用任何第三方依赖，只用 Node.js 内置模块
输出完整可运行的单文件代码。"

评判标准:
  - 功能完整性 (5 分): 四个命令都能用
  - 代码质量 (5 分): 类型安全、错误处理、代码组织
  - 可运行性 (5 分): 自动保存到临时文件，用 tsx 跑测试命令序列验证
  - 边界处理 (5 分): 空文件、越界序号、中文标题、并发写入
  总分 20 分，归一化到 0-5
  自动评分: 保存代码 → tsx 运行 → 执行命令序列 → 检查输出
```

### T13: 长文档问答 — 上下文理解（document_qa）

```
Context: 提供一份真实的技术文档（约 8000-15000 tokens），例如：
  - Margay 项目的 CLAUDE.md + 部分源码
  - 或一份 API 设计文档

Questions (5 个，难度递增):
  Q1 (事实检索): "文档中提到了哪几种 Agent 类型？"
  Q2 (细节定位): "权限确认的超时时间是多少秒？在哪个文件的哪一行？"
  Q3 (跨段落推理): "如果用户离开电脑 5 分钟，会发生什么？描述完整的事件链。"
  Q4 (隐含信息): "这个系统的最大安全风险是什么？文档没有直接说，但可以推断。"
  Q5 (建议生成): "基于文档描述的架构，如果要新增一个 Slack Channel 插件，需要改哪些文件？"

评判标准:
  - Q1: 自动评分（关键词匹配）
  - Q2: 自动评分（精确匹配文件名+行号范围）
  - Q3: 半自动（事件链关键节点匹配）
  - Q4: 人工/judge model（推理合理性）
  - Q5: 人工/judge model（文件列表合理性+完整性）
  每题 1 分，总 5 分
```

### T14: 代码库理解 — 看代码回答问题（codebase_comprehension）

```
Context: 提供 3-4 个相关源文件片段（约 5000 tokens），例如：
  - ForkTask.ts (基类)
  - GeminiAgentManager.ts (子类)
  - BaseAgentManager.ts (中间层)

Questions:
  Q1: "GeminiAgentManager 的 kill() 方法是如何保证幂等性的？描述具体机制。"
  Q2: "如果 worker 在 bootstrap 阶段崩溃，postMessagePromise 会怎样？这是 bug 吗？"
  Q3: "画出 sendMessage 的完整调用链，从 renderer 到 worker。"
  Q4: "如果要给 GeminiAgent 增加一个 cancel 功能（取消当前请求），
       需要改哪些文件的哪些方法？给出具体的改动点。"

评判标准:
  - 准确性 (5 分): 对代码逻辑的理解是否正确
  - 深度 (5 分): 是否发现了隐含的 bug、竞态条件、设计缺陷
  - 可操作性 (5 分): 改动建议是否具体到文件和方法级别
  - 表达清晰度 (5 分): 调用链/架构描述是否清晰易懂
  总分 20 分，归一化到 0-5
  评分方式: judge model + 人工确认
```

### T15: 数据分析 — 从 CSV 到洞察（data_analysis）

```
Context: 提供一份 CSV 数据（约 50 行 × 8 列，内嵌在 prompt 中），例如：
  电商订单数据：order_id, date, product, category, quantity, price, city, payment_method

Prompt: "分析以上订单数据：
1. 按品类统计销售额和订单量，找出 top 3 品类
2. 按城市分析客单价差异
3. 按支付方式分析偏好分布
4. 发现数据中的异常值（如果有）
5. 给出 3 条运营建议

要求用 Markdown 表格呈现统计结果，计算过程可以简要说明。"

评判标准:
  - 计算正确性 (5 分): 统计数字是否算对（可自动验证）
  - 分析完整性 (5 分): 5 个要求是否都覆盖
  - 异常发现 (5 分): 是否识别了预埋的异常数据
  - 建议质量 (5 分): 建议是否基于数据、具体可行
  总分 20 分，归一化到 0-5
  自动评分: 统计数字比对 + 结构检查; 建议质量用 judge model
```

### T16: 多工具编排 — Agent 能力（multi_tool_orchestration）

```
Tools: [
  { "name": "search_web", "description": "搜索网页", "parameters": { "query": "string" } },
  { "name": "read_url", "description": "读取网页内容", "parameters": { "url": "string" } },
  { "name": "run_python", "description": "执行 Python 代码", "parameters": { "code": "string" } }
]

Prompt: "帮我调查 DeepSeek V3 和 GPT-5.2 在代码生成任务上的最新评测对比。
先搜索相关信息，然后整理成对比表格。如果需要计算性价比，可以用 Python。"

评判标准:
  - 工具选择 (5 分): 是否合理选择了搜索 → 阅读 → 计算的工具序列
  - 参数构造 (5 分): 搜索 query 是否精准，URL 是否合理
  - 多步编排 (5 分): 是否正确串联多个工具调用（非一次性，而是根据前一步结果决定下一步）
  - 最终输出 (5 分): 对比表格结构清晰、信息有用
  总分 20 分，归一化到 0-5
  注意: 工具不会真正执行，我们返回模拟数据，考察的是模型的编排逻辑
```

---

### 兼容性测试（T17-T18）

### T17: 流式输出兼容性

```
测试: 以 stream=true 发送 T1 请求
评判:
  - 通过: 正常收到 SSE chunks, 最终有 finish_reason
  - 异常: chunk 格式不标准、缺少 finish_reason、连接断开等
```

### T18: 错误处理兼容性

```
测试: 发送超长 prompt (超过模型 context limit)
评判: 返回标准错误码 (400/413) 还是不可预期的行为
```

---

## 三、评估脚本设计

### 输入

```bash
# .env.evaluation
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
MOONSHOT_API_KEY=sk-...
MINIMAX_API_KEY=...
MINIMAX_GROUP_ID=...       # MiniMax 需要 group_id
ZHIPU_API_KEY=...
DASHSCOPE_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
```

### 脚本结构

```
scripts/model-eval/
├── index.ts                # 入口，读取配置，运行评估
├── providers.ts            # 各厂商的 client 配置（baseUrl, headers, 协议差异）
├── test-cases.ts           # T1-T11 测试用例定义
├── evaluator.ts            # 运行测试 + 打分逻辑
├── reporter.ts             # 生成报告 + 更新 model-catalog.json
└── assets/
    └── test-image.png      # T5 视觉测试用图
```

### 执行流程

```
1. 读取 .env.evaluation 中的 API keys
2. 对每个厂商，先调 models.list() 获取可用模型列表
3. 对每个模型 × 每个测试用例:
   a. 构造请求（适配各家协议差异）
   b. 发送请求，记录: 响应内容、延迟、token 用量、是否报错
   c. 自动评分（能力验证为二值，质量评分用规则或 judge model）
4. 汇总生成 model-catalog.json
5. 输出人类可读的对比报告（Markdown 表格）
```

### 自动评分 vs 人工评分

| 测试 | 类型 | 评分方式 |
|------|------|---------|
| T1 text | 能力 | 自动（有回复=通过） |
| T2 instruction | 能力 | 自动（正则检查 5 个条件） |
| T3 coding | 能力 | 自动（实际运行 Python 验证输出） |
| T4 reasoning | 能力 | 半自动（关键词匹配 + 人工确认） |
| T5 vision | 能力 | 自动（有回复=支持; 质量=人工） |
| T6 function_calling | 能力 | 自动（检查 tool_call 结构） |
| T7 多轮 | 能力 | 自动（回复包含"张三"） |
| T8 creative | 能力 | judge model（创意无法规则评） |
| T9 multilingual | 能力 | 半自动（有翻译=通过; 质量=judge model） |
| **T10 report** | **实战** | **半自动（结构检查 + 数字验证 + judge model 评洞察）** |
| **T11 data_extraction** | **实战** | **自动（JSON.parse + 字段逐一比对预期值）** |
| **T12 app_development** | **实战** | **自动（保存代码 → tsx 运行 → 命令序列测试）** |
| **T13 document_qa** | **实战** | **半自动（Q1-Q2 关键词匹配; Q3-Q5 judge model）** |
| **T14 codebase** | **实战** | **judge model + 人工确认** |
| **T15 data_analysis** | **实战** | **半自动（统计数字自动验证 + judge model 评建议）** |
| **T16 multi_tool** | **实战** | **自动（检查 tool_call 序列逻辑）+ judge model 评输出** |
| T17 streaming | 兼容 | 自动（检查 SSE 格式） |
| T18 error | 兼容 | 自动（检查 HTTP status code） |

> judge model 统一用 Claude Opus 4.6（我们正在用的模型），避免用被测模型评自己。

---

## 四、输出格式

### model-catalog.json（最终产物）

```json
{
  "version": 1,
  "last_updated": "2026-02-13",
  "models": [
    {
      "id": "gpt-5.2",
      "provider": "openai",
      "display_name": "GPT-5.2",
      "pricing": { "input": 1.75, "output": 14.00 },
      "context": 400000,
      "max_output": 128000,
      "capabilities": {
        "text": true,
        "vision": true,
        "function_calling": true,
        "web_search": true,
        "reasoning": true,
        "image_generation": true,
        "embedding": false,
        "rerank": false
      },
      "quality": {
        "coding": 4.8,
        "reasoning": 4.5,
        "instruction_following": 4.8,
        "creative_writing": 4.2,
        "multilingual": 4.3
      },
      "recommended_for": ["通用旗舰", "代码生成", "复杂推理"],
      "not_good_at": [],
      "eval_latency_ms": 1500,
      "last_evaluated": "2026-02-13",
      "status": "active"
    },
    {
      "id": "deepseek-chat",
      "provider": "deepseek",
      "display_name": "DeepSeek V3.2",
      "pricing": { "input": 0.28, "output": 0.42 },
      "context": 128000,
      "max_output": 8000,
      "capabilities": {
        "text": true,
        "vision": false,
        "function_calling": true,
        "web_search": false,
        "reasoning": false,
        "image_generation": false,
        "embedding": false,
        "rerank": false
      },
      "quality": {
        "coding": 4.3,
        "reasoning": 4.0,
        "instruction_following": 4.0,
        "creative_writing": 3.5,
        "multilingual": 3.8
      },
      "recommended_for": ["高性价比日常", "代码辅助"],
      "not_good_at": ["视觉", "创意写作"],
      "eval_latency_ms": 800,
      "last_evaluated": "2026-02-13",
      "status": "active"
    }
  ]
}
```

### 对比报告（Markdown）

```markdown
# Model Evaluation Report — 2026-02-13

## 能力矩阵

| 模型 | text | vision | func_call | reasoning | web_search | img_gen |
|------|------|--------|-----------|-----------|------------|---------|
| gpt-5.2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| o3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| gpt-4o-mini | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| gemini-3-pro | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| gemini-2.5-flash | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| claude-opus-4.6 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| claude-haiku-4.5 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| deepseek-chat | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| deepseek-reasoner | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| kimi-k2.5 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| minimax-m2.5 | ✅ | ? | ✅ | ✅ | ? | ? |
| glm-5 | ✅ | ? | ✅ | ? | ? | ? |
| qwen3-max | ✅ | ? | ✅ | ✅ | ✅ | ❌ |
...

## 成本对比 (per 1M tokens)

| 模型 | Input | Output | Context | 性价比 |
|------|-------|--------|---------|--------|
| qwen-turbo | $0.04 | $0.08 | 1M | 极高 |
| glm-4.7-flash | $0.06 | $0.40 | 200K | 极高 |
| gpt-4o-mini | $0.15 | $0.60 | 128K | 极高 |
| deepseek-chat | $0.28 | $0.42 | 128K | 极高 |
| gemini-2.5-flash | $0.30 | $2.50 | 1M | 极高 |
| minimax-m2 | $0.26 | $1.00 | 512K | 高 |
| o3 | $0.40 | $1.60 | 200K | 高 |
| kimi-k2.5 | $0.60 | $2.50 | 256K | 中 |
| qwen3-max | $1.20 | $6.00 | 1M | 中 |
| gemini-2.5-pro | $1.25 | $10.00 | 1M | 中 |
| gpt-5.2 | $1.75 | $14.00 | 400K | 中 |
| claude-sonnet-4.5 | $3.00 | $15.00 | 200K | 低 |
| claude-opus-4.6 | $5.00 | $25.00 | 200K | 低(最强) |
...
```

---

## 五、成本预估

### 基础能力测试 (T1-T9)
- 输入: ~2000 tokens/case × 9 = ~18K tokens/模型
- 输出: ~500 tokens/case × 9 = ~4.5K tokens/模型

### 实战任务测试 (T10-T16)
- 输入: ~5000-15000 tokens/case（含上下文材料）× 7 = ~60K tokens/模型
- 输出: ~2000 tokens/case × 7 = ~14K tokens/模型

### 兼容性测试 (T17-T18)
- 输入: ~2000 tokens × 2 = ~4K tokens/模型
- 输出: ~500 tokens × 2 = ~1K tokens/模型

### 每模型合计
- 输入: ~82K tokens
- 输出: ~19.5K tokens

### 全部模型 (~22 个)
- 总输入: ~1.8M tokens
- 总输出: ~430K tokens

### Judge model 成本（Claude Opus 4.6 评分）
- 约 10 个需要 judge 的测试 × 22 模型 = 220 次评分调用
- 每次 ~3K input + ~500 output = ~660K input + ~110K output
- 成本: $3.30 + $2.75 = ~$6

### 总成本估算
- 被测模型: 按最贵的 Claude Opus 4.6 ($5/$25) 算上限 ≈ $9 + $10.75 = ~$20
- 实际混合价（多数模型 < $1/M）≈ **~$5-8**
- Judge model: ~$6
- **总计: ~$12-15**（实际可能更低）

---

## 六、执行计划

| 步骤 | 内容 | 产出 |
|------|------|------|
| 1 | 用户提供 8 家 API keys | `.env.evaluation` |
| 2 | 编写评估脚本 | `scripts/model-eval/` |
| 3 | 运行评估，人工审核边界 case | 原始数据 |
| 4 | 生成 catalog + 报告 | `model-catalog.json` + `evaluation-report.md` |
| 5 | MiniMax 平台配置接入 | `modelPlatforms.ts` 新增 |
| 6 | 替换正则检测 | `modelCapabilities.ts` 改为查 catalog |
| 7 | 补全 context limits | `modelContextLimits.ts` 合入 catalog 数据 |

步骤 2-4 今天可完成，5-7 随 Tier 1 bug 修复一起做。
