/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ConfigStorage } from '@/common/storage';
import type { TProviderWithModel } from '@/common/storage';
import type { AcpBackend } from '@/types/acpTypes';
import ClaudeLogo from '@/renderer/assets/logos/claude.svg';
import CodexLogo from '@/renderer/assets/logos/codex.svg';
import GeminiLogo from '@/renderer/assets/logos/gemini.svg';
import QwenLogo from '@/renderer/assets/logos/qwen.svg';
import DroidLogo from '@/renderer/assets/logos/droid.svg';
import IflowLogo from '@/renderer/assets/logos/iflow.svg';
import GooseLogo from '@/renderer/assets/logos/goose.svg';
import AuggieLogo from '@/renderer/assets/logos/auggie.svg';
import KimiLogo from '@/renderer/assets/logos/kimi.svg';
import OpenCodeLogo from '@/renderer/assets/logos/opencode.svg';
import GitHubLogo from '@/renderer/assets/logos/github.svg';
import QoderLogo from '@/renderer/assets/logos/qoder.png';
import OpenClawLogo from '@/renderer/assets/logos/openclaw.svg';
import { iconColors } from '@/renderer/theme/colors';
import { emitter } from '@/renderer/utils/emitter';
import { resolveDefaultModel } from '@/renderer/utils/modelResolver';
import { updateWorkspaceTime } from '@/renderer/utils/workspaceHistory';
import { Dropdown, Menu, Message, Tooltip } from '@arco-design/web-react';
import { Close, Plus } from '@icon-park/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { useConversationTabs } from './context/ConversationTabsContext';

const TAB_OVERFLOW_THRESHOLD = 10;

/** Agent logo map — reused from guid */
const AGENT_LOGO_MAP: Partial<Record<AcpBackend, string>> = {
  claude: ClaudeLogo,
  gemini: GeminiLogo,
  qwen: QwenLogo,
  codex: CodexLogo,
  droid: DroidLogo,
  iflow: IflowLogo,
  goose: GooseLogo,
  auggie: AuggieLogo,
  kimi: KimiLogo,
  opencode: OpenCodeLogo,
  copilot: GitHubLogo,
  qoder: QoderLogo,
  openclaw: OpenClawLogo,
};

/** Resolve backend → conversation create type */
function resolveConversationType(backend: AcpBackend): 'gemini' | 'codex' | 'acp' {
  if (backend === 'gemini') return 'gemini';
  if (backend === 'codex') return 'codex';
  return 'acp';
}

/** Agent info for the inline selector */
interface InlineSelectorAgent {
  backend: AcpBackend;
  name: string;
  cliPath?: string;
  customAgentId?: string;
}

interface TabFadeState {
  left: boolean;
  right: boolean;
}

/**
 * 会话 Tabs 栏组件
 * Conversation tabs bar component
 *
 * 显示所有打开的会话 tabs，支持切换、关闭和新建会话
 * Displays all open conversation tabs, supports switching, closing, and creating new conversations
 */
