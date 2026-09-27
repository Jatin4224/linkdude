/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_PALETTES, CarouselPalette,
 *   getCarouselPalette, CAROUSEL_BRAND_HEX, CAROUSEL_TYPE_SCALE,
 *   getCarouselTypeScale
 *
 * WHAT:  The render-time twin of the app's theme tokens — every colour and type
 *        size the slide templates draw with, as plain sRGB and pixels.
 * WHY:   THIS FILE EXISTS BECAUSE SATORI HAS NO CSS RUNTIME. The renderer never
 *        loads globals.css: `bg-background` resolves to nothing, and satori's
 *        colour parser does not understand `oklch()` — which is the notation
 *        every token in this app is authored in. A slide template reaching for a
 *        theme token would silently draw transparent-on-transparent.
 *
 *        So the values below are DERIVED, not invented: each one is the exact
 *        sRGB conversion of the `.dark` token named beside it (dark is the
 *        shipped theme — layout.tsx forces it). Changing a token in globals.css
 *        means reconverting it here; that duplication is the unavoidable cost of
 *        rendering outside the browser, and stating it in one config file is what
 *        keeps it out of the components, where the project's no-hardcoded-colour
 *        rule properly applies.
 * WHERE: Read by the slide templates in src/services/carousel.service.ts. Nothing
 *        else should import it — in the DOM, use the real tokens.
 */

import type { CarouselPagePreset, CarouselTemplate } from "@/lib/types/carousel";

/* The palette shape is owned by the studio's theme module — see the note on
 * CarouselPalette below. Imported, not redeclared. */
import type { DesignPalette } from "./design-theme";

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_BRAND_HEX
 *
 * WHAT:  The channel accent as sRGB.
 * WHY:   Taken from the INTENT stated in globals.css ("LinkedIn blue (#0A66C2)")
 *        rather than from converting `--brand`, which round-trips to #1972C5. The
 *        oklch token is a near-match authored for screen; a PDF renders inside
 *        LinkedIn's own chrome, where the exact brand blue is the right one.
 */
export const CAROUSEL_BRAND_HEX = "#0A66C2";

/**
 * SOURCE OF TRUTH KEYWORDS: CarouselPalette
 *
 * WHAT:  The five colours a slide template needs — background, foreground,
 *        muted, border, accent.
 * WHY:   Deliberately small. A template that needs a sixth colour is a template
 *        doing too much — the constraint is what keeps decks looking like one
 *        product rather than five unrelated designs.
 *
 *        An ALIAS rather than its own declaration since the studio landed: the
 *        two renderers had byte-identical five-field interfaces, and phase 5 of
 *        docs/20-studio.md points this renderer at the studio's generic one.
 *        Two identical shapes would have to be reconciled then; one shape now
 *        costs nothing and every existing importer of `CarouselPalette` keeps
 *        resolving unchanged.
 */
export type CarouselPalette = DesignPalette;

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_PALETTES
 *
 * WHAT:  One palette per CAROUSEL_TEMPLATES entry.
 * WHY:   Hex beside the token it converts, so the derivation is auditable without
 *        re-running a colour-space conversion to check.
 */
