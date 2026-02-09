# Next Phase Plan — 2026-02-08

**Branch**: `ocelot` → next iteration (fork target: **Margay**)
**Status**: Partially implemented, planning next iteration
**Updated**: 2026-02-09

### Status Summary

| Issue | Status | Notes |
|-------|--------|-------|
| 1. ACP Reconnect | **Done** (F14) | Async stop, await disconnect, clear sessionId |
| 2. Agent Switch | **Needs Revision** | Current F15 goes to Welcome page; user wants inline tab + agent selector |
| 3. Settings Restructure | **Partially Done** (F16/F17) | Skills page + Backend page created; UI entry may not be visible |
| 4. Agent Config | **Partially Done** (F17) | Backend management page exists; routing/visibility TBD |
| 5. Fork | **Planning** | Name confirmed: **Margay** |
| 6. Agent Collaboration | Deferred | |
| 7. Task System | Deferred | |
| NEW-8. Skill Unified Distribution | **Designing** | RFC Rev 4 — copy-only, path injection, Gemini unification |
| NEW-9. Claude Skill Announcement | **New** | Suppress verbose skill listing on every connection |
| NEW-10. Multi-Directory Access | **New** | Primary CWD + additional accessible directories |
| NEW-11. P1 Menu Bar "Electron" | **Pending** | 1-line fix in appMenu.ts |
| NEW-12. Settings UI 同步 | **New** | SettingsModal 缺 Agent/Skills/Display；Quick Scan 空目录隐藏 |

---

## Issue 1: ACP 连接中断后无法重新发送

**优先级**: P1（用户体验阻断）
**复杂度**: 低

### 现象

用户发消息给 Claude → 发现错误立即停止 → 再次发送 → Claude 拒绝："conversation in progress"

### 根因分析

ACP 协议**没有 cancel/abort 机制**。当前的 stop 流程：

```
用户点停止 → AcpAgent.stop() → AcpConnection.disconnect()
           → treeKill(pid, SIGTERM)  // 杀进程
           → pendingRequests.clear() // 清本地请求缓存
           → child = null            // 清连接引用
```

问题在于：
1. `disconnect()` 使用 `treeKill` 是异步的（spawns pgrep），但 `stop()` 返回 `Promise.resolve()` 不等待完成
2. 杀掉的是本地 ACP CLI 进程，但 **Claude 后端可能仍在处理上一条请求**
3. 重新发送时创建新连接/进程，但后端 session 可能还在 "busy" 状态
4. ACP JSON-RPC 协议没有 `$/cancelRequest`（不像 LSP），可用的方法只有 `session/prompt`、`session/update`、`session/request_permission`

### 关键代码位置

| 组件 | 文件:行号 | 说明 |
|------|----------|------|
| Stop 入口 | `src/agent/acp/index.ts:238-252` | `stop()` 调用 `disconnect()` 但不等待 |
| 进程清理 | `src/agent/acp/AcpConnection.ts:879-903` | `disconnect()` 使用 treeKill |
| 请求管理 | `src/agent/acp/AcpConnection.ts:206` | `pendingRequests` Map |
| 超时机制 | `src/agent/acp/AcpConnection.ts:437-489` | session/prompt 300s 超时 |
| 自动重连 | `src/agent/acp/index.ts:258-267` | `sendMessage()` 中的重连逻辑 |

### 方案选择

| 方案 | 复杂度 | 说明 |
|------|--------|------|
| A. 强制新 session | 低 | stop 时清除 `sessionId`，下次 sendMessage 创建全新 session，放弃旧 session 上下文 |
| B. 等待 disconnect 完成 | 低 | `stop()` await `disconnect()` 完成，确保进程真正退出后再允许重发 |
| C. 发送 cancel 通知 | 中 | 在 ACP 协议层添加 `session/cancel` 方法（需要 CLI 端也支持） |
| D. 队列化发送 | 中 | sendMessage 检查是否有 in-flight 请求，排队或自动 cancel 前一条 |

**推荐**：方案 A + B 组合 — `stop()` 等待 disconnect 完成 + 清除 sessionId 强制新 session。

### 具体实施

1. **`AcpAgent.stop()`**（`src/agent/acp/index.ts:238`）: 改为 `async stop()` 并 `await this.connection.disconnect()`
2. **`AcpConnection.disconnect()`**: 确保 treeKill 完成后 resolve（包裹在 Promise 中，监听 `close` 事件）
3. **`AcpAgentManager`**: `stop()` 后清除 `this.options.acpSessionId`，确保下次 `sendMessage()` 创建新 session
4. **UI**: stop 按钮点击后短暂 disable（等待 disconnect 完成），防止重复点击

---

## Issue 2: 同一工作空间不能切换 Agent

**优先级**: P1（功能缺失）
**复杂度**: 低

### 现象

在某目录用 Claude Code 开了对话后，新建标签页自动继承 Claude，无法切换到 Gemini 或 Codex。

### 根因

`ConversationTabs.tsx:131-137` 新建标签时使用展开运算符复制整个会话对象：

