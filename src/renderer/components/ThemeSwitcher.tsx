/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { useThemeContext } from '@/renderer/context/ThemeContext';
import MargaySelect from '@/renderer/components/base/MargaySelect';
import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 主题切换器组件 / Theme switcher component
 *
 * 提供明暗模式切换功能
 * Provides light/dark mode switching functionality
 */
export const ThemeSwitcher = () => {
  const { theme, setTheme } = useThemeContext();
  const { t } = useTranslation();

  return (
    <div className='flex items-center gap-8px'>
      {/* 明暗模式选择器 / Light/Dark mode selector */}
      <MargaySelect value={theme} onChange={setTheme} className='w-160px'>
        <MargaySelect.Option value='light'>{t('settings.lightMode')}</MargaySelect.Option>
        <MargaySelect.Option value='dark'>{t('settings.darkMode')}</MargaySelect.Option>
      </MargaySelect>
    </div>
  );
};
