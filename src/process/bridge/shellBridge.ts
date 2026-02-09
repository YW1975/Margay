/**
 * @license
 * Copyright 2025 Margay (forked from AionUi)
 * SPDX-License-Identifier: Apache-2.0
 */

import { shell } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ipcBridge } from '../../common';
import { buildTerminalCommand } from '../../common/terminalUtils';
import type { Platform } from '../../common/terminalUtils';

export function initShellBridge(): void {
  ipcBridge.shell.openFile.provider(async (path) => {
    await shell.openPath(path);
  });

  ipcBridge.shell.showItemInFolder.provider((path) => {
    shell.showItemInFolder(path);
    return Promise.resolve();
  });

  ipcBridge.shell.openExternal.provider((url) => {
    return shell.openExternal(url);
  });

  ipcBridge.shell.openInTerminal.provider(async (params) => {
    const { command, cwd } = params;
    const effectiveCwd = cwd || os.homedir();
    const platform = process.platform as Platform;

    // Write command to a temp script file to avoid shell escaping issues
    // with complex commands (nested quotes, !, <>, etc.)
    const tmpDir = os.tmpdir();
    const scriptId = `aionui-term-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const isWindows = platform === 'win32';
    const scriptExt = isWindows ? '.bat' : '.sh';
    const scriptPath = path.join(tmpDir, scriptId + scriptExt);

    let scriptContent: string;
    if (isWindows) {
      scriptContent = `@echo off\r\ncd /d "${effectiveCwd}"\r\n${command}\r\n`;
    } else {
      scriptContent = `#!/bin/bash\ncd "${effectiveCwd.replace(/"/g, '\\"')}"\n${command}\n`;
    }

    fs.writeFileSync(scriptPath, scriptContent, { mode: 0o755 });

    const termCmd = buildTerminalCommand(platform, `bash "${scriptPath}"`, undefined);

    return new Promise<void>((resolve, reject) => {
      const child = spawn(termCmd.command, termCmd.args, {
        detached: true,
        stdio: 'ignore',
      });

      child.on('error', (err) => {
        fs.unlink(scriptPath, () => {});
        reject(new Error(`Failed to open terminal: ${err.message}`));
      });

      // For macOS osascript and Linux, wait for the launcher to finish
      // For Windows, the start command returns immediately
      child.on('close', (code) => {
        // Clean up temp script after a delay to ensure terminal has read it
        setTimeout(() => fs.unlink(scriptPath, () => {}), 5000);
        if (code !== 0 && code !== null) {
          reject(new Error(`Terminal launcher exited with code ${code}`));
        } else {
          resolve();
        }
      });

      child.unref();
    });
  });
}
