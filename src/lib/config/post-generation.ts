/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: POST_TONE_LABELS, POST_LENGTH_LABELS,
 *   POST_GOAL_LABELS, tone label, length label, goal label, PostTone,
 *   PostLength, PostGoal, post generation config
 *
 * WHAT:  Human labels for the post tone and length vocabularies.
 * WHY:   Two screens pick a tone, the post composer and the carousel form, and
 *        each kept its own identical copy of these labels. One map here means a
 *        renamed tone changes on both screens at once. `Record<…>` over the zod
 *        tuples in lib/types, so adding a tone or length without a label is a
 *        compile error rather than a raw enum value on screen.
 * WHERE: generate-form.tsx (tone and length) and carousel-form.tsx (tone).
 */

import type { PostLength, PostTone } from "@/lib/types/ai";
import type { PostGoal } from "@/lib/types/post-hooks";

export const POST_TONE_LABELS: Record<PostTone, string> = {
  professional: "Professional",
  conversational: "Conversational",
  storytelling: "Storytelling",
  contrarian: "Contrarian",
  educational: "Educational",
};

export const POST_LENGTH_LABELS: Record<PostLength, string> = {
  short: "Short",
  medium: "Medium",
  long: "Long",
};

/* Phrased as the answer to "What do you want from this post?". */
export const POST_GOAL_LABELS: Record<PostGoal, string> = {
  any: "No preference",
  comments: "Comments",
  reposts: "Reposts",
  likes: "Likes",
  saves: "Saves",
};
