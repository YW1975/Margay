/**
 * @license
 * Copyright 2025 Margay (forked from AionUi)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Cross-platform terminal command builder.
 * Generates platform-specific command strings to open a command in the system's native terminal.
 */

export type Platform = 'darwin' | 'win32' | 'linux';

/**
 * Escape a string for safe embedding in AppleScript double-quoted strings.
 * AppleScript requires escaping backslashes and double quotes.
 */
export function escapeAppleScript(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Escape a string for safe embedding in Windows cmd double-quoted arguments.
 * cmd.exe special characters: & | < > ^ " %
 * We wrap the whole command in double quotes and escape internal double quotes.
 */
export function escapeWindowsCmd(str: string): string {
  return str.replace(/"/g, '""');
}

/**
 * Escape a string for safe embedding in bash single-quoted strings.
 * Single quotes in bash cannot contain single quotes, so we break out and use '\'' pattern.
 */
export function escapeBashSingleQuote(str: string): string {
  return str.replace(/'/g, "'\\''");
}

export interface TerminalCommand {
  /** The executable to run (e.g., 'osascript', 'cmd', 'bash') */
  command: string;
  /** Arguments for the executable */
  args: string[];
}

/**
 * Build a platform-specific command to open a terminal and run a command.
 *
 * @param platform - The OS platform ('darwin', 'win32', 'linux')
 * @param command - The shell command to execute in the terminal
 * @param cwd - Optional working directory to cd into first
 * @returns TerminalCommand with executable and args for child_process.spawn
 */
export function buildTerminalCommand(platform: Platform, command: string, cwd?: string): TerminalCommand {
  switch (platform) {
    case 'darwin': {
      const cdPart = cwd ? `cd "${escapeAppleScript(cwd)}" && ` : '';
      const script = `tell application "Terminal"
activate
do script "${escapeAppleScript(cdPart + command)}"
end tell`;
      return {
        command: 'osascript',
        args: ['-e', script],
      };
    }

    case 'win32': {
      const cdPart = cwd ? `cd /d "${escapeWindowsCmd(cwd)}" && ` : '';
      return {
        command: 'cmd',
        args: ['/c', 'start', 'cmd', '/k', `${cdPart}${command}`],
      };
    }

    case 'linux': {
      const cdPart = cwd ? `cd '${escapeBashSingleQuote(cwd)}' && ` : '';
      const fullCmd = `${cdPart}${command}; exec bash`;
      // Try common terminal emulators in order of preference
      return {
        command: 'bash',
        args: ['-c', `x-terminal-emulator -e bash -c '${escapeBashSingleQuote(fullCmd)}' 2>/dev/null || gnome-terminal -- bash -c '${escapeBashSingleQuote(fullCmd)}' 2>/dev/null || xterm -e bash -c '${escapeBashSingleQuote(fullCmd)}'`],
      };
    }

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
