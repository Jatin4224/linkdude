/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ERROR_CODES, ErrorCode, StructuredError,
 *   StructuredErrorCause, SANITIZED_ERROR_CODES, SanitizedErrorCode,
 *   SanitizedErrorCause, isStructuredErrorCause
 *
 * WHAT:  Discriminated union of every structured error the server may attach
 *        to a tRPC error's `cause`, keyed by ERROR_CODES.
 * WHY:   Clients narrow on `errorCode` to render specific UI (upgrade modal,
 *        invitation accept screen, 2FA prompt) instead of generic error text.
 * WHERE: Codes thrown via createStructuredError in src/trpc/init.ts; consumed
 *        by the tRPC client error handler and UI gate components. Re-exported
 *        through the src/lib/errors barrel.
 */

import type { ResourceKey } from "@/lib/resources";

/**
 * SOURCE OF TRUTH KEYWORDS: SANITIZED_ERROR_CODES, SanitizedErrorCode
 *
 * WHAT:  The codes produced by classifyError when an UNEXPECTED failure (a model
 *        provider, an upstream HTTP call, a crash) has to be shown to a user.
 * WHY:   Kept as its own registry, not loose strings, because these are the only
 *        codes whose user-visible copy is written by US rather than by a vendor.
 *        Everything classified into one of these has already had its raw message
 *        thrown away, which is what stops provider names, model IDs, plan tiers
 *        and quota numbers reaching the browser.
 * WHERE: Produced by classifyError (src/lib/errors/classify.ts), consumed by the
 *        toast helper (src/lib/errors/client.ts) and the AI routers.
 */
