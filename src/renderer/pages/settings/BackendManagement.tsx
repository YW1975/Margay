/**
 * @license
 * Copyright 2025 Margay (forked from AionUi)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ConfigStorage } from '@/common/storage';
import type { AcpBackend } from '@/types/acpTypes';
import { Collapse, Message, Switch } from '@arco-design/web-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type DetectedAgent = {
  backend: AcpBackend;
  name: string;
  cliPath?: string;
  customAgentId?: string;
};

/**
 * Backend Management — enable/disable detected agent backends.
 * Disabled backends are hidden from UI agent selection, NOT skipped from installation detection.
 * This allows instant re-enable without app restart.
 */
const BackendManagement: React.FC = () => {
  const { t } = useTranslation();
  const [allAgents, setAllAgents] = useState<DetectedAgent[]>([]);
  const [disabledBackends, setDisabledBackends] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [agentsResult, disabled] = await Promise.all([ipcBridge.acpConversation.getAllDetectedAgents.invoke(), ConfigStorage.get('acp.disabledBackends')]);
      if (cancelled) return;
      if (agentsResult.success) {
        // Only show non-custom backends (custom agents managed separately in AssistantManagement)
        setAllAgents(agentsResult.data.filter((a) => a.backend !== 'custom'));
      }
      setDisabledBackends(disabled || []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = useCallback(
    async (backend: string, enabled: boolean) => {
      const next = enabled ? disabledBackends.filter((b) => b !== backend) : [...disabledBackends, backend];
      setDisabledBackends(next);
      const result = await ipcBridge.acpConversation.setDisabledBackends.invoke({ backends: next });
      if (!result.success) {
        Message.error(t('settings.backendManagement.saveFailed', { defaultValue: 'Failed to save settings' }));
        setDisabledBackends(disabledBackends); // revert
      }
    },
    [disabledBackends, t]
  );

  if (allAgents.length === 0) return null;

  return (
    <Collapse.Item header={<span>{t('settings.backendManagement.title', { defaultValue: 'Agent Engines' })}</span>} name='backend-management'>
      <div className='flex flex-col gap-8px'>
        <div className='text-12px color-#86909C mb-4px'>
          {t('settings.backendManagement.description', {
            defaultValue: 'Enable or disable agent engines. Disabled engines are hidden from the agent selector.',
          })}
        </div>
        {allAgents.map((agent) => {
          const isEnabled = !disabledBackends.includes(agent.backend);
          return (
            <div key={agent.backend} className='flex items-center justify-between py-4px'>
              <div className='flex flex-col'>
                <span className='text-14px'>{agent.name}</span>
                {agent.cliPath && <span className='text-12px color-#86909C'>{agent.cliPath}</span>}
              </div>
              <Switch size='small' checked={isEnabled} onChange={(checked) => void handleToggle(agent.backend, checked)} />
            </div>
          );
        })}
      </div>
    </Collapse.Item>
  );
};

export default BackendManagement;
