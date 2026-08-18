/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: getErrorMessage, getStructuredCause, isRetryableError,
 *   toast, error.message, traceId, ref, sanitize
 *
 * WHAT:  The one helper every toast / inline error uses to turn a tRPC client
 *        error into display text, with the support reference appended.
 * WHY:   `toast.error(error.message)` is what put raw vendor text on screen —
 *        it renders whatever string the server happened to send. Reading the
 *        structured cause instead means the UI shows copy the app authored, and
 *        gets the trace id for free so a user can quote a reference that maps to
 *        the full error in the server log.
 * WHERE: Every `onError` handler under src/app/(dashboard) and
 *        src/components/global. Pairs with classifyError on the server.
 */

/* Deliberately NOT marked "use client": this module is re-exported from the
 * `@/lib/errors` barrel that server files import too, and a client directive
 * there would turn every server import of the barrel into a client reference.
 * The functions are pure and run correctly on both sides. */

import { TRPCClientError } from "@trpc/client";
import { isStructuredErrorCause, type StructuredErrorCause } from "./codes";

/**
 * SOURCE OF TRUTH KEYWORDS: getStructuredCause
 *
 * WHAT:  Pulls the typed `cause` off a tRPC client error, or null.
 * WHY:   The cause is the only part of the envelope the server guarantees is
 *        safe and structured; `error.message` is not, which is the entire reason
 *        this module exists. Returning the union lets callers narrow on
 *        `errorCode` to branch into specific UI (upgrade modal, retry button).
 * WHERE: Used by getErrorMessage below and by any component needing to branch
 *        on a specific ERROR_CODES value.
 */
export function getStructuredCause(
  error: unknown,
): StructuredErrorCause | null {
  if (!(error instanceof TRPCClientError)) return null;
  const data: unknown = error.data;
  if (data === null || typeof data !== "object") return null;
  const cause = (data as { cause?: unknown }).cause;
  return isStructuredErrorCause(cause) ? cause : null;
}

/**
 * SOURCE OF TRUTH KEYWORDS: isRetryableError
 *
 * WHAT:  Whether the failure is upstream weather that a retry could clear.
 * WHY:   Lets a surface offer "Try again" only when trying again could actually
 *        work — offering it on a content refusal just walks the user into the
 *        same wall.
 * WHERE: Optional; for surfaces that render a retry affordance.
 */
export function isRetryableError(error: unknown): boolean {
  const cause = getStructuredCause(error);
  return cause !== null && "retryable" in cause && cause.retryable === true;
}

/**
 * SOURCE OF TRUTH KEYWORDS: getErrorMessage
 *
 * WHAT:  Display text for any thrown value: the structured message plus the
 *        support reference when one is present.
 * WHY:   Falls back to `error.message` ONLY when there is no structured cause,
 *        which after the errorFormatter net can only be an already-sanitized
 *        message — a client-side throw or a transport failure. So the unsafe
 *        path that used to exist here is now closed on the server side too,
 *        and this stays a single readable line at every call site.
 * WHERE: Replaces `toast.error(error.message)` everywhere.
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  const cause = getStructuredCause(error);

  if (cause !== null) {
    /* Only sanitized causes carry a trace id — the domain codes (upgrade
     * required, invitation expired) are self-explanatory and a reference on
     * them would read like a bug report for normal product behavior. */
    if ("traceId" in cause && typeof cause.traceId === "string") {
      return `${cause.message} (ref: ${cause.traceId})`;
    }
    return cause.message;
  }

  if (error instanceof TRPCClientError || error instanceof Error) {
    return error.message || (fallback ?? "Something went wrong. Please try again.");
  }

  return fallback ?? "Something went wrong. Please try again.";
}
