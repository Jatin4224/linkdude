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
 *   LinkedInConnectionStatus, LINKEDIN_IMAGE_MIME_TYPES, LINKEDIN_MAX_IMAGE_BYTES,
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
} from "./ai";
export type {
  PostTone,
  PostLength,
  GeneratePostValues,
  GeneratedPost,
} from "./ai";
export {
  LINKEDIN_IMAGE_MIME_TYPES,
  LINKEDIN_MAX_IMAGE_BYTES,
  LINKEDIN_MAX_IMAGE_LABEL,
  LINKEDIN_OAUTH_ERROR_CODES,
  normalizeLinkedInOAuthError,
  postImageSchema,
  publishPostSchema,
  listPostsSchema,
  deletePostSchema,
  disconnectIntegrationSchema,
} from "./linkedin";
export type {
  LinkedInImageMimeType,
  LinkedInOAuthErrorCode,
  PostImageValues,
  PublishPostValues,
  LinkedInConnectionStatus,
} from "./linkedin";
export {
  analyzeProfileSchema,
  profileAnalysisSchema,
  sectionFeedbackSchema,
  profileImprovementSchema,
  fetchProfileSchema,
  brightDataProfileSchema,
  apifyProfileSchema,
  scrapedErrorItemSchema,
  profileSourceSchema,
  PROFILE_SOURCE_KEYS,
  LINKEDIN_PROFILE_URL_PATTERN,
  PROFILE_HEADLINE_MAX,
  PROFILE_ABOUT_MAX,
  PROFILE_EXPERIENCE_MAX,
} from "./profile-analysis";
export type {
  AnalyzeProfileValues,
  ProfileAnalysis,
  SectionFeedback,
  ProfileImprovement,
  FetchProfileValues,
  FetchedProfile,
  BrightDataProfile,
  ApifyProfile,
  ProfileSource,
} from "./profile-analysis";
