/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import SkillsManagement from './SkillsManagement';

const SkillsSettings: React.FC = () => {
  return (
    <SettingsPageWrapper contentClassName='max-w-1200px'>
      <SkillsManagement />
    </SettingsPageWrapper>
  );
};

export default SkillsSettings;