```typescript
const newConversation = {
  ...currentConversation,  // ← 复制了 type 字段
  id: newId,
  name: t('conversation.welcome.newConversation'),
  createTime: Date.now(),
  modifyTime: Date.now(),
};
```

`...currentConversation` 将 `type: 'acp'` 也复制了，新标签被锁定为同一 agent 类型。**没有 UI 让用户选择不同 agent**。

### 关键代码位置

| 组件 | 文件:行号 | 说明 |
|------|----------|------|
| 新建标签 | `src/renderer/pages/conversation/ConversationTabs.tsx:131-137` | 展开运算符复制 type |
| Agent 选择 | `src/renderer/pages/guid/index.tsx:766,825,880` | 仅在首次创建时选择 |
| 工作空间分组 | `src/renderer/pages/conversation/WorkspaceGroupedHistory.tsx:55-87` | 按 workspace 分组，不限 type |
| 会话类型 | `src/renderer/pages/conversation/context/ConversationTabsContext.tsx:21` | `type: 'gemini' | 'acp' | 'codex'` |

### 方案选择

| 方案 | 复杂度 | 说明 |
|------|--------|------|
| A. 新标签跳转 Welcome 页 | 低 | 新建标签时导航到 Welcome/Guid 页，让用户重新选择 agent |
| B. 标签栏增加 Agent 选择器 | 中 | 新建标签时弹出 agent 选择弹窗 |
| C. 会话内切换 Agent | 高 | 已有对话可以切换 agent（需要迁移消息格式） |

**推荐**：方案 A — 最简单且符合直觉。新建标签 = 新建对话 = 走完整的创建流程。

### 具体实施

1. **`ConversationTabs.tsx:131`**: 新建标签不再 spread `currentConversation`，而是导航到 `/guid`（Welcome 页）
2. **路由处理**: 确保 `/guid` 页面在标签场景下正确传递 workspace 路径（从当前标签获取）
3. **Guid 页保持 workspace**: 新建会话页自动填充当前 workspace，用户只需选 agent type

---

## Issue 3: 助手 vs Skill vs 工具的概念混淆

**优先级**: P2（架构改进）
**复杂度**: 中

### 现象

设置里只有「智能助手」管理，没有独立的 Skill 管理和统一工具入口。

### 当前设置页面架构

```
/settings/
├── /gemini      → Gemini OAuth + 代理 + yolo 模式
├── /model       → 模型 API Key 配置
├── /agent       → 智能助手管理 (AssistantManagement.tsx)
│                  └── Skill 选择嵌套在助手编辑里
├── /tools       → MCP 服务器 + 图片生成模型
├── /display     → 主题/语言
├── /webui       → WebUI 远程访问
├── /system      → 系统设置
└── /about       → 关于
```

### 问题分析

1. **Skill 管理被嵌套在助手编辑内**：用户必须创建/编辑助手才能管理 skills，没有全局 skill 管理入口
2. **Tools 页只有 MCP 和图片生成**：agent 内置工具（Bash, Read, Edit 等）没有管理入口
3. **概念混淆**：助手 = agent + skills + preset，但 UI 没有清晰分层

### 概念模型建议

```
┌─────────────────────────────────────────────┐
│  Agent (引擎)                                │
│  Claude Code, Gemini CLI, Codex, 自定义      │
│  全局配置：启用/禁用、CLI 路径、yolo 模式       │
├─────────────────────────────────────────────┤
│  Skill (能力扩展)                             │
│  cron, shell-bg, pptx, docx, 自定义          │
│  全局管理：安装/卸载/启停                       │
├─────────────────────────────────────────────┤
│  Tool (工具)                                 │
│  MCP servers + Agent 内置工具                 │
│  统一入口：查看所有可用工具                     │
├─────────────────────────────────────────────┤
│  Assistant (智能助手) = Agent + Skills + Preset │
│  预配置组合，快捷方式                          │
└─────────────────────────────────────────────┘
```

### 关键代码位置

| 组件 | 文件 | 说明 |
|------|-----|------|
| 助手管理 | `src/renderer/pages/settings/AssistantManagement.tsx` | 50KB，核心 CRUD |
| Skill 选择 | `AssistantManagement.tsx:659-779` | 嵌套在助手编辑弹窗内 |
| MCP 管理 | `src/renderer/pages/settings/McpManagement/index.tsx` | 独立组件 223 行 |
| Tools 页 | `src/renderer/pages/settings/ToolsModalContent.tsx` | MCP + 图片生成 |
| 设置导航 | `src/renderer/pages/settings/SettingsSider.tsx:18-70` | 菜单项定义 |

### 具体实施

1. **独立 Skill 管理页**: 从 `AssistantManagement.tsx` 提取 skill 列表/安装/删除到 `/settings/skills` 页面
2. **设置菜单重组**: 调整 `SettingsSider.tsx` 菜单结构为：Agent → Skill → Tool → Assistant
3. **保留助手编辑中的 skill 勾选**：助手编辑弹窗中仍保留 enabledSkills 勾选，但链接到独立 Skill 页

---

## Issue 4: Agent 加载应可配置

**优先级**: P2（用户体验）
**复杂度**: 低

### 现象

所有 agent 硬编码加载，用户无法控制启用哪些。

