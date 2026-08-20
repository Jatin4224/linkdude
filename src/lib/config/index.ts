/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: prisma, DbClient, APP_NAME, APP_URL, APP_DOMAIN,
 *   APP_DESCRIPTION, APP_METADATA_BASE, BRANDING, AUTH_ROUTES,
 *   REGISTRATION_OPEN, EMAIL_AUTH_ENABLED, GOOGLE_AUTH_ENABLED,
 *   PLANS, PlanKey, PlanDefinition, resend,
 *   getResendClient, RESEND_DEFAULT_FROM, isResendConfigured, ROUTES,
 *   AppRouteKey, PLAN_ORDER, BillingInterval, getPlanPriceId, getPlanByPriceId,
 *   getNextPlan, isPaidPlan, getStripeClient, isStripeConfigured,
 *   getStripeWebhookSecret, STRIPE_API_VERSION, portalConfig, isPortalEnabled,
 *   isPortalOwnerEmail, PORTAL_PATH, AI_PROVIDERS, AI_PROVIDER, getAiProvider,
 *   getAiModel, isAiConfigured, AI_MODEL,
 *   AI_MAX_TOKENS, isLinkedInConfigured, getLinkedInCredentials,
 *   LINKEDIN_SCOPES, LINKEDIN_API_VERSION, LINKEDIN_ENDPOINTS,
 *   LINKEDIN_MAX_COMMENTARY, getLinkedInRedirectUri, isImageKitConfigured,
 *   getImageKitCredentials, IMAGEKIT_MAX_IMAGE_BYTES, IMAGEKIT_POST_FOLDER,
 *   IMAGEKIT_UPLOAD_ENDPOINT, LINKEDIN_IMAGE_TRANSFORM, isSchedulerConfigured,
 *   getSchedulerSecret, MAX_PUBLISH_ATTEMPTS, PUBLISH_BATCH_SIZE,
 *   PUBLISHING_STALE_MS, MIN_SCHEDULE_LEAD_MS, SCHEDULER_RUN_PATH,
 *   CONTENT_PLAN_STEPS, CONTENT_PLAN_STEP_ENTRIES, CONTENT_PLAN_QUESTION_KEYS,
 *   contentPlanAnswerText, isContentPlanAnswered,
 *   firstUnansweredContentPlanStep, nextContentPlanStep,
 *   ContentPlanStepDefinition, CONTENT_PLAN_SECTIONS,
 *   CONTENT_PLAN_SECTION_ENTRIES, serializeContentPlanAnswers,
 *   serializeContentPlanSection, contentPlanSectionCopyText,
 *   ContentPlanSectionDefinition, PLAN_PRICE_CURRENCY, PLAN_PRICE_LOCALE,
 *   HIGHLIGHTED_PLAN, getPlanPriceAmount, formatPlanPrice,
 *   getPlanMonthlyEquivalent, formatPlanMonthlyEquivalent,
 *   getPlanYearlySavingPercent, MARKETING_SECTION_IDS, MARKETING_NAV,
 *   MARKETING_HERO, MARKETING_HERO_POST, MARKETING_DEMO, MARKETING_LOOP_STEPS,
 *   MARKETING_SURFACES, MARKETING_SURFACE_ROWS, MARKETING_SECTION_HEADINGS,
 *   MARKETING_PLAN_PITCHES, MARKETING_FAQ, MARKETING_CLOSING,
 *   MARKETING_MATRIX_GROUPS, GET_STARTED_HREF, GET_STARTED_LABEL
 *
 * WHAT:  Barrel re-export for the `src/lib/config/*` modules.
 * WHY:   Single import surface (`@/lib/config`) so consumers don't depend on
 *        the per-concern split, and so the prisma singleton, branding,
 *        auth-routes, plans, and registration flag can be regrouped without
 *        ripple edits.
 * WHERE: Imported broadly across the app and by src/lib/better-auth/auth.ts.
 */

