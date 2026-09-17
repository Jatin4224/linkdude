/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: DesignPalette, DESIGN_PALETTES, DESIGN_PALETTE_KEYS,
 *   DesignPaletteKey, getDesignPalette, resolveDesignPalette, resolveDesignColor,
 *   DESIGN_TYPE_SCALE, DesignTypeScale, getDesignTypeScale, hexToRgbTuple,
 *   design studio theme, satori colours
 *
 * WHAT:  The render-time twin of the app's theme, for the studio renderer —
 *        every colour and type size a design draws with, as plain sRGB and
 *        pixels.
 * WHY:   Same reason `carousel-theme.ts` exists, and the explanation there is the
 *        canonical one: SATORI HAS NO CSS RUNTIME. It never loads globals.css,
 *        `bg-background` resolves to nothing, and its colour parser does not
 *        understand `oklch()` — the notation every token in this app is authored
 *        in. A design reaching for a theme token would silently draw
 *        transparent-on-transparent.
 *
 *        This file owns `DesignPalette`, and `carousel-theme.ts` now aliases its
 *        own `CarouselPalette` to it. One declaration rather than two identical
 *        five-field interfaces: phase 5 of docs/20-studio.md points the carousel
 *        renderer at this module, and a forked shape would have to be reconciled
 *        then instead of now.
 *
 *        The palettes below are USER-FACING CHOICES, not theme conversions.
 *        That is the difference from carousel-theme, where each hex is the sRGB
 *        twin of a named `.dark` token: a profile banner is the member's brand
 *        on LinkedIn's canvas, not this app's chrome, so it needs colours this
 *        app does not have tokens for.
 * WHERE: Read by src/services/design-render.service.tsx and by the studio's
 *        palette picker. Nothing in the DOM should import it — there, use the
 *        real theme tokens.
 */

import type {
  DesignCanvasKey,
  DesignColorRef,
  DesignColorSlot,
} from "@/lib/types/design-block";

/**
 * SOURCE OF TRUTH KEYWORDS: DesignPalette
 *
 * WHAT:  The five colours any design gets.
 * WHY:   Five, and deliberately not six — the constraint carousel-theme states:
 *        a template that needs another colour is a template doing too much, and
 *        the cap is what keeps twenty templates looking like one product.
 *
 *        DESIGN_COLOR_SLOTS in lib/types/design-block is declared `satisfies
 *        readonly (keyof DesignPalette)[]`, so adding a field here without
 *        adding the slot there is a compile error rather than a colour no
 *        template can name.
 */
export interface DesignPalette {
  /** Full-bleed canvas fill. */
  background: string;
  /** Headlines. */
  foreground: string;
  /** Supporting copy — never a headline. */
  muted: string;
  /** Rules, hairlines, badge outlines. */
  border: string;
  /** The one emphatic colour: CTA fills, accent bars. */
  accent: string;
}

/** LinkedIn's own blue. Shared with the carousel renderer's brand constant. */
export const DESIGN_BRAND_HEX = "#0A66C2";

export const DESIGN_PALETTE_KEYS = [
  "boldBlue",
  "midnight",
  "paper",
  "forest",
] as const;
export type DesignPaletteKey = (typeof DESIGN_PALETTE_KEYS)[number];

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_PALETTES
 *
 * WHAT:  The named colourways a template can be rendered in.
 * WHY:   This is the multiplier that makes twenty gallery entries affordable.
 *        Five archetypes times four palettes is twenty cards, with five block
 *        lists to maintain — the same split CAROUSEL_TEMPLATES and
 *        CAROUSEL_PALETTES already prove. A new colourway is one entry here and
 *        costs no render code at all.
 *
 *        Every value is six-digit sRGB. `muted` is always a TINT of its own
 *        field rather than a neutral grey, because grey over a saturated colour
 *        reads as dirt — the note carousel-theme makes about its `bold` palette
 *        generalises to all of these.
 */
