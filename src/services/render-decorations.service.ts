/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: loadDecorationSvgs, DECORATION_FILES, tintDecoration,
 *   decorationDataUri, doodle, currentColor, satori svg
 *
 * WHAT:  The hand-drawn SVG marks a design may place, read off disk once per
 *        process and tinted per render.
 * WHY:   `server-only` for the same reason render-fonts is: this reads the
 *        filesystem, and the markup it returns is render input rather than
 *        anything a browser should receive.
 *
 *        Read ONCE and cached, following render-fonts exactly — a failed read is
 *        not cached, so a transient filesystem error retries on the next render
 *        instead of poisoning every render for the life of the process.
 *
 *        Every file is authored with `currentColor`. satori does NOT inherit
 *        `color` into an <img> payload, so the tint is a string substitution
 *        performed before the data URI is built — which is also why the raw markup
 *        is cached rather than a finished URI: one file serves every palette.
 *
 *        Encoded base64 rather than percent-escaped. An SVG's `#`, `<` and quotes
 *        all need escaping in a data URI, and getting one wrong yields a silently
 *        blank image rather than an error.
 * WHERE: resolveDesignDecorations in design-render.service, which hands the markup
 *        to the decoration block.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  DESIGN_DECORATION_KEYS,
  type DesignDecorationKey,
} from "@/lib/types/design-block";

/* Paths relative to the project root, resolved at render time rather than
 * imported, so the files stay out of the JS bundle. next.config.ts must trace
 * this folder for a deployed render to find them — see its entry. */
const DECORATION_FILES: Record<DesignDecorationKey, string> = {
  underline: "src/app/assets/doodles/underline.svg",
  curvedArrow: "src/app/assets/doodles/curved-arrow.svg",
  circleScribble: "src/app/assets/doodles/circle-scribble.svg",
  starburst: "src/app/assets/doodles/starburst.svg",
  cornerBracket: "src/app/assets/doodles/corner-bracket.svg",
};

export type DecorationMarkup = Readonly<Record<DesignDecorationKey, string>>;

let pending: Promise<DecorationMarkup> | null = null;

export async function loadDecorationSvgs(): Promise<DecorationMarkup> {
  if (pending) return pending;

  pending = (async () => {
    const entries = await Promise.all(
      DESIGN_DECORATION_KEYS.map(async (key) => {
        const markup = await readFile(
          path.join(process.cwd(), DECORATION_FILES[key]),
          "utf8",
        );
        return [key, markup] as const;
      }),
    );
    return Object.fromEntries(entries) as DecorationMarkup;
  })().catch((error: unknown) => {
    pending = null;
    throw error;
  });

  return pending;
}

/**
 * SOURCE OF TRUTH KEYWORDS: decorationDataUri, tint, currentColor
 *
 * WHAT:  One decoration, tinted and encoded for an <img src>.
 * WHY:   The substitution is global on purpose — a mark may use `currentColor` on
 *        several paths at different opacities, and every one of them is the same
 *        ink. Opacity stays in the artwork, where the drawing decided it.
 */
export function decorationDataUri(markup: string, color: string): string {
  const tinted = markup.replaceAll("currentColor", color);
  return `data:image/svg+xml;base64,${Buffer.from(tinted, "utf8").toString("base64")}`;
}
