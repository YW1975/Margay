/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tool confirmation outcome enum
 * This is a local copy to avoid importing the entire tools module from @margay/agent-core
 * which contains Node.js dependencies (node:crypto) that cannot be bundled in the renderer process.
 */
export enum ToolConfirmationOutcome {
  ProceedOnce = 'proceed_once',
  ProceedAlways = 'proceed_always',
  ProceedAlwaysAndSave = 'proceed_always_and_save',
  ProceedAlwaysServer = 'proceed_always_server',
  ProceedAlwaysTool = 'proceed_always_tool',
  ModifyWithEditor = 'modify_with_editor',
  Cancel = 'cancel',
}
