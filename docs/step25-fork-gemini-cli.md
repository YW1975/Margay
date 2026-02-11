# Step 25: Fork Google gemini-cli → @margay/agent-core

> Date: 2026-02-11
> Status: Plan approved (Lisa [PASS] Round 2), execution pending
> Ralph-Lisa step: step25-fork-aioncli-core

---

## 一、背景与决策过程

### 1.1 原始状态

Margay 通过 npm alias + patch-package 使用 Gemini 引擎核心库：

```json
// package.json
"@margay/agent-core": "npm:@office-ai/aioncli-core@^0.24.4"
```

- `@office-ai/aioncli-core` 是 npm 上的编译后产物（只有 dist/，没有 TypeScript 源码）
- `patches/@margay+agent-core+0.24.4.patch` 修改 ShellExecutionService 解决后台进程清理问题
- 28 个文件、41 条 import 语句依赖此包
- 其中 3 条 deep import 直接引用 `dist/src/mcp/oauth-*.js` 内部路径

### 1.2 关键调研发现

#### 依赖链关系

```
Google 原版 (开源, Apache-2.0, 94k stars)
  github.com/google-gemini/gemini-cli
  packages/core → @google/gemini-cli-core (v0.30.0, 完整 TypeScript 源码)
         │
         │  fork + 改包名 + 加多模型支持
         ▼
office-sec fork (停更)
  github.com/office-sec/aioncli
  packages/core → @office-ai/aioncli-core (v0.24.4)
  新增: anthropicContentGenerator.ts, openaiContentGenerator.ts, bedrockContentGenerator.ts
         │
         │  Margay 当前通过 npm alias 使用
         ▼
Margay (AionUi)
  @margay/agent-core → npm:@office-ai/aioncli-core@^0.24.4 + patch
```

#### Google 原版 vs office-sec fork 对比

| 功能 | Google 原版 (v0.30) | office-sec aioncli (v0.24.4) |
|------|---------------------|------------------------------|
| Gemini 支持 | 有 | 有 |
| Anthropic (Claude) 支持 | 无 | 有 (anthropicContentGenerator.ts) |
| OpenAI 支持 | 无 | 有 (openaiContentGenerator.ts) |
| AWS Bedrock 支持 | 无 | 有 (bedrockContentGenerator.ts) |
| BaseLlmClient 抽象层 | 有 (仅 Gemini) | 有 (扩展为多 provider) |
| Model Router 策略 | 有 | 有 (相同结构) |
| ShellExecutionService | 大改 (新增多个静态属性) | 旧版 (需要补丁) |
| 版本活跃度 | 活跃维护 | 停更 |

#### aioncli monorepo 包结构

| 包 | npm 名 | 作用 | Margay 是否使用 |
|---|--------|------|----------------|
| core | @office-ai/aioncli-core | Gemini 引擎核心 | 是 (28 个文件深度依赖) |
| cli | @google/gemini-cli | 终端 UI (React Ink) | 否 (Margay 有自己的 Electron UI) |
| a2a-server | @google/gemini-cli-a2a-server | Agent-to-Agent 服务器 | 否 |
| test-utils | @google/gemini-cli-test-utils | 测试工具 | 否 |
| vscode-ide-companion | gemini-cli-vscode-ide-companion | VS Code 扩展 | 否 |

### 1.3 决策结论

1. **Fork Google 原版而非 office-sec 二手 fork** — 最新代码、源头级控制、上游同步更容易
2. **独立 repo + submodule** — 不把 gemini-cli 塞进 Margay monorepo
3. **先用 v0.24.x 兼容 commit** — 保证现有 28 个文件的 API 不炸
4. **多模型支持后续移植** — aioncli 的多 provider 功能有价值，但 Margay 已有 ACP 层方案，不急
5. **补丁合入源码** — 拥有 TypeScript 源码后不再需要 patch-package

---

## 二、架构设计

### 2.1 Margay 的多模型方案 vs aioncli 的多模型方案

两种不同层次的多模型支持，不冲突：

```
aioncli 的方式：一个引擎支持多个 LLM API
  ┌─────────────────────────┐
  │  aioncli-core 引擎       │
  │  ├── GeminiChat          │
  │  ├── AnthropicGenerator  │  ← 引擎内部切换 provider
  │  ├── OpenAIGenerator     │
  │  └── ModelRouter         │
  └─────────────────────────┘

Margay 的方式：多个引擎各管一个
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │ Gemini   │ │ Claude   │ │ Codex    │
  │ (嵌入)   │ │ (ACP)    │ │ (ACP)    │
  └──────────┘ └──────────┘ └──────────┘
       ↑ Margay 在上层统一调度
```

用户决策："agent 调用多模型和 agent 支持多模型是两回事"。先解决 Gemini 引擎移植，后续再移植多模型能力。

### 2.2 独立 repo 的理由

| | 放进 Margay (monorepo) | 独立 repo (submodule) |
|---|---|---|
| 同步 Google 上游 | 很难，merge 冲突多 | 容易，git fetch upstream + merge |
| 仓库体积 | gemini-cli 5 个包全塞进来很臃肿 | Margay 保持精简 |
| 后续做 margay cli | 要重建 CLI 结构 | fork 里已有 packages/cli 可直接改造 |
| 职责清晰 | 引擎与 UI 混在一起 | 引擎是引擎，UI 是 UI |

### 2.3 目标结构

```
YW1975/gemini-cli (fork from google-gemini/gemini-cli)
  └── packages/core  → @margay/agent-core (改名)
  └── packages/cli   → 将来改造为 margay cli

AionUi/ (Margay)
  ├── vendor/gemini-cli/        (git submodule, commit-pinned)
  │   └── packages/core/        (@margay/agent-core 源码)
  ├── scripts/bootstrap-vendor.sh (自动 build 脚本)
  ├── package.json              (@margay/agent-core: file:vendor/gemini-cli/packages/core)
  ├── src/                      (import '@margay/agent-core' 不变)
  └── (无 patches/ 目录)
```

