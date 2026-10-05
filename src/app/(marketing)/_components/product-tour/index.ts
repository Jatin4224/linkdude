/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ProductTour, product tour barrel, scroll camera
 *
 * WHAT:  Barrel for the product tour — the SECTION only.
 * WHY:   The mock, the camera maths and the DOM writer are implementation of
 *        this one section and are deliberately NOT exported: the mock is a
 *        drawing with no meaning outside the camera that frames it, and the
 *        camera's pose table is measured against that drawing. Exporting either
 *        would invite a second caller to depend on geometry that exists to serve
 *        one scroll sequence.
 * WHERE: src/app/(marketing)/_components/index.ts.
 */

export { ProductTour } from "./product-tour";
