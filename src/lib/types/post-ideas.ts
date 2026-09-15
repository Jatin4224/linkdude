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
 *   updatePostIdeaSchema, UpdatePostIdeaValues, PostIdeaOption,
 *   ideaAnglesSchema, IdeaAngle, expandPostIdeaSchema, idea inbox, post ideas
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

import { AI_POST_TOPIC_MAX, AI_POST_TOPIC_MIN } from "./ai";
import { POST_OPENING_MAX, hookFormulaKeySchema } from "./post-hooks";

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

/**
 * SOURCE OF TRUTH KEYWORDS: postIdeaOptionSchema, PostIdeaOption
 *
 * WHAT:  The part of an idea a picker needs: its id and text.
 * WHERE: The composer's "Use an idea" menu.
 */
export const postIdeaOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
});
export type PostIdeaOption = z.infer<typeof postIdeaOptionSchema>;

/**
 * SOURCE OF TRUTH KEYWORDS: IDEA_ANGLES_COUNT, IDEA_ANGLE_TITLE_MAX,
 *   IDEA_ANGLE_NEEDS_MAX, ideaAngleSchema, IdeaAngle, ideaAnglesSchema,
 *   IdeaAngles, expandPostIdeaSchema, expand idea, idea angles
 *
 * WHAT:  What "Expand" returns for one idea: a few specific angles, each with a
 *        topic brief, a sample first line, the hook formula it uses, and the one
 *        real detail the member still needs to add.
 * WHY:   A vague idea is why most ideas sit unused. `topic` is bounded by the
 *        composer's topic limits so an angle can replace the idea text and go
 *        straight into a generation. `needs` exists because the model may never
 *        supply that detail itself; it asks for it instead.
 * WHERE: Returned by ideaAngles.create; rendered by the angles dialog.
 */
export const IDEA_ANGLES_COUNT = 3;
export const IDEA_ANGLE_TITLE_MAX = 80;
export const IDEA_ANGLE_NEEDS_MAX = 200;

export const ideaAngleSchema = z.object({
  title: z.string().trim().min(1).max(IDEA_ANGLE_TITLE_MAX),
  topic: z.string().trim().min(AI_POST_TOPIC_MIN).max(AI_POST_TOPIC_MAX),
  formula: hookFormulaKeySchema,
  openingLine: z.string().trim().min(1).max(POST_OPENING_MAX),
  needs: z.string().trim().max(IDEA_ANGLE_NEEDS_MAX),
});
export type IdeaAngle = z.infer<typeof ideaAngleSchema>;

export const ideaAnglesSchema = z.object({
  angles: z.array(ideaAngleSchema).min(1).max(IDEA_ANGLES_COUNT),
});
export type IdeaAngles = z.infer<typeof ideaAnglesSchema>;

/* The idea is addressed by id and read on the server, never sent as text, so
 * an expansion can only ever be of the member's own saved idea. */
export const expandPostIdeaSchema = postIdeaIdSchema;
