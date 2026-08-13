/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: getUploadAuthParams, buildTransformedUrl,
 *   deleteImage, fetchImageBinary, getImageKitClient
 *
 * WHAT:  Every ImageKit touchpoint — minting signed upload credentials for the
 *        browser, composing delivery URLs with a `tr:` transform, fetching the
 *        rendered bytes for LinkedIn, and deleting an asset.
 * WHY:   `server-only` because this file holds the ImageKit PRIVATE key;
 *        importing it into a client bundle would hand every visitor the ability
 *        to upload to and delete from this account. The browser never gets the
 *        private key — it gets a short-lived HMAC signature minted here.
 *
 *        Uploads go browser→ImageKit DIRECTLY, never through this app. That is
 *        what removed the old 3 MB attachment cap: base64 inside the tRPC
 *        payload hit Vercel's 4.5 MB request-body ceiling, and no amount of
 *        raising a constant fixes a transport limit.
 * WHERE: Called by the linkedinPosts router (uploadAuth) and by the publish
 *        path in src/services/linkedin.service.ts (both immediate and worker).
 */

import ImageKit from "@imagekit/nodejs";

import {
  getImageKitCredentials,
  IMAGEKIT_AUTH_EXPIRY_SECONDS,
  IMAGEKIT_POST_FOLDER,
} from "@/lib/config/imagekit";
import type { LinkedInImageBinary, UploadAuthParams } from "@/lib/types";

/* One client per process. Constructed lazily rather than at module scope so an
 * install with no ImageKit keys can still import this file — every other
 * integration here fails soft the same way, and a top-level throw would take
 * the whole publish path down with it. */
let client: ImageKit | null = null;

function getImageKitClient(): ImageKit {
  if (!client) {
    client = new ImageKit({ privateKey: getImageKitCredentials().privateKey });
  }
  return client;
}

/**
 * SOURCE OF TRUTH KEYWORDS: getUploadAuthParams
 *
 * WHAT:  Short-lived signed credentials letting one browser upload one file.
 * WHY:   The signature is HMAC-SHA1 over (token + expire) with the private key,
 *        so possessing it permits an upload but never reveals the key. Expiry
 *        is deliberately short — long enough to pick a file and send it, short
 *        enough that a leaked token is worthless by the time it is found.
 *
 *        publicKey/urlEndpoint/folder ride along so the client needs no
 *        ImageKit env vars of its own. Duplicating them into NEXT_PUBLIC_* vars
 *        would create a second source of truth that silently drifts from this
 *        one when an account is switched.
 * WHERE: Returned by linkedinPosts.uploadAuth to the image-upload component.
 */
export function getUploadAuthParams(): UploadAuthParams {
  const { publicKey, urlEndpoint } = getImageKitCredentials();
  const { token, expire, signature } = getImageKitClient().helper
    /* Token is auto-generated (UUID v4) when omitted — no reason to invent our
     * own identifier for a credential that lives fifteen minutes. */
    .getAuthenticationParameters(
      undefined,
      /* The SDK wants the absolute SECOND at which the token dies, not how long
       * it lives. Handing it the duration itself dates the token to 1970, and
       * ImageKit rejects the upload with a 400 the client can only report as an
       * opaque vendor error — the signature is computed over that same bad
       * value, so nothing catches it on our side. */
      Math.floor(Date.now() / 1000) + IMAGEKIT_AUTH_EXPIRY_SECONDS,
    );

  return {
    token,
    expire,
    signature,
    publicKey,
    urlEndpoint,
    folder: IMAGEKIT_POST_FOLDER,
  };
}

/**
 * SOURCE OF TRUTH KEYWORDS: buildTransformedUrl
 *
 * WHAT:  Splices a `tr:` transformation into an ImageKit delivery URL.
 * WHY:   ImageKit renders transforms on demand from the URL — no re-upload, no
 *        processing backend, and the original is never modified. That is what
 *        lets a post store its edits as a string (LinkedInPost.imageTransform)
 *        and keeps every edit reversible.
 *
 *        Uses the QUERY form (`?tr=`) rather than the path form (`/tr:.../`):
 *        the path form requires knowing where the endpoint ends and the file
 *        path begins, which breaks on custom domains and sub-folders. The query
 *        form is position-independent and therefore can't be spliced wrong.
 * WHERE: Called by the publish path and mirrored by the composer preview so the
 *        user sees exactly the pixels LinkedIn receives.
 */
export function buildTransformedUrl(imageUrl: string, transform: string): string {
  const url = new URL(imageUrl);
  url.searchParams.set("tr", transform);
  return url.toString();
}

/**
 * SOURCE OF TRUTH KEYWORDS: fetchImageBinary
 *
 * WHAT:  Downloads a rendered ImageKit image as bytes.
 * WHY:   LinkedIn's Images API wants the binary uploaded to a URL it hands us —
 *        it will not fetch from a third party. So the transformed image has to
 *        make one hop through the server on its way out. This is the ONLY time
 *        image bytes touch this app.
 * WHERE: Called by the publish path immediately before uploadImage.
 */
export async function fetchImageBinary(
  url: string,
): Promise<LinkedInImageBinary> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `[imagekit] fetching transformed image failed (${response.status})`,
    );
  }

  /* ImageKit may return a different type than was uploaded — `f-auto` and
   * format conversion are transform options — so the response header is the
   * only trustworthy source for what LinkedIn should be told it is receiving. */
  const mimeType = response.headers.get("content-type") ?? "image/jpeg";
  return { mimeType, bytes: await response.arrayBuffer() };
}

/**
 * SOURCE OF TRUTH KEYWORDS: deleteImage
 *
 * WHAT:  Removes an asset from ImageKit. Never throws.
 * WHY:   Called when a scheduled post is canceled. Swallowing the failure is
 *        deliberate: an orphaned ImageKit file costs a few kilobytes, while a
 *        thrown error would fail the user's cancel and leave a post that still
 *        publishes. The cheap failure is the right one to absorb.
 * WHERE: Called by the linkedinPosts router AFTER the cancel transaction
 *        commits — never inside it, or a rollback would leave a live row
 *        pointing at a deleted image.
 */
export async function deleteImage(fileId: string): Promise<void> {
  try {
    await getImageKitClient().files.delete(fileId);
  } catch (error) {
    console.error("[imagekit] failed to delete asset", { fileId, error });
  }
}