### 当前机制

- `ACP_BACKENDS_ALL`（`acpTypes.ts:283-410`）定义了 14 个内置 agent
- 每个 backend 有 `enabled` 属性，但**硬编码在源码中**
- `AcpDetector`（`src/agent/acp/AcpDetector.ts:72-158`）根据 `enabled` 过滤后做 `which` 检测
- **自定义 agent 已经可配置**（通过 `acp.customAgents` ConfigStorage）

### 内置 Agent 列表（`acpTypes.ts`）

| Agent | enabled | CLI Command |
|-------|---------|-------------|
| claude | true | `claude` |
| gemini | true | (内置) |
| qwen | true | `qwen` |
| iflow | true | `iflow` |
| codex | true | `codex` |
| droid | false | `droid` |
| goose | true | `goose` |
| auggie | true | `auggie` |
| kimi | true | `kimi` |
| opencode | true | `opencode` |
| copilot | false | `github-copilot` |
| qoder | true | `qoder` |
| openclaw | true | `openclaw` |
| custom | true | (用户自定义) |

### 方案选择

| 方案 | 复杂度 | 说明 |
|------|--------|------|
| A. ConfigStorage 覆盖 | 低 | `ProcessConfig.get('acp.backend.enabled')` 存储用户覆盖，合并 `ACP_BACKENDS_ALL` 默认值 |
| B. Settings UI 开关 | 低 | Agent 设置页增加 per-backend 启用/禁用开关 |
| C. 全局配置文件 | 低 | 支持 `~/.aionui/config.json` 中指定启用的 agents |

**推荐**：方案 A + B — ConfigStorage 存储 + Settings UI 开关。自定义 agent 已有类似实现，扩展到内置 agent 即可。

### 具体实施

1. **`AcpDetector.ts`**: `detect()` 方法中读取 `ProcessConfig.get('acp.disabledBackends')` 覆盖硬编码 `enabled`
2. **新设置页组件**: Agent Management 页面，展示所有已检测 backends + 启用/禁用开关
3. **ConfigStorage**: 新增 `acp.disabledBackends: string[]` 存储被禁用的 backend 名称

---

## Issue 5: 独立 Fork — 从 AionUi 派生独立产品

**优先级**: P0（基础设施）
**复杂度**: 高（工作量大，但技术难度不高）

### 可行性

✅ 完全可行

### 许可证

Apache-2.0，允许 fork、修改、商用、重新分发。只需：
- 保留原始 LICENSE 文件
- 在修改的文件中注明变更
- 不使用原作者商标进行推广

### 品牌触点清单

| 类别 | 数量 | 关键文件 |
|------|------|---------|
| 产品名 "AionUi" | 1,250+ 处 | 几乎所有源文件的 license header |
| 小写 "aionui" | 673+ 处 | 存储键、环境变量、常量 |
| Bundle ID | 3 处 | `com.aionui.app` + plist + savedState |
| 域名/URL | 8+ 处 | aionui.com, GitHub iOfficeAI/AionUi |
| Email | 2 处 | service@aionui.com, security@aionui.com |
| 图标文件 | 6+ 个 | `resources/` 目录下 |
| 存储键前缀 | 6 个 | `aionui_*` localStorage keys |
| 环境变量 | 6 个 | `AIONUI_*` 系列 |
| i18n 品牌字符串 | 7 个文件 | 每个语言文件有 "AionUi" 引用 |
| Homebrew cask | 1 个文件 | `homebrew/aionui.rb` |
| Lark 集成 | 1 处 | `LarkCards.ts` "AionUi Assistant" |

### 需要变更的配置文件

| 文件 | 需改内容 |
|------|---------|
| `package.json` | name, productName, author, description |
| `electron-builder.yml` | appId, productName, copyright, maintainer |
| `forge.config.ts` | executableName, CompanyName, ProductName, installer configs |
| `public/index.html` | `<title>` |
| `src/renderer/layout.tsx:221` | 侧栏品牌名 |
| `LICENSE` | 新增 fork 声明，保留原始版权 |
| `src/common/storageKeys.ts` | `aionui_*` 前缀 |
| `src/common/constants.ts` | `AIONUI_*` 常量 |
| `resources/*` | 图标文件替换 |
| `homebrew/*.rb` | cask 名称和元数据 |
| 所有 `*.ts` 文件 header | license 声明中的版权持有者 |

### 依赖风险

| 依赖 | 风险 | 处理方式 |
|------|------|---------|
| `@office-ai/aioncli-core` | npm 包绑定 iOfficeAI 账号 | fork 或替换为自有包名 |
| `patch-package` 补丁 | 补丁依赖特定版本 | 合入自有 fork 的源码 |
| GitHub Actions CI | 绑定 iOfficeAI org | 迁移到自有 org |

### Fork 实施步骤