export const DESIGN_PALETTES: Record<DesignPaletteKey, DesignPalette> = {
  /* The channel colour as the field. Highest recognition on LinkedIn, because
   * it is the platform's own blue — which is also the argument against using it
   * for everything, hence the other three. */
  boldBlue: {
    background: DESIGN_BRAND_HEX,
    foreground: "#FFFFFF",
    muted: "#D6E4F5",
    border: "#075EA9",
    accent: "#FFFFFF",
  },

  /* Near-black with the brand as the single accent. Reads as considered rather
   * than loud, and it is the safest default behind a photograph. */
  midnight: {
    background: "#0B1220",
    foreground: "#FFFFFF",
    muted: "#94A3B8",
    border: "#1E293B",
    accent: DESIGN_BRAND_HEX,
  },

  /* The light inversion, for profiles that want to read as a document. Off-white
   * rather than pure white: #FFFFFF against LinkedIn's own white page loses the
   * banner's edge entirely. */
  paper: {
    background: "#F7F5F0",
    foreground: "#111111",
    muted: "#57534E",
    border: "#E0DCD3",
    accent: DESIGN_BRAND_HEX,
  },

  /* A non-blue option that still clears contrast at banner scale. Present so the
   * gallery is not four shades of the same idea. */
  forest: {
    background: "#0F2A22",
    foreground: "#FFFFFF",
    muted: "#9DC3B4",
    border: "#1D4438",
    accent: "#4ADE80",
  },
};

/**
 * SOURCE OF TRUTH KEYWORDS: getDesignPalette
 *
 * WHAT:  Palette lookup that always returns something.
 * WHY:   `paletteId` is a bare String on StudioProject and inside a Json doc, so
 *        a value written before a palette was renamed must still render rather
 *        than throw halfway through a kit. The same fallback contract
 *        getCarouselPalette states, for the same reason.
 */
export function getDesignPalette(paletteId: string): DesignPalette {
  return DESIGN_PALETTES[paletteId as DesignPaletteKey] ?? DESIGN_PALETTES.midnight;
}

/**
 * SOURCE OF TRUTH KEYWORDS: resolveDesignPalette
 *
 * WHAT:  A named palette with the user's per-slot overrides applied.
 * WHY:   Overrides are partial by design — someone changes the accent and leaves
 *        the rest — so this merges rather than replaces. Returning a complete
 *        palette means the renderer never has to think about which slots the
 *        user touched.
 * WHERE: Called once per render, before the element tree is built.
 */
