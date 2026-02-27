# Margay → OpenClaw Cloud 任务同步设计方案

## 一、背景与目标

**现状**：Margay 作为桌面端 AI Agent GUI，通过 CronService 管理定时任务，任务的调度和执行完全依赖本地 Electron 进程。OpenClaw 目前仅作为一个本地 ACP 后端（`openclaw acp`）被集成，没有任何云端同步能力。

**目标**：将 Margay 中管理的定时任务（CronJob）同步到 OpenClaw Cloud，使得：
1. 桌面端离线/关机后，云端可自动接管执行定时任务
2. 云端执行结果可回同步到 Margay 本地
3. 支持双向冲突解决（本地修改 vs 云端修改）

---

## 二、整体架构

```
┌─────────────────────────────────┐       ┌──────────────────────────────┐
│         Margay Desktop          │       │      OpenClaw Cloud          │
│                                 │       │                              │
│  ┌───────────┐  ┌────────────┐  │       │  ┌────────────────────────┐  │
│  │CronService│──│ SyncEngine │◄─┼──REST──┼─►│  Cloud Scheduler API   │  │
│  └───────────┘  └────────────┘  │       │  └────────────────────────┘  │
│        │              │         │       │           │                  │
│  ┌─────┴─────┐  ┌─────┴──────┐ │       │  ┌────────┴───────────────┐  │
│  │ CronStore │  │ SyncStore  │ │       │  │  Cloud Agent Runtime   │  │
│  │ (SQLite)  │  │ (SQLite)   │ │       │  │  (OpenClaw ACP)        │  │
│  └───────────┘  └────────────┘ │       │  └────────────────────────┘  │
│        │                       │       │           │                  │
│  ┌─────┴──────────────────┐    │       │  ┌────────┴───────────────┐  │
│  │  AcpAgentManager       │    │       │  │  Execution Log Store   │  │
│  │  (local execution)     │    │       │  │  (results & history)   │  │
│  └────────────────────────┘    │       │  └────────────────────────┘  │
└─────────────────────────────────┘       └──────────────────────────────┘
```

---

## 三、核心模块设计

### 3.1 SyncEngine（同步引擎）

**职责**：协调本地 CronStore 与云端 Cloud Scheduler API 之间的数据同步。

**位置**：`src/process/services/sync/SyncEngine.ts`

```typescript
interface SyncEngine {
  // 初始化：连接云端、加载同步状态
  init(cloudConfig: OpenClawCloudConfig): Promise<void>;

  // 全量同步（启动时 / 手动触发）
  fullSync(): Promise<SyncResult>;

  // 增量同步（CronJob 变更时自动触发）
  pushJobChange(change: JobChange): Promise<void>;

  // 拉取云端执行结果
  pullExecutionResults(): Promise<ExecutionResult[]>;

  // 心跳 & 在线状态
  reportHeartbeat(): void;

  // 断开连接
  disconnect(): void;
}

interface OpenClawCloudConfig {
  apiEndpoint: string;      // e.g. "https://api.openclaw.ai"
  apiKey: string;           // 用户认证 token
  deviceId: string;         // Margay 实例唯一标识
  syncIntervalMs: number;   // 增量同步间隔 (默认 60s)
}
```

### 3.2 SyncStore（同步状态存储）

**职责**：记录每个 CronJob 的同步状态，用于增量同步和冲突检测。

**位置**：`src/process/services/sync/SyncStore.ts`

**数据库表**：
```sql
CREATE TABLE sync_state (
  local_job_id TEXT PRIMARY KEY,          -- 本地 CronJob ID
  remote_job_id TEXT,                      -- 云端任务 ID
  last_synced_at INTEGER,                  -- 上次同步时间戳
  local_version INTEGER DEFAULT 0,         -- 本地版本号
  remote_version INTEGER DEFAULT 0,        -- 云端版本号
  sync_status TEXT DEFAULT 'pending',      -- pending | synced | conflict | cloud_only
  sync_direction TEXT DEFAULT 'bidirectional', -- upload | download | bidirectional
  last_error TEXT,
  cloud_execution_enabled INTEGER DEFAULT 1  -- 是否启用云端执行
);

CREATE TABLE sync_execution_log (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  executed_by TEXT,           -- 'local' | 'cloud'
  executed_at INTEGER,
  status TEXT,                -- 'ok' | 'error'
  result_summary TEXT,
  synced_at INTEGER
);
```

