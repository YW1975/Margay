/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { Collapse, Message } from '@arco-design/web-react';
import React from 'react';
import AssistantManagement from '@/renderer/pages/settings/AssistantManagement';
import BackendManagement from '@/renderer/pages/settings/BackendManagement';
import MargayScrollArea from '@/renderer/components/base/MargayScrollArea';
import { useSettingsViewMode } from '../settingsViewContext';

const AgentModalContent: React.FC = () => {
  const [agentMessage, agentMessageContext] = Message.useMessage({ maxCount: 10 });
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  return (
    <div className='flex flex-col h-full w-full'>
      {agentMessageContext}

      <MargayScrollArea className='flex-1 min-h-0 pb-16px scrollbar-hide' disableOverflow={isPageMode}>
        <Collapse defaultActiveKey={['backend-management', 'smart-assistants']}>
          <BackendManagement />
          <AssistantManagement message={agentMessage} />
        </Collapse>
      </MargayScrollArea>
    </div>
  );
};

export default AgentModalContent;
