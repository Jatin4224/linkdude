/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ComposerSurvey, composer-survey, Surface,
 *   ComposerShowcase, paper-scope, SCENE_SURFACE_WIDTH, flute scene binding,
 *   monumental surface travel, scene library, cinematic camera, landing composer
 *
 * WHAT:  The binding for the `composer-survey` recipe — the landing page's real
 *        ComposerShowcase section mounted as the scene's single Surface.
 * WHY:   The scene is a CAMERA shot of the shipped section, not a rebuild of it,
 *        so this file renders the same component src/app/(marketing)/page.tsx
 *        renders and adds nothing to it. Two things have to be carried across
 *        the route boundary for it to look like itself: `.paper-scope`, which is
 *        what remaps the shadcn tokens to the paper palette and pins radius to 0
 *        (the marketing LAYOUT normally supplies it, and this scene renders
 *        outside that layout), and a fixed pixel width, because the section is
 *        full-bleed and would otherwise size itself to the studio chrome rather
 *        than to the page it is a picture of. The fonts and the forced-dark
 *        ThemeProvider already come from the root layout, which /flute renders
 *        inside.
 *
 *        No Scene or ScenePreview here by contract: SceneLibrary supplies both
 *        around this component, and nesting a second preview would register a
 *        second capture bridge.
 * WHERE: Paired with composer-survey.scene.json, discovered by the generated
 *        src/flute/catalog.js registry and shown at /flute?flute-scene=composer-survey.
 */

import { Surface } from "@webprodigies/flute";

import { ComposerShowcase } from "@/app/(marketing)/_components";

/* The width the section is composed for. The panel's own max-width is 1240px,
 * so 1440 leaves the page gutter either side of it — the same relationship the
 * landing page has on a desktop viewport, which is what keeps the clamp()-driven
 * type sizes in the scene close to the ones a reader actually sees. */
const SCENE_SURFACE_WIDTH = 1440;

export default function ComposerSurvey() {
  return (
    <Surface id="composer" style={{ width: SCENE_SURFACE_WIDTH }}>
      {/* The visual leaf. The section paints its own `bg-paper`, so the black
          void stops at its edges instead of showing through it. */}
      <div className="paper-scope">
        <ComposerShowcase />
      </div>
    </Surface>
  );
}