export function resolveDesignPalette(
  paletteId: string,
  overrides: Partial<Record<DesignColorSlot, string>>,
): DesignPalette {
  const base = getDesignPalette(paletteId);
  return {
    background: overrides.background ?? base.background,
    foreground: overrides.foreground ?? base.foreground,
    muted: overrides.muted ?? base.muted,
    border: overrides.border ?? base.border,
    accent: overrides.accent ?? base.accent,
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: hexToRgbTuple
 *
 * WHAT:  Splits a six-digit hex into its channels.
 * WHY:   Only needed because of the opacity rule below. Tolerates a malformed
 *        value by returning black rather than throwing: this runs inside the
 *        render path, and a bad colour should cost one wrong swatch, not the
 *        whole export.
 */
function hexToRgbTuple(hex: string): readonly [number, number, number] {
  const match = /^#([0-9A-Fa-f]{6})$/.exec(hex);
  if (!match?.[1]) return [0, 0, 0];
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/**
 * SOURCE OF TRUTH KEYWORDS: resolveDesignColor
 *
 * WHAT:  Turns a block's colour reference into a string satori will actually
 *        draw.
 * WHY:   Emits `rgba(...)` for anything translucent rather than an eight-digit
 *        hex. satori's colour parser is not CSS Color 4, so `#0A66C280` is not
 *        reliably understood — and an unparsed colour draws nothing, silently,
 *        which is the failure mode this whole module exists to prevent.
 *
 *        Fully opaque colours pass through as hex untouched, which keeps the
 *        common case readable when debugging a rendered tree.
 * WHERE: Every colour in design-render.service goes through here. A raw string
 *        cannot reach a style object, because the block schema has no hex field.
 */
export function resolveDesignColor(
  palette: DesignPalette,
  ref: DesignColorRef,
): string {
  const hex = palette[ref.slot];
  if (ref.opacity >= 1) return hex;
  const [r, g, b] = hexToRgbTuple(hex);
  return `rgba(${r}, ${g}, ${b}, ${ref.opacity})`;
}

/**
 * SOURCE OF TRUTH KEYWORDS: DesignTypeScale
 *
 * WHAT:  Type sizes, padding and stack gap for one geometry, in pixels.
 * WHY:   Pixels because satori has no rem and no root font size — every length
 *        it draws is absolute.
 */
export interface DesignTypeScale {
  display: number;
  heading: number;
  subheading: number;
  body: number;
  meta: number;
  padding: number;
  gap: number;
}

/**
 * SOURCE OF TRUTH KEYWORDS: DESIGN_TYPE_SCALE
 *
 * WHAT:  One row per canvas.
 * WHY:   One table per geometry, never one table plus a multiplier — the rule
 *        carousel-theme states and the reason is starker here. A banner is 4:1
 *        and a company banner is 5.9:1; a scale factor that suits one produces a
 *        headline taller than the canvas in the other.
 *
 *        The two carousel rows are COPIED from CAROUSEL_TYPE_SCALE rather than
 *        re-derived, with `coverHeading` becoming `display` and the two extra
 *        roles added. That is what makes phase 5 pixel-neutral: pointing the
 *        carousel renderer here must not move a single glyph.
 */
export const DESIGN_TYPE_SCALE = {
  /* A banner is only 396px tall and its left third sits under the avatar, so the
   * display size is far smaller than the canvas width suggests. */
  linkedinBanner: {
    display: 72,
    heading: 58,
    subheading: 34,
    body: 28,
    meta: 22,
    padding: 72,
    gap: 16,
  },
  /* 191px tall. Everything shrinks; this is the tightest canvas in the set. */
  companyBanner: {
    display: 44,
    heading: 38,
    subheading: 24,
    body: 20,
    meta: 16,
    padding: 40,
    gap: 10,
  },
  /* Renders as a small card in the Featured rail, so type runs large relative to
   * the canvas — it has to survive being shown at roughly a third of its size. */
  featuredCover: {
    display: 88,
    heading: 68,
    subheading: 40,
    body: 32,
    meta: 24,
    padding: 72,
    gap: 20,
  },
  /* 400px square, and LinkedIn renders it as a ~150px circle. Text on a headshot
   * is a ring label at most, which is why these numbers are so small. */
  headshot: {
    display: 44,
    heading: 34,
    subheading: 24,
    body: 18,
    meta: 14,
    padding: 24,
    gap: 8,
  },
  /* Copied verbatim from CAROUSEL_TYPE_SCALE.portrait — see the WHY above. */
  carouselPortrait: {
    display: 104,
    heading: 84,
    subheading: 56,
    body: 38,
    meta: 28,
    padding: 96,
    gap: 24,
  },
  /* Copied verbatim from CAROUSEL_TYPE_SCALE.square. */
  carouselSquare: {
    display: 88,
    heading: 72,
    subheading: 48,
    body: 34,
    meta: 26,
    padding: 84,
    gap: 22,
  },
} as const satisfies Record<DesignCanvasKey, DesignTypeScale>;

/**
 * SOURCE OF TRUTH KEYWORDS: getDesignTypeScale
 *
 * WHAT:  Type-scale lookup with the same never-throw contract as
 *        getDesignPalette.
 * WHY:   `canvas` arrives as a String from inside a Json column. A document
 *        written before a preset was renamed must render something rather than
 *        fail mid-kit.
 * WHERE: Called once per render in design-render.service.
 */
export function getDesignTypeScale(canvas: string): DesignTypeScale {
  return (
    DESIGN_TYPE_SCALE[canvas as DesignCanvasKey] ?? DESIGN_TYPE_SCALE.linkedinBanner
  );
}
