/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: isImageKitConfigured, getImageKitCredentials,
 *   ImageKitCredentials, IMAGEKIT_MAX_IMAGE_BYTES, IMAGEKIT_MAX_IMAGE_LABEL,
 *   IMAGEKIT_POST_FOLDER, IMAGEKIT_UPLOAD_ENDPOINT, LINKEDIN_IMAGE_TRANSFORM,
 *   IMAGEKIT_AUTH_EXPIRY_SECONDS
 *
 * WHAT:  ImageKit credentials, upload ceiling, folder, and the default delivery
 *        transform — the ONE place these literals live.
 * WHY:   Fails soft like src/lib/config/linkedin.ts: with no keys the app still
 *        boots and image attachment simply disappears from the composer rather
 *        than crashing a publish. ImageKit exists because a post that publishes
 *        on Tuesday cannot hold its image in a request payload — scheduling
 *        forced a durable store, and URL transforms mean the image editor is a
 *        string rather than a processing backend.
 * WHERE: Consumed by src/services/imagekit.service.ts and the upload-auth
 *        endpoint on the linkedinPosts router.
 */

/* ImageKit's own upload ceiling for images on every plan. The old 3 MB limit
 * existed only because base64 rode inside the tRPC payload and Vercel rejects
 * bodies over 4.5 MB; direct browser→ImageKit upload removes that constraint
 * entirely, so the real vendor limit is the only one left to enforce. */
export const IMAGEKIT_MAX_IMAGE_BYTES = 25 * 1024 * 1024;

/* Derived so the ceiling is stated once — the zod message and the picker's
 * pre-flight check both read it instead of restating a number that then drifts. */
export const IMAGEKIT_MAX_IMAGE_LABEL = `${IMAGEKIT_MAX_IMAGE_BYTES / (1024 * 1024)} MB`;

/* Post media is namespaced so it can be lifecycled independently of any other
 * uploads this app grows later. */
export const IMAGEKIT_POST_FOLDER = "/linkedin-posts";

/* The browser POSTs the file here directly with the signed params minted by
 * getUploadAuthParams. The bytes never touch our server. */
export const IMAGEKIT_UPLOAD_ENDPOINT =
  "https://upload.imagekit.io/api/v1/files/upload";

/* Signed upload tokens are short-lived: the window only has to cover picking a
 * file and uploading it, and a narrow window limits the blast radius if one
 * leaks out of the client.
 *
 * A DURATION, not a deadline. The ImageKit SDK's getAuthenticationParameters
 * takes an absolute Unix second, so the caller adds this to the current time —
 * passing it straight through backdates every token to 1970. */
export const IMAGEKIT_AUTH_EXPIRY_SECONDS = 15 * 60;

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_IMAGE_TRANSFORM
 *
 * WHAT:  The default ImageKit `tr:` string applied to post images.
 * WHY:   1200x627 is LinkedIn's recommended link-post aspect; `pad_resize`
 *        letterboxes rather than cropping, so a portrait upload is never
 *        silently beheaded. Applied when a post carries no custom transform,
 *        which is every post until the image editor ships — at which point the
 *        editor writes LinkedInPost.imageTransform and this stays the fallback.
 * WHERE: Read by the publish path in src/services/linkedin.service.ts and by
 *        the composer preview so both render identical pixels.
 */
export const LINKEDIN_IMAGE_TRANSFORM = "w-1200,h-627,cm-pad_resize";

export interface ImageKitCredentials {
  publicKey: string;
  privateKey: string;
  urlEndpoint: string;
}

/**
 * SOURCE OF TRUTH KEYWORDS: isImageKitConfigured
 *
 * WHAT:  True when all three ImageKit keys are set.
 * WHERE: Guard in the upload-auth endpoint and the composer, so an unconfigured
 *        install hides image attachment instead of offering a control that
 *        fails on click.
 */
export function isImageKitConfigured(): boolean {
  return Boolean(
    process.env["IMAGEKIT_PUBLIC_KEY"] &&
      process.env["IMAGEKIT_PRIVATE_KEY"] &&
      process.env["IMAGEKIT_URL_ENDPOINT"],
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: getImageKitCredentials
 *
 * WHAT:  Returns all three ImageKit keys, throwing a clear error if any is unset.
 * WHY:   Never returns a partial — a half-configured client would fail at upload
 *        time with an opaque vendor error instead of here with a fixable one.
 * WHERE: Called by src/services/imagekit.service.ts.
 */
export function getImageKitCredentials(): ImageKitCredentials {
  const publicKey = process.env["IMAGEKIT_PUBLIC_KEY"];
  const privateKey = process.env["IMAGEKIT_PRIVATE_KEY"];
  const urlEndpoint = process.env["IMAGEKIT_URL_ENDPOINT"];
  if (!publicKey || !privateKey || !urlEndpoint) {
    throw new Error(
      "[imagekit] IMAGEKIT_PUBLIC_KEY / IMAGEKIT_PRIVATE_KEY / IMAGEKIT_URL_ENDPOINT " +
        "are not all set. Image attachment is unavailable until they are configured.",
    );
  }
  return { publicKey, privateKey, urlEndpoint };
}
