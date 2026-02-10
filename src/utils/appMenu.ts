/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { MenuItemConstructorOptions } from 'electron';
import { Menu, app } from 'electron';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../../package.json') as { productName?: string };

export function setupApplicationMenu(): void {
  const isMac = process.platform === 'darwin';
  const appName = packageJson.productName ?? app.name;

  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: appName,
      submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'services' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }],
    });
  }

  template.push({
    label: 'Edit',
    submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, ...(isMac ? ([{ role: 'pasteAndMatchStyle' }, { role: 'delete' }, { role: 'selectAll' }] as MenuItemConstructorOptions[]) : ([{ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' }] as MenuItemConstructorOptions[]))],
  });

  template.push({
    label: 'View',
    submenu: [{ role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }],
  });

  template.push({
    label: 'Help',
    submenu: [
      {
        label: 'Check for Updates...',
        click: () => {
          ipcBridge.update.open.emit({ source: 'menu' });
        },
      },
    ],
  });

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
