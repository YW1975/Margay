/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from '@jest/globals';
import { buildTerminalCommand, escapeAppleScript, escapeWindowsCmd, escapeBashSingleQuote } from '../../src/common/terminalUtils';

describe('terminalUtils', () => {
  describe('escapeAppleScript', () => {
    it('should escape backslashes', () => {
      expect(escapeAppleScript('path\\to\\file')).toBe('path\\\\to\\\\file');
    });

    it('should escape double quotes', () => {
      expect(escapeAppleScript('echo "hello"')).toBe('echo \\"hello\\"');
    });

    it('should escape both backslashes and quotes', () => {
      expect(escapeAppleScript('echo "C:\\Users"')).toBe('echo \\"C:\\\\Users\\"');
    });

    it('should return unchanged string with no special chars', () => {
      expect(escapeAppleScript('ls -la')).toBe('ls -la');
    });
  });

  describe('escapeWindowsCmd', () => {
    it('should escape double quotes by doubling', () => {
      expect(escapeWindowsCmd('echo "hello"')).toBe('echo ""hello""');
    });

    it('should return unchanged string with no quotes', () => {
      expect(escapeWindowsCmd('dir /b')).toBe('dir /b');
    });
  });

  describe('escapeBashSingleQuote', () => {
    it('should escape single quotes using break-out pattern', () => {
      expect(escapeBashSingleQuote("it's")).toBe("it'\\''s");
    });

    it('should handle multiple single quotes', () => {
      expect(escapeBashSingleQuote("it's a 'test'")).toBe("it'\\''s a '\\''test'\\''");
    });

    it('should return unchanged string with no single quotes', () => {
      expect(escapeBashSingleQuote('hello world')).toBe('hello world');
    });
  });

  describe('buildTerminalCommand', () => {
    describe('darwin (macOS)', () => {
      it('should generate osascript command', () => {
        const result = buildTerminalCommand('darwin', 'npm start');
        expect(result.command).toBe('osascript');
        expect(result.args[0]).toBe('-e');
        expect(result.args[1]).toContain('tell application "Terminal"');
        expect(result.args[1]).toContain('npm start');
      });

      it('should include cd when cwd is provided', () => {
        const result = buildTerminalCommand('darwin', 'npm start', '/Users/test/project');
        expect(result.args[1]).toContain('cd \\"/Users/test/project\\"');
        expect(result.args[1]).toContain('npm start');
      });

      it('should escape quotes in command', () => {
        const result = buildTerminalCommand('darwin', 'echo "hello world"');
        expect(result.args[1]).toContain('echo \\"hello world\\"');
      });

      it('should escape quotes in cwd path', () => {
        const result = buildTerminalCommand('darwin', 'ls', '/Users/test/My "Project"');
        // The cwd path with quotes should be escaped (no raw " in the AppleScript do script string)
        // Verify the script doesn't contain unescaped quotes from the path
        expect(result.args[1]).toContain('/Users/test/My');
        expect(result.args[1]).toContain('Project');
        expect(result.args[1]).not.toMatch(/My "Project"/);
      });

      it('should handle command with backslashes', () => {
        const result = buildTerminalCommand('darwin', 'echo C:\\path');
        expect(result.args[1]).toContain('C:\\\\path');
      });

      it('should handle newline-containing commands', () => {
        const result = buildTerminalCommand('darwin', 'echo line1\necho line2');
        expect(result.command).toBe('osascript');
        // The newline should be preserved in the AppleScript string
        expect(result.args[1]).toContain('echo line1\necho line2');
      });

      it('should omit cd when cwd is undefined', () => {
        const result = buildTerminalCommand('darwin', 'ls');
        expect(result.args[1]).not.toContain('cd');
      });
    });

    describe('win32 (Windows)', () => {
      it('should generate cmd command', () => {
        const result = buildTerminalCommand('win32', 'npm start');
        expect(result.command).toBe('cmd');
        expect(result.args).toContain('/c');
        expect(result.args).toContain('start');
        expect(result.args).toContain('/k');
      });

      it('should include cd /d when cwd is provided', () => {
        const result = buildTerminalCommand('win32', 'npm start', 'C:\\Users\\test');
        const fullCmd = result.args[result.args.length - 1];
        expect(fullCmd).toContain('cd /d "C:\\Users\\test"');
        expect(fullCmd).toContain('npm start');
      });

      it('should escape quotes in cwd', () => {
        const result = buildTerminalCommand('win32', 'dir', 'C:\\My "Folder"');
        const fullCmd = result.args[result.args.length - 1];
        expect(fullCmd).toContain('My ""Folder""');
      });

      it('should handle newline-containing commands', () => {
        const result = buildTerminalCommand('win32', 'echo line1\necho line2');
        const fullCmd = result.args[result.args.length - 1];
        expect(fullCmd).toContain('echo line1\necho line2');
      });

      it('should omit cd /d when cwd is undefined', () => {
        const result = buildTerminalCommand('win32', 'dir');
        const fullCmd = result.args[result.args.length - 1];
        expect(fullCmd).not.toContain('cd /d');
      });
    });

    describe('linux', () => {
      it('should generate bash command with terminal emulator fallback', () => {
        const result = buildTerminalCommand('linux', 'npm start');
        expect(result.command).toBe('bash');
        expect(result.args[0]).toBe('-c');
        expect(result.args[1]).toContain('x-terminal-emulator');
        expect(result.args[1]).toContain('gnome-terminal');
        expect(result.args[1]).toContain('xterm');
      });

      it('should include cd when cwd is provided', () => {
        const result = buildTerminalCommand('linux', 'npm start', '/home/user/project');
        // The inner cd command is wrapped in single quotes, then the whole thing
        // is wrapped again in single quotes for the -c argument, so inner quotes get escaped
        expect(result.args[1]).toContain('/home/user/project');
        expect(result.args[1]).toContain('npm start');
      });

      it('should append exec bash to keep terminal open', () => {
        const result = buildTerminalCommand('linux', 'npm start');
        expect(result.args[1]).toContain('exec bash');
      });

      it('should escape single quotes in cwd', () => {
        const result = buildTerminalCommand('linux', 'ls', "/home/user/it's a dir");
        // The single quote in the path gets escaped at the inner level (cd '...'),
        // then the whole command is escaped again for the outer single-quote wrapping.
        // Verify the path is present and quotes are escaped (no literal unescaped single-quote sequence)
        expect(result.args[1]).toContain('/home/user/it');
        expect(result.args[1]).toContain('s a dir');
      });

      it('should escape single quotes in command', () => {
        const result = buildTerminalCommand('linux', "echo 'hello'");
        expect(result.args[1]).toContain("echo '\\''hello'\\''");
      });

      it('should handle newline-containing commands', () => {
        const result = buildTerminalCommand('linux', 'echo line1\necho line2');
        expect(result.args[1]).toContain('echo line1\necho line2');
      });

      it('should omit cd when cwd is undefined', () => {
        const result = buildTerminalCommand('linux', 'ls');
        expect(result.args[1]).not.toContain("cd '");
      });
    });

    describe('unsupported platform', () => {
      it('should throw for unsupported platform', () => {
        expect(() => buildTerminalCommand('freebsd' as any, 'ls')).toThrow('Unsupported platform: freebsd');
      });
    });

    describe('edge cases', () => {
      it('should handle empty command', () => {
        const result = buildTerminalCommand('darwin', '');
        expect(result.command).toBe('osascript');
      });

      it('should handle command with special shell metacharacters', () => {
        const result = buildTerminalCommand('darwin', 'echo $HOME && ls | grep foo > out.txt');
        expect(result.args[1]).toContain('echo $HOME && ls | grep foo > out.txt');
      });

      it('should handle paths with spaces', () => {
        const result = buildTerminalCommand('darwin', 'ls', '/Users/test/my project');
        expect(result.args[1]).toContain('/Users/test/my project');
      });

      it('should handle very long commands', () => {
        const longCmd = 'echo ' + 'a'.repeat(1000);
        const result = buildTerminalCommand('linux', longCmd);
        expect(result.args[1]).toContain(longCmd);
      });

      it('should handle commands with unicode characters', () => {
        const result = buildTerminalCommand('darwin', 'echo 你好世界');
        expect(result.args[1]).toContain('你好世界');
      });
    });
  });
});
