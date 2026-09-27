/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: POST, carousel preview route, renderCarouselSlidePreview,
 *   carouselSlidePreviewSchema, slide preview, connection pool, CAROUSEL_PREVIEW_PATH
 *
 * WHAT:  Renders one unsaved slide and returns the PNG bytes.
 * WHY:   A ROUTE HANDLER RATHER THAN A tRPC PROCEDURE, for the reason the studio's
 *        equivalent documents at src/app/api/studio/preview/route.ts — and that
 *        reason was a measured outage, not a preference.
 *
 *        The procedure factory wraps EVERY mutation in a Prisma transaction, so a
 *        keystroke-triggered render holds one pooled connection for as long as
 *        satori takes. With a pool limit of 5, seconds of typing exhausted it, and
 *        the first casualty was Better Auth's own session lookup — which reached
 *        the member as being silently signed out mid-edit. This handler touches NO
 *        database: it reads the already-per-request-cached session, validates the
 *        posted slide, rasterises, and returns bytes. Nothing to roll back, no
 *        connection to hold.
 *
 *        Returns image/png directly rather than a base64 data URI, which drops the
 *        ~33% encoding overhead on a payload rebuilt on every debounce tick.
 *
 *        WHAT THIS GIVES UP, stated plainly: the factory's quota, rate limit and
 *        audit wiring. A preview spends no quota and writes no audit row by design,
 *        so only the rate limit is a real loss — and the render is bounded instead
 *        by carouselSlidePreviewSchema's own caps (the heading and body ceilings,
 *        the deck bounds on `total`, and the `index < total` refine), which is what
 *        actually guards the renderer from hostile input.
 * WHERE: Fetched by the carousel slide preview and by the PNG zip export, both via
 *        CAROUSEL_PREVIEW_PATH. The stored export stays on tRPC as carousel.render,
 *        where the transaction, the quota and the audit row all belong.
 */

import { NextResponse } from "next/server";

import { getCachedSession } from "@/lib/better-auth/auth";
import { carouselSlidePreviewSchema } from "@/lib/types";
import { CAROUSEL_PNG_MIME_TYPE } from "@/lib/config";
import { renderCarouselSlidePreview } from "@/services/carousel.service";

export async function POST(request: Request): Promise<Response> {
  const session = await getCachedSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  /* The same schema bounds this that bounds a stored slide. A preview draws
   * UNTRUSTED client input, so this is the boundary that bounds the render — not a
   * formality. */
  const parsed = carouselSlidePreviewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That slide could not be read" },
      { status: 400 },
    );
  }

  try {
    const rendered = await renderCarouselSlidePreview(parsed.data);

    return new NextResponse(Buffer.from(rendered.base64, "base64"), {
      status: 200,
      headers: {
        "Content-Type": CAROUSEL_PNG_MIME_TYPE,
        /* Never cached: the whole point is that it changes on every keystroke, and
         * a cached preview is a preview of the wrong thing. */
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[carousel] preview render failed", error);
    return NextResponse.json(
      { error: "That slide could not be drawn" },
      { status: 500 },
    );
  }
}