export { prisma } from "./prisma";
export type { DbClient } from "./prisma";
export {
  APP_NAME,
  APP_URL,
  APP_DOMAIN,
  APP_DESCRIPTION,
  APP_METADATA_BASE,
  BRANDING,
} from "./branding";
export { AUTH_ROUTES } from "./auth-routes";
export type { AuthRouteKey } from "./auth-routes";
export { ROUTES } from "./routes";
export type { AppRouteKey } from "./routes";
export { REGISTRATION_OPEN } from "./registration";
export { EMAIL_AUTH_ENABLED, GOOGLE_AUTH_ENABLED } from "./auth-methods";
export {
  PLAN_KEYS,
  PLANS,
  PLAN_ORDER,
  PLAN_PRICE_CURRENCY,
  PLAN_PRICE_LOCALE,
  HIGHLIGHTED_PLAN,
  isPaidPlan,
  getPlanPriceId,
  getPlanByPriceId,
  getNextPlan,
  getPlanPriceAmount,
  formatPlanPrice,
  getPlanMonthlyEquivalent,
  formatPlanMonthlyEquivalent,
  getPlanYearlySavingPercent,
} from "./plans";
export type { PlanKey, PlanDefinition, BillingInterval } from "./plans";
export {
  MARKETING_SECTION_IDS,
  MARKETING_NAV,
  MARKETING_HERO,
  MARKETING_HERO_POST,
  MARKETING_DEMO,
  MARKETING_LOOP_STEPS,
  MARKETING_SURFACES,
  MARKETING_SURFACE_ROWS,
  MARKETING_SECTION_HEADINGS,
  MARKETING_PLAN_PITCHES,
  MARKETING_FAQ,
  MARKETING_CLOSING,
  MARKETING_FOOTER_GROUPS,
  MARKETING_MATRIX_GROUPS,
  MARKETING_PLAN_BULLET_RESOURCES,
  MARKETING_FREE_TIER_RESOURCES,
  GET_STARTED_HREF,
  GET_STARTED_LABEL,
} from "./marketing";
export type {
  MarketingSectionId,
  MarketingNavItem,
  MarketingHeading,
  MarketingLoopStep,
  MarketingSurface,
  MarketingSurfaceRow,
  MarketingSectionHeading,
  MarketingFaqItem,
  MarketingFooterGroup,
  MarketingMatrixGroup,
} from "./marketing";
export {
  getResendClient,
  RESEND_DEFAULT_FROM,
  isResendConfigured,
  isDevEmailFallbackActive,
} from "./resend";
export {
  getStripeClient,
  isStripeConfigured,
  getStripeWebhookSecret,
  STRIPE_API_VERSION,
} from "./stripe";
export {
  portalConfig,
  isPortalEnabled,
  isPortalOwnerEmail,
  PORTAL_PATH,
} from "./portal";
export {
  AI_PROVIDERS,
  AI_PROVIDER,
  getAiProvider,
  getAiModel,
  isAiConfigured,
  getAiImageModel,
  isAiImageConfigured,
  AI_MODEL,
  AI_MAX_TOKENS,
  AI_MAX_RETRIES,
  AI_TIMEOUT_MS,
} from "./ai";
export {
  isLinkedInConfigured,
  getLinkedInCredentials,
  getLinkedInRedirectUri,
  LINKEDIN_SCOPES,
  LINKEDIN_API_VERSION,
  LINKEDIN_ENDPOINTS,
  LINKEDIN_REDIRECT_PATH,
  LINKEDIN_MAX_COMMENTARY,
  LINKEDIN_OAUTH_STATE_COOKIE,
} from "./linkedin";
export type { LinkedInCredentials } from "./linkedin";
export {
  isImageKitConfigured,
  getImageKitCredentials,
  IMAGEKIT_MAX_IMAGE_BYTES,
  IMAGEKIT_MAX_IMAGE_LABEL,
  IMAGEKIT_POST_FOLDER,
  IMAGEKIT_UPLOAD_ENDPOINT,
  IMAGEKIT_AUTH_EXPIRY_SECONDS,
  LINKEDIN_IMAGE_TRANSFORM,
  buildTransformedUrl,
} from "./imagekit";
export type { ImageKitCredentials } from "./imagekit";
export {
  isSchedulerConfigured,
  getSchedulerSecret,
  MAX_PUBLISH_ATTEMPTS,
  PUBLISH_BATCH_SIZE,
  PUBLISHING_STALE_MS,
  MIN_SCHEDULE_LEAD_MS,
  SCHEDULER_RUN_PATH,
} from "./scheduler";
export {
  CONTENT_PLAN_STEPS,
  CONTENT_PLAN_STEP_ENTRIES,
  CONTENT_PLAN_QUESTION_KEYS,
  contentPlanAnswerText,
  isContentPlanAnswered,
  firstUnansweredContentPlanStep,
  nextContentPlanStep,
} from "./content-plan-steps";
export type { ContentPlanStepDefinition } from "./content-plan-steps";
export {
  CONTENT_PLAN_SECTIONS,
  CONTENT_PLAN_SECTION_ENTRIES,
  serializeContentPlanAnswers,
  serializeContentPlanSection,
  contentPlanSectionCopyText,
} from "./content-plan-sections";
export type { ContentPlanSectionDefinition } from "./content-plan-sections";