```
Phase 1: 基础 Fork（1-2 天）
├── 确定新产品名和仓库名
├── Fork repo 到自有 GitHub org
├── 合并 ocelot 分支
├── 全局替换品牌名（sed/find-replace）
├── 替换图标和 logo
└── 更新 LICENSE（添加 fork 声明）

Phase 2: 去耦合（2-3 天）
├── Fork @office-ai/aioncli-core 到自有包名
├── 将 patch-package 补丁合入 aioncli-core fork
├── 配置独立 CI/CD pipeline
├── 配置独立 Homebrew tap
└── 注册独立域名和邮箱

Phase 3: 独立演进
├── 基于 Issue 1-4 开始独立开发
├── 建立自己的 issue tracker 和 roadmap
├── 定期从上游 cherry-pick 有价值的改动
└── 发布独立版本
```

### LICENSE 处理示例

```
Copyright 2026 [新产品名]
Based on AionUi (https://github.com/iOfficeAI/AionUi)
Original Copyright 2025 AionUi (aionui.com)

Licensed under the Apache License, Version 2.0
```

---

## Issue 6: Agent 间通信 — 类似 Ralph-Lisa 的协作模式（下一阶段）

**优先级**: P3（下一阶段）
**复杂度**: 高

### 需求

在独立的 agent 对话之间建立通信机制，实现类似 Ralph-Lisa 的轮次协作。

### 现有基础设施

| 组件 | 文件 | 能力 |
|------|-----|------|
| ChannelEventBus | `src/channels/agent/ChannelEventBus.ts:16-59` | 全局事件总线，已用于 Channel→UI 消息分发 |
| WorkerManage | `src/process/WorkerManage.ts:16-131` | 中央任务注册表，按 conversationId 发现 agent task |
| Conversation Source | `src/common/storage.ts:96` | 会话来源标记（`'aionui' | 'telegram'`），可扩展 |
| SessionManager | `src/channels/core/SessionManager.ts:76-109` | Session→Conversation 链接 |
| ChannelMessageService | `src/channels/agent/ChannelMessageService.ts:65-120` | 事件驱动的消息路由，解耦发送者和接收者 |
| IPC Bridge | `src/common/ipcBridge.ts:426-449` | 类型安全的跨进程事件 |
| Database | `src/process/database/schema.ts:41-84` | 持久化存储 |

### 架构设计

```
┌─────────────────────────────────────────────────────┐
│                DualAgentOrchestrator                 │
│  管理协作状态：turn, round, step, review             │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────────────┐     EventBus      ┌────────────┐ │
│  │ Agent A      │ ◄──────────────► │ Agent B     │ │
│  │ (Ralph)      │   TURN_CHANGE    │ (Lisa)      │ │
│  │ conversation │   REVIEW_READY   │ conversation│ │
│  │ id: conv-001 │   CONSENSUS      │ id: conv-002│ │
│  └──────────────┘                   └────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ dual_agent_sessions (DB table)               │  │
│  │ pair_id, agent_a_conv, agent_b_conv,         │  │
│  │ current_turn, round, step, state_json        │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 实现层次

```
Layer 1: 数据层 — DualAgentStore
├── 新建 dual_agent_sessions 表
├── 存储 pair 关系、轮次状态、review 内容
└── 支持暂停/恢复协作

Layer 2: 协调层 — DualAgentOrchestrator
├── 创建/管理 agent pair
├── 轮次控制：whose-turn, submit, pass-turn
├── 通过 ChannelEventBus 路由消息
├── 将 Agent A 的输出作为 Agent B 的输入
└── 超时和死锁检测

Layer 3: 通信层 — 复用 ChannelEventBus
├── 新增事件类型: TURN_CHANGE, REVIEW_SUBMITTED
├── Agent A finish → Orchestrator 检测 [TAG] → 路由到 Agent B
├── Agent B finish → Orchestrator 检测 [PASS]/[NEEDS_WORK] → 路由回 A
└── [CONSENSUS] → Orchestrator 标记 step 完成