### 3.3 Cloud Scheduler API（云端接口抽象）

**职责**：封装与 OpenClaw Cloud 的 HTTP 通信。

**位置**：`src/process/services/sync/CloudSchedulerApi.ts`

```typescript
interface CloudSchedulerApi {
  // 认证
  authenticate(apiKey: string): Promise<AuthSession>;

  // 任务 CRUD
  createJob(job: CloudJobPayload): Promise<CloudJob>;
  updateJob(remoteId: string, job: Partial<CloudJobPayload>): Promise<CloudJob>;
  deleteJob(remoteId: string): Promise<void>;
  getJob(remoteId: string): Promise<CloudJob>;

  // 批量同步
  listJobs(since?: number): Promise<CloudJob[]>;
  batchSync(changes: JobChange[]): Promise<BatchSyncResult>;

  // 执行结果
  getExecutionLogs(jobId: string, since?: number): Promise<CloudExecutionLog[]>;

  // 设备管理
  registerDevice(deviceInfo: DeviceInfo): Promise<DeviceRegistration>;
  heartbeat(deviceId: string): Promise<HeartbeatResponse>;
}

interface CloudJobPayload {
  name: string;
  schedule: {
    kind: 'cron' | 'every' | 'at';
    value: string;
    timezone?: string;
  };
  message: string;                    // 要发送给 agent 的消息
  agentType: string;                  // 'openclaw' | 'claude' | ...
  agentConfig?: {                     // agent 运行配置
    model?: string;
    workspace?: string;
    skills?: string[];
    rules?: string;
  };
  executionPolicy: {
    preferLocal: boolean;             // 优先本地执行
    cloudFallback: boolean;           // 本地离线时云端接管
    cloudOnly: boolean;               // 仅云端执行
  };
}
```

---

## 四、同步策略

### 4.1 三种执行模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **Local-First** | 本地优先，云端仅在本地离线时接管 | 需要本地文件/工具访问的任务 |
| **Cloud-First** | 云端优先执行，结果同步回本地 | 不依赖本地环境的任务 |
| **Cloud-Only** | 仅在云端运行，本地只查看结果 | 7x24 监控、数据采集类任务 |

### 4.2 同步流程

#### 启动同步（Full Sync）
```
Margay 启动
    │
    ├─ 1. SyncEngine.init() → 连接云端 API
    │
    ├─ 2. registerDevice() → 注册/更新设备信息
    │
    ├─ 3. fullSync():
    │     ├─ 拉取云端所有 job（带 remote_version）
    │     ├─ 比较本地 sync_state 表
    │     ├─ 冲突检测：
    │     │   ├─ local_version > synced_version && remote_version > synced_version → 冲突
    │     │   ├─ local_version > synced_version → 上传
    │     │   └─ remote_version > synced_version → 下载
    │     ├─ 执行合并
    │     └─ 更新 sync_state
    │
    └─ 4. 启动增量同步定时器 (每 60s)
```

#### 增量同步（Incremental Sync）
```
本地 CronJob 变更 (create/update/delete)
    │
    ├─ CronService 执行操作
    ├─ CronStore 写入数据库
    ├─ SyncEngine.pushJobChange()
    │     ├─ 更新 sync_state.local_version++
    │     ├─ 调用 CloudSchedulerApi.batchSync()
    │     └─ 更新 sync_state.remote_version & last_synced_at
    │
    └─ 失败时：标记为 pending，下次增量同步重试
```

#### 心跳与离线检测
```
SyncEngine 每 30s 发送心跳
    │
    ├─ 云端记录设备在线状态
    ├─ 如果连续 3 次心跳丢失 (90s)：
    │     └─ 云端将 Local-First 任务切换为云端执行
    │
    └─ Margay 恢复在线时：
          ├─ 重新注册设备
          ├─ 拉取云端执行期间的 logs
          └─ 将 Local-First 任务切回本地执行
```

### 4.3 冲突解决

采用 **Last-Write-Wins + Version Vector** 策略：

