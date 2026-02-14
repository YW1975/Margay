/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ConfigStorage } from '@/common/storage';
import PwaPullToRefresh from '@/renderer/components/PwaPullToRefresh';
import Titlebar from '@/renderer/components/Titlebar';
import { Layout as ArcoLayout } from '@arco-design/web-react';
import { MenuFold, MenuUnfold } from '@icon-park/react';
import classNames from 'classnames';
import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LayoutContext } from './context/LayoutContext';
import { useDirectorySelection } from './hooks/useDirectorySelection';
import { useMultiAgentDetection } from './hooks/useMultiAgentDetection';
import { processCustomCss } from './utils/customCssProcessor';
import UpdateModal from '@/renderer/components/UpdateModal';
import LoveLetterOverlay from '@/renderer/components/LoveLetterOverlay';
import StarryNightOverlay from '@/renderer/components/StarryNightOverlay';
import ValentineGreetingOverlay from '@/renderer/components/ValentineGreetingOverlay';
import { isElectronDesktop } from '@/renderer/utils/platform';
import MargayLogo from '@/renderer/assets/logos/margay.png';

const useDebug = () => {
  const [count, setCount] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const timer = useRef<any>(null);
  const onClick = () => {
    const openDevTools = () => {
      ipcBridge.application.openDevTools.invoke().catch((error) => {
        console.error('Failed to open dev tools:', error);
      });
    };

    setCount((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        // 5 clicks: Valentine Easter egg / 5次点击：情人节彩蛋
        setShowEasterEgg(true);
        return 0;
      }
      if (next >= 3) {
        // 3 clicks: open DevTools (preserved behavior) / 3次点击：打开开发者工具
        openDevTools();
        return next; // Don't reset — let user keep clicking to reach 5
      }
      return next;
    });

    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      clearTimeout(timer.current);
      setCount(0);
    }, 1500); // Extended from 1s to 1.5s for 5-click feasibility
  };

  return { onClick, showEasterEgg, setShowEasterEgg };
};

const DEFAULT_SIDER_WIDTH = 250;

