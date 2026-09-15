/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: POST_IDEA_STATUSES, PostIdeaStatus,
 *   postIdeaStatusSchema, POST_IDEA_TEXT_MIN, POST_IDEA_TEXT_MAX,
 *   createPostIdeaSchema, CreatePostIdeaValues, DEFAULT_POST_IDEA,
 *   listPostIdeasSchema, ListPostIdeasValues, postIdeaIdSchema,
 *   updatePostIdeaSchema, UpdatePostIdeaValues, idea inbox, post ideas
 *
 * WHAT:  Contracts for the idea inbox: saving an idea, listing, editing its text
 *        or status, and addressing one idea by id.
 * WHY:   An idea's text is capped at the composer's topic limit, so "Turn into
 *        post" can never hand the composer a topic its own schema rejects for
 *        being too long. The minimum is low on purpose: a two-word note is a real
 *        idea, and the composer asks for more only when it is time to generate.
 * WHERE: Router input for postIdeas.*; resolver for the quick-add box and the
 *        edit dialog; the composer's "Save as idea".
 */

import { z } from "zod";

import { AI_POST_TOPIC_MAX } from "./ai";

/**
 * SOURCE OF TRUTH KEYWORDS: POST_IDEA_STATUSES, PostIdeaStatus,
 *   postIdeaStatusSchema
 *
 * WHAT:  Whether an idea is still waiting or has been turned into a post.
 */
export const POST_IDEA_STATUSES = ["new", "used"] as const;
export const postIdeaStatusSchema = z.enum(POST_IDEA_STATUSES);
export type PostIdeaStatus = z.infer<typeof postIdeaStatusSchema>;

export const POST_IDEA_TEXT_MIN = 3;
export const POST_IDEA_TEXT_MAX = AI_POST_TOPIC_MAX;

const postIdeaTextSchema = z
  .string()
  .trim()
  .min(POST_IDEA_TEXT_MIN, `Write at least ${POST_IDEA_TEXT_MIN} characters`)
  .max(POST_IDEA_TEXT_MAX, `Keep it under ${POST_IDEA_TEXT_MAX} characters`);

/**
 * SOURCE OF TRUTH KEYWORDS: createPostIdeaSchema, CreatePostIdeaValues,
 *   DEFAULT_POST_IDEA
 *
 * WHAT:  A new idea, and the idea text when edited.
 */
export const createPostIdeaSchema = z.object({
  text: postIdeaTextSchema,
});
export type CreatePostIdeaValues = z.infer<typeof createPostIdeaSchema>;
export const DEFAULT_POST_IDEA: CreatePostIdeaValues = { text: "" };

/**
 * SOURCE OF TRUTH KEYWORDS: listPostIdeasSchema, ListPostIdeasValues
 *
 * WHAT:  Paging, status filter and text search for the idea inbox.
 * WHY:   page and pageSize are clamped by the factory's `paginate` option, the
 *        listLibraryPostsSchema convention. Search is capped because it becomes a
 *        `contains`.
 */
export const listPostIdeasSchema = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
  status: postIdeaStatusSchema.optional(),
  search: z.string().trim().max(200).optional(),
});
export type ListPostIdeasValues = z.infer<typeof listPostIdeasSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: postIdeaIdSchema
 *
 * WHAT:  One idea by id, for get and delete.
 */
export const postIdeaIdSchema = z.object({
  id: z.string().min(1),
});

/**
 * SOURCE OF TRUTH KEYWORDS: updatePostIdeaSchema, UpdatePostIdeaValues
 *
 * WHAT:  An edit to an idea: its text, or its status.
 * WHY:   One `update` verb with a discriminated union, the voiceProfile.update
 *        precedent, so there is one permission and one audit verb, and the audit
 *        line still says which part changed via {input.field}.
 */
export const updatePostIdeaSchema = z.discriminatedUnion("field", [
  z.object({
    field: z.literal("text"),
    id: z.string().min(1),
    text: postIdeaTextSchema,
  }),
  z.object({
    field: z.literal("status"),
    id: z.string().min(1),
    status: postIdeaStatusSchema,
  }),
]);
export type UpdatePostIdeaValues = z.infer<typeof updatePostIdeaSchema>;