Layer 4: UI 层
├── 双面板视图：左 Agent A，右 Agent B
├── 轮次指示器：当前谁在工作
├── 协作历史时间线
└── 手动干预入口
```

### 关键设计决策

| 决策点 | 选项 | 推荐 |
|--------|------|------|
| 消息路由 | A. ChannelEventBus 事件 / B. 数据库轮询 / C. IPC 直接调用 | A — 已有基础，低延迟 |
| 状态存储 | A. 内存 / B. 文件 / C. 数据库 | C — 持久化，支持恢复 |
| Agent 类型 | A. 同类型 / B. 混合类型 | B — Ralph=Claude, Lisa=Gemini 应该可以 |
| 触发方式 | A. 自动轮次 / B. 手动确认 / C. 混合 | C — 默认自动，deadlock 时手动 |

### 与现有 Ralph-Lisa CLI 的对比

| 方面 | 当前 CLI 方式 | 产品化方案 |
|------|-------------|-----------|
| 状态存储 | 文件（`.dual-agent/turn.txt`） | 数据库表 |
| 消息传递 | 手动 copy-paste | ChannelEventBus 自动路由 |
| UI | 两个终端窗口 | 双面板集成视图 |
| 并发控制 | 文件锁 | CronBusyGuard + Orchestrator |
| 恢复能力 | 手动 | 自动从 DB 恢复 |

---

## Issue 7: 任务系统 — 参考 OpenClaw 简化设计（下一阶段）

**优先级**: P3（下一阶段）
**复杂度**: 高

### 参考

[OpenClaw](https://github.com/claw-project/OpenClaw)（145K+ stars）的任务系统设计思路，简化后适配我们的产品。

### OpenClaw 的核心设计哲学

- 用户用自然语言描述任务，AI 自主决定用哪些 skill
- 持久记忆（SOUL.md + MEMORY.md），agent 跨会话保持上下文
- Proactive monitoring（心跳机制），不只是定时触发
- 用户不需要配置工作流，只需要确认权限

### 用户使用场景（从简单到复杂）

**场景 1：定时任务（现有，需增强）**
```
用户：「每天早上 9 点检查 GitHub 新 issue，整理成报告」
→ 选择 agent (Claude/Gemini)
→ 选择助手模板（可选）
→ 设定触发时间
→ 自动执行，结果推送
```

**场景 2：Standing Instruction（常驻指令，OpenClaw 的核心创新）**
```
用户：「监控 /logs 目录，有新 error log 就分析原因告诉我」
→ 不是定时轮询，而是「记住这个指令」
→ agent 在每次被唤醒时检查条件
→ 条件满足时自动执行分析
```

**场景 3：多步骤任务（skill 链）**
```
用户：「把这张收据拍照提取数据，生成 Excel 表格」
→ Agent 自主调用: 图片识别 skill → 数据提取 → Excel skill
→ 用户只看到最终结果
```

**场景 4：Agent 协作（结合 Issue 6）**
```
用户：「用 Claude 写代码，让 Gemini review」
→ 创建协作任务
→ Agent A 输出 → 自动转给 Agent B → 反馈回 Agent A
→ 用户看到最终共识结果
```

### 当前系统 vs 目标系统

| 维度 | 当前 Cron | 目标 Task System |
|------|-----------|-----------------|
| 任务定义 | 写 cron 表达式 + 固定消息 | 自然语言描述 + 助手模板 |
| 触发方式 | 时间（cron/interval/at） | 时间 + 常驻指令 + 手动 |
| 任务内容 | 固定文本 | 动态模板 + skill 上下文 |
| 执行方式 | 发消息到固定会话 | 可指定 agent + assistant |
| 结果 | 无反馈 | 执行历史 + 结果展示 |
| 限制 | 每会话 1 个 job | 无限制 |
| 上下文 | 无记忆 | 持久记忆（上次结果可用） |

### 简化设计：3 层架构（不要 DAG，不要工作流编辑器）

```
┌──────────────────────────────────────────────┐
│         用户界面：任务管理页                    │
│  创建任务 / 查看历史 / 手动触发 / 开关         │
├──────────────────────────────────────────────┤
│         任务定义 (Task)                        │
│  ├── what: 自然语言指令                        │
│  ├── who: agent 类型 + assistant 模板（可选）   │
│  ├── when: 定时 / 常驻 / 手动                  │
│  └── with: enabledSkills（可选，默认全部）      │
├──────────────────────────────────────────────┤
│         执行引擎 (TaskRunner)                  │
│  ├── 复用现有 CronService 的定时能力           │
│  ├── 复用 WorkerManage 创建 agent task         │
│  ├── 注入 assistant preset + skills            │
│  ├── CronBusyGuard 并发控制                    │
│  └── 记录执行历史和结果                        │
└──────────────────────────────────────────────┘
```

**核心原则：用户不写工作流，AI 自己编排**。用户只说「做什么」+「用谁做」+「什么时候做」，agent 自主决定调用哪些 skill、怎么拆分步骤。

### 实现路径

**Phase 1：增强现有 Cron（改造，不重写）**

改动最小，用户体感提升最大：

```
现有 CronService
  ├── 解除每会话 1 job 限制
  ├── 任务创建时可选 assistant 模板（注入 presetContext + enabledSkills）
  ├── 支持消息模板变量: {{date}}, {{lastResult}}
  ├── 记录每次执行结果（agent 回复）到 task_runs 表
  └── UI: 从内嵌在会话 → 独立任务管理页
```

代码改动点：

| 文件 | 改动 | 复杂度 |
|------|------|--------|
| `CronService.ts:68-73` | 去掉 `if (existing.length > 0) throw` 限制 | 低 |
| `CronService.ts:321-375` | `executeJob()` 注入 `presetContext` + `enabledSkills` | 低 |
| `CronStore.ts:22-47` | `CronJob` 增加 `assistantId`, `enabledSkills`, `lastResult` | 低 |
| `CronCommandDetector.ts` | 支持 `[CRON_CREATE]` 中的 assistant 字段 | 低 |
| `migrations.ts` | v12: 扩展 cron_jobs 表 + 新建 task_runs 表 | 低 |
| `src/renderer/pages/cron/` | 独立任务管理页（列表+创建+历史） | 中 |

**Phase 2：Standing Instruction（常驻指令）**

OpenClaw 的「心跳」概念简化版：

```
用户创建常驻指令：
  「每次我打开这个项目的对话，先检查 git status，有未提交的改动就提醒我」

