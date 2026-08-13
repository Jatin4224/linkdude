/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ImageEditor, ImageEditorProps
 *
 * WHAT:  Barrel for the global image-editor component.
 * WHY:   Matches the sibling image-upload barrel so consumers import from the
 *        folder, not the file — the internal layout stays free to change.
 * WHERE: Imported by the post composer.
 */

export { ImageEditor } from "./image-editor";
export type { ImageEditorProps } from "./image-editor";