```typescript
function resolveConflict(local: SyncState, remote: CloudJob): Resolution {
  // 时间戳近的优先
  if (local.updatedAt > remote.updatedAt) {
    return { action: 'push_local', reason: 'local is newer' };
  } else {
    return { action: 'pull_remote', reason: 'remote is newer' };
  }
  // 用户也可手动选择保留哪个版本
}
```

---

## 五、集成到现有代码的改动点

### 5.1 CronService 扩展

**文件**：`src/process/services/cron/CronService.ts`

```typescript
// 在现有方法中加入同步钩子

async addJob(params: AddJobParams): Promise<CronJob> {
  const job = await this._addJobInternal(params);
  // ✅ 新增：同步到云端
  if (this.syncEngine?.isConnected()) {
    await this.syncEngine.pushJobChange({
      type: 'create',
      job: this.toCloudPayload(job),
    });
  }
  return job;
}

async updateJob(jobId: string, updates: Partial<CronJob>): Promise<void> {
  await this._updateJobInternal(jobId, updates);
  // ✅ 新增：同步更新到云端
  if (this.syncEngine?.isConnected()) {
    await this.syncEngine.pushJobChange({
      type: 'update',
      jobId,
      updates: this.toCloudPayload(updates),
    });
  }
}

async deleteJob(jobId: string): Promise<void> {
  await this._deleteJobInternal(jobId);
  // ✅ 新增：同步删除到云端
  if (this.syncEngine?.isConnected()) {
    await this.syncEngine.pushJobChange({ type: 'delete', jobId });
  }
}
```

### 5.2 CronJob 数据结构扩展

**文件**：`src/process/services/cron/types.ts`（新增或在现有类型中扩展）

```typescript
interface CronJob {
  // ... 现有字段 ...

  // ✅ 新增：云端同步相关
  sync?: {
    remoteId?: string;           // 云端任务 ID
    executionPolicy: ExecutionPolicy;
    lastSyncedAt?: number;
  };
}

interface ExecutionPolicy {
  mode: 'local-first' | 'cloud-first' | 'cloud-only';
  cloudFallback: boolean;
}
```

### 5.3 新增 IPC Bridge

**文件**：`src/common/ipcBridge.ts`（新增 namespace）

```typescript
// 新增 sync namespace
sync: {
  // Renderer → Main
  connect: (config: OpenClawCloudConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  fullSync: () => Promise<SyncResult>;
  getSyncStatus: () => Promise<SyncStatus>;
  resolveConflict: (jobId: string, resolution: 'local' | 'remote') => Promise<void>;

  // Main → Renderer (events)
  onSyncStatusChanged: EventEmitter<SyncStatus>;
  onConflictDetected: EventEmitter<ConflictInfo>;
  onCloudExecutionResult: EventEmitter<ExecutionResult>;
}
```

### 5.4 数据库迁移

**文件**：`src/process/database/` (新增 migration)

```sql
-- Migration v15: Add sync tables
CREATE TABLE IF NOT EXISTS sync_state (
  local_job_id TEXT PRIMARY KEY,
  remote_job_id TEXT,
  last_synced_at INTEGER,
  local_version INTEGER DEFAULT 0,
  remote_version INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'pending',
  cloud_execution_enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sync_execution_log (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  executed_by TEXT,
  executed_at INTEGER,
  status TEXT,
  result_summary TEXT,
  synced_at INTEGER
);

-- Add sync columns to cron_jobs
ALTER TABLE cron_jobs ADD COLUMN remote_id TEXT;
ALTER TABLE cron_jobs ADD COLUMN execution_policy TEXT DEFAULT 'local-first';
ALTER TABLE cron_jobs ADD COLUMN last_synced_at INTEGER;
```

### 5.5 设置页面 UI

**文件**：`src/renderer/pages/settings/` (新增同步设置)

需要新增：
- OpenClaw Cloud 账号绑定（API Key 配置）
- 同步开关与状态展示
- 每个 CronJob 的执行策略选择（local-first / cloud-first / cloud-only）
- 冲突解决 UI（出现冲突时弹窗让用户选择）
- 云端执行历史查看

---

## 六、OpenClaw Cloud 端需要的能力（假设需新建）

如果 OpenClaw Cloud 还不存在完整的 Scheduler API，需要提供：