实现方式（不需要新引擎）：
  ├── 存储为特殊类型 task: trigger_kind = 'standing'
  ├── 触发时机: 对话首条消息前，自动注入指令
  ├── 类似 presetContext，但是 per-workspace 而非 per-assistant
  └── 复用现有 prepareFirstMessage() 管道
```

**Phase 3：Agent 协作任务（结合 Issue 6）**

```
用户创建协作任务：
  「Claude 写代码 → Gemini review → 通过就提交」

实现方式：
  ├── Task 定义包含 agent_pair: [agentA, agentB]
  ├── TaskRunner 创建两个 agent task
  ├── Agent A 完成 → 输出注入 Agent B 的输入
  ├── Agent B 完成 → 判断 PASS/NEEDS_WORK
  ├── 循环或结束
  └── 依赖 Issue 6 的 DualAgentOrchestrator
```

### 关键代码位置

| 组件 | 文件 | 说明 |
|------|-----|------|
| CronService | `src/process/services/cron/CronService.ts` | 核心调度，Phase 1 改造基础 |
| CronStore | `src/process/services/cron/CronStore.ts` | 数据模型，需扩展字段 |
| CronBusyGuard | `src/process/services/cron/CronBusyGuard.ts` | 并发控制，复用 |
| CronCommandDetector | `src/process/task/CronCommandDetector.ts` | Agent 命令解析 |
| MessageMiddleware | `src/process/task/MessageMiddleware.ts` | 命令处理和路由 |
| Cron Skill | `skills/_builtin/cron/SKILL.md` | 需更新：支持 assistant 字段 |
| 任务管理 UI | `src/renderer/pages/cron/` | Phase 1 需改造成独立页面 |
| WorkerManage | `src/process/WorkerManage.ts` | 复用：创建 agent task |
| prepareFirstMessage | `src/process/task/agentUtils.ts` | Phase 2 常驻指令注入点 |
| DB Migration | `src/process/database/migrations.ts` | v12 扩展 |

### 与 OpenClaw 的对比

| 方面 | OpenClaw | 我们的方案 |
|------|----------|-----------|
| 任务定义 | 自然语言 + 自主编排 | 自然语言 + assistant 模板辅助 |
| Skill 调用 | Agent 自主决定 | Agent 自主决定（通过 enabledSkills 约束范围） |
| 持久记忆 | SOUL.md + MEMORY.md | presetContext + lastResult |
| 多步骤 | Agent 自主拆分 | Agent 自主拆分（不做显式 DAG） |
| 协作 | 单 agent | 支持双 agent 协作（Phase 3） |
| 触发方式 | 心跳 + 事件 | 定时 + 常驻指令（简化） |
| 复杂度 | 高（Lobster shell, marketplace） | 低（复用现有 CronService） |

---

## Issue 8: Skill 统一分发架构重构（NEW — 2026-02-09）

**优先级**: P1（核心功能修复）
**复杂度**: 中
**设计文档**: `docs/skill-distribution-rfc.md` Rev 4 (Section 13)

### 现象

手动验证三个引擎 skill 发现均有问题：
- Claude: symlink bug #14836，skill 不被发现
- Gemini: `_builtin/` 二级目录不被递归扫描
- Codex: skill 内脚本路径相对于 skill 目录，CWD 不匹配

### 方案（已讨论确认）

1. **All Copy**: 不用 symlink，全部 `fs.cpSync()`
2. **Flat Storage**: 去掉 `_builtin/`，metadata 标记 builtin
3. **Path Injection**: 含脚本的 skill 部署时注入绝对路径提示
4. **Gemini 统一**: distribute 到 `.gemini/skills/`，去 aioncli-core 依赖
5. **Global Detection**: 扫描全局 skill 目录，Settings 只读展示
6. **mtime 刷新**: stat 对比，source 更新时 re-copy

### 关键代码位置

| 文件 | 改动 |
|------|------|
| `SkillDistributor.ts` | 核心重构：`distributeToEngine()` 统一函数 |
| `GeminiAgentManager.ts` | 新增 `distributeToEngine(workspace, 'gemini')` 调用 |
| `initStorage.ts` | 去 `getBuiltinSkillsDir()`，加迁移脚本 |
| `fsBridge.ts` | 新增 `detectGlobalSkills()` provider |

---

## Issue 9: Claude Skill Announcement 抑制（NEW — 2026-02-09）

**优先级**: P2（token 浪费）
**复杂度**: 低

### 现象

Claude 每次连接会话时复述所有可用 skills/commands 列表（20+ 条），消耗 token 且噪音大。

### 方案方向

| 方案 | 复杂度 | 说明 |
|------|--------|------|
| A. CLAUDE.md 抑制 | 低 | 在 CLAUDE.md 中加指令："不要列出可用工具列表" |
| B. ACP 层过滤 | 中 | AcpAdapter 过滤掉 announce 类消息不显示给用户 |
| C. 首条消息指令 | 低 | prepareFirstMessage 中注入 "skip tool listing" |

推荐先试 A，成本最低。

---

## Issue 10: 多目录访问（NEW — 2026-02-09）

**优先级**: P3（功能增强）
**复杂度**: 低-中

### 需求

一个会话支持一个主工作目录（CWD）+ 多个可访问目录。不是多 CWD，而是文件访问范围扩展。

### 引擎支持

| 引擎 | 访问外部目录 | 方式 |
|------|------------|------|
| Claude Code | 能 | 绝对路径，权限通过 settings.local.json 预批准 |
| Gemini CLI | 能 | 无沙箱限制 |
| Codex | 受限 | 沙箱需配置 |

### 实现方向

```
会话配置: workspace (主) + additionalDirs: string[] (辅)
启动时: CWD = workspace，额外目录通过系统指令/配置通知引擎
```

---

## Issue 11: P1 macOS Menu Bar "Electron"

**优先级**: P1（cosmetic）
**复杂度**: 极低（1 行）
**文件**: `appMenu.ts:18`
**修复**: `app.setName('AionUi')` 或使用 `productName` 常量

---

## Issue 2 补充: 多标签页 Agent 选择器（修订 — 2026-02-09）

原方案 A（新标签跳转 Welcome 页）已实现为 F15，但体验不理想。

**修订需求**: 在当前对话旁边开新标签，内嵌 agent 选择器，不离开当前上下文。类似"新标签 + agent 下拉菜单"的组合，而不是跳回 Welcome 页。

---

## Issue 3 补充: UI 入口不可见（2026-02-09）

F16（独立 Skills 管理页）和 F17（Backend 管理页）已创建，但用户反馈在界面上看不到入口。需要排查：
- `SettingsSider.tsx` 菜单项是否正确添加
- `router.tsx` 路由是否正确注册
- 是否有条件渲染导致隐藏

---

## Issue 12: Settings UI 同步问题（NEW — 2026-02-09）

**优先级**: P1（功能入口不可达）
**复杂度**: 低
**来源**: 手动排查确认

### 问题清单

| # | 问题 | 原因 | 修复方向 |
|---|------|------|---------|
| 12a | Settings 弹窗缺 Agent/Skills/Display 三个 tab | `SettingsModal/index.tsx` 的 `menuItems` 和 `SettingTab` 类型未包含这三项；`renderContent()` 缺 skills/display case | 同步 menuItems + SettingTab 类型 + renderContent |
| 12b | Quick Scan 按钮不显示 | `detectCommonSkillPaths` 依赖 `~/.gemini/skills`、`~/.claude/skills` 目录存在（`fs.access`），首次使用时目录不存在 | 始终显示候选路径，目录不存在时标灰或标注 "not found" |
| 12c | Detected Engine Skills 区域无空状态 | `engineNativeSkills.length > 0` 条件渲染，为空时整块隐藏 | 加空状态提示："No engine-native skills detected" |
| 12d | BackendManagement 入口不直观 | 嵌在 Assistants 页的 Collapse 折叠面板中，默认折叠 | 考虑独立 sidebar 入口或默认展开 |

### 关键代码位置

| 文件 | 行号 | 问题 |
|------|------|------|
| `src/renderer/components/SettingsModal/index.tsx:54` | `SettingTab` 类型缺 `skills`/`display` | 12a |
| `src/renderer/components/SettingsModal/index.tsx:160-201` | `menuItems` 缺三项 | 12a |
| `src/renderer/components/SettingsModal/index.tsx:207-226` | `renderContent()` 缺 skills/display case | 12a |
| `src/renderer/pages/settings/SkillsManagement.tsx:283` | `commonPaths.length > 0` 条件渲染 | 12b |
| `src/process/bridge/fsBridge.ts:927-933` | `fs.access` 过滤不存在的目录 | 12b |
| `src/renderer/pages/settings/SkillsManagement.tsx:234` | `engineNativeSkills.length > 0` 条件渲染 | 12c |
| `src/renderer/components/SettingsModal/contents/AgentModalContent.tsx:24` | `defaultActiveKey` 只有 `smart-assistants` | 12d |

---

## Issue 5 补充: Fork 名称确认（2026-02-09）

Fork 名称确认为 **Margay**。

---

## 执行计划（确认 2026-02-09）

### Step 11: 稳定基线 + Quick Fixes（预计半天）

| 子步骤 | Issue | 改动范围 | 说明 |
|--------|-------|---------|------|
| 11a | — | git commit | 提交 Steps 9-10 的 21 个未提交文件 |
| 11b | #11 | `appMenu.ts` (1 行) | Menu Bar "Electron" → "AionUi" |
| 11c | #12a | `SettingsModal/index.tsx` (~30 行) | 补齐 Agent/Skills/Display 三个 tab（类型 + 菜单 + renderContent） |
| 11d | #12b | `fsBridge.ts` + `SkillsManagement.tsx` (~10 行) | Quick Scan 始终显示候选路径，目录不存在时标灰 |
| 11e | #12c-d | `SkillsManagement.tsx` + `AgentModalContent.tsx` (~10 行) | 空状态提示 + BackendManagement 默认展开 |

### Step 12: Skill 统一分发（预计 1-2 天，核心）

| 子步骤 | 改动范围 | 说明 |
|--------|---------|------|
| 12a | `SkillDistributor.ts`, `initStorage.ts` | 扁平化存储：`_builtin/` 提到顶层，加 `.aionui-skill.json` 元数据，首次运行迁移脚本 |
| 12b | `SkillDistributor.ts` | 统一 `distributeToEngine()`：合并 Claude/Codex 函数，全 `fs.cpSync`，去 symlink，mtime 对比 |
| 12c | `SkillDistributor.ts` | SKILL.md 路径注入：检测 `*.py/*.js/*.sh`，含脚本 → prepend 绝对路径提示 |
| 12d | `GeminiAgentManager.ts`, `config.ts` | Gemini 并入：加 `distributeToEngine('gemini')`，去 `computeGeminiDisabledSkills()`，去 `loadSkillsFromDir` |
| 12e | `SkillDistributor.ts`, `fsBridge.ts`, `SkillsManagement.tsx`, i18n | 全局 skill 检测：扫描 `~/.claude/skills/` `~/.gemini/skills/`，Settings 只读展示 |
| 12f | `tests/unit/test_skill_distributor.ts` | 更新测试 + 手动验证三引擎 skill 发现 |

### Step 13: UX 修复（预计半天-1 天）

| 子步骤 | Issue | 改动范围 | 说明 |
|--------|-------|---------|------|
| 13a | #9 | CLAUDE.md 或 AcpAdapter | Claude skill announcement 抑制（先试 CLAUDE.md 指令） |
| 13b | #2 修订 | `ConversationTabs.tsx`, `guid/index.tsx` | 多标签页：当前对话旁开新标签 + 内嵌 agent 选择器 |

### Step 14: Fork Margay（预计 1-2 天）

| 子步骤 | 改动范围 | 说明 |
|--------|---------|------|
| 14a | 全局 sed | 品牌替换：AionUi→Margay, aionui→margay, AIONUI→MARGAY |
| 14b | `resources/` | 图标 / Logo 替换 |
| 14c | `package.json`, imports | aioncli-core 解耦：fork 为独立包或保持引用 |
| 14d | LICENSE, CI | Apache-2.0 fork 声明 + GitHub Actions |

### 后续（不在这次迭代）

- Issue 10: 多目录访问
- Issue 4: Agent 配置化完善
- Issue 6: Agent 间通信
- Issue 7: 任务系统
- aioncli-core 长期改造（见下方"长期方向"章节）

### 关键路径

```
Step 11 (半天) ──► Step 12 (1-2天) ──► Step 13 (半天-1天) ──► Step 14 (1-2天)
                      ↑ 核心阻塞点
```

**总工期估计：3-5 天**

---

## 长期方向: aioncli-core 评估与演进（2026-02-09）

### 现状

AionUi 通过 `@office-ai/aioncli-core` 以**嵌入模式**运行 Gemini agent（30+ 文件依赖）。这与 Claude Code / Codex 的**子进程模式**（ACP 协议通信）形成对比。

### aioncli-core 在 AionUi 中的定制层

| 定制类别 | 具体内容 | 原生 Gemini CLI 能替代？ |
|---------|---------|----------------------|
| **自定义工具（3 个）** | `aionui_web_fetch`（跨模型 web 抓取）、`gemini_web_search`（让 OpenAI 用 Google 搜索）、`aionui_image_generation`（图片生成/分析） | ❌ 需要改为 MCP Server |
| **多 API Key 轮换** | 自动处理配额耗尽，跨多个 key 切换 | ❌ 原生 CLI 不支持 |
| **权限持久化** | "Always Allow" 存 SQLite，跨会话保持 | ❌ 原生 CLI 每次重新确认 |
| **对话历史注入** | 从 DB 加载近期聊天上下文，注入新会话 | ❌ 子进程模式无法访问 AionUi DB |
| **Stream 容错** | 心跳检测（90s 超时）+ 指数退避重试 + 工具执行保护 | ❌ 原生 CLI 有基础重试但不如深入 |
| **Cron 命令检测** | 自动识别 agent 输出中的定时任务指令 | ❌ 需要在 ACP 层实现 |
| **账户级配置** | Google OAuth 账户 → Cloud Project ID 映射 | ❌ 原生 CLI 单账户模型 |

### 结论

**短期（Margay v1）**：保持 aioncli-core 嵌入模式。定制能力强，切换成本高。

**中期演进方向**：
1. 自定义工具（web_fetch, web_search, image_gen）抽成独立 MCP Server → 即使未来切子进程也能复用
2. 权限持久化 → 探索通过 `.gemini/` 配置文件实现（Gemini CLI v0.23+ 有权限配置）
3. 多 Key 轮换 → 评估是否可以做成代理层（AionUi 作为 API proxy）

**长期（AionUi 告一段落后）**：回到 aioncli-core 本身，考虑：
- 上游贡献：将 AionUi 的定制（Stream 容错、权限持久化）贡献回 aioncli-core
- 独立发展：fork aioncli-core 为 Margay 专属版本，去除 AionUi 绑定
- 架构切换评估：如果 Gemini CLI 的 ACP/MCP 协议成熟到能暴露工具扩展点和权限管理，则可考虑切子进程模式，彻底去除 aioncli-core 依赖
