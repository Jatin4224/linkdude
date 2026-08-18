/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: AUTH_PASSWORD_MIN_LENGTH, signInSchema,
 *   signUpSchema, SignInValues, SignUpValues, AuthFormMode, AuthValuesByMode,
 *   authSchemaFor, createOrganizationSchema, CreateOrganizationValues,
 *   inviteMemberSchema, updateMemberSchema, removeMemberSchema,
 *   cancelInvitationSchema, resendInvitationSchema, createRoleSchema,
 *   updateRoleSchema, deleteRoleSchema, roleNameSchema, permissionStringSchema,
 *   createSubscriptionSchema, upgradeSubscriptionSchema, billingIntervalSchema,
 *   planKeySchema, CreateSubscriptionValues, UpgradeSubscriptionValues,
 *   POST_TONES, POST_LENGTHS, postToneSchema, postLengthSchema,
 *   generatePostSchema, GeneratePostValues, generatedPostSchema, GeneratedPost,
 *   publishPostSchema, PublishPostValues, postImageSchema, PostImageValues,
 *   listPostsSchema, deletePostSchema, disconnectIntegrationSchema,
 *   listCalendarPostsSchema, ListCalendarPostsValues, scheduledForSchema,
 *   LINKEDIN_POST_STATUSES, LinkedInPostStatus, CANCELABLE_POST_STATUSES,
 *   saveDraftSchema, SaveDraftValues, discardDraftSchema, getPostSchema,
 *   postStatusSchema, listLibraryPostsSchema, ListLibraryPostsValues,
 *   LinkedInImageBinary, uploadAuthParamsSchema, UploadAuthParams,
 *   imageKitUploadResponseSchema, ImageKitUploadResponse, imageTransformSchema,
 *   LinkedInConnectionStatus, LINKEDIN_IMAGE_MIME_TYPES,
 *   analyzeProfileSchema, AnalyzeProfileValues, profileAnalysisSchema,
 *   ProfileAnalysis, SectionFeedback, ProfileImprovement
 *
 * WHAT:  Barrel re-export for `src/lib/types/*` — the single import surface
 *        for custom (non-Prisma) types and their backing zod schemas.
 * WHY:   Per CLAUDE.md, custom types live under `lib/types` exclusively.
 *        Routing every consumer through `@/lib/types` keeps that constraint
 *        easy to enforce: imports from anywhere else are a code-smell flag.
 * WHERE: Imported by client + server code that needs auth (or future)
 *        input contracts.
 */

