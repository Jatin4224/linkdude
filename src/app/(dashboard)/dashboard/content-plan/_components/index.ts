/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ContentPlanChat, ContentPlanUrlStep,
 *   ContentPlanInsightsCard, ContentPlanResultView, ContentPlanRefineBar
 *
 * WHAT:  Barrel for the content-plan route's components.
 * WHY:   The page imports one name from one path; the internal split between the
 *        chat orchestrator and its presentational pieces stays a private detail.
 */

export { ContentPlanChat } from "./content-plan-chat";
export { ContentPlanUrlStep } from "./content-plan-url-step";
export { ContentPlanInsightsCard } from "./content-plan-insights";
export { ContentPlanResultView } from "./content-plan-result";
export { ContentPlanRefineBar } from "./content-plan-refine";