```
POST   /api/v1/scheduler/jobs          # 创建任务
GET    /api/v1/scheduler/jobs           # 列出任务（支持 ?since=timestamp）
GET    /api/v1/scheduler/jobs/:id       # 获取单个任务
PUT    /api/v1/scheduler/jobs/:id       # 更新任务
DELETE /api/v1/scheduler/jobs/:id       # 删除任务
POST   /api/v1/scheduler/sync          # 批量同步
GET    /api/v1/scheduler/jobs/:id/logs  # 获取执行日志

POST   /api/v1/devices/register        # 注册设备
POST   /api/v1/devices/:id/heartbeat   # 心跳

POST   /api/v1/auth/token              # 认证获取 token
```

云端执行引擎需要：
- 可运行 OpenClaw Agent 的容器/沙箱环境
- 标准 Cron 调度器（如 Bull/BullMQ + Redis，或 Kubernetes CronJob）
- 任务执行结果的持久化存储
- WebSocket 推送（实时通知 Margay 执行结果）

---

## 七、实现路径建议（分阶段）

### Phase 1: 单向上传（MVP）
- 实现 SyncEngine + CloudSchedulerApi 基础骨架
- CronJob CRUD 时自动上传到云端
- 云端只存储，不执行
- **交付物**：任务列表的云端镜像

### Phase 2: 云端执行
- OpenClaw Cloud 实现 Scheduler + Agent Runtime
- 添加 executionPolicy 支持
- 心跳 + 离线检测 + 自动接管
- **交付物**：桌面离线后云端自动执行

### Phase 3: 双向同步
- 云端变更推送（WebSocket）
- 冲突检测与解决 UI
- 执行日志回同步
- **交付物**：完整的双向同步体验

### Phase 4: 高级功能
- 云端 Workspace 文件同步（选择性）
- Skill 同步到云端
- 多设备协同（多台 Margay 共享同一云端账号）
- 执行结果推送到 Channel（Telegram/Lark/Discord）

---

## 八、安全考量

1. **API Key 管理**：使用 Electron safeStorage 加密存储，不明文写入 SQLite
2. **传输加密**：所有 API 调用走 HTTPS + TLS 1.3
3. **任务内容加密**：敏感的 message payload 可选 E2E 加密（用户持有密钥）
4. **权限隔离**：云端沙箱限制文件系统访问，避免 agent 越权
5. **Yolo Mode 限制**：云端执行时强制关闭 yoloMode，所有工具调用需审批或白名单

---

## 九、对话中长任务推送到云端 OpenClaw

### 9.1 场景分析

除了定时任务的云端同步，还有一个更常见的场景：**用户在对话中让助手执行一个耗时较长的任务**（如代码重构、数据分析、批量文件处理等），希望把这个任务推送到云端 OpenClaw 继续执行，本地不需要保持连接。

**当前执行模型的约束**：

| 约束 | 说明 |
|------|------|
| 进程绑定 | AcpAgentManager 在 Electron 主进程内运行，关闭 Margay 即终止 |
| stdio 管道 | AcpConnection 通过 JSON-RPC over stdio 与 CLI 进程通信，不可跨网络 |
| 会话状态 | acpSessionId 存在 SQLite 中，但会话上下文在本地 CLI 进程内存里 |
| 权限审批 | 执行工具调用时需要用户交互式审批（除非 yoloMode） |
| 本地文件依赖 | Agent 的 workspace、skills 文件都在本地磁盘 |

### 9.2 架构设计：Task Offloading（任务卸载）

