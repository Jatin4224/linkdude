/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: loadRenderFonts, LoadedFont, RENDER_FONT_FAMILIES,
 *   RenderFontFamilyKey, satori fonts, ImageResponse fonts, woff
 *
 * WHAT:  The typefaces every server-side rasteriser draws with, read off disk
 *        once per process.
 * WHY:   `server-only` because this reads the filesystem and holds multi-hundred
 *        kilobyte buffers — neither belongs in a browser bundle.
 *
 *        Lifted out of carousel.service rather than exported from it. Two
 *        renderers now need these buffers (carousel PDFs and studio PNGs) and
 *        src/app/opengraph-image.tsx already re-implements the same read a third
 *        time. Naming the shared thing after one of its consumers would also
 *        drag pdf-lib and the whole Carousel Prisma surface into the studio's
 *        render path, which is why this is its own module.
 *
 *        THE CACHE IS THE PROMISE, not the resolved value. Two concurrent
 *        renders starting at once would otherwise both miss and both read the
 *        disk; caching the in-flight promise means the second awaits the first.
 *
 *        WOFF ONLY — never woff2. satori cannot decode woff2, and the failure is
 *        not an exception: next/og falls back to the single Regular face it
 *        bundles and SILENTLY IGNORES fontWeight, so every weight from 300 to
 *        900 renders identically. A design that looks flat rather than broken is
 *        the hardest render bug to notice.
 * WHERE: src/services/design-render.service.tsx and
 *        src/services/carousel.service.ts. Any new rasteriser should call this
 *        rather than reading CAROUSEL_FONT_FILES itself.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import { CAROUSEL_FONT_FAMILY, CAROUSEL_FONT_FILES } from "@/lib/config";

/**
 * SOURCE OF TRUTH KEYWORDS: LoadedFont
 *
 * WHAT:  One face, in the shape `ImageResponse` expects for its `fonts` option.
 * WHY:   Declared here rather than imported from next/og: the option type is not
 *        exported, and restating five fields is cheaper than a structural cast
 *        that would stop type-checking the moment the option shape changed.
 */
export interface LoadedFont {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
}

/**
 * SOURCE OF TRUTH KEYWORDS: RENDER_FONT_FAMILIES, RenderFontFamilyKey
 *
 * WHAT:  The typefaces a design may name.
 * WHY:   A registry rather than a single constant, because "a style with its own
 *        typeface" is a real product request and this is where it costs one
 *        entry instead of a refactor. next.config.ts already traces
 *        ./src/app/assets/fonts/** wholesale, so adding a WOFF beside the
 *        existing ones needs no build-config change at all.
 *
 *        Three families now. The keys are the ones a design block names through
 *        its `font` property, so a layout asks for "marker" and this decides which
 *        file that is — a template never names a filename.
 *
 *        Permanent Marker ships ONE weight, and that is correct rather than
 *        incomplete: it is already a heavy face, and satori falls back to the
 *        nearest weight it holds, so a 700 request draws the 400 file at its
 *        natural weight instead of a synthesised one.
 *
 *        Note the .ttf extensions beside Geist's .woff. satori reads both; it does
 *        NOT read woff2, which is the one substitution that fails silently.
 */
export const RENDER_FONT_FAMILIES = {
  geist: { family: CAROUSEL_FONT_FAMILY, files: CAROUSEL_FONT_FILES },
  marker: {
    family: "Permanent Marker",
    files: [
      { weight: 400, path: "src/app/assets/fonts/Marker-400.ttf" },
    ],
  },
  hand: {
    family: "Caveat",
    files: [
      { weight: 400, path: "src/app/assets/fonts/Caveat-400.ttf" },
      { weight: 700, path: "src/app/assets/fonts/Caveat-700.ttf" },
    ],
  },
} as const;

export type RenderFontFamilyKey = keyof typeof RENDER_FONT_FAMILIES;

/* Keyed by family so two renderers asking for different typefaces do not share
 * one cache slot and hand each other the wrong buffers. */
const fontPromises = new Map<RenderFontFamilyKey, Promise<LoadedFont[]>>();

/**
 * SOURCE OF TRUTH KEYWORDS: loadRenderFonts
 *
 * WHAT:  Every face of one family, as buffers, cached for the life of the
 *        process.
 * WHY:   Font files never change at runtime, so re-reading them per render is
 *        pure latency on a path that is already CPU-bound.
 *
 *        A failed read is NOT cached: the map entry is dropped so the next call
 *        retries. A transient filesystem error would otherwise poison every
 *        render for the lifetime of the process, turning a blip into an outage.
 * WHERE: Passed straight to `new ImageResponse(..., { fonts })`. Every
 *        ImageResponse in this codebase must receive these — see the woff2 note
 *        in the module header for what happens when one does not.
 */
export async function loadRenderFonts(
  familyKey: RenderFontFamilyKey = "geist",
): Promise<LoadedFont[]> {
  const cached = fontPromises.get(familyKey);
  if (cached) return cached;

  const family = RENDER_FONT_FAMILIES[familyKey];
  const pending = Promise.all(
    family.files.map(async (font) => ({
      name: family.family,
      data: await readFile(path.join(process.cwd(), font.path)),
      weight: font.weight,
      style: "normal" as const,
    })),
  ).catch((error: unknown) => {
    fontPromises.delete(familyKey);
    throw error;
  });

  fontPromises.set(familyKey, pending);
  return pending;
}

/**
 * SOURCE OF TRUTH KEYWORDS: loadAllRenderFonts, multiple families, fontFamily
 *
 * WHAT:  Every registered face, as one array.
 * WHY:   satori resolves `fontFamily` per element against whatever it was handed,
 *        so a document that mixes a marker headline with a sans body needs BOTH
 *        families present in the same render. There is no per-element font
 *        loading to do instead.
 *
 *        Cheap, despite loading everything: each family is memoised by
 *        loadRenderFonts, so after the first render this is three cache hits and
 *        an array concat. The buffers are held for the life of the process either
 *        way — they are read from disk once, not per render.
 * WHERE: renderDesignPng, which draws documents whose blocks may name any family.
 */
export async function loadAllRenderFonts(): Promise<LoadedFont[]> {
  const families = Object.keys(RENDER_FONT_FAMILIES) as RenderFontFamilyKey[];
  const loaded = await Promise.all(families.map((key) => loadRenderFonts(key)));
  return loaded.flat();
}