const Layout: React.FC<{
  sider: React.ReactNode;
  onSessionClick?: () => void;
}> = ({ sider, onSessionClick: _onSessionClick }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [customCss, setCustomCss] = useState<string>('');
  const { onClick, showEasterEgg, setShowEasterEgg } = useDebug();
  const { contextHolder: multiAgentContextHolder } = useMultiAgentDetection();
  const { contextHolder: directorySelectionContextHolder } = useDirectorySelection();
  const location = useLocation();
  const workspaceAvailable = location.pathname.startsWith('/conversation/');
  const collapsedRef = useRef(collapsed);

  // 加载并监听自定义 CSS 配置 / Load & watch custom CSS configuration
  useEffect(() => {
    const loadCustomCss = () => {
      ConfigStorage.get('customCss')
        .then((css) => setCustomCss(css || ''))
        .catch((error) => {
          console.error('Failed to load custom CSS:', error);
        });
    };

    loadCustomCss();

    const handleCssUpdate = (event: CustomEvent) => {
      if (event.detail?.customCss !== undefined) {
        setCustomCss(event.detail.customCss || '');
      }
    };
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key && event.key.includes('customCss')) {
        loadCustomCss();
      }
    };

    window.addEventListener('custom-css-updated', handleCssUpdate as EventListener);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('custom-css-updated', handleCssUpdate as EventListener);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 注入自定义 CSS / Inject custom CSS into document head
  useEffect(() => {
    const styleId = 'user-defined-custom-css';

    if (!customCss) {
      document.getElementById(styleId)?.remove();
      return;
    }

    const wrappedCss = processCustomCss(customCss);

    const ensureStyleAtEnd = () => {
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

      if (styleEl && styleEl.textContent === wrappedCss && styleEl === document.head.lastElementChild) {
        return;
      }

      styleEl?.remove();
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.type = 'text/css';
      styleEl.textContent = wrappedCss;
      document.head.appendChild(styleEl);
    };

    ensureStyleAtEnd();

    const observer = new MutationObserver((mutations) => {
      const hasNewStyle = mutations.some((mutation) => Array.from(mutation.addedNodes).some((node) => node.nodeName === 'STYLE' || node.nodeName === 'LINK'));

      if (hasNewStyle) {
        const element = document.getElementById(styleId);
        if (element && element !== document.head.lastElementChild) {
          ensureStyleAtEnd();
        }
      }
    });

    observer.observe(document.head, { childList: true });

    return () => {
      observer.disconnect();
      document.getElementById(styleId)?.remove();
    };
  }, [customCss]);

  // 检测移动端并响应窗口大小变化（仅 WebUI 模式，Electron 桌面端不启用手机态）
  // Detect mobile viewport (WebUI only; Electron desktop always stays in desktop mode)
  useEffect(() => {
    if (isElectronDesktop()) return;

    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };

    checkMobile();

    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 进入移动端后立即折叠 / Collapse immediately when switching to mobile
  useEffect(() => {
    if (!isMobile || collapsedRef.current) {
      return;
    }
    setCollapsed(true);
  }, [isMobile]);
  useEffect(() => {
    collapsedRef.current = collapsed;
  }, [collapsed]);
  return (
    <LayoutContext.Provider value={{ isMobile, siderCollapsed: collapsed, setSiderCollapsed: setCollapsed }}>
      <div className='app-shell flex flex-col size-full min-h-0'>
        <Titlebar workspaceAvailable={workspaceAvailable} />
        {/* 移动端左侧边栏蒙板 / Mobile left sider backdrop */}
        {isMobile && !collapsed && <div className='fixed inset-0 bg-black/30 z-90' onClick={() => setCollapsed(true)} aria-hidden='true' />}

        <ArcoLayout className={'size-full layout flex-1 min-h-0'}>
          <ArcoLayout.Sider
            collapsedWidth={64}
            collapsed={collapsed}
            width={DEFAULT_SIDER_WIDTH}
            className={classNames('!bg-2 layout-sider', {
              collapsed: collapsed,
            })}
            style={
              isMobile && !collapsed
                ? {
                    position: 'fixed',
                    left: 0,
                    zIndex: 100,
                    transition: 'none',
                  }
                : undefined
            }
          >
            <ArcoLayout.Header
              className={classNames('flex items-center justify-center py-2px gap-12px layout-sider-header', {
                'cursor-pointer group': collapsed,
              })}
            >
              <img
                className={classNames('shrink-0 size-72px rd-0.5rem', {
                  '!size-48px': collapsed,
                })}
                src={MargayLogo}
                alt='Margay'
                onClick={onClick}
              />
              <div className=' flex-1 text-20px collapsed-hidden font-bold'>Margay</div>
              {isMobile && !collapsed && (
                <button type='button' className='app-titlebar__button' onClick={() => setCollapsed(true)} aria-label='Collapse sidebar'>
                  {collapsed ? <MenuUnfold theme='outline' size='18' fill='currentColor' /> : <MenuFold theme='outline' size='18' fill='currentColor' />}
                </button>
              )}
              {/* 侧栏折叠改由标题栏统一控制 / Sidebar folding handled by Titlebar toggle */}
            </ArcoLayout.Header>
            <ArcoLayout.Content className={classNames('p-8px layout-sider-content', !isMobile && 'h-[calc(100%-72px-16px)]')}>
              {React.isValidElement(sider)
                ? React.cloneElement(sider, {
                    onSessionClick: () => {
                      if (isMobile) setCollapsed(true);
                    },
                    collapsed,
                  } as any)
                : sider}
            </ArcoLayout.Content>
          </ArcoLayout.Sider>

          <ArcoLayout.Content
            className={'bg-1 layout-content flex flex-col min-h-0'}
            onClick={() => {
              if (isMobile && !collapsed) setCollapsed(true);
            }}
            style={
              isMobile && !collapsed
                ? {
                    width: '100vw',
                  }
                : undefined
            }
          >
            <Outlet />
            {multiAgentContextHolder}
            {directorySelectionContextHolder}
            <PwaPullToRefresh />
            <UpdateModal />
            <ValentineGreetingOverlay />
            <LoveLetterOverlay />
            {showEasterEgg && <StarryNightOverlay onClose={() => setShowEasterEgg(false)} />}
          </ArcoLayout.Content>
        </ArcoLayout>
      </div>
    </LayoutContext.Provider>
  );
};

export default Layout;