```
┌─────────────────────────────────────────────────────────────────┐
│                        Margay Desktop                           │
│                                                                 │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │ AcpAgent     │───►│ TaskOffloader    │───►│ CloudTaskApi  │  │
│  │ Manager      │    │                  │    │ (REST+WS)     │  │
│  │ (local exec) │    │ • snapshot ctx   │    │               │  │
│  └──────────────┘    │ • upload files   │    └───────┬───────┘  │
│        │             │ • switch to proxy│            │          │
│  ┌─────┴──────┐      └──────────────────┘            │          │
│  │ Conversation│                                     │          │
│  │ UI (React)  │◄───── WebSocket ────────────────────┘          │
│  │ • progress  │     (实时推送执行状态)                           │
│  │ • results   │                                                 │
│  └─────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                         HTTPS + WSS
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                       OpenClaw Cloud                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Task Execution Engine                                    │  │
│  │                                                           │  │
│  │  ┌──────────────┐    ┌────────────┐    ┌──────────────┐   │  │
│  │  │ Task Queue   │───►│ Agent Pool │───►│ Result Store │   │  │
│  │  │ (接收任务)    │    │ (OpenClaw  │    │ (执行结果)    │   │  │
│  │  │              │    │  sandbox)  │    │              │   │  │
│  │  └──────────────┘    └────────────┘    └──────────────┘   │  │
│  │                           │                               │  │
│  │                    ┌──────┴──────┐                         │  │
│  │                    │ Cloud       │                         │  │
│  │                    │ Workspace   │                         │  │
│  │                    │ (文件快照)   │                         │  │
│  │                    └─────────────┘                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Notification Gateway                                     │  │
│  │  • WebSocket push → Margay (实时进度)                      │  │
│  │  • Webhook → Channel plugins (完成通知)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.3 核心流程：任务卸载（Task Offloading）

用户在对话中点击 "推送到云端" 按钮触发：

```
Step 1: 上下文快照 (Context Snapshot)
    │
    ├─ 提取当前对话历史 (messages[])
    ├─ 提取助手配置 (assistantRule, enabledSkills)
    ├─ 提取 Agent 配置 (model, backend, acpSessionId)
    ├─ 打包 workspace 关键文件 (可选，用户勾选)
    └─ 生成 TaskSnapshot 对象

Step 2: 上传到云端 (Upload)
    │
    ├─ POST /api/v1/tasks/offload  ── 上传 TaskSnapshot
    ├─ 如果有文件 → 分块上传到 Cloud Workspace
    └─ 云端返回 cloudTaskId + wsChannel

Step 3: 本地切换为代理模式 (Proxy Mode)
    │
    ├─ 停止本地 AcpAgent 进程 (agent.stop())
    ├─ 将 AcpAgentManager 替换为 CloudProxyManager
    ├─ CloudProxyManager 连接 WebSocket 订阅云端进度
    └─ UI 显示 "云端执行中..." + 实时进度

Step 4: 云端执行 (Cloud Execution)
    │
    ├─ 云端 Agent Pool 启动 OpenClaw Agent
    ├─ 加载对话历史 + skills + rules
    ├─ 继续执行用户的原始请求
    ├─ 工具调用策略：
    │   ├─ 白名单工具 → 自动执行
    │   ├─ 需审批工具 → WebSocket 推送到 Margay 让用户审批
    │   └─ 文件操作 → 在 Cloud Workspace 内执行
    └─ 实时推送 streaming updates 到 Margay

Step 5: 结果回收 (Result Collection)
    │
    ├─ 执行完成后，云端发送 finish 信号
    ├─ Margay 拉取完整执行结果
    ├─ 更新本地对话历史 (合并云端新消息)
    ├─ 如有文件变更 → 可选下载到本地 workspace
    └─ CloudProxyManager 切回正常模式
```

### 9.4 TaskSnapshot 数据结构

```typescript
interface TaskSnapshot {
  // 任务标识
  taskId: string;                      // 本地生成的唯一 ID
  conversationId: string;              // 对应的本地对话 ID
  createdAt: number;

  // 对话上下文
  context: {
    messages: SnapshotMessage[];       // 对话历史（可截断到最近 N 轮）
    pendingMessage?: string;           // 尚未完成的用户请求
    agentSessionId?: string;           // ACP session ID (用于 resume)
  };

  // Agent 配置
  agent: {
    backend: string;                   // 'openclaw' | 'claude' | ...
    model?: string;                    // 模型选择
    rules?: string;                    // 助手预设规则 (assistant rule)
    skills: SkillManifest[];           // 启用的 skill 列表 + 内容
    mcpServers?: McpServerConfig[];    // MCP 服务器配置
  };

  // 执行策略
  execution: {
    permissionPolicy: PermissionPolicy;
    maxDurationMs: number;             // 最长执行时间 (默认 30 min)
    notifyOnComplete: boolean;         // 完成后通知
    notifyChannels?: string[];         // 'telegram' | 'lark' | 'discord'
  };

  // 文件快照（可选）
  workspace?: {
    files: WorkspaceFile[];            // 需要的文件列表
    uploadId?: string;                 // 已上传文件的引用 ID
  };
}

