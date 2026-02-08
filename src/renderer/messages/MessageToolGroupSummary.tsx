import type { BadgeProps } from '@arco-design/web-react';
import { Badge, Button, Message } from '@arco-design/web-react';
import { IconCopy, IconDown, IconRight } from '@arco-design/web-react/icon';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IMessageAcpToolCall, IMessageToolGroup } from '../../common/chatLib';
import './MessageToolGroupSummary.css';

const ToolGroupMapper = (m: IMessageToolGroup) => {
  return m.content.map(({ name, callId, description, confirmationDetails, status, resultDisplay }) => {
    let desc = description.slice(0, 100);
    const type = confirmationDetails?.type;
    if (type === 'edit') desc = confirmationDetails.fileName;
    if (type === 'exec') desc = confirmationDetails.command;
    if (type === 'info') desc = confirmationDetails.urls?.join(';') || confirmationDetails.title;
    if (type === 'mcp') desc = confirmationDetails.serverName + ':' + confirmationDetails.toolName;
    // Shell output: resultDisplay is a string for execute commands
    const output = typeof resultDisplay === 'string' ? resultDisplay : undefined;
    return {
      key: callId,
      name: name,
      desc,
      status: (status === 'Success' ? 'success' : status === 'Error' ? 'error' : status === 'Canceled' ? 'default' : 'processing') as BadgeProps['status'],
      output,
    };
  });
};

const ToolAcpMapper = (message: IMessageAcpToolCall) => {
  const update = message.content.update;
  if (!update) return;
  const command = update.kind === 'execute' && update.rawInput?.command ? String(update.rawInput.command) : undefined;
  return {
    key: update.toolCallId,
    name: update.rawInput?.description || update.title,
    desc: update.rawInput?.command || update.kind,
    status: update.status === 'completed' ? 'success' : update.status === 'failed' ? 'error' : ('default' as BadgeProps['status']),
    command,
    output: update.rawOutput,
  };
};
const CopyCommandButton: React.FC<{ command: string }> = ({ command }) => {
  const { t } = useTranslation();

  const handleClick = useCallback(
    (e: Event) => {
      e.stopPropagation();
      void navigator.clipboard.writeText(command).then(() => {
        Message.success(t('messages.copySuccess'));
      });
    },
    [command, t]
  );

  return (
    <Button type='text' size='mini' icon={<IconCopy />} onClick={handleClick}>
      {t('messages.copyCommand')}
    </Button>
  );
};

const MessageToolGroupSummary: React.FC<{ messages: Array<IMessageToolGroup | IMessageAcpToolCall> }> = ({ messages }) => {
  const [showMore, setShowMore] = useState(() => {
    if (!messages.length) return false;
    return messages.some((m) => (m.type === 'tool_group' && m.content.some((t) => t.status !== 'Success' && t.status !== 'Error' && t.status !== 'Canceled')) || (m.type === 'acp_tool_call' && m.content.update.status !== 'completed'));
  });
  const tools = useMemo(() => {
    return messages
      .map((m) => {
        if (m.type === 'tool_group') return ToolGroupMapper(m);
        return ToolAcpMapper(m);
      })
      .flat();
  }, [messages]);

  return (
    <div>
      <div className='flex items-center gap-10px color-#86909C cursor-pointer' onClick={() => setShowMore(!showMore)}>
        <Badge status='default' text='View Steps' className={'![&_span.arco-badge-status-text]:color-#86909C'}></Badge>
        {showMore ? <IconDown /> : <IconRight />}
      </div>
      {showMore && (
        <div className='p-l-20px flex flex-col gap-8px pt-8px'>
          {tools.map((item) => {
            return (
              <div key={item.key} className='flex flex-col gap-4px'>
                <div className='flex flex-row items-center color-#86909C gap-12px'>
                  <Badge status={item.status} className={item.status === 'processing' ? 'badge-breathing' : ''}></Badge>
                  <span>{`${item.name}(${item.desc})`} </span>
                  {'command' in item && item.command && <CopyCommandButton command={item.command} />}
                </div>
                {'output' in item && item.output && <pre className='m-l-20px bg-1 p-2 rounded text-xs overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap break-words color-#4E5969'>{item.output}</pre>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default React.memo(MessageToolGroupSummary);
