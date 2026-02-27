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

## 九、新增文件清单

```
src/process/services/sync/
├── SyncEngine.ts              # 同步引擎核心
├── SyncStore.ts               # 同步状态持久化
├── CloudSchedulerApi.ts       # 云端 API 客户端
├── types.ts                   # 同步相关类型定义
└── conflictResolver.ts        # 冲突解决策略

src/process/bridges/
└── syncBridge.ts              # IPC Bridge for sync

src/renderer/pages/settings/
└── SyncSettings.tsx           # 同步设置页面

src/renderer/components/cron/
└── ExecutionPolicySelector.tsx # 执行策略选择组件
└── SyncStatusBadge.tsx        # 同步状态徽标
└── CloudExecutionLog.tsx      # 云端执行日志查看
```
