/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: StudioWorkspace, DesignPreview, DesignContentForm,
 *   BackdropControl, BlockStylePanel, ThemePanel, PhotoControl, ExportPanel,
 *   ProfileTextPanel, StyleCard
 *
 * WHAT:  Barrel for the studio route's components.
 * WHY:   The page imports one name from one path; the split between the
 *        workspace and its presentational pieces stays a private detail.
 */
export { StudioWorkspace } from "./studio-workspace";
export { DesignPreview } from "./design-preview";
export type { DesignPreviewProps } from "./design-preview";
export { DesignContentForm } from "./design-content-form";
export type { DesignContentFormProps } from "./design-content-form";
export { BackdropControl } from "./backdrop-control";
export type { BackdropControlProps } from "./backdrop-control";
export { BlockStylePanel } from "./block-style-panel";
export type { BlockStylePanelProps } from "./block-style-panel";
export { ExportPanel } from "./export-panel";
export type { ExportPanelProps } from "./export-panel";
export { PhotoControl } from "./photo-control";
export { ProfileTextPanel } from "./profile-text-panel";
export type { ProfileTextPanelProps } from "./profile-text-panel";
export type { PhotoControlProps } from "./photo-control";
export { StyleCard } from "./style-card";
export type { StyleCardProps } from "./style-card";
export { ThemePanel } from "./theme-panel";
export type { ThemePanelProps } from "./theme-panel";