export const CAROUSEL_PALETTES: Record<CarouselTemplate, CarouselPalette> = {
  /* Dark and quiet. `--card` rather than `--background` for the fill: pure black
   * full-bleed crushes against LinkedIn's own dark surface, and #090909 keeps the
   * slide edge visible in the feed. */
  minimal: {
    background: "#090909", // .dark --card       oklch(0.14 0 0)
    foreground: "#FFFFFF", // .dark --foreground oklch(1 0 0)
    muted: "#A4A4A4", // .dark --muted-foreground oklch(0.72 0 0)
    border: "#242424", // .dark --border     oklch(0.26 0 0)
    accent: CAROUSEL_BRAND_HEX,
  },

  /* The channel colour as the field. White on brand blue clears contrast
   * comfortably; the "muted" slot is a tinted white rather than a grey, because a
   * grey on saturated blue reads as dirt. */
  bold: {
    background: CAROUSEL_BRAND_HEX,
    foreground: "#FFFFFF", // --brand-foreground oklch(1 0 0)
    muted: "#D6E4F5", // brand-tinted white; grey muddies on a saturated field
    border: "#075EA9", // --brand-hover    oklch(0.48 0.14 252)
    accent: "#FFFFFF",
  },

  /* The light counterpart, from the `:root` (light) ramp rather than `.dark` —
   * the one template that deliberately inverts, for decks meant to read as a
   * document rather than a graphic. */
  editorial: {
    background: "#FCFCFC", // :root --background oklch(0.99 0 0)
    foreground: "#000000", // :root --foreground oklch(0 0 0)
    muted: "#525252", // :root --muted-foreground oklch(0.44 0 0)
    border: "#E4E4E4", // :root --border     oklch(0.92 0 0)
    accent: CAROUSEL_BRAND_HEX,
  },

  /* Warm paper with a marker highlight. The accent is YELLOW rather than the
   * channel blue, because in this template the accent's main job is the swash
   * behind a marked word — and a blue swash under navy text is unreadable where
   * yellow carries it. The cta slide inverts onto the navy foreground instead of
   * onto the accent, which is why its layout states its own field. */
  notebook: {
    background: "#FAF6EC", // warm paper; a flat white loses the notebook read
    foreground: "#16233A", // deep navy ink
    muted: "#5C6475",
    border: "#E7DFCE",
    accent: "#F5C542", // marker yellow
  },

  /* High-contrast blue on white, for decks that read as a product's own
   * material. Near-black rather than pure black for the ink: pure black beside a
   * saturated blue reads as a rendering error on a bright feed. */
  linkdude: {
    background: "#FFFFFF",
    foreground: "#0B1220",
    muted: "#5B6474",
    border: "#DCE6F5",
    accent: "#2D6BFF",
  },
};

/**
 * SOURCE OF TRUTH KEYWORDS: getCarouselPalette
 *
 * WHAT:  Palette lookup with a guaranteed result.
 * WHY:   templateId is a String on the row. A value that predates a renamed
 *        template must still render something rather than throwing mid-deck, so
 *        an unknown id falls back to `minimal` instead of failing the job.
 * WHERE: Called once per render in carousel.service.
 */
export function getCarouselPalette(templateId: string): CarouselPalette {
  return CAROUSEL_PALETTES[templateId as CarouselTemplate] ?? CAROUSEL_PALETTES.minimal;
}

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_TYPE_SCALE, getCarouselTypeScale
 *
 * WHAT:  Type sizes and page padding, in pixels, per page preset.
 * WHY:   Pixels because satori has no rem and no root font size — every length it
 *        draws is absolute. Scaled per preset rather than shared: a square slide
 *        is 270px shorter than a portrait one, so the portrait heading size
 *        overflows it. Two tables beat one table plus a magic multiplier.
 *
 *        Sizes are for the whole deck, not per slide kind; templates vary weight
 *        and position, never the scale, which is what keeps a deck internally
 *        consistent when the model writes an unusually long heading.
 */
export const CAROUSEL_TYPE_SCALE = {
  portrait: { heading: 84, coverHeading: 104, body: 38, meta: 28, padding: 96 },
  square: { heading: 72, coverHeading: 88, body: 34, meta: 26, padding: 84 },
} as const satisfies Record<
  CarouselPagePreset,
  { heading: number; coverHeading: number; body: number; meta: number; padding: number }
>;

export type CarouselTypeScale = (typeof CAROUSEL_TYPE_SCALE)[CarouselPagePreset];

/**
 * SOURCE OF TRUTH KEYWORDS: getCarouselTypeScale
 *
 * WHAT:  Type-scale lookup with the same fallback contract as getCarouselPalette.
 * WHERE: Called once per render in carousel.service.
 */
export function getCarouselTypeScale(pagePreset: string): CarouselTypeScale {
  return (
    CAROUSEL_TYPE_SCALE[pagePreset as CarouselPagePreset] ??
    CAROUSEL_TYPE_SCALE.portrait
  );
}
