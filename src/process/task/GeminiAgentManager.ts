/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'path';
import { channelEventBus } from '@/channels/agent/ChannelEventBus';
import { ipcBridge } from '@/common';
import type { IMessageToolGroup, TMessage } from '@/common/chatLib';
import { transformMessage } from '@/common/chatLib';
import type { IResponseMessage } from '@/common/ipcBridge';
import type { IMcpServer, TProviderWithModel } from '@/common/storage';
import { ProcessConfig, getSkillsDir } from '@/process/initStorage';
import { distributeForGemini } from './SkillDistributor';
import { uuid } from '@/common/utils';
import { getOauthInfoWithCache } from '@/agent/gemini/auth-compat';
import { GeminiApprovalStore } from '../../agent/gemini/GeminiApprovalStore';
import { ToolConfirmationOutcome } from '../../agent/gemini/cli/tools/tools';
import { addMessage, addOrUpdateMessage, nextTickToLocalFinish } from '../message';
import { cronBusyGuard } from '@process/services/cron/CronBusyGuard';
import { handlePreviewOpenEvent } from '../utils/previewUtils';
import BaseAgentManager from './BaseAgentManager';
import { hasCronCommands } from './CronCommandDetector';
import { extractTextFromMessage, processCronInMessage } from './MessageMiddleware';

// gemini agent管理器类
type UiMcpServerConfig = {
  command: string;
  args: string[];
  env: Record<string, string>;
  description?: string;
};

export class GeminiAgentManager extends BaseAgentManager<
  {
    workspace: string;
    model: TProviderWithModel;
    imageGenerationModel?: TProviderWithModel;
    webSearchEngine?: 'google' | 'default';
    mcpServers?: Record<string, UiMcpServerConfig>;
    contextFileName?: string;
    // 系统规则 / System rules
    presetRules?: string;
    contextContent?: string; // 向后兼容 / Backward compatible
    GOOGLE_CLOUD_PROJECT?: string;
    /** 内置 skills 目录路径 / Builtin skills directory path */
    skillsDir?: string;
    /** 工作空间级 skills 目录路径 / Workspace-specific skills directory path */
    workspaceSkillsDir?: string;
    /** Yolo mode: auto-approve all tool calls / 自动允许模式 */
    yoloMode?: boolean;
    /** L2 助手跨会话记忆 / L2 assistant cross-session memory */
    assistantMemory?: string;
    /** L3 工作空间共享记忆 / L3 workspace shared memory */
    workspaceMemory?: string;
  },
  string
