/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: postImageSchema, PostImageValues,
 *   uploadAuthParamsSchema, UploadAuthParams, imageKitUploadResponseSchema,
 *   ImageKitUploadResponse, IMAGEKIT_TRANSFORM_MAX
 *
 * WHAT:  The contract for an image attached to a post — an ImageKit reference,
 *        not bytes — plus the signed params the browser needs to upload one and
 *        the response shape ImageKit hands back.
 * WHY:   This REPLACED a base64 payload. Two reasons it had to change: a
 *        scheduled post publishes days later and cannot keep its image in a
 *        request body, and base64 inside the tRPC payload capped attachments at
 *        3 MB because Vercel rejects request bodies over 4.5 MB. Uploading
 *        browser→ImageKit directly fixes both: the server only ever sees a
 *        fileId and a URL.
 *        `transform` is carried separately from `url` so edits stay
 *        non-destructive — the image editor rewrites one string and the
 *        original is never touched.
 * WHERE: Consumed by publishPostSchema (src/lib/types/linkedin.ts), the
 *        linkedinPosts router, src/services/imagekit.service.ts, and the
 *        global image-upload component.
 */

import { z } from "zod";

/* An ImageKit `tr:` string. Bounded because it is user-influenced input that
 * ends up spliced into a delivery URL — an unbounded string is a payload, not a
 * transform. Generous enough for chained ops with text overlays. */
export const IMAGEKIT_TRANSFORM_MAX = 500;

/* ImageKit transform syntax is comma/colon-separated tokens. Restricting the
 * charset stops a crafted value from breaking out of the transform segment and
 * rewriting the URL path — the reason this is validated and not just typed. */
const IMAGEKIT_TRANSFORM_PATTERN = /^[A-Za-z0-9_\-,:.@%/ ]+$/;

export const imageTransformSchema = z
  .string()
  .max(IMAGEKIT_TRANSFORM_MAX)
  .regex(IMAGEKIT_TRANSFORM_PATTERN, "Unsupported image transform");

/**
 * SOURCE OF TRUTH KEYWORDS: postImageSchema, PostImageValues
 *
 * WHAT:  An image attached to a post, referenced by ImageKit handle.
 * WHY:   `fileId` is kept alongside `url` because canceling a scheduled post
 *        must delete the asset, and ImageKit's delete API takes the id — a URL
 *        alone would strand the file. The url is validated as a real URL so a
 *        malformed value fails here rather than at fetch time inside the worker.
 */
export const postImageSchema = z.object({
  fileId: z.string().min(1),
  url: z.url(),
  /* The `tr:` string for this post's edits. Absent until the image editor
   * ships, at which point the publish path uses it instead of the default. */
  transform: imageTransformSchema.optional(),
});
export type PostImageValues = z.infer<typeof postImageSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: uploadAuthParamsSchema, UploadAuthParams
 *
 * WHAT:  The signed, short-lived credentials the browser presents to ImageKit
 *        to upload one file.
 * WHY:   The private key signs these on the server and never leaves it. The
 *        publicKey and urlEndpoint ride along so the client needs no ImageKit
 *        env vars of its own — nothing about the integration is duplicated into
 *        a NEXT_PUBLIC_* var that could drift from the server's.
 * WHERE: Returned by linkedinPosts.uploadAuth; consumed by the image-upload
 *        component.
 */
export const uploadAuthParamsSchema = z.object({
  token: z.string(),
  expire: z.number(),
  signature: z.string(),
  publicKey: z.string(),
  urlEndpoint: z.url(),
  folder: z.string(),
});
export type UploadAuthParams = z.infer<typeof uploadAuthParamsSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: imageKitUploadResponseSchema, ImageKitUploadResponse
 *
 * WHAT:  The subset of ImageKit's upload response this app relies on.
 * WHY:   Parsed rather than cast: the response crosses a vendor boundary, so
 *        validating it turns a silently-changed API into a clear local error
 *        instead of an undefined that surfaces three layers later.
 * WHERE: Used by the image-upload component after a direct browser upload.
 */
export const imageKitUploadResponseSchema = z.object({
  fileId: z.string().min(1),
  url: z.url(),
  name: z.string(),
  filePath: z.string(),
  size: z.number(),
});
export type ImageKitUploadResponse = z.infer<
  typeof imageKitUploadResponseSchema
>;
