# AionUi v2 Implementation Plan

## Step 1: outputUpdateHandler — 修复 Gemini shell 命令阻塞

### 现状分析
- **阻塞点:** `await this.scheduler.schedule(toolCallRequests, abortController.signal)` (`src/agent/gemini/index.ts:500`)
- `schedule()` 会等待所有工具调用（包括 shell 命令）完成后才 resolve
- 如果 shell 命令长时间运行（如 dev server），整个 `submitQuery` 流程被阻塞
- `initToolScheduler` (lines 312-383) 中的 `onAllToolCallsComplete` 是完成回调，`onToolCallsUpdate` 是实时更新回调 — 这些是 scheduler 的消费端，不是阻塞源
- 需要验证: `outputUpdateHandler` 如何接入 schedule/abort 路径，以及 abort 能否中断正在执行的 shell 命令

### 实施方案
1. 研究 `CoreToolScheduler.schedule()` 的内部逻辑（来自 `@office-ai/aioncli-core`）
2. 确认 `abortController.signal` 是否能中断正在运行的 shell 命令
3. 验证 `outputUpdateHandler` 与 schedule 的交互方式
4. 实现修复: 确保长时间 shell 命令不阻塞对话流 (可能方案: 超时机制 / abort 传播 / 后台降级)
5. 确保 `onToolCallsUpdate` 实时回调在修复后仍正常工作

### 验收标准
- [ ] 前台命令 (build/test) 超时后能被 abort 中断
- [ ] 后台命令 (dev server 等) 通过 shell-bg 规则自动加 `&`，不进入 schedule 等待
- [ ] 用户手动中止对话时，scheduler 能正确 abort 当前 shell 命令
- [ ] `onToolCallsUpdate` 实时更新不受影响

### 影响范围
- `src/agent/gemini/index.ts` — `submitQuery` 方法 (line 500 附近)
- 可能涉及 `@office-ai/aioncli-core` 的 CoreToolScheduler

---

## Step 2: shell-bg skill — 后台进程识别 skill

### 现状分析
- `skills/_builtin/shell-bg/SKILL.md` 已定义了基础的前台/后台命令分类
- 规则: build/test/script → 前台; server/watcher → 后台
- 后台命令格式: `command > /dev/null 2>&1 & BG_PID=$! && sleep 8 && echo "✓ Process started (PID: $BG_PID)"`

### 实施方案
1. 审查并增强现有 SKILL.md 规则
2. 确保 Gemini agent 正确加载和应用 shell-bg skill
3. 验证后台进程 PID 追踪机制

### 验收标准
- [ ] `npm run dev` / `python -m http.server` 等命令自动加 `&` 不阻塞对话
- [ ] `npm test` / `npm run build` 等命令保持前台执行
- [ ] 后台进程 PID 正确输出，可通过 `ps -p <PID>` 检查状态

### 影响范围
- `skills/_builtin/shell-bg/SKILL.md`

---

## Step 3: Sidebar overlap — macOS 红绿灯遮挡修复

### 现状分析
- `src/renderer/components/Titlebar/index.tsx:66`
- 当前 collapsed 状态下 marginLeft = `60px`
- macOS 窗口控制按钮(红黄绿三个圆点)位于左上角，被侧边栏遮挡

### 实施方案
1. 将 collapsed 状态下的 marginLeft 从 `60px` 改为 `80px`
2. 验证不影响 Windows/Linux 和 WebUI 模式
3. 验证展开状态(`210px`)不需要调整

### 验收标准
- [ ] macOS collapsed 模式下红绿灯按钮完全可见可点击
- [ ] Windows/Linux 不受影响（不显示 macOS 红绿灯）
- [ ] WebUI 模式不受影响
- [ ] 展开状态 (210px) 布局正常

### 影响范围
- `src/renderer/components/Titlebar/index.tsx` — 一行修改

---

## Step 4: Permission persistence — 权限记忆持久化

### 现状分析
- `GeminiApprovalStore` 继承自 `BaseApprovalStore`
- 使用内存中的 `Map<string, boolean>` 存储审批决策
- 对话关闭或应用重启后数据丢失
- 需要持久化到 SQLite (Better SQLite3)

### 实施方案
1. 设计 DB schema: `approval_cache` 表
   - `id`, `conversation_id`, `action`, `identifier`, `approved`, `created_at`
2. 扩展 `BaseApprovalStore` 或 `GeminiApprovalStore` 支持 DB 读写
3. 启动时从 DB 加载，approve 时写入 DB
4. 提供清除 API (按 conversation 或全部清除)

### 验收标准
- [ ] 用户批准 `curl` 命令后，重启应用/新开对话仍记住该权限
- [ ] 按 conversation 隔离的权限正确加载
- [ ] 提供"清除全部权限"功能
- [ ] 权限数据不会无限膨胀（有过期或容量机制）

### 影响范围
- `src/common/approval/ApprovalStore.ts`
- `src/agent/gemini/GeminiApprovalStore.ts`
- DB migration / schema
- IPC bridge 可能需要新的 provider

---

## Step 5: Tree-kill for Gemini — 进程树终止

### 现状分析
- `AcpConnection.ts:878-902` 已使用 `tree-kill` 做进程清理
- `CodexConnection.ts` 同样使用 `tree-kill`
- Gemini agent (`src/agent/gemini/index.ts`) 没有对应的进程树清理
- Gemini agent 的 shell 命令通过 `CoreToolScheduler` → shell 工具执行，子进程 PID 需要追踪