// 权限策略
interface PermissionPolicy {
  mode: 'auto-approve' | 'ask-user' | 'whitelist';
  whitelist?: string[];                // 允许自动执行的工具名
  // ask-user: 通过 WebSocket 推送到 Margay 让用户审批
  // auto-approve: 类似 yoloMode
  // whitelist: 只自动执行白名单中的工具
}
```

### 9.5 CloudProxyManager（云端代理管理器）

替代 AcpAgentManager，在本地任务被推送到云端后接管通信：

```typescript
// src/process/task/CloudProxyManager.ts

class CloudProxyManager extends BaseAgentManager {
  private ws: WebSocket;
  private cloudTaskId: string;

  constructor(data: {
    conversation_id: string;
    cloudTaskId: string;
    wsEndpoint: string;
    authToken: string;
  }) {
    super(data);
    this.cloudTaskId = data.cloudTaskId;
  }

  async init(): Promise<void> {
    // 连接云端 WebSocket
    this.ws = new WebSocket(data.wsEndpoint);
    this.ws.on('message', this.handleCloudMessage.bind(this));
  }

  private handleCloudMessage(raw: string): void {
    const message = JSON.parse(raw);

    switch (message.type) {
      case 'stream_update':
        // 透传 streaming 消息到 UI（与本地 ACP 格式兼容）
        const responseMsg = this.transformCloudMessage(message);
        addOrUpdateMessage(this.conversation_id, responseMsg);
        ipcBridge.acpConversation.responseStream.emit(responseMsg);
        break;

      case 'permission_request':
        // 云端需要用户审批某个工具调用
        this.addConfirmation(message.callId, message.toolInfo);
        break;

      case 'finish':
        // 云端执行完成
        this.handleCloudFinish(message);
        break;

      case 'error':
        this.handleCloudError(message);
        break;
    }
  }

  // 用户审批后，将结果推回云端
  async confirm(id: string, callId: string, data: AcpPermissionOption): Promise<void> {
    this.ws.send(JSON.stringify({
      type: 'permission_response',
      callId,
      decision: data.optionId,  // 'allow' | 'reject'
    }));
  }

  // 发送追加消息（用户在云端执行期间继续输入）
  async sendMessage(data: { content: string }): Promise<void> {
    this.ws.send(JSON.stringify({
      type: 'user_message',
      content: data.content,
    }));
  }