---

## 三、执行计划

### Step 25a: Git submodule 集成

1. `git submodule add https://github.com/YW1975/gemini-cli.git vendor/gemini-cli`
2. checkout 到 v0.24.0 tag（最接近 v0.24.4 的兼容版本）
   - Google 原版有 `v0.24.0` tag
   - 需验证 API 与 Margay 的 41 条 import 兼容
3. `git submodule` 锁定到该 commit

### Step 25b: Fork 侧改动

在 `vendor/gemini-cli/packages/core` 中：

1. **改包名**: `package.json` 的 `name` 从 `@google/gemini-cli-core` → `@margay/agent-core`
2. **合入补丁到 TypeScript 源码** (`src/services/shellExecutionService.ts`):
   - 添加 `static trackedProcessGroups: Set<number>`
   - 添加 `static killAllTrackedProcessGroups()` 方法
   - 修改 abort handler: 移除 `!exited` 检查，改为 try-catch
   - 修改 cleanup: 不移除 abort listener（后台子进程可能仍存活）
   - 注意: 如果 v0.24.0 的 ShellExecutionService 结构与 v0.24.4 不同，需适配
3. **补充 barrel export** (`src/index.ts`):
   - 添加 `export { OAUTH_DISPLAY_MESSAGE_EVENT } from './mcp/oauth-provider.js';`
   - 其他 3 个符号 (MCPOAuthProvider, MCPOAuthTokenStorage, MCPOAuthConfig) 已在 barrel 中
4. Build: `npm install && npm run build -w packages/core`
5. Commit + push 到 fork

### Step 25c: Margay 侧改动

1. **创建 `scripts/bootstrap-vendor.sh`**:
   ```bash
   #!/bin/bash
   set -e
   git submodule update --init --recursive
   cd vendor/gemini-cli
   npm install
   npm run build -w packages/core
   echo 'vendor/gemini-cli/packages/core built successfully'
   ```

2. **修改 `package.json`**:
   - 依赖: `"@margay/agent-core": "file:vendor/gemini-cli/packages/core"`
   - 脚本: `"preinstall": "bash scripts/bootstrap-vendor.sh"`

3. **删除 `patches/@margay+agent-core+0.24.4.patch`**

4. **修改 `src/process/services/mcpServices/McpOAuthService.ts`**:
   ```typescript
   // Before (3 条 deep import):
   import { MCPOAuthProvider, OAUTH_DISPLAY_MESSAGE_EVENT } from '@margay/agent-core/dist/src/mcp/oauth-provider.js';
   import { MCPOAuthTokenStorage } from '@margay/agent-core/dist/src/mcp/oauth-token-storage.js';
   import type { MCPOAuthConfig } from '@margay/agent-core/dist/src/mcp/oauth-provider.js';

   // After (2 条标准 import):
   import { MCPOAuthProvider, OAUTH_DISPLAY_MESSAGE_EVENT, MCPOAuthTokenStorage } from '@margay/agent-core';
   import type { MCPOAuthConfig } from '@margay/agent-core';
   ```

### Step 25d: 验证

- `tsc --noEmit` — 类型检查
- `npm test` — 单元测试 (133 tests, 6 suites)
- 手动启动 Margay — 验证 Gemini agent 正常

---

## 四、风险与缓解

| 风险 | 缓解方案 |
|------|---------|
| v0.24.0 与 v0.24.4 有 API 差异 | tsc --noEmit 快速发现；必要时在 fork 中 cherry-pick 缺失 commit |
| Google v0.30 的 ShellExecutionService 结构大改，补丁不适用 | 先用 v0.24.0 tag；v0.30 升级作为独立 step |
| submodule + preinstall 在某些 CI 环境不可用 | 文档说明 fallback: 手动运行 `bash scripts/bootstrap-vendor.sh` |
| npm install 时 file: 依赖需要 dist/ 已存在 | bootstrap 脚本在 preinstall 阶段先 build |

---

## 五、已完成的准备工作

- [x] 用户已 fork google-gemini/gemini-cli → YW1975/gemini-cli
- [x] Fork 已同步到 Google 最新 main (v0.30.0-nightly, commit 6d3fff2ea)
- [x] Fork 已 clone 到本地: `/Users/yinaruto/MyProjects/ChatLLM/Leopar/gemini-cli/`
- [x] 已配置 upstream remote 指向 google-gemini/gemini-cli
- [ ] 待执行: checkout 到 v0.24.0 tag
- [ ] 待执行: submodule 添加到 Margay

---

## 六、后续步骤 (不在本 step)

1. **升级到 Google v0.30** — 适配 API 变化，获取最新功能和修复
2. **移植多模型支持** — 从 office-sec/aioncli cherry-pick anthropicContentGenerator 等
3. **margay cli** — 基于 fork 的 packages/cli 改造为独立终端客户端
4. **自定义工具 → MCP Server** — web_fetch, web_search, image_gen 解耦为独立 MCP server

---

## 七、参考链接

- Google 原版: https://github.com/google-gemini/gemini-cli
- 用户 fork: https://github.com/YW1975/gemini-cli
- office-sec fork (参考): https://github.com/office-sec/aioncli
- 用户 aioncli fork (参考): https://github.com/YW1975/aioncli
- 既有设计文档: `docs/next-phase-design-2026-02-11.md` (Section 1)
- 既有规划文档: `docs/next-phase-plan-2026-02-08.md` (长期方向章节)
