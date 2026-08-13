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
 * SOURCE OF TRUTH KEYWORDS: IMAGE_ASPECT_PRESETS, ImageAspectPreset,
 *   IMAGE_FIT_MODES, ImageFitMode, IMAGE_FOCUS_MODES, ImageFocusMode,
 *   IMAGE_ROTATIONS, ImageRotation, IMAGE_SHARPEN_MAX, IMAGE_BLUR_MAX,
 *   imageEditSchema, ImageEditValues, DEFAULT_IMAGE_EDIT,
 *   buildImageTransform, parseImageTransform
 *
 * WHAT:  The image editor's vocabulary — every control it offers, the ImageKit
 *        token each maps to, and the two functions that convert between the
 *        structured edit state and the flat `tr:` string.
 * WHY:   ONLY these tokens exist. ImageKit has no brightness and no flip; its
 *        enhancement set is contrast-stretch, sharpen, unsharp-mask, grayscale,
 *        plus blur. Encoding the vocabulary here means an unsupported control
 *        cannot be added without editing this table, rather than being
 *        discovered as a silently-ignored URL segment.
 *
 *        Serializer AND parser, because the only thing persisted is the string
 *        (LinkedInPost.imageTransform). Without the parser, reopening the editor
 *        on a saved post would show every control reset while the image stayed
 *        edited — the controls would lie about the image.
 * WHERE: Backs the global image-editor component; the serializer also derives
 *        LINKEDIN_IMAGE_TRANSFORM in src/lib/config/imagekit.ts, so the default
 *        and the editor's default cannot drift apart.
 */

/* Dimensions, not ratios: ImageKit resizes by w/h, and stating the pixels here
 * keeps the delivered size a deliberate choice rather than a side effect. */
export const IMAGE_ASPECT_PRESETS = {
  linkedin: { label: "LinkedIn (1.91:1)", width: 1200, height: 627 },
  square: { label: "Square (1:1)", width: 1200, height: 1200 },
  portrait: { label: "Portrait (4:5)", width: 1080, height: 1350 },
} as const;
const IMAGE_ASPECT_KEYS = ["linkedin", "square", "portrait"] as const;
export type ImageAspectPreset = (typeof IMAGE_ASPECT_KEYS)[number];

/* `pad` letterboxes, `crop` fills and loses edges, `fit` shrinks to fit without
 * padding. Pad is the default everywhere because it is the only one of the
 * three that cannot remove part of the subject. */
export const IMAGE_FIT_MODES = {
  pad: { label: "Pad", token: "cm-pad_resize" },
  crop: { label: "Crop", token: "c-maintain_ratio" },
  fit: { label: "Fit", token: "c-at_max" },
} as const;
const IMAGE_FIT_KEYS = ["pad", "crop", "fit"] as const;
export type ImageFitMode = (typeof IMAGE_FIT_KEYS)[number];

/* Which part survives when `crop` discards edges. Center is ImageKit's own
 * default, so it is emitted as nothing rather than as `fo-center`. */
export const IMAGE_FOCUS_MODES = {
  center: { label: "Center", token: null },
  top: { label: "Top", token: "fo-top" },
  bottom: { label: "Bottom", token: "fo-bottom" },
  left: { label: "Left", token: "fo-left" },
  right: { label: "Right", token: "fo-right" },
  auto: { label: "Auto", token: "fo-auto" },
} as const;
const IMAGE_FOCUS_KEYS = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "auto",
] as const;
export type ImageFocusMode = (typeof IMAGE_FOCUS_KEYS)[number];

/* Quarter turns only. ImageKit accepts arbitrary angles, but anything off-axis
 * needs a background fill decision the editor does not ask for. */
export const IMAGE_ROTATIONS = [0, 90, 180, 270] as const;
export type ImageRotation = (typeof IMAGE_ROTATIONS)[number];

/* Vendor ranges. Sharpen is unbounded at the API but stops being useful long
 * before 10; blur is documented as 1-100. Zero means "off" for both, which is
 * why neither emits a token at 0. */
export const IMAGE_SHARPEN_MAX = 10;
export const IMAGE_BLUR_MAX = 100;

export const imageEditSchema = z.object({
  aspect: z.enum(IMAGE_ASPECT_KEYS),
  fit: z.enum(IMAGE_FIT_KEYS),
  focus: z.enum(IMAGE_FOCUS_KEYS),
  rotate: z.union([
    z.literal(0),
    z.literal(90),
    z.literal(180),
    z.literal(270),
  ]),
  /* Toggles, not sliders: `e-contrast` is a contrast STRETCH and `e-grayscale`
   * is absolute — neither takes a magnitude. */
  grayscale: z.boolean(),
  contrast: z.boolean(),
  sharpen: z.number().int().min(0).max(IMAGE_SHARPEN_MAX),
  blur: z.number().int().min(0).max(IMAGE_BLUR_MAX),
});
export type ImageEditValues = z.infer<typeof imageEditSchema>;