  async stop(): Promise<void> {
    // 请求云端取消任务
    this.ws.send(JSON.stringify({ type: 'cancel' }));
    this.ws.close();
  }
}
```

### 9.6 UI 交互设计

#### 推送入口

在对话界面中，当 Agent 正在执行长任务时，显示一个浮动操作按钮：

```
┌──────────────────────────────────────────────┐
│  🔄 Agent 正在执行...  (已运行 2m30s)         │
│                                              │
│  [推送到云端执行]  [取消任务]                   │
└──────────────────────────────────────────────┘
```

或者在发送消息时就可以选择执行位置：

```
┌──────────────────────────────────────────────┐
│  输入框                                       │
│  ┌────────────────────────────────────────┐  │
│  │ 请帮我重构整个 src/utils 目录...         │  │
│  └────────────────────────────────────────┘  │
│  [发送 ▼]                                    │
│    ├─ 本地执行 (默认)                         │
│    └─ 云端执行                               │
└──────────────────────────────────────────────┘
```

#### 云端执行状态

```
┌──────────────────────────────────────────────┐
│  ☁️ 云端执行中  (OpenClaw Cloud)              │
│  ────────────────────────────────────────── │
│  ▶ 正在分析代码结构...                        │
│  ✅ 已完成 3/8 个文件的重构                    │
│  ▶ 正在处理 src/utils/parser.ts              │
│                                              │
│  [拉回本地]  [取消]                           │
│                                              │
│  ⚠️ 需要审批：Agent 要执行 rm 命令             │
│  [允许]  [拒绝]  [总是允许]                    │
└──────────────────────────────────────────────┘
```

### 9.7 关键问题与解决方案

#### Q1: 对话历史太长怎么办？

```typescript
// 智能截断策略
function truncateForCloud(messages: Message[]): SnapshotMessage[] {
  const MAX_CONTEXT_TOKENS = 50000;

  // 1. 保留 system prompt（rules + skills）
  // 2. 保留最近 N 轮对话
  // 3. 对更早的对话做摘要压缩
  // 4. 保留所有 tool_call 结果（重要上下文）

  return smartTruncate(messages, MAX_CONTEXT_TOKENS);
}
```

#### Q2: 本地文件依赖怎么处理？

三种策略，按任务特点选择：

| 策略 | 做法 | 适用场景 |
|------|------|----------|
| **不传文件** | Agent 在云端沙箱中工作，无本地文件 | 纯对话/知识问答/API 调用类任务 |
| **选择性上传** | 用户勾选必需文件，打包上传到 Cloud Workspace | 代码审查、文档处理 |
| **Git 仓库挂载** | 云端克隆用户的 Git 仓库，执行完后提 PR | 代码重构、批量修改 |

#### Q3: 工具调用的权限怎么控制？

```typescript
// 分层权限模型
const CLOUD_PERMISSION_TIERS = {
  // Tier 1: 自动允许（安全、只读）
  auto_allow: [
    'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch',
    'ListDirectory', 'GetFileInfo',
  ],

  // Tier 2: 需要用户审批（有副作用）
  ask_user: [
    'Write', 'Edit', 'Bash', 'NotebookEdit',
    'CreateFile', 'DeleteFile',
  ],

  // Tier 3: 云端禁止（危险操作）
  deny: [
    'Bash:rm -rf', 'Bash:git push --force',
    'Bash:sudo', 'Bash:curl|sh',
  ],
};
```

#### Q4: Margay 离线了怎么办？

```
云端执行中 + Margay 断开连接
    │
    ├─ 遇到 auto_allow 的工具 → 继续自动执行
    ├─ 遇到 ask_user 的工具 →
    │   ├─ 有预设 whitelist → 自动允许
    │   └─ 无预设 → 暂停执行，等待 Margay 重连或超时
    │
    └─ 执行完成 →
        ├─ 存储结果到 Result Store
        ├─ 通过 Channel (Telegram/Lark) 发送完成通知
        └─ Margay 重连后自动拉取结果
```

#### Q5: 如何实现 "正在执行中" 的任务平滑迁移？

这是最复杂的场景——任务已经在本地开始执行了一部分，中途想推送到云端。

```typescript
// 方案 A: 中断-重启 (Interrupt & Restart) — 推荐
async function offloadRunningTask(manager: AcpAgentManager): Promise<string> {
  // 1. 停止本地 Agent
  await manager.stop();

  // 2. 提取已完成的对话历史作为上下文
  const messages = getMessagesForConversation(manager.conversation_id);

  // 3. 构造 snapshot，包含 "请继续完成以下任务" 的 meta 提示
  const snapshot: TaskSnapshot = {
    context: {
      messages: truncateForCloud(messages),
      pendingMessage: '请继续完成上面的任务。之前的执行已在本地完成了一部分，请基于对话历史继续。',
    },
    // ...
  };

  // 4. 上传并在云端启动新 session
  const { cloudTaskId } = await cloudApi.offloadTask(snapshot);

  // 5. 切换到 CloudProxyManager
  WorkerManage.replaceTask(manager.conversation_id, new CloudProxyManager({ cloudTaskId }));

  return cloudTaskId;
}

