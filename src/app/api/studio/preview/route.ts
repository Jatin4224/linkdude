/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: POST, studio preview route, renderDesignPng,
 *   design preview, connection pool
 *
 * WHAT:  Renders an unsaved design and returns the PNG bytes.
 * WHY:   A ROUTE HANDLER RATHER THAN A tRPC PROCEDURE, and this is not a style
 *        preference — it is a fix for a measured outage.
 *
 *        `preview` began life as a mutation. The procedure factory wraps EVERY
 *        mutation in a Prisma transaction, so each keystroke-triggered render
 *        held one pooled connection for the ~1-2s satori takes. With a pool
 *        limit of 5, a few seconds of typing exhausted it — and the first thing
 *        to fail was Better Auth's own session lookup, which surfaced to the
 *        member as being silently signed out and bounced back to the gallery
 *        mid-edit. The dev log named it exactly:
 *        "Timed out fetching a new connection from the connection pool
 *         ... meta: { modelName: 'Session', connection_limit: 5 }".
 *
 *        This handler touches NO database at all. It reads the session (already
 *        cached per request), validates the posted document, rasterises, and
 *        returns bytes. Nothing to roll back, no connection to hold.
 *
 *        It also returns image/png directly rather than a base64 data URI, which
 *        drops the ~33% encoding overhead on a payload sent on every debounce
 *        tick.
 *
 *        WHAT THIS GIVES UP, stated plainly: the procedure factory's quota,
 *        rate limit and audit wiring. A preview spends no quota and writes no
 *        audit row by design, so only the rate limit is a real loss — and the
 *        render is bounded instead by the schema's own caps (DESIGN_MAX_BLOCKS,
 *        the per-slot ceilings, the 1-4 cap on badge items), which is what was
 *        actually guarding the renderer from hostile input all along.
 * WHERE: Called by DesignPreview in the studio route. The saved-and-stored
 *        export path stays on tRPC as studio.render, where the transaction,
 *        the quota and the audit row all belong.
 */

import { NextResponse } from "next/server";

import { getCachedSession } from "@/lib/better-auth/auth";
import { designDocSchema } from "@/lib/types";
import { STUDIO_PNG_MIME_TYPE } from "@/lib/config";
import { renderDesignPng } from "@/services/design-render.service";

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

  /* The same schema the stored design is parsed with. A preview draws UNTRUSTED
   * client input, so this is the boundary that bounds the render — not a
   * formality. */
  const parsed = designDocSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That design could not be read" },
      { status: 400 },
    );
  }

  try {
    const rendered = await renderDesignPng(parsed.data);

    return new NextResponse(Buffer.from(rendered.base64, "base64"), {
      status: 200,
      headers: {
        "Content-Type": STUDIO_PNG_MIME_TYPE,
        /* Never cached: the whole point is that it changes on every keystroke,
         * and a cached preview is a preview of the wrong thing. */
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[studio] preview render failed", error);
    return NextResponse.json(
      { error: "That design could not be drawn" },
      { status: 500 },
    );
  }
}
