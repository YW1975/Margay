/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

/// 多线程管理模型
// 1. 主进程管理子进程 -》 进程管理器，需要维护当前所有子进程，并负责子进程的通信操作
// 2. 子进程管理，需要根据不同的agent处理不同的agent任务，同时所有子进程具备相同的通信机制
import { GeminiAgent } from '@/agent/gemini';
import { ShellExecutionService } from '@/agent/gemini/core-facade';
import { forkTask } from './utils';

// Set CLI_VERSION so @margay/agent-core's getVersion() returns the embedded
// package version rather than relying on readPackageUp (which finds the wrong
// package.json when running inside a webpack bundle).
if (!process.env.CLI_VERSION) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    process.env.CLI_VERSION = require('@margay/agent-core/package.json').version;
  } catch {
    // noop — getVersion() falls back to readPackageUp
  }
}

export default forkTask(({ data }, pipe) => {
  pipe.log('gemini.init', data);
  console.log(`[GeminiWorker] presetRules length: ${data.presetRules?.length || 0}`);
  console.log(`[GeminiWorker] presetRules preview: ${data.presetRules?.substring(0, 200) || 'empty'}`);
  const agent = new GeminiAgent({
    ...data,
    onStreamEvent(event) {
      if (event.type === 'tool_group') {
        event.data = (event.data as any[]).map((tool: any) => {
          const { confirmationDetails, ...other } = tool;
          if (confirmationDetails) {
            const { onConfirm, ...details } = confirmationDetails;
            pipe.once(tool.callId, (confirmKey: string) => {
              onConfirm(confirmKey);
            });
            return {
              ...other,
              confirmationDetails: details,
            };
          }
          return other;
        });
      }
      pipe.call('gemini.message', event);
    },
  });
  pipe.on('stop.stream', (_, deferred) => {
    agent.stop();
    // Kill all tracked process groups (background processes spawned with `cmd &`)
    ShellExecutionService.killAllTrackedProcessGroups();
    deferred.with(Promise.resolve());
  });
  pipe.on('init.history', (event: { text: string }, deferred) => {
    deferred.with(agent.injectConversationHistory(event.text));
  });
  pipe.on('send.message', (event: { input: string; msg_id: string; files?: string[] }, deferred) => {
    deferred.with(agent.send(event.input, event.msg_id, event.files));
  });
  pipe.on('switch.model', (event: { modelName: string }, deferred) => {
    agent.switchModel(event.modelName);
    deferred.with(Promise.resolve());
  });

  // Safety net: kill background process groups when worker is terminated
  process.on('exit', () => {
    for (const pgid of ShellExecutionService.trackedProcessGroups) {
      try {
        process.kill(-pgid, 'SIGKILL');
      } catch {
        // ESRCH: already dead
      }
    }
  });

  return agent.bootstrap;
});