// 方案 B: Session 迁移 (Session Migration) — 理想但依赖后端支持
// 如果 OpenClaw ACP 支持 session export/import：
async function migrateSession(manager: AcpAgentManager): Promise<string> {
  // 1. 导出本地 ACP session 状态
  const sessionState = await manager.agent.exportSession();

  // 2. 上传 session state 到云端
  const { cloudTaskId } = await cloudApi.importSession(sessionState);

  // 3. 云端恢复 session 继续执行
  // 这要求 ACP 协议支持 session serialization
}
```

**推荐方案 A（中断-重启）**，原因：
- 不依赖 ACP 协议扩展
- 大模型有能力从对话历史恢复上下文
- 实现复杂度低
- 兼容所有 ACP 后端（不止 OpenClaw）

### 9.8 集成到现有代码的改动点

| 改动文件 | 改动内容 |
|----------|----------|
| `AcpAgentManager.ts` | 新增 `offloadToCloud()` 方法，构造 TaskSnapshot |
| `WorkerManage.ts` | 新增 `replaceTask()` 方法，支持运行时替换 manager |
| `conversationBridge.ts` | 新增 `offloadToCloud` / `pullBackFromCloud` IPC |
| `ipcBridge.ts` | 新增 `cloud.*` namespace (offload, status, cancel, pullBack) |
| `BaseAgentManager.ts` | 新增 `isCloudProxy` 属性标识当前是否为代理模式 |
| 新增 `CloudProxyManager.ts` | WebSocket 代理管理器 |
| 新增 `TaskOffloader.ts` | 快照构造 + 上传逻辑 |
| 新增 `CloudTaskApi.ts` | 云端任务 API 客户端 |
| UI: 对话页面 | 添加 "推送到云端" 按钮和云端执行状态组件 |

### 9.9 与定时任务同步的关系

这两个功能互补但独立：

```
┌─────────────────────────┐    ┌─────────────────────────┐
│ 定时任务同步 (CronSync)  │    │ 对话任务卸载 (Offload)  │
│                         │    │                         │
│ • 预定义的周期性任务     │    │ • 临时的、一次性长任务   │
│ • 主要同步任务定义       │    │ • 主要传输执行上下文     │
│ • 离线接管为核心价值     │    │ • 释放本地资源为核心价值  │
│ • CronService 驱动      │    │ • 用户手动触发           │
│ • 使用 SyncEngine       │    │ • 使用 TaskOffloader     │
│                         │    │                         │
│ 共享：CloudTaskApi,     │    │ 共享：CloudTaskApi,      │
│   认证, WebSocket 通道   │    │   认证, WebSocket 通道    │
└─────────────────────────┘    └─────────────────────────┘
```

---

## 十、完整新增文件清单

```
src/process/services/sync/
├── SyncEngine.ts              # 定时任务同步引擎
├── SyncStore.ts               # 同步状态持久化
├── CloudSchedulerApi.ts       # 云端定时任务 API 客户端
├── types.ts                   # 同步相关类型定义
└── conflictResolver.ts        # 冲突解决策略

src/process/services/cloud/
├── TaskOffloader.ts           # 对话任务卸载（快照 + 上传）
├── CloudTaskApi.ts            # 云端任务执行 API 客户端
├── CloudProxyManager.ts       # WebSocket 代理管理器
└── types.ts                   # 云端任务相关类型

src/process/bridges/
├── syncBridge.ts              # 定时任务同步 IPC Bridge
└── cloudBridge.ts             # 云端任务卸载 IPC Bridge

src/renderer/pages/settings/
└── SyncSettings.tsx           # 同步 & 云端设置页面

src/renderer/components/cloud/
├── OffloadButton.tsx          # "推送到云端" 操作按钮
├── CloudExecutionStatus.tsx   # 云端执行实时状态组件
├── PermissionRelay.tsx        # 云端权限审批透传组件
└── CloudResultViewer.tsx      # 云端执行结果查看

src/renderer/components/cron/
├── ExecutionPolicySelector.tsx # 执行策略选择组件
├── SyncStatusBadge.tsx        # 同步状态徽标
└── CloudExecutionLog.tsx      # 云端执行日志查看
```

---

## 十一、实现优先级建议

综合两个场景（定时任务同步 + 对话任务卸载），建议的实施顺序：

### Phase 1: 基础设施 (Week 1-2)
- OpenClawCloudConfig 配置 UI + 认证
- CloudTaskApi 基础通信层
- WebSocket 连接管理
- 数据库 migration (sync_state, cloud_tasks 表)

### Phase 2: 对话任务卸载 MVP (Week 3-4)
- TaskOffloader: 对话快照构造 + 上传
- CloudProxyManager: WebSocket 代理接收云端消息
- UI: "推送到云端" 按钮 + 基本状态展示
- 云端 API: 接收 snapshot → 启动 Agent → 流式返回

### Phase 3: 定时任务同步 (Week 5-6)
- SyncEngine: 全量 + 增量同步
- CronService 集成同步钩子
- 心跳 + 离线检测 + 云端接管
- UI: 执行策略选择 + 同步状态

### Phase 4: 完善体验 (Week 7-8)
- 权限审批透传（WebSocket relay）
- 文件上传/下载 + Git 仓库挂载
- Channel 通知集成（完成后推送 Telegram/Lark）
- 冲突解决 UI + 多设备协同