### 实施方案
1. 分析 Gemini agent 的 shell 工具如何 spawn 子进程 (通过 CoreToolScheduler)
2. 在 Gemini agent 的 disconnect/cleanup 方法中添加 tree-kill
3. 参考 AcpConnection 的实现模式
4. 确保所有 shell 工具执行的子进程都能被正确追踪和清理

### 验收标准
- [ ] Gemini 对话关闭时，所有 shell 子进程被 SIGTERM 终止
- [ ] 孤儿进程不会残留（用 `ps aux | grep` 验证）
- [ ] tree-kill 失败时有错误日志
- [ ] 不影响正常的工具调用生命周期

### 影响范围
- `src/agent/gemini/index.ts` — cleanup/disconnect 方法

---

## Step 6: Skill architecture overhaul — 移除注入，改为分发

### 现状分析
AionUi 自定义 skill loading/injection 系统与三个底层 CLI 工具的原生 skill 系统重复:
- **Gemini CLI**: `SkillManager` + `activate_skill` tool + lazy loading (aioncli-core)
- **Claude Code**: `.claude/skills/` discovery + description budget + auto/manual activation
- **Codex**: `.agents/skills/` discovery + progressive disclosure

### 要移除的组件
| 组件 | 文件 | 操作 |
|------|------|------|
| `buildSystemInstructions()` | `agentUtils.ts:28-49` | **REMOVE** — 让 aioncli-core 处理 |
| `loadSkillsContent()` | `initStorage.ts:763+` | **REMOVE** — 不再需要 body 注入 |
| `prepareFirstMessageWithSkillsIndex()` | `agentUtils.ts:76-130` | **REMOVE** — Claude Code 原生发现 |
| `AcpSkillManager` | `AcpSkillManager.ts` | **REMOVE** — Claude Code 有自己的发现 |
| `GeminiAgent.filterSkills()` | `index.ts:269-273` | **REPLACE** — 用 `disabledSkills` config |

### 要保留/重构的组件
| 组件 | 文件 | 操作 |
|------|------|------|
| `initBuiltinAssistantRules()` skill copy | `initStorage.ts:356-407` | **KEEP** — 分发 builtin skills |
| `CronCommandDetector` | `CronCommandDetector.ts` | **KEEP** — output 解析与 skill loading 无关 |

### 实施方案

#### 6a. Gemini 路径
1. 停止调用 `buildSystemInstructions()` 进行 skill body 注入
2. 停止调用 `filterSkills()` (post-init)
3. 改为传递 `disabledSkills` 给 Config 构造函数:
   ```typescript
   const allSkills = this.config.getSkillManager().getSkills().map(s => s.name);
   const disabledSkills = allSkills.filter(s => !enabledSet.has(s));
   ```
4. 让 `activate_skill` 工具处理 lazy loading

#### 6b. ACP (Claude Code) 路径
1. 停止调用 `prepareFirstMessageWithSkillsIndex()`
2. 确保 builtin skills (cron, shell-bg) 存在于 `.claude/skills/` (symlink 或 copy)
3. Claude Code 自行发现和加载

#### 6c. Codex 路径
1. 确保 skills 存在于 `.agents/skills/`
2. Codex 自行发现和加载

#### 6d. Preset 迁移
- `enabledSkills` → 计算 `disabledSkills` (反转逻辑)
- 所有发现的 skills 默认可用，除非明确禁用

### 验收标准
- [ ] Gemini: `activate_skill` 工具能正确 lazy-load skill (不再是 full-body injection)
- [ ] ACP: Claude Code 从 `.claude/skills/` 自动发现 builtin skills
- [ ] `buildSystemInstructions()` 和 `prepareFirstMessageWithSkillsIndex()` 已删除
- [ ] `AcpSkillManager.ts` 已删除
- [ ] Cron skill 功能不受影响 (`[CRON_CREATE]` 语法正常工作)
- [ ] Preset 的 `enabledSkills` 配置正确转换为 `disabledSkills`
- [ ] SKILL.md 格式仅使用 `name` + `description` frontmatter (跨引擎兼容)

### 影响范围
- `src/process/task/agentUtils.ts` — 删除 skill injection 函数
- `src/process/task/AcpSkillManager.ts` — 删除整个文件
- `src/process/initStorage.ts` — 删除 `loadSkillsContent()`，保留 builtin copy
- `src/agent/gemini/index.ts` — 替换 `filterSkills()` 为 `disabledSkills`
- `src/agent/gemini/cli/config.ts` — 可能需要传递 `disabledSkills`
- Skill 分发逻辑 (symlink/copy 到引擎目录)

---

## 执行顺序 (Authoritative)

| 顺序 | Step | 复杂度 | 依赖 | 理由 |
|------|------|--------|------|------|
| 1 | Step 3 (Sidebar overlap) | 低 | 无 | 一行改动，快速验证流程 |
| 2 | Step 2 (shell-bg skill) | 低 | 无 | Step 1 的前置知识，理解后台规则 |
| 3 | Step 1 (outputUpdateHandler) | 中 | Step 2 完成后 | 需要 shell-bg 规则确认后才能判断阻塞边界 |
| 4 | Step 5 (Tree-kill) | 中 | Step 1 完成后 | 需要理解 Gemini shell 进程生命周期 |
| 5 | Step 4 (Permission persistence) | 高 | 无 (独立) | 涉及 DB/IPC |
| 6 | Step 6 (Skill overhaul) | 中 | 无 (独立) | 放最后：代码删除为主，需要前面 Steps 稳定后再重构 |

**注意:** Step 6 放在最后不是因为延后，而是因为它以删除/重构为主，需要在 Steps 1-5 的功能变更稳定后再清理注入代码，避免同时修改相同文件导致冲突。
