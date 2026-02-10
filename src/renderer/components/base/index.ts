/**
 * @license
 * Copyright 2025 Margay
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Margay 基础组件库统一导出 / Margay base components unified exports
 *
 * 提供所有基础组件和类型的统一导出入口
 * Provides unified export entry for all base components and types
 */

// ==================== 组件导出 / Component Exports ====================

export { default as MargayModal } from './MargayModal';
export { default as MargayCollapse } from './MargayCollapse';
export { default as MargaySelect } from './MargaySelect';
export { default as MargayScrollArea } from './MargayScrollArea';
export { default as MargaySteps } from './MargaySteps';

// ==================== 类型导出 / Type Exports ====================

// MargayModal 类型 / MargayModal types
export type { ModalSize, ModalHeaderConfig, ModalFooterConfig, ModalContentStyleConfig, MargayModalProps } from './MargayModal';
export { MODAL_SIZES } from './MargayModal';

// MargayCollapse 类型 / MargayCollapse types
export type { MargayCollapseProps, MargayCollapseItemProps } from './MargayCollapse';

// MargaySelect 类型 / MargaySelect types
export type { MargaySelectProps } from './MargaySelect';

// MargaySteps 类型 / MargaySteps types
export type { MargayStepsProps } from './MargaySteps';
