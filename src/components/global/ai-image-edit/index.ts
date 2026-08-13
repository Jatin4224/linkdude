/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: AiImageEdit, AiImageEditProps
 *
 * WHAT:  Barrel for the global AI image-edit component.
 * WHY:   Matches the image-upload and image-editor barrels so consumers import
 *        from the folder, not the file.
 * WHERE: Imported by the post composer.
 */

export { AiImageEdit } from "./ai-image-edit";
export type { AiImageEditProps } from "./ai-image-edit";
