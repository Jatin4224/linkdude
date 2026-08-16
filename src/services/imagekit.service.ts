/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: getUploadAuthParams, buildTransformedUrl,
 *   deleteImage, fetchImageBinary, getImageKitClient, uploadImageBytes,
 *   uploadFileBytes
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
import {
  imageKitUploadResponseSchema,
  type LinkedInImageBinary,
  type PostImageValues,
  type UploadAuthParams,
} from "@/lib/types";

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
  /* Token is auto-generated (UUID v4) when omitted — no reason to invent our
   * own identifier for a credential that lives fifteen minutes. */
  const { token, expire, signature } =
    getImageKitClient().helper.getAuthenticationParameters(
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

/* Re-exported, not redefined: the implementation moved to lib/config/imagekit
 * so the browser can use it too (the composer preview and the image editor both
 * build this URL live, and this file is `server-only`). Publish-path callers
 * keep reaching it through `imagekitService.buildTransformedUrl`. */
export { buildTransformedUrl } from "@/lib/config/imagekit";

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
 * SOURCE OF TRUTH KEYWORDS: uploadImageBytes
 *
 * WHAT:  Uploads bytes to ImageKit from the SERVER and returns the stored
 *        reference.
 * WHY:   Every other upload in this app goes browser→ImageKit directly, which is
 *        why this did not exist until now. An AI-generated image has no browser
 *        to come from: the bytes are produced by a model call on this server, so
 *        this is the one upload that legitimately originates here.
 *
 *        Takes base64 because that is what the AI SDK's GeneratedFile hands back
 *        — converting to a buffer only to have the SDK re-encode it would be
 *        work for nothing. Lands in the same folder as browser uploads so post
 *        media stays lifecycled as one set regardless of how it got there.
 * WHERE: Called by the AI image-edit router after ai.service.editImage returns.
 */
export async function uploadImageBytes(
  base64: string,
  fileName: string,
): Promise<PostImageValues> {
  return uploadFileBytes(base64, fileName, IMAGEKIT_POST_FOLDER);
}

/**
 * SOURCE OF TRUTH KEYWORDS: uploadFileBytes
 *
 * WHAT:  Uploads bytes to a NAMED ImageKit folder and returns the stored
 *        reference. The generalised form of uploadImageBytes.
 * WHY:   ImageKit stores more than images, and this app now generates more than
 *        images — a rendered carousel PDF has no browser to upload from and does
 *        not belong in the post-media folder, because the two have different
 *        owners and different lifecycles. Taking the folder as an argument is the
 *        whole difference; everything else about the upload is identical, so the
 *        image path delegates here rather than duplicating it.
 *
 *        Still base64, for the reason uploadImageBytes was: it is what the AI
 *        SDK hands back, the SDK re-encodes anything else anyway, and it is the
 *        shape this vendor boundary is already known to accept.
 * WHERE: Called by uploadImageBytes (post media) and by
 *        src/services/carousel.service.ts (rendered PDFs).
 */
export async function uploadFileBytes(
  base64: string,
  fileName: string,
  folder: string,
): Promise<PostImageValues> {
  const response = await getImageKitClient().files.upload({
    file: base64,
    fileName,
    folder,
    /* Same reason as the browser path: never overwrite an existing asset. A
     * collision here would silently rewrite a file another row is using. */
    useUniqueFileName: true,
  });

  /* Parsed, not cast — the same vendor boundary the browser upload validates,
   * so a changed response shape fails here with a clear message. */
  const parsed = imageKitUploadResponseSchema.parse(response);
  return { fileId: parsed.fileId, url: parsed.url };
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
