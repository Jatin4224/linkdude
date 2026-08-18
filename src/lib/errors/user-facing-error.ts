/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: UserFacingError, isUserFacingError, safeMessage,
 *   allowlist, sanitize, redact, leak
 *
 * WHAT:  The marker error class for messages a HUMAN in this codebase wrote and
 *        deliberately intends an end user to read.
 * WHY:   Sanitizing by blocklist — regex-matching vendor phrasings and hoping to
 *        catch them all — leaks the moment a provider rewords a message or a new
 *        one is added. This inverts it into an allowlist: a message is shown to
 *        the user only because it was thrown as a UserFacingError, never because
 *        it failed to match a pattern. Everything else is generic by default, so
 *        the failure mode of forgetting is a vague toast, not a leaked model ID,
 *        plan tier or quota number.
 * WHERE: Thrown by services (ai, linkedin, profile-source) for conditions the
 *        user can act on; honored by classifyError (./classify.ts) and by the
 *        redaction net in src/trpc/procedures/protected.ts.
 */

import { SANITIZED_ERROR_CODES, type SanitizedErrorCode } from "./codes";

/**
 * SOURCE OF TRUTH KEYWORDS: UserFacingError
 *
 * WHAT:  An Error whose `message` is guaranteed safe to render in the UI.
 * WHY:   `instanceof` is the whole mechanism — it is the one signal that
 *         separates an authored message from a provider's. `errorCode` is
 *         optional so a service can additionally say WHICH category it is
 *         (a content refusal vs. unusable output) without the classifier
 *         having to guess from the wording.
 * WHERE: Constructed in src/services/*; read by classifyError.
 */
export class UserFacingError extends Error {
  readonly errorCode: SanitizedErrorCode;
  /* Retryable failures get a "try again" framing in the UI; a content refusal
   * or an unusable output does not, because retrying identically fails again. */
  readonly retryable: boolean;

  constructor(
    message: string,
    options?: { errorCode?: SanitizedErrorCode; retryable?: boolean; cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "UserFacingError";
    this.errorCode = options?.errorCode ?? SANITIZED_ERROR_CODES.INTERNAL_ERROR;
    this.retryable = options?.retryable ?? false;
  }
}

/**
 * SOURCE OF TRUTH KEYWORDS: isUserFacingError
 *
 * WHAT:  Guard for UserFacingError that survives module duplication.
 * WHY:   A bare `instanceof` can fail when the class is evaluated twice (server
 *        vs. edge bundle, or a hot reload), which would silently downgrade a
 *        perfectly good authored message into a generic one. The name check is
 *        the fallback that keeps that from happening.
 * WHERE: classifyError and the errorFormatter net.
 */
export function isUserFacingError(error: unknown): error is UserFacingError {
  if (error instanceof UserFacingError) return true;
  return (
    error instanceof Error &&
    error.name === "UserFacingError" &&
    typeof (error as UserFacingError).errorCode === "string"
  );
}
