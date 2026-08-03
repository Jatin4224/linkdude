/*
 * Copyright (c) 2026 Web Prodigies LLC
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LINKEDIN_IMAGE_MIME_TYPES, LinkedInImageMimeType,
 *   LINKEDIN_MAX_IMAGE_BYTES, postImageSchema, PostImageValues,
 *   publishPostSchema, PublishPostValues, disconnectIntegrationSchema,
 *   listPostsSchema, deletePostSchema, LinkedInConnectionStatus
 *
 * WHAT:  Input contracts for publishing to LinkedIn and for managing the
 *        connection, plus the client-safe connection-status shape.
 * WHY:   Image payloads cross the wire as base64 because feature 1 streams
 *        media straight to LinkedIn at publish time with no storage provider in
 *        between — so the size ceiling has to be enforced here, before a
 *        multi-megabyte string reaches the server. LinkedInConnectionStatus is
 *        declared as its own type to guarantee tokens can never be widened into
 *        a client response by an accidental `select`.
 * WHERE: Consumed by src/services/linkedin.service.ts, the linkedinPosts and
 *        integrations routers, and the composer UI.
 */

import { z } from 'zod'
import { LINKEDIN_MAX_COMMENTARY } from '@/lib/config/linkedin'

/* LinkedIn's Images API accepts these for member posts. */
export const LINKEDIN_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/gif'] as const
export type LinkedInImageMimeType = (typeof LINKEDIN_IMAGE_MIME_TYPES)[number]

/* 5 MB of raw image. Base64 inflates ~33%, so the encoded string stays under
 * the ~8 MB body ceiling most edge runtimes impose. */
export const LINKEDIN_MAX_IMAGE_BYTES = 5 * 1024 * 1024

/**
 * SOURCE OF TRUTH KEYWORDS: postImageSchema, PostImageValues
 *
 * WHAT:  An image attached to a post, carried as base64.
 * WHY:   Validating the decoded byte length (not the string length) is the only
 *        honest size check — base64 overstates the real payload by a third, so
 *        a naive string cap would reject valid images.
 */
export const postImageSchema = z.object({
  mimeType: z.enum(LINKEDIN_IMAGE_MIME_TYPES),
  /* Bare base64 — the `data:` prefix is stripped client-side before submit. */
  data: z
    .string()
    .min(1, 'Image data is empty')
    .refine(
      (value) => Math.floor((value.length * 3) / 4) <= LINKEDIN_MAX_IMAGE_BYTES,
      'Image must be 5 MB or smaller'
    ),
})
export type PostImageValues = z.infer<typeof postImageSchema>

/**
 * SOURCE OF TRUTH KEYWORDS: publishPostSchema, PublishPostValues
 *
 * WHAT:  Input contract for publishing a post to LinkedIn.
 * WHY:   Capping commentary at LinkedIn's own 3000-character ceiling turns what
 *        would be a remote FIELD_LENGTH_TOO_LONG into a local field error the
 *        composer can render inline.
 * WHERE: Router input for linkedinPosts.create; resolver for the composer form.
 */
export const publishPostSchema = z.object({
  commentary: z
    .string()
    .trim()
    .min(1, 'Write something before publishing')
    .max(LINKEDIN_MAX_COMMENTARY, `Posts are limited to ${LINKEDIN_MAX_COMMENTARY} characters`),
  image: postImageSchema.optional(),
})
export type PublishPostValues = z.infer<typeof publishPostSchema>

/**
 * SOURCE OF TRUTH KEYWORDS: listPostsSchema
 *
 * WHAT:  Paging input for the recent-posts strip.
 */
export const listPostsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(10),
})

/**
 * SOURCE OF TRUTH KEYWORDS: deletePostSchema
 *
 * WHAT:  Identifies a locally-recorded post to forget.
 * WHY:   Removes OUR record only — it does not delete the post from LinkedIn.
 */
export const deletePostSchema = z.object({
  postId: z.string().min(1),
})

/**
 * SOURCE OF TRUTH KEYWORDS: disconnectIntegrationSchema
 *
 * WHAT:  Identifies which third-party connection to drop.
 * WHY:   Carries `provider` so the audit template
 *        ("Disconnected the {input.provider} account") interpolates, and so the
 *        same endpoint serves the next provider without a schema change.
 */
export const disconnectIntegrationSchema = z.object({
  provider: z.literal('linkedin'),
})

/**
 * SOURCE OF TRUTH KEYWORDS: LinkedInConnectionStatus
 *
 * WHAT:  The client-safe view of an org's LinkedIn connection.
 * WHY:   Explicitly enumerates the only fields allowed to reach a browser.
 *        Access and refresh tokens live on the same Prisma row, so returning
 *        the model directly would leak posting credentials; this type is what
 *        LINKEDIN_ACCOUNT_SAFE_SELECT is checked against.
 *        `needsReconnect` is surfaced because LinkedIn only issues refresh
 *        tokens to approved apps — without one, a connection simply expires
 *        after ~60 days and the user must reauthorize.
 * WHERE: Returned by integrations.read; consumed by the connect button.
 */
export interface LinkedInConnectionStatus {
  connected: boolean
  configured: boolean
  name: string | null
  avatarUrl: string | null
  expiresAt: Date | null
  needsReconnect: boolean
}
