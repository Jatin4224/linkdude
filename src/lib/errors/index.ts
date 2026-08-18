/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ERROR_CODES, ErrorCode, StructuredError,
 *   StructuredErrorCause, SANITIZED_ERROR_CODES, SanitizedErrorCode,
 *   SanitizedErrorCause, isStructuredErrorCause, UserFacingError,
 *   isUserFacingError, classifyError, ClassifiedError, createTraceId,
 *   logRawError, safeMessage, SANITIZED_ERROR_MESSAGES, getErrorMessage,
 *   getStructuredCause, isRetryableError
 *
 * WHAT:  Barrel for the error module — the single import surface for error
 *        codes, the user-facing message allowlist, the server-side classifier
 *        and the client-side display helper.
 * WHY:   Error handling is a whole-app concern with three participants (service
 *        throws, procedure translates, UI renders) and they only stay in step if
 *        they read from one place. Splitting the implementation into files while
 *        keeping ONE import path means `@/lib/errors` stays the answer to
 *        "where does error handling live" no matter which side you are on.
 * WHERE: Imported by src/trpc/init.ts, src/trpc/procedures/protected.ts,
 *        src/trpc/react-provider.tsx, the AI routers, the services that throw
 *        UserFacingError, and every `onError` toast handler.
 */

export {
  ERROR_CODES,
  SANITIZED_ERROR_CODES,
  isStructuredErrorCause,
  type ErrorCode,
  type SanitizedErrorCode,
  type SanitizedErrorCause,
  type StructuredError,
  type StructuredErrorCause,
} from "./codes";

export { UserFacingError, isUserFacingError } from "./user-facing-error";

export {
  classifyError,
  createTraceId,
  logRawError,
  SANITIZED_ERROR_MESSAGES,
  safeMessage,
  type ClassifiedError,
  type ClassifyErrorOptions,
  type TrpcErrorCode,
} from "./classify";

export {
  getErrorMessage,
  getStructuredCause,
  isRetryableError,
} from "./client";
