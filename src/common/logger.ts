/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Lightweight logger replacing @office-ai/platform logger module.
 * Only implements the subset actually used by Margay.
 */

interface LogEntry {
  type: string;
  logs: unknown[];
}

interface LoggerProvider {
  log(entry: LogEntry): void;
  path(): Promise<string>;
}

let printEnabled = false;
let logProvider: LoggerProvider | null = null;

export const logger = {
  config(options: { print: boolean }) {
    printEnabled = options.print;
  },

  provider(provider: LoggerProvider) {
    logProvider = provider;
  },

  log(...args: unknown[]) {
    if (printEnabled) console.log(...args);
    logProvider?.log({ type: 'log', logs: args });
  },

  info(...args: unknown[]) {
    if (printEnabled) console.info(...args);
    logProvider?.log({ type: 'info', logs: args });
  },

  warn(...args: unknown[]) {
    if (printEnabled) console.warn(...args);
    logProvider?.log({ type: 'warn', logs: args });
  },

  error(...args: unknown[]) {
    if (printEnabled) console.error(...args);
    logProvider?.log({ type: 'error', logs: args });
  },
};