export const SANITIZED_ERROR_CODES = {
  AI_QUOTA_EXHAUSTED: "AI_QUOTA_EXHAUSTED",
  AI_PROVIDER_UNAVAILABLE: "AI_PROVIDER_UNAVAILABLE",
  AI_CONTENT_REJECTED: "AI_CONTENT_REJECTED",
  AI_OUTPUT_UNUSABLE: "AI_OUTPUT_UNUSABLE",
  UPSTREAM_UNAVAILABLE: "UPSTREAM_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type SanitizedErrorCode =
  (typeof SANITIZED_ERROR_CODES)[keyof typeof SANITIZED_ERROR_CODES];

/**
 * SOURCE OF TRUTH KEYWORDS: ERROR_CODES, ErrorCode
 *
 * WHAT:  String enum of every structured error code the server emits.
 * WHY:   Frozen at the type level so adding a new variant forces an exhaustive
 *        check on every switch consuming StructuredErrorCause.
 * WHERE: Used everywhere a StructuredError is created or matched.
 */
export const ERROR_CODES = {
  ONBOARDING_INCOMPLETE: "ONBOARDING_INCOMPLETE",
  NOT_ORGANIZATION_MEMBER: "NOT_ORGANIZATION_MEMBER",
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  FEATURE_NOT_AVAILABLE: "FEATURE_NOT_AVAILABLE",
  USAGE_LIMIT_REACHED: "USAGE_LIMIT_REACHED",
  INSUFFICIENT_CREDITS: "INSUFFICIENT_CREDITS",
  RATE_LIMITED: "RATE_LIMITED",
  PENDING_INVITATION: "PENDING_INVITATION",
  INVITATION_NOT_FOUND: "INVITATION_NOT_FOUND",
  INVITATION_ALREADY_USED: "INVITATION_ALREADY_USED",
  INVITATION_EXPIRED: "INVITATION_EXPIRED",
  ...SANITIZED_ERROR_CODES,
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * SOURCE OF TRUTH KEYWORDS: SanitizedErrorCause
 *
 * WHAT:  The cause payload attached to every sanitized (vendor-scrubbed) error.
 * WHY:   One shape for all six codes because the client does the same three
 *        things with each: pick copy off `errorCode`, decide whether to offer a
 *        retry off `retryable`, and print `traceId` so a user can quote it in
 *        support. `traceId` is the ONLY link back to the raw provider error,
 *        which now lives exclusively in the server log.
 * WHERE: Built by classifyError; read by getErrorMessage in ./client.ts.
 */
export interface SanitizedErrorCause {
  errorCode: SanitizedErrorCode;
  message: string;
  traceId: string;
  retryable: boolean;
}

/**
 * SOURCE OF TRUTH KEYWORDS: StructuredErrorCause, StructuredError
 *
 * WHAT:  Discriminated union of every structured error payload.
 * WHY:   `errorCode` narrows the union in switch statements, giving callers
 *        type-safe access to error-specific fields (resource, retryAfter, etc.).
 * WHERE: Set as `cause` on TRPCError via createStructuredError; surfaced to
 *        clients through the tRPC errorFormatter.
 */
/* Discriminated union — `errorCode` narrows in switch statements. */
export type StructuredErrorCause =
  | {
      errorCode: typeof ERROR_CODES.ONBOARDING_INCOMPLETE;
      requiredStep: "onboarding";
      message: string;
    }
  | {
      errorCode: typeof ERROR_CODES.NOT_ORGANIZATION_MEMBER;
      organizationId: string;
      message: string;
    }
  | {
      errorCode: typeof ERROR_CODES.INSUFFICIENT_PERMISSIONS;
      required: string[];
      current: string;
      message: string;
    }
  | {
      errorCode: typeof ERROR_CODES.VALIDATION_ERROR;
      message: string;
    }
  | {
      errorCode: typeof ERROR_CODES.FEATURE_NOT_AVAILABLE;
      resource: ResourceKey;
      currentPlan: string;
      upgradeRequired: true;
      message: string;
    }
  | {
      errorCode: typeof ERROR_CODES.USAGE_LIMIT_REACHED;
      resource: string;
      limit: number;
      current: number;
      upgradeRequired: true;
      message: string;
    }
  | {
      errorCode: typeof ERROR_CODES.INSUFFICIENT_CREDITS;
      resource: ResourceKey;
      required: number;
      available: number;
      message: string;
    }
  | {
      errorCode: typeof ERROR_CODES.RATE_LIMITED;
      limit: number;
      remaining: number;
      resetAt: number;
      retryAfter: number;
      message: string;
    }
  | {
      errorCode: typeof ERROR_CODES.PENDING_INVITATION;
      invitationId: string;
      organizationId: string;
      organizationName: string;
      role: string;
      message: string;
    }
  | {
      errorCode: typeof ERROR_CODES.INVITATION_NOT_FOUND;
      message: string;
    }
  | {
      errorCode: typeof ERROR_CODES.INVITATION_ALREADY_USED;
      status: string;
      message: string;
    }
  | {
      errorCode: typeof ERROR_CODES.INVITATION_EXPIRED;
      message: string;
    }
  | SanitizedErrorCause;

export type StructuredError = StructuredErrorCause;

/**
 * SOURCE OF TRUTH KEYWORDS: isStructuredErrorCause
 *
 * WHAT:  Runtime guard that says whether an unknown `cause` is one of OUR
 *        structured payloads.
 * WHY:   The redaction net in the errorFormatter needs exactly this question:
 *        an error carrying a structured cause was shaped deliberately by a
 *        procedure and its message is safe to show; anything else is an
 *        unplanned throw whose message may carry vendor or infrastructure
 *        detail and must be replaced.
 * WHERE: src/trpc/procedures/protected.ts (errorFormatter) and ./client.ts.
 */
export function isStructuredErrorCause(
  cause: unknown,
): cause is StructuredErrorCause {
  if (cause === null || typeof cause !== "object") return false;
  const errorCode = (cause as { errorCode?: unknown }).errorCode;
  if (typeof errorCode !== "string") return false;
  return Object.prototype.hasOwnProperty.call(ERROR_CODES, errorCode);
}