/* The state every un-edited image starts from. Serializes to exactly
 * "w-1200,h-627,cm-pad_resize" — which is what LINKEDIN_IMAGE_TRANSFORM is
 * derived from, so opening the editor on an untouched image shows controls that
 * already match the pixels being published. */
export const DEFAULT_IMAGE_EDIT: ImageEditValues = {
  aspect: "linkedin",
  fit: "pad",
  focus: "center",
  rotate: 0,
  grayscale: false,
  contrast: false,
  sharpen: 0,
  blur: 0,
};

/**
 * SOURCE OF TRUTH KEYWORDS: buildImageTransform
 *
 * WHAT:  Structured edit state -> an ImageKit `tr:` string.
 * WHY:   Emits tokens in a FIXED order and omits every default, so the same
 *        edits always produce the same string. That is what lets the default
 *        state round-trip to the exact literal the app shipped with, and what
 *        keeps the value inside imageTransformSchema's 500-char bound.
 * WHERE: Called by the image editor on every control change, and once at module
 *        load by src/lib/config/imagekit.ts to derive the default transform.
 */
export function buildImageTransform(edits: ImageEditValues): string {
  const { width, height } = IMAGE_ASPECT_PRESETS[edits.aspect];
  const tokens: string[] = [`w-${width}`, `h-${height}`];

  tokens.push(IMAGE_FIT_MODES[edits.fit].token);

  const focus = IMAGE_FOCUS_MODES[edits.focus].token;
  if (focus) tokens.push(focus);
  if (edits.rotate !== 0) tokens.push(`rt-${edits.rotate}`);
  if (edits.grayscale) tokens.push("e-grayscale");
  if (edits.contrast) tokens.push("e-contrast");
  if (edits.sharpen > 0) tokens.push(`e-sharpen-${edits.sharpen}`);
  if (edits.blur > 0) tokens.push(`bl-${edits.blur}`);

  return tokens.join(",");
}

/**
 * SOURCE OF TRUTH KEYWORDS: parseImageTransform
 *
 * WHAT:  An ImageKit `tr:` string -> structured edit state.
 * WHY:   The inverse of buildImageTransform, so reopening the editor restores
 *        the controls that produced the image. Deliberately TOLERANT: a token
 *        this editor cannot represent (a hand-written transform, or one written
 *        by a future version) is ignored rather than throwing, because a
 *        half-understood string must still open the dialog.
 * WHERE: Called by the image editor when it mounts on an already-edited image.
 */
export function parseImageTransform(transform: string): ImageEditValues {
  const tokens = transform.split(",").map((token) => token.trim());
  const edits: ImageEditValues = { ...DEFAULT_IMAGE_EDIT };

  /* Width alone identifies the preset: the three presets have distinct widths
   * EXCEPT linkedin/square, which are separated by height. */
  const width = Number(tokens.find((t) => t.startsWith("w-"))?.slice(2));
  const height = Number(tokens.find((t) => t.startsWith("h-"))?.slice(2));
  const aspect = IMAGE_ASPECT_KEYS.find(
    (key) =>
      IMAGE_ASPECT_PRESETS[key].width === width &&
      IMAGE_ASPECT_PRESETS[key].height === height,
  );
  if (aspect) edits.aspect = aspect;

  const fit = IMAGE_FIT_KEYS.find((key) =>
    tokens.includes(IMAGE_FIT_MODES[key].token),
  );
  if (fit) edits.fit = fit;

  const focus = IMAGE_FOCUS_KEYS.find((key) => {
    const token = IMAGE_FOCUS_MODES[key].token;
    return token !== null && tokens.includes(token);
  });
  if (focus) edits.focus = focus;

  const rotate = IMAGE_ROTATIONS.find((value) =>
    tokens.includes(`rt-${value}`),
  );
  if (rotate) edits.rotate = rotate;

  edits.grayscale = tokens.includes("e-grayscale");
  edits.contrast = tokens.includes("e-contrast");

  const sharpen = Number(
    tokens.find((t) => t.startsWith("e-sharpen-"))?.slice(10),
  );
  if (Number.isInteger(sharpen) && sharpen > 0)
    edits.sharpen = Math.min(sharpen, IMAGE_SHARPEN_MAX);

  const blur = Number(tokens.find((t) => t.startsWith("bl-"))?.slice(3));
  if (Number.isInteger(blur) && blur > 0)
    edits.blur = Math.min(blur, IMAGE_BLUR_MAX);

  return edits;
}

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