export {
  AUTH_PASSWORD_MIN_LENGTH,
  signInSchema,
  signUpSchema,
  authSchemaFor,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./auth";
export type {
  SignInValues,
  SignUpValues,
  AuthFormMode,
  AuthValuesByMode,
  ForgotPasswordValues,
  ResetPasswordValues,
} from "./auth";
export {
  createOrganizationSchema,
  updateOrganizationSettingsSchema,
} from "./organization";
export type {
  CreateOrganizationValues,
  UpdateOrganizationSettingsValues,
} from "./organization";
export {
  inviteMemberSchema,
  updateMemberSchema,
  removeMemberSchema,
  cancelInvitationSchema,
  resendInvitationSchema,
  createRoleSchema,
  updateRoleSchema,
  deleteRoleSchema,
  roleNameSchema,
  permissionStringSchema,
  RESERVED_ROLE_NAMES,
  VALID_PERMISSION_STRINGS,
} from "./team";
export type {
  InviteMemberValues,
  UpdateMemberValues,
  CreateRoleValues,
  UpdateRoleValues,
} from "./team";
export {
  billingIntervalSchema,
  planKeySchema,
  createSubscriptionSchema,
  upgradeSubscriptionSchema,
  paymentMethodIdSchema,
} from "./billing";
export type {
  CreateSubscriptionValues,
  UpgradeSubscriptionValues,
} from "./billing";
export {
  POST_TONES,
  POST_LENGTHS,
  postToneSchema,
  postLengthSchema,
  generatePostSchema,
  generatedPostSchema,
  aiImageEditSchema,
  AI_IMAGE_PROMPT_MAX,
} from "./ai";
export type {
  PostTone,
  PostLength,
  GeneratePostValues,
  GeneratedPost,
  AiImageEditValues,
} from "./ai";
export {
  LINKEDIN_IMAGE_MIME_TYPES,
  LINKEDIN_OAUTH_ERROR_CODES,
  LINKEDIN_POST_STATUSES,
  CANCELABLE_POST_STATUSES,
  normalizeLinkedInOAuthError,
  scheduledForSchema,
  publishPostSchema,
  listPostsSchema,
  listCalendarPostsSchema,
  deletePostSchema,
  disconnectIntegrationSchema,
  saveDraftSchema,
  discardDraftSchema,
  getPostSchema,
  postStatusSchema,
  listLibraryPostsSchema,
} from "./linkedin";
export type {
  LinkedInImageMimeType,
  LinkedInImageBinary,
  PostDocumentValues,
  LinkedInOAuthErrorCode,
  LinkedInPostStatus,
  ListCalendarPostsValues,
  PublishPostValues,
  LinkedInConnectionStatus,
  SaveDraftValues,
  ListLibraryPostsValues,
} from "./linkedin";

/* ImageKit — post media lives behind a storage provider so a scheduled post
 * still has its image when the worker fires days later. */
export {
  postImageSchema,
  originalImageSchema,
  imageTransformSchema,
  uploadAuthParamsSchema,
  imageKitUploadResponseSchema,
  IMAGEKIT_TRANSFORM_MAX,
  IMAGE_ASPECT_PRESETS,
  IMAGE_FIT_MODES,
  IMAGE_FOCUS_MODES,
  IMAGE_ROTATIONS,
  IMAGE_SHARPEN_MAX,
  IMAGE_BLUR_MAX,
  imageEditSchema,
  DEFAULT_IMAGE_EDIT,
  buildImageTransform,
  parseImageTransform,
} from "./imagekit";
export type {
  PostImageValues,
  OriginalImageValues,
  UploadAuthParams,
  ImageKitUploadResponse,
  ImageAspectPreset,
  ImageFitMode,
  ImageFocusMode,
  ImageRotation,
  ImageEditValues,
} from "./imagekit";
export {
  analyzeProfileSchema,
  profileAnalysisSchema,
  sectionFeedbackSchema,
  headlineFeedbackSchema,
  profileImprovementSchema,
  profileIssueAreaSchema,
  profileIssueSeveritySchema,
  sectionInsightSchema,
  listAnalysesSchema,
  discardAnalysisSchema,
  PROFILE_ISSUE_SEVERITIES,
} from "./profile-analysis";
export type {
  AnalyzeProfileValues,
  ProfileAnalysis,
  SectionFeedback,
  HeadlineFeedback,
  ProfileImprovement,
  ProfileIssueArea,
  ProfileIssueSeverity,
  SectionInsight,
  ListAnalysesValues,
  DiscardAnalysisValues,
  StoredProfileAnalysis,
} from "./profile-analysis";

/* Profile lookup — a shared capability, exported from its own module rather
 * than through the analyzer that happened to need it first. */
export {
  fetchProfileSchema,
  fetchedProfileSchema,
  brightDataProfileSchema,
  apifyProfileSchema,
  scrapedErrorItemSchema,
  profileSourceSchema,
  PROFILE_SOURCE_KEYS,
  LINKEDIN_PROFILE_URL_PATTERN,
  PROFILE_HEADLINE_MAX,
  PROFILE_ABOUT_MAX,
  PROFILE_EXPERIENCE_MAX,
  PROFILE_ITEM_LABEL_MAX,
  PROFILE_ITEM_META_MAX,
  PROFILE_ITEM_DETAIL_MAX,
  PROFILE_SECTION_KEYS,
  PROFILE_SECTION_MAX_ITEMS,
  profileSectionKeySchema,
  profileSectionItemSchema,
  profileSectionsSchema,
} from "./profile-lookup";
export type {
  FetchProfileValues,
  FetchedProfile,
  CachedProfileLookup,
  BrightDataProfile,
  ApifyProfile,
  ProfileSource,
  ProfileSectionKey,
  ProfileSectionItem,
  ProfileSections,
} from "./profile-lookup";

/* Personalized Content Plan — the guided chat that turns a profile plus four
 * answers into a posting strategy. */
export {
  CONTENT_PLAN_STEP_KEYS,
  CONTENT_PLAN_SECTION_KEYS,
  CONTENT_PLAN_STATUSES,
  CONTENT_PLAN_ANSWER_MAX,
  CONTENT_PLAN_GOALS_MAX,
  contentPlanStepKeySchema,
  contentPlanSectionKeySchema,
  contentPlanStatusSchema,
  contentPlanAnswersSchema,
  contentPlanDraftAnswersSchema,
  contentPlanInsightsSchema,
  contentPlanPillarSchema,
  contentPlanCalendarWeekSchema,
  contentPlanResultSchema,
  startContentPlanSchema,
  saveContentPlanProgressSchema,
  generateContentPlanSchema,
} from "./content-plan";
export type {
  ContentPlanStepKey,
  ContentPlanSectionKey,
  ContentPlanStatus,
  ContentPlanAnswers,
  ContentPlanDraftAnswers,
  ContentPlanInsights,
  ContentPlanPillar,
  ContentPlanCalendarWeek,
  ContentPlanResult,
  StartContentPlanValues,
  SaveContentPlanProgressValues,
  GenerateContentPlanValues,
  StoredContentPlan,
} from "./content-plan";
/* Carousels — slide vocabulary, deck bounds and page geometry. The deck itself
 * lives in Carousel.slides as Json, so carouselSlidesSchema is the boundary that
 * keeps an untyped value out of the router on every read. */
export {
  CAROUSEL_STATUSES,
  carouselStatusSchema,
  CAROUSEL_SLIDE_KINDS,
  carouselSlideKindSchema,
  CAROUSEL_TEMPLATES,
  carouselTemplateSchema,
  CAROUSEL_PAGE_PRESETS,
  carouselPagePresetSchema,
  CAROUSEL_MIN_SLIDES,
  CAROUSEL_MAX_SLIDES,
  CAROUSEL_DEFAULT_SLIDES,
  CAROUSEL_HEADING_MAX,
  CAROUSEL_BODY_MAX,
  CAROUSEL_TOPIC_MIN,
  CAROUSEL_TOPIC_MAX,
  carouselSlideSchema,
  carouselSlidesSchema,
  generateCarouselSchema,
  updateCarouselSchema,
  renderCarouselSchema,
  getCarouselSchema,
  discardCarouselSchema,
  listCarouselsSchema,
  listDocumentsSchema,
  deleteDocumentSchema,
} from "./carousel";
export type {
  CarouselStatus,
  CarouselSlideKind,
  CarouselTemplate,
  CarouselPagePreset,
  CarouselSlide,
  CarouselSlides,
  GenerateCarouselValues,
  GenerateCarouselInput,
  UpdateCarouselValues,
  RenderCarouselValues,
  GetCarouselValues,
  DiscardCarouselValues,
  ListCarouselsValues,
  ListDocumentsValues,
  DeleteDocumentValues,
} from "./carousel";
export { ANALYTICS_RANGE_DAYS, analyticsRangeSchema } from "./portal-analytics";
export type {
  AnalyticsRangeDays,
  AnalyticsRangeValues,
  MetricDelta,
  PlatformMetrics,
  GrowthPoint,
  EngagementPoint,
  RetentionPoint,
  RetentionMetrics,
  PlanBreakdownRow,
  RevenueMetrics,
} from "./portal-analytics";