const ConversationTabs: React.FC = () => {
  const { openTabs, activeTabId, switchTab, closeTab, openTab, closeAllTabs, closeTabsToLeft, closeTabsToRight, closeOtherTabs } = useConversationTabs();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const [tabFadeState, setTabFadeState] = useState<TabFadeState>({ left: false, right: false });

  // Fetch available agents for the inline selector (already filtered by disabled backends)
  const { data: availableAgents } = useSWR('acp.agents.available', async () => {
    const result = await ipcBridge.acpConversation.getAvailableAgents.invoke();
    if (result.success) {
      // Filter out presets (full preset flow stays on /guid)
      return result.data.filter((agent) => !agent.isPreset);
    }
    return [];
  });

  // Fetch disabled backends to respect BackendManagement settings for fallback Gemini
  const { data: disabledBackends } = useSWR('acp.disabledBackends', () => ConfigStorage.get('acp.disabledBackends').then((v) => v || []));

  // Build selector options: use getAvailableAgents response (respects disabled backends).
  // If no agents detected but Gemini is not disabled, guarantee Gemini as fallback.
  const selectorOptions = useMemo((): InlineSelectorAgent[] => {
    const agents = availableAgents || [];
    const disabled = disabledBackends || [];
    const options: InlineSelectorAgent[] = agents.map((a) => ({
      backend: a.backend,
      name: a.name,
      cliPath: a.cliPath,
      customAgentId: a.customAgentId,
    }));
    // Guarantee Gemini if not already present AND not disabled (gemini-only env fallback)
    if (!options.some((a) => a.backend === 'gemini') && !disabled.includes('gemini')) {
      options.unshift({ backend: 'gemini', name: 'Gemini CLI' });
    }
    return options;
  }, [availableAgents, disabledBackends]);

  // Create inline conversation for the selected agent
  const handleCreateInlineConversation = useCallback(
    async (agent: InlineSelectorAgent) => {
      const currentTab = openTabs.find((tab) => tab.id === activeTabId);
      const workspace = currentTab?.workspace || '';

      if (!workspace) {
        Message.error(t('conversation.workspace.createNewConversation'));
        return;
      }

      try {
        const convType = resolveConversationType(agent.backend);

        // Only Gemini requires a configured model; ACP/Codex agents ignore it
        const model = await resolveDefaultModel();
        if (convType === 'gemini' && !model) {
          Message.error(t('settings.noConfiguredModels'));
          return;
        }
        const conversation = await ipcBridge.conversation.create.invoke({
          type: convType,
          name: t('conversation.welcome.newConversation'),
          model: model ?? ({ useModel: '' } as TProviderWithModel), // ACP/Codex don't use model but field is required by type
          extra: {
            workspace,
            customWorkspace: true,
            ...(convType === 'acp' && {
              backend: agent.backend,
              cliPath: agent.cliPath,
              agentName: agent.name,
              customAgentId: agent.customAgentId,
            }),
          },
        });

        if (!conversation || !conversation.id) {
          Message.error('Failed to create conversation.');
          return;
        }

        updateWorkspaceTime(workspace);
        openTab(conversation);
        emitter.emit('chat.history.refresh');
        void navigate(`/conversation/${conversation.id}`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        Message.error(msg);
      }
    },
    [openTabs, activeTabId, openTab, navigate, t]
  );

  // 更新 Tab 溢出状态
  const updateTabOverflow = useCallback(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const hasOverflow = scrollWidth > clientWidth + 1;

    const nextState: TabFadeState = {
      left: hasOverflow && scrollLeft > TAB_OVERFLOW_THRESHOLD,
      right: hasOverflow && scrollLeft + clientWidth < scrollWidth - TAB_OVERFLOW_THRESHOLD,
    };

    setTabFadeState((prev) => {
      if (prev.left === nextState.left && prev.right === nextState.right) return prev;
      return nextState;
    });
  }, []);

  // 当 tabs 变化时更新溢出状态
  useEffect(() => {
    updateTabOverflow();
  }, [updateTabOverflow, openTabs.length]);

  // 监听滚动和窗口大小变化
  useEffect(() => {
    const container = tabsContainerRef.current;
    if (!container) return;

    const handleScroll = () => updateTabOverflow();
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', updateTabOverflow);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateTabOverflow());
      resizeObserver.observe(container);
    }

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', updateTabOverflow);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [updateTabOverflow]);

  // 切换 tab 并导航
  const handleSwitchTab = useCallback(
    (tabId: string) => {
      switchTab(tabId);
      void navigate(`/conversation/${tabId}`);
    },
    [switchTab, navigate]
  );

  // 关闭 tab
  const handleCloseTab = useCallback(
    (tabId: string) => {
      closeTab(tabId);
      // 如果关闭的是当前 tab，导航将由 context 自动处理（切换到最后一个）
      // 如果没有 tab 了，导航到欢迎页
      if (openTabs.length === 1 && tabId === activeTabId) {
        void navigate('/guid');
      }
    },
    [closeTab, openTabs.length, activeTabId, navigate]
  );

  // 生成右键菜单内容
  const getContextMenu = useCallback(
    (tabId: string) => {
      const tabIndex = openTabs.findIndex((tab) => tab.id === tabId);
      const hasLeftTabs = tabIndex > 0;
      const hasRightTabs = tabIndex < openTabs.length - 1;
      const hasOtherTabs = openTabs.length > 1;

      return (
        <Menu
          onClickMenuItem={(key) => {
            switch (key) {
              case 'close-all':
                closeAllTabs();
                void navigate('/guid');
                break;
              case 'close-left':
                closeTabsToLeft(tabId);
                break;
              case 'close-right':
                closeTabsToRight(tabId);
                break;
              case 'close-others':
                closeOtherTabs(tabId);
                void navigate(`/conversation/${tabId}`);
                break;
            }
          }}
        >
          <Menu.Item key='close-others' disabled={!hasOtherTabs}>
            {t('conversation.tabs.closeOthers')}
          </Menu.Item>
          <Menu.Item key='close-left' disabled={!hasLeftTabs}>
            {t('conversation.tabs.closeLeft')}
          </Menu.Item>
          <Menu.Item key='close-right' disabled={!hasRightTabs}>
            {t('conversation.tabs.closeRight')}
          </Menu.Item>
          <Menu.Item key='close-all'>{t('conversation.tabs.closeAll')}</Menu.Item>
        </Menu>
      );
    },
    [openTabs, closeAllTabs, closeTabsToLeft, closeTabsToRight, closeOtherTabs, navigate, t]
  );

  // Build the agent selector dropdown for the "+" button
  const agentSelectorMenu = useMemo(
    () => (
      <Menu
        onClickMenuItem={(key) => {
          const agent = selectorOptions.find((a) => (a.customAgentId ? `custom:${a.customAgentId}` : a.backend) === key);
          if (agent) {
            void handleCreateInlineConversation(agent);
          }
        }}
      >
        {selectorOptions.map((agent) => {
          const key = agent.customAgentId ? `custom:${agent.customAgentId}` : agent.backend;
          const logo = AGENT_LOGO_MAP[agent.backend];
          return (
            <Menu.Item key={key}>
              <div className='flex items-center gap-8px'>
                {logo ? <img src={logo} alt={agent.name} width={16} height={16} style={{ objectFit: 'contain' }} /> : <Plus theme='outline' size={14} />}
                <span>{agent.name}</span>
              </div>
            </Menu.Item>
          );
        })}
      </Menu>
    ),
    [selectorOptions, handleCreateInlineConversation]
  );

  const { left: showLeftFade, right: showRightFade } = tabFadeState;

  // 检查当前激活的 tab 是否在 openTabs 中
  // Check if current active tab is in openTabs
  const isActiveTabInList = openTabs.some((tab) => tab.id === activeTabId);

  // 如果没有打开的 tabs，或者当前激活的会话不在 tabs 中（说明切换到了非工作空间会话），不显示此组件
  // If no open tabs, or active conversation is not in tabs (switched to non-workspace chat), hide component
  if (openTabs.length === 0 || !isActiveTabInList) {
    return null;
  }

  return (
    <div className='relative shrink-0 bg-2 min-h-40px'>
      <div className='relative flex items-center h-40px w-full border-t border-x border-solid border-[color:var(--border-base)]'>
        {/* Tabs 滚动区域 */}
        <div ref={tabsContainerRef} className='flex items-center h-full flex-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'>
          {openTabs.map((tab) => (
            <Dropdown key={tab.id} droplist={getContextMenu(tab.id)} trigger='contextMenu' position='bl'>
              <Tooltip content={tab.name} position='bottom'>
                <div className={`flex items-center gap-8px px-12px h-full max-w-240px cursor-pointer transition-all duration-200 shrink-0 border-r border-[color:var(--border-base)] ${tab.id === activeTabId ? 'bg-1 text-[color:var(--color-text-1)] font-medium' : 'bg-2 text-[color:var(--color-text-3)] hover:text-[color:var(--color-text-2)] border-b border-[color:var(--border-base)]'}`} style={{ borderRight: '1px solid var(--border-base)' }} onClick={() => handleSwitchTab(tab.id)}>
                  <span className='text-15px whitespace-nowrap overflow-hidden text-ellipsis select-none flex-1'>{tab.name}</span>
                  <Close
                    theme='outline'
                    size='14'
                    fill={iconColors.secondary}
                    className='shrink-0 transition-all duration-200 hover:fill-[rgb(var(--danger-6))]'
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(tab.id);
                    }}
                  />
                </div>
              </Tooltip>
            </Dropdown>
          ))}
        </div>

        {/* 新建会话按钮 — inline agent selector dropdown */}
        <Dropdown droplist={agentSelectorMenu} trigger='click' position='bl'>
          <div className='flex items-center justify-center w-40px h-40px shrink-0 cursor-pointer transition-colors duration-200 hover:bg-[var(--fill-2)] ' style={{ borderLeft: '1px solid var(--border-base)' }} title={t('conversation.workspace.createNewConversation')}>
            <Plus theme='outline' size='16' fill={iconColors.primary} strokeWidth={3} />
          </div>
        </Dropdown>

        {/* 左侧渐变指示器 */}
        {showLeftFade && <div className='pointer-events-none absolute left-0 top-0 bottom-0 w-32px [background:linear-gradient(90deg,var(--bg-2)_0%,transparent_100%)]' />}

        {/* 右侧渐变指示器 */}
        {showRightFade && <div className='pointer-events-none absolute right-40px top-0 bottom-0 w-32px [background:linear-gradient(270deg,var(--bg-2)_0%,transparent_100%)]' />}
      </div>
    </div>
  );
};

export default ConversationTabs;