> {
  workspace: string;
  model: TProviderWithModel;
  contextFileName?: string;
  presetRules?: string;
  presetAssistantId?: string;
  contextContent?: string;
  private bootstrap: Promise<void>;

  /** Session-level approval store for "always allow" memory */
  readonly approvalStore = new GeminiApprovalStore();

  /** Load persisted approvals from database into memory (global + workspace-scoped) */
  private loadPersistedApprovals(): void {
    import('@process/database')
      .then(({ getDatabase }) => {
        const db = getDatabase();
        // Load global approvals + approvals scoped to this workspace
        const result = db.getGeminiApprovals(this.workspace);
        if (!result.success) {
          console.warn('[GeminiAgent] Failed to load persisted approvals from DB:', result.error);
          return;
        }
        if (result.data && result.data.length > 0) {
          this.approvalStore.loadFromPersistedData(result.data);
          console.log(`[GeminiAgent] Loaded ${result.data.length} persisted approvals`);
        }
      })
      .catch((error) => {
        console.warn('[GeminiAgent] Failed to load persisted approvals:', error);
      });
  }

  private async injectHistoryFromDatabase(): Promise<void> {
    // ... (omitting injectHistoryFromDatabase for space)
  }

  /** Force yolo mode (for cron jobs) / 强制 yolo 模式（用于定时任务） */
  private forceYoloMode?: boolean;

  constructor(
    data: {
      workspace: string;
      conversation_id: string;
      webSearchEngine?: 'google' | 'default';
      contextFileName?: string;
      // 系统规则 / System rules
      presetRules?: string;
      contextContent?: string; // 向后兼容 / Backward compatible
      /** Force yolo mode (for cron jobs) / 强制 yolo 模式（用于定时任务） */
      yoloMode?: boolean;
      /** 预设助手 ID（用于 L2 记忆查找）/ Preset assistant ID (for L2 memory lookup) */
      presetAssistantId?: string;
    },
    model: TProviderWithModel
  ) {
    super('gemini', { ...data, model });
    this.workspace = data.workspace;
    this.conversation_id = data.conversation_id;
    this.model = model;
    this.contextFileName = data.contextFileName;
    this.presetRules = data.presetRules;
    this.presetAssistantId = data.presetAssistantId;
    this.forceYoloMode = data.yoloMode;
    // 向后兼容 / Backward compatible
    this.contextContent = data.contextContent || data.presetRules;
    // Load persisted approvals from database
    this.loadPersistedApprovals();
    this.bootstrap = Promise.all([ProcessConfig.get('gemini.config'), this.getImageGenerationModel(), this.getMcpServers()])
      .then(async ([config, imageGenerationModel, mcpServers]) => {
        // 获取当前账号对应的 GOOGLE_CLOUD_PROJECT
        // Get GOOGLE_CLOUD_PROJECT for current account
        let projectId: string | undefined;
        try {
          const oauthInfo = await getOauthInfoWithCache(config?.proxy);
          if (oauthInfo && oauthInfo.email && config?.accountProjects) {
            projectId = config.accountProjects[oauthInfo.email];
          }
          // 注意：不使用旧的全局 GOOGLE_CLOUD_PROJECT 回退，因为可能属于其他账号
          // Note: Don't fall back to old global GOOGLE_CLOUD_PROJECT, it might belong to another account
        } catch {
          // 获取账号失败时不设置 projectId，让系统使用默认值
          // If account retrieval fails, don't set projectId, let system use default
        }

        // Distribute Margay skills to Gemini workspace discovery dir (bootstrap-only)
        // 在 bootstrap 时将 Margay skills 分发到 Gemini 工作空间发现目录
        distributeForGemini(this.workspace);

        // Determine yoloMode: forceYoloMode (cron jobs) takes priority over config setting
        // 确定 yoloMode：forceYoloMode（定时任务）优先于配置设置
        const yoloMode = this.forceYoloMode ?? config?.yoloMode ?? false;

        // Workspace skills directory for Gemini to load workspace-specific skills
        const workspaceSkillsDir = path.join(this.workspace, '.margay', 'skills');

        // Load L2/L3 organizational memory for Gemini userMemory injection
        // 加载 L2/L3 组织记忆用于 Gemini userMemory 注入
        let assistantMemory: string | undefined;
        let workspaceMemory: string | undefined;
        try {
          const { getMemoryDir } = await import('../initStorage');
          const { MemoryFileManager } = await import('../services/memory/MemoryFileManager');
          const memoryDir = getMemoryDir();
          const fileManager = new MemoryFileManager(memoryDir);
          // Use preset assistant ID as stable identity for L2 memory lookup
          // 使用预设助手 ID 作为稳定的 L2 记忆查找键
          const assistantId = this.presetAssistantId || this.contextFileName;
          if (assistantId) {
            const content = fileManager.readAssistantMemory(assistantId);
            if (content?.trim()) {
              assistantMemory = content;
              // Lazy index into SQLite (best-effort)
              try {
                const { MemoryStore } = await import('../services/memory/MemoryStore');
                const result = MemoryStore.upsert({
                  id: `assistant:${assistantId}`,
                  scope: 'assistant',
                  ownerId: assistantId,
                  category: 'summary',
                  summary: content.trim().split('\n')[0]?.slice(0, 200) || '',
                  filePath: fileManager.getAssistantMemoryPath(assistantId),
                });
                if (!result.success) {
                  console.warn(`[GeminiAgentManager] Assistant memory indexing failed:`, result.error);
                }
              } catch (error) {
                console.warn(`[GeminiAgentManager] Assistant memory indexing error:`, error);
              }
            }
          }
          const wsContent = fileManager.readWorkspaceMemory(this.workspace);
          if (wsContent?.trim()) {
            workspaceMemory = wsContent;
            try {
              const { MemoryStore } = await import('../services/memory/MemoryStore');
              const hash = MemoryFileManager.computeWorkspaceHash(this.workspace);
              const result = MemoryStore.upsert({
                id: `workspace:${hash}`,
                scope: 'workspace',
                ownerId: hash,
                category: 'summary',
                summary: wsContent.trim().split('\n')[0]?.slice(0, 200) || '',
                filePath: fileManager.getWorkspaceMemoryPath(this.workspace),
              });
              if (!result.success) {
                console.warn(`[GeminiAgentManager] Workspace memory indexing failed:`, result.error);
              }
            } catch (error) {
              console.warn(`[GeminiAgentManager] Workspace memory indexing error:`, error);
            }
          }
        } catch (error) {
          console.warn('[GeminiAgentManager] Failed to load memory:', error);
        }

        return this.start({
          ...config,
          GOOGLE_CLOUD_PROJECT: projectId,
          workspace: this.workspace,
          model: this.model,
          imageGenerationModel,
          webSearchEngine: data.webSearchEngine,
          mcpServers,
          contextFileName: this.contextFileName,
          presetRules: this.presetRules,
          contextContent: this.contextContent,
          // Skills discovered natively by @margay/agent-core SkillManager
          // Skills 由 @margay/agent-core 原生 SkillManager 发现
          skillsDir: getSkillsDir(),
          // Workspace-specific skills directory (loaded alongside global skills)
          workspaceSkillsDir,
          // Yolo mode: auto-approve all tool calls / 自动允许模式
          yoloMode,
          // L2/L3 organizational memory
          assistantMemory,
          workspaceMemory,
        });
      })
      .then(async () => {
        await this.injectHistoryFromDatabase();
      });
  }

  private getImageGenerationModel(): Promise<TProviderWithModel | undefined> {
    return ProcessConfig.get('tools.imageGenerationModel')
      .then((imageGenerationModel) => {
        if (imageGenerationModel && imageGenerationModel.switch) {
          return imageGenerationModel;
        }
        return undefined;
      })
      .catch(() => Promise.resolve(undefined));
  }

  private async getMcpServers(): Promise<Record<string, UiMcpServerConfig>> {
    try {
      const mcpServers = await ProcessConfig.get('mcp.config');
      if (!mcpServers || !Array.isArray(mcpServers)) {
        return {};
      }

      // 转换为 @margay/agent-core 期望的格式
      const mcpConfig: Record<string, UiMcpServerConfig> = {};
      mcpServers
        .filter((server: IMcpServer) => server.enabled) // 使用所有启用的服务器（引擎负责建立连接）
        .forEach((server: IMcpServer) => {
          // 只处理 stdio 类型的传输方式，因为 @margay/agent-core 只支持这种类型
          if (server.transport.type === 'stdio') {
            mcpConfig[server.name] = {
              command: server.transport.command,
              args: server.transport.args || [],
              env: server.transport.env || {},
              description: server.description,
            };
          }
        });

      return mcpConfig;
    } catch (error) {
      return {};
    }
  }

  async sendMessage(data: { input: string; msg_id: string; files?: string[] }) {
    const message: TMessage = {
      id: data.msg_id,
      type: 'text',
      position: 'right',
      conversation_id: this.conversation_id,
      content: {
        content: data.input,
      },
    };
    addMessage(this.conversation_id, message);
    this.status = 'pending';
    cronBusyGuard.setProcessing(this.conversation_id, true);
    const result = await this.bootstrap
      .catch((e) => {
        cronBusyGuard.setProcessing(this.conversation_id, false);
        this.emit('gemini.message', {
          type: 'error',
          data: e.message || JSON.stringify(e),
          msg_id: data.msg_id,
        });
        // 需要同步后才返回结果
        // 为什么需要如此?
        // 在某些情况下，消息需要同步到本地文件中，由于是异步，可能导致前端接受响应和无法获取到最新的消息，因此需要等待同步后再返回
        return new Promise((_, reject) => {
          nextTickToLocalFinish(() => {
            reject(e);
          });
        });
      })
      .then(() => super.sendMessage(data))
      .finally(() => {
        cronBusyGuard.setProcessing(this.conversation_id, false);
      });
    return result;
  }

  private getConfirmationButtons = (confirmationDetails: IMessageToolGroup['content'][number]['confirmationDetails'], t: (key: string, options?: any) => string) => {
    if (!confirmationDetails) return {};
    let question: string;
    let description: string;
    const options: Array<{ label: string; value: ToolConfirmationOutcome; params?: Record<string, string> }> = [];
    switch (confirmationDetails.type) {
      case 'edit':
        {
          question = t('messages.confirmation.applyChange');
          description = confirmationDetails.fileName;
          options.push(
            {
              label: t('messages.confirmation.yesAllowOnce'),
              value: ToolConfirmationOutcome.ProceedOnce,
            },
            {
              label: t('messages.confirmation.yesAllowAlways'),
              value: ToolConfirmationOutcome.ProceedAlways,
            },
            {
              label: t('messages.confirmation.yesAllowWorkspace'),
              value: ToolConfirmationOutcome.ProceedAlwaysAndSave,
            },
            { label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel }
          );
        }
        break;
      case 'exec':
        {
          question = t('messages.confirmation.allowExecution');
          description = confirmationDetails.command;
          options.push(
            {
              label: t('messages.confirmation.yesAllowOnce'),
              value: ToolConfirmationOutcome.ProceedOnce,
            },
            {
              label: t('messages.confirmation.yesAllowAlways'),
              value: ToolConfirmationOutcome.ProceedAlways,
            },
            {
              label: t('messages.confirmation.yesAllowWorkspace'),
              value: ToolConfirmationOutcome.ProceedAlwaysAndSave,
            },
            { label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel }
          );
        }
        break;
      case 'info':
        {
          question = t('messages.confirmation.proceed');
          description = confirmationDetails.urls?.join(';') || confirmationDetails.prompt;
          options.push(
            {
              label: t('messages.confirmation.yesAllowOnce'),
              value: ToolConfirmationOutcome.ProceedOnce,
            },
            {
              label: t('messages.confirmation.yesAllowAlways'),
              value: ToolConfirmationOutcome.ProceedAlways,
            },
            {
              label: t('messages.confirmation.yesAllowWorkspace'),
              value: ToolConfirmationOutcome.ProceedAlwaysAndSave,
            },
            { label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel }
          );
        }
        break;
      case 'mcp': {
        const mcpProps = confirmationDetails;
        question = t('messages.confirmation.allowMCPTool', {
          toolName: mcpProps.toolName,
          serverName: mcpProps.serverName,
        });
        description = mcpProps.serverName + ':' + mcpProps.toolName;
        options.push(
          {
            label: t('messages.confirmation.yesAllowOnce'),
            value: ToolConfirmationOutcome.ProceedOnce,
          },
          {
            label: t('messages.confirmation.yesAlwaysAllowTool', {
              toolName: mcpProps.toolName,
              serverName: mcpProps.serverName,
            }),
            value: ToolConfirmationOutcome.ProceedAlwaysTool,
            params: { toolName: mcpProps.toolName, serverName: mcpProps.serverName },
          },
          {
            label: t('messages.confirmation.yesAlwaysAllowServer', {
              serverName: mcpProps.serverName,
            }),
            value: ToolConfirmationOutcome.ProceedAlwaysServer,
            params: { serverName: mcpProps.serverName },
          },
          { label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel }
        );
        break;
      }
      case 'ask_user': {
        const askProps = confirmationDetails;
        question = confirmationDetails.title || 'Ask User';
        description = askProps.questions?.map((q) => q.question).join('\n') || '';
        options.push(
          {
            label: t('messages.confirmation.yesAllowOnce'),
            value: ToolConfirmationOutcome.ProceedOnce,
          },
          { label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel }
        );
        break;
      }
      case 'exit_plan_mode': {
        question = confirmationDetails.title || 'Exit Plan Mode';
        description = confirmationDetails.planPath || '';
        options.push(
          {
            label: t('messages.confirmation.yesAllowOnce'),
            value: ToolConfirmationOutcome.ProceedOnce,
          },
          { label: t('messages.confirmation.no'), value: ToolConfirmationOutcome.Cancel }
        );
        break;
      }
      default:
        // Unknown confirmation type — skip creating dialog
        return {};
    }
    return {
      question,
      description,
      options,
    };
  };
  private handleConformationMessage(message: IMessageToolGroup) {
    const execMessages = message.content.filter((c) => c.status === 'Confirming');
    if (execMessages.length) {
      execMessages.forEach((content) => {
        const { question, options, description } = this.getConfirmationButtons(content.confirmationDetails, (k) => k);
        const hasDetails = Boolean(content.confirmationDetails);
        const hasOptions = options && options.length > 0;
        if (!question && !hasDetails) {
          // Fallback confirmation when tool is waiting but missing details
          // 当工具处于确认状态但缺少详情时，提供兜底确认
          this.addConfirmation({
            title: 'Awaiting Confirmation',
            id: content.callId,
            action: 'confirm',
            description: content.description || content.name || 'Tool requires confirmation',
            callId: content.callId,
            options: [
              { label: 'messages.confirmation.yesAllowOnce', value: ToolConfirmationOutcome.ProceedOnce },
              { label: 'messages.confirmation.no', value: ToolConfirmationOutcome.Cancel },
            ],
          });
          return;
        }
        if (!question || !hasOptions) return;
        // Extract commandType from exec confirmations for "always allow" memory
        const commandType = content.confirmationDetails?.type === 'exec' ? (content.confirmationDetails as { rootCommand?: string }).rootCommand : undefined;
        this.addConfirmation({
          title: content.confirmationDetails?.title || '',
          id: content.callId,
          action: content.confirmationDetails.type,
          description: description || content.description || '',
          callId: content.callId,
          options: options,
          commandType,
        });
      });
    }
  }

  init() {
    super.init();
    // 接受来子进程的对话消息
    this.on('gemini.message', (data) => {
      if (data.type === 'finish') {
        this.status = 'finished';
        // When stream finishes, check for cron commands in the accumulated message
        // Use longer delay and retry logic to ensure message is persisted
        this.checkCronWithRetry(0);
      }
      if (data.type === 'start') {
        this.status = 'running';
      }

      // 处理预览打开事件（chrome-devtools 导航触发）/ Handle preview open event (triggered by chrome-devtools navigation)
      if (handlePreviewOpenEvent(data)) {
        return; // 不需要继续处理 / No need to continue processing
      }

      data.conversation_id = this.conversation_id;
      // Transform and persist message (skip transient UI state messages)
      // 跳过 thought, finished 等不需要持久化的消息类型
      // Skip transient UI state messages that don't need persistence
      // 跳过不需要持久化的临时 UI 状态消息 (thought, finished, start, finish)
      const skipTransformTypes = ['thought', 'finished', 'start', 'finish'];
      if (!skipTransformTypes.includes(data.type)) {
        const tMessage = transformMessage(data as IResponseMessage);
        if (tMessage) {
          addOrUpdateMessage(this.conversation_id, tMessage, 'gemini');
          if (tMessage.type === 'tool_group') {
            this.handleConformationMessage(tMessage);
          }
        }
      }

      ipcBridge.geminiConversation.responseStream.emit(data);

      // 发送到 Channel 全局事件总线（用于 Telegram 等外部平台）
      // Emit to Channel global event bus (for Telegram and other external platforms)
      channelEventBus.emitAgentMessage(this.conversation_id, data);
    });
  }

  /**
   * Retry checking for cron commands with increasing delays
   * Max 3 retries: 1s, 2s, 3s
   * @param attempt - current attempt number
   * @param checkAfterTimestamp - only process messages created after this timestamp
   */
  private checkCronWithRetry(attempt: number, checkAfterTimestamp?: number): void {
    const delays = [1000, 2000, 3000];
    const maxAttempts = delays.length;

    if (attempt >= maxAttempts) {
      return;
    }

    // Record timestamp on first attempt to avoid re-processing old messages
    const timestamp = checkAfterTimestamp ?? Date.now();
    const delay = delays[attempt];

    setTimeout(async () => {
      const found = await this.checkCronCommandsOnFinish(timestamp);
      if (!found && attempt < maxAttempts - 1) {
        // No assistant messages found, retry with same timestamp
        this.checkCronWithRetry(attempt + 1, timestamp);
      }
    }, delay);
  }

  /**
   * Check for cron commands when stream finishes
   * Gets recent assistant messages from database and processes them
   * @param afterTimestamp - Only process messages created after this timestamp
   * Returns true if assistant messages were found (regardless of cron commands)
   */
  private async checkCronCommandsOnFinish(afterTimestamp: number): Promise<boolean> {
    try {
      const { getDatabase } = await import('@process/database');
      const db = getDatabase();
      const result = db.getConversationMessages(this.conversation_id, 0, 20, 'DESC');

      if (!result.data || result.data.length === 0) {
        return false;
      }

      // Check recent assistant messages for cron commands (position: left means assistant)
      // Filter by timestamp to avoid re-processing old messages
      const assistantMsgs = result.data.filter((m) => m.position === 'left' && (m.createdAt ?? 0) > afterTimestamp);

      // Return false if no assistant messages found after timestamp (will trigger retry)
      if (assistantMsgs.length === 0) {
        return false;
      }

      // Only check the LATEST assistant message to avoid re-processing old messages
      // Messages are sorted DESC, so the first one is the latest
      const latestMsg = assistantMsgs[0];
      const textContent = extractTextFromMessage(latestMsg);

      if (textContent && hasCronCommands(textContent)) {
        // Create a message with finish status for middleware
        const msgWithStatus = { ...latestMsg, status: 'finish' as const };
        // Collect system responses to send back to AI
        const collectedResponses: string[] = [];
        await processCronInMessage(this.conversation_id, 'gemini', msgWithStatus, (sysMsg) => {
          collectedResponses.push(sysMsg);
          // Also emit to frontend for display
          ipcBridge.geminiConversation.responseStream.emit({
            type: 'system',
            conversation_id: this.conversation_id,
            msg_id: uuid(),
            data: sysMsg,
          });
        });
        // Send collected responses back to AI agent so it can continue
        if (collectedResponses.length > 0) {
          const feedbackMessage = `[System Response]\n${collectedResponses.join('\n')}`;
          // Use sendMessage to send the feedback back to AI
          await this.sendMessage({
            input: feedbackMessage,
            msg_id: uuid(),
          });
        }
      }

      // Found assistant messages, no need to retry
      return true;
    } catch {
      return false;
    }
  }

  confirm(id: string, callId: string, data: string) {
    // Store "always allow" decision before removing confirmation from cache
    // 在从缓存中移除确认之前，存储 "always allow" 决策
    if (data === ToolConfirmationOutcome.ProceedAlways || data === ToolConfirmationOutcome.ProceedAlwaysAndSave) {
      const confirmation = this.confirmations.find((c) => c.callId === callId);
      if (confirmation?.action) {
        const keys = GeminiApprovalStore.createKeysFromConfirmation(confirmation.action, confirmation.commandType);

        if (data === ToolConfirmationOutcome.ProceedAlwaysAndSave) {
          // Workspace-scoped: approve for this workspace only
          this.approvalStore.approveForWorkspace(keys, this.workspace);
          this.persistApprovals(keys, this.workspace);
        } else {
          // Global: approve for all workspaces (existing behavior)
          this.approvalStore.approveAll(keys);
          this.persistApprovals(keys);
        }
      }
    }

    // Send to worker as ProceedAlways (engine doesn't know about workspace scope)
    const engineData = data === ToolConfirmationOutcome.ProceedAlwaysAndSave ? ToolConfirmationOutcome.ProceedAlways : data;

    super.confirm(id, callId, engineData);
    // 发送确认到 worker，使用 callId 作为消息类型
    // Send confirmation to worker, using callId as message type
    return this.postMessagePromise(callId, engineData);
  }

  /** Persist approval keys to database with optional workspace scope */
  private persistApprovals(keys: Array<{ action: string; identifier?: string }>, workspaceScope = ''): void {
    import('@process/database')
      .then(({ getDatabase }) => {
        const db = getDatabase();
        const failed: string[] = [];
        for (const key of keys) {
          const result = db.saveGeminiApproval(key.action, key.identifier || '', workspaceScope);
          if (!result.success) {
            failed.push(`${key.action}:${key.identifier || ''}`);
          }
        }
        if (failed.length > 0) {
          console.warn(`[GeminiAgent] Failed to persist approvals: ${failed.join(', ')}`);
        }
      })
      .catch((error) => {
        console.warn('[GeminiAgent] Failed to persist approvals:', error);
      });
  }

  /**
   * Override kill() to ensure shell subprocess cleanup in the worker.
   * Sends abort signal to worker first, waits for ShellExecutionService's
   * SIGTERM→SIGKILL cleanup (200ms), then terminates the worker process.
   */
  kill() {
    let killed = false;
    const GRACE_PERIOD_MS = 300; // Allow ShellExecutionService SIGTERM→SIGKILL (200ms) + margin
    const HARD_TIMEOUT_MS = 1000; // Force kill if worker unresponsive

    const doKill = () => {
      if (killed) return;
      killed = true;
      clearTimeout(hardTimer);
      super.kill();
    };

    // Hard fallback: force kill after timeout regardless
    const hardTimer = setTimeout(doKill, HARD_TIMEOUT_MS);

    // Graceful path: stop → grace period → kill
    // stop() triggers abort signal in worker, which kills tracked process groups
    // Grace period allows SIGTERM→SIGKILL cycle to complete
    void this.stop()
      .catch((err) => {
        console.warn('[GeminiAgentManager] stop() failed during kill:', err);
      })
      .then(() => new Promise<void>((resolve) => setTimeout(resolve, GRACE_PERIOD_MS)))
      .finally(doKill);
  }

  /**
   * Hot-switch to a different model within the same provider.
   * Delegates to GeminiAgent.switchModel() via IPC — no agent rebuild needed.
   */
  async switchModel(modelName: string): Promise<void> {
    await this.bootstrap; // ensure agent is initialized
    this.model = { ...this.model, useModel: modelName };
    return this.postMessagePromise('switch.model', { modelName });
  }

  // Manually trigger context reload
  async reloadContext(): Promise<void> {
    await this.injectHistoryFromDatabase();
  }
}
