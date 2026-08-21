/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: opengraph-image, ImageResponse, satori, og:image,
 *   twitter:image, link preview, CAROUSEL_FONT_FILES, Geist-700, BRANDING,
 *   APP_NAME, paper palette, social card
 *
 * WHAT:  The 1200×630 card every link to this app renders as when it is pasted
 *        into LinkedIn, Slack, iMessage or X.
 * WHY:   The product's whole pitch is making someone's LinkedIn presence look
 *        considered, and until this file existed a link to it previewed there as
 *        a bare text row — no image, because `metadata.openGraph` named no
 *        `images` and nothing generated one. On the one network this product is
 *        FOR, the preview card is the product's first impression.
 *
 *        Three constraints come from satori, which is what renders this, and all
 *        three are easy to trip:
 *
 *        1. satori has no CSS runtime — no variables, no classes, no theme. Every
 *           colour below is a LITERAL, and they are the paper palette's hex
 *           values rather than the `oklch()` the app's own tokens are authored
 *           in, because satori cannot parse oklch at all and fails silently.
 *        2. `next/og` bundles exactly one face, Geist Regular, and satori does
 *           NOT synthesise bold. Without the explicit woff buffer below, every
 *           weight from 300 to 900 rasterises identically and the headline
 *           cannot outweigh the label under it. WOFF, never woff2 — satori
 *           reads the former and not the latter.
 *        3. The font is read from disk at request time, so `next.config.ts`
 *           needs this route in `outputFileTracingIncludes` or the file is
 *           absent from the deployed bundle and the card silently loses its
 *           weight.
 *
 *        Deliberately typographic rather than a screenshot of the page: an OG
 *        card is read at thumbnail size in a feed, where a shrunken landing page
 *        is mush and four words in Archivo-weight type still land.
 * WHERE: Next reads this file by convention for `/`. `alt`, `size` and
 *        `contentType` below are the metadata it emits alongside the image.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

import { APP_DESCRIPTION, APP_NAME, CAROUSEL_FONT_FILES } from "@/lib/config";

export const alt = `${APP_NAME} — ${APP_DESCRIPTION}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* The paper palette as literals. See note 1 above — these MUST stay in sync with
 * the `--paper` / `--ink` / `--blue` tokens in globals.css by hand, because
 * satori cannot read a CSS variable and would render nothing rather than warn. */
const PAPER = "#F5F2EA";
const INK = "#111111";
const BLUE = "#2B36E8";
const GREY = "#8C8C8C";
const ON_BLUE = "#FFFFFF";

export default async function OpengraphImage() {
  /* Reuses the same buffers the carousel renderer loads — one copy of these
   * files in the repo, one weight table, and no second place to keep in step. */
  const bold = CAROUSEL_FONT_FILES.find((font) => font.weight === 700);
  const fontData = bold
    ? await readFile(join(process.cwd(), bold.path))
    : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          color: INK,
          padding: 72,
          /* Rule 1 of the design system reaches the card too: everything square,
             and the only depth is a 1px ink rule. */
          border: `2px solid ${INK}`,
          fontFamily: "Geist",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 26,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          <div style={{ width: 18, height: 18, background: BLUE }} />
          {APP_NAME}
        </div>

        {/* One word boxed in blue, exactly as the page sets its display type —
            and exactly one, so the card obeys rule 4 like every screen does. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            fontSize: 92,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            textTransform: "uppercase",
          }}
        >
          <span>Post like you</span>
          <span
            style={{
              background: BLUE,
              color: ON_BLUE,
              padding: "8px 18px 16px",
            }}
          >
            mean it
          </span>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: `2px solid ${INK}`,
            paddingTop: 26,
            fontSize: 24,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: GREY,
          }}
        >
          <div style={{ display: "flex" }}>AI posts · carousels · scheduling</div>
          <div style={{ display: "flex" }}>Free forever · no card</div>
        </div>
      </div>
    ),
    {
      ...size,
      ...(fontData
        ? {
            fonts: [
              { name: "Geist", data: fontData, weight: 700 as const, style: "normal" as const },
            ],
          }
        : {}),
    },
  );
}
