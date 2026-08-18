/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: classifyError, ClassifiedError, ClassifyErrorOptions,
 *   createTraceId, logRawError, SANITIZED_ERROR_MESSAGES, traceId, sanitize,
 *   redact, quota, provider, leak
 *
 * WHAT:  The single place that turns ANY thrown value into a user-safe message,
 *        a structured code, a tRPC status and a trace id — logging the raw error
 *        server-side on the way through.
 * WHY:   Before this existed, five AI routers each did their own
 *        `error instanceof Error ? error.message : fallback`, which passes the
 *        vendor text through verbatim (the fallback only fires for non-Error
 *        throws, i.e. never). Users could read the provider host, the model ID,
 *        the plan tier and the exact quota numbers off a toast. One classifier
 *        means one place to fix, one vocabulary of codes, and no way for a
 *        router to leak by omission — while the raw error stays fully
 *        recoverable from the log by its trace id.
 * WHERE: Called by toProcedureError in src/trpc/init.ts (which every AI router
 *        uses) and by the redaction net in src/trpc/procedures/protected.ts.
 */

import {
  SANITIZED_ERROR_CODES,
  type SanitizedErrorCause,
  type SanitizedErrorCode,
} from "./codes";
import { isUserFacingError } from "./user-facing-error";

/**
 * SOURCE OF TRUTH KEYWORDS: ClassifiedError, TrpcErrorCode
 *
 * WHAT:  A sanitized cause plus the tRPC status the procedure should throw with.
 * WHY:   The status is part of the classification, not a separate decision: a
 *        capacity failure is TOO_MANY_REQUESTS (retryable, not a bug) while a
 *        crash is INTERNAL_SERVER_ERROR, and getting that right is what stops
 *        upstream weather being reported as an app defect.
 * WHERE: Returned by classifyError; consumed by toProcedureError.
 */
export type TrpcErrorCode =
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_SERVER_ERROR"
  | "BAD_REQUEST"
  | "SERVICE_UNAVAILABLE";

export interface ClassifiedError extends SanitizedErrorCause {
  trpcCode: TrpcErrorCode;
}

export interface ClassifyErrorOptions {
  /* Grep handle in the server log — use the procedure path, e.g. "carousel.create". */
  context: string;
  /* Shown when nothing more specific matched. Author-written, domain-specific. */
  fallbackMessage: string;
  /* Per-code overrides so a router can phrase a category in its own domain
   * terms ("fewer slides") without forking the classifier. */
  messages?: Partial<Record<SanitizedErrorCode, string>>;
}

/**
 * SOURCE OF TRUTH KEYWORDS: SANITIZED_ERROR_MESSAGES
 *
 * WHAT:  Default user-visible copy for each sanitized code.
 * WHY:   Deliberately says nothing about WHICH vendor, model, tier or limit was
 *        involved — that is the entire point. Each line instead answers the only
 *        two questions a user actually has: was I charged, and should I retry.
 * WHERE: Defaults for classifyError; overridable per call via `messages`.
 */
export const SANITIZED_ERROR_MESSAGES: Record<SanitizedErrorCode, string> = {
  [SANITIZED_ERROR_CODES.AI_QUOTA_EXHAUSTED]:
    "AI features are temporarily unavailable. Nothing was used from your plan — please try again shortly.",
  [SANITIZED_ERROR_CODES.AI_PROVIDER_UNAVAILABLE]:
    "The AI is busy right now. Nothing was used from your plan — try again in a minute.",
  [SANITIZED_ERROR_CODES.AI_CONTENT_REJECTED]:
    "The AI declined this request. Try rewording it without sensitive or restricted content.",
  [SANITIZED_ERROR_CODES.AI_OUTPUT_UNUSABLE]:
    "The AI returned a response we could not use. Try again, or narrow the request.",
  [SANITIZED_ERROR_CODES.UPSTREAM_UNAVAILABLE]:
    "A service we depend on is not responding. Nothing was saved — please try again.",
  [SANITIZED_ERROR_CODES.INTERNAL_ERROR]:
    "Something went wrong on our side. Please try again.",
};

/**
 * SOURCE OF TRUTH KEYWORDS: createTraceId
 *
 * WHAT:  Short random id correlating a user toast with the server log line.
 * WHY:   Eight hex characters is enough to grep a log with confidence and short
 *        enough that a user can read it over the phone. It carries no
 *        information by itself, so it is safe to print in the UI — unlike the
 *        error it points at.
 * WHERE: Stamped onto every SanitizedErrorCause by classifyError.
 */
export function createTraceId(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

/* Reads an HTTP status off an AI-SDK / fetch-style error and its cause chain.
 * Tried before prose because vendors reword messages far more often than they
 * change status codes. */
function readStatusCode(error: unknown): number | null {
  let current: unknown = error;
  for (
    let depth = 0;
    depth < 4 && current !== null && typeof current === "object";
    depth += 1
  ) {
    const record = current as Record<string, unknown>;
    for (const key of ["statusCode", "status"] as const) {
      const value = record[key];
      if (typeof value === "number" && value >= 100 && value < 600) return value;
    }
    current = record["cause"];
  }
  return null;
}

/* Name AND message, because the AI SDK encodes the useful part in the class name
 * (AI_NoObjectGeneratedError, AI_TypeValidationError) while the vendor encodes
 * it in the prose. The cause chain is walked because the outermost error is the
 * RetryError wrapper, whose own message is only "Failed after N attempts". */
function buildSignature(error: unknown): string {
  if (typeof error === "string") return error;

  const parts: string[] = [];
  let current: unknown = error;
  for (
    let depth = 0;
    depth < 4 && current !== null && typeof current === "object";
    depth += 1
  ) {
    const record = current as Record<string, unknown>;
    if (typeof record["name"] === "string") parts.push(record["name"]);
    if (typeof record["message"] === "string") parts.push(record["message"]);
    current = record["cause"];
  }
  return parts.join(" ");
}

/* The AI SDK names every error it raises `AI_<Something>Error`, and that name is
 * in the signature — so it is a reliable gate for "this came from a model". The
 * gate matters: without it a Prisma connection-pool TIMEOUT matched the capacity
 * pattern and told the user the AI was busy, which sends them to retry a failure
 * that has nothing to do with the model. */
const MODEL_ERROR_MARKER = /\bAI_\w*Error\b/;

/* Ordered: quota before capacity, because a quota refusal mentions rate limits
 * too (the vendor links its rate-limit docs in the same string) and the two need
 * different copy — one clears on its own, the other needs an operator. */
const MODEL_PATTERNS: ReadonlyArray<
  readonly [SanitizedErrorCode, RegExp, boolean]
> = [
  [
    SANITIZED_ERROR_CODES.AI_QUOTA_EXHAUSTED,
    /\bquota\b|insufficient_quota|RESOURCE_EXHAUSTED|free[_ -]?tier|billing|payment required/i,
    true,
  ],
  [
    SANITIZED_ERROR_CODES.AI_CONTENT_REJECTED,
    /safety|content[_ -]?filter|PROHIBITED_CONTENT|blocked by|content policy|recitation/i,
    false,
  ],
  [
    SANITIZED_ERROR_CODES.AI_PROVIDER_UNAVAILABLE,
    /rate[_ -]?limit|too many requests|overload|high demand|currently unavailable|service unavailable|UNAVAILABLE|try again later/i,
    true,
  ],
];

/* Deliberately narrow — matched on the ERROR CLASS, not on words like "invalid"
 * or "expected", which appear in half of all error prose and would have swept
 * unrelated crashes into "the AI returned something unusable". */
const UNUSABLE_OUTPUT_PATTERN =
  /NoObjectGenerated|TypeValidationError|JSONParseError|ZodError|did not match schema/i;

/* Transport-level failures, which say nothing about WHICH dependency broke —
 * so they get the neutral upstream copy rather than blaming the model. */
const INFRASTRUCTURE_PATTERN =
  /timed? ?out|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|fetch failed|socket hang up|AbortError/i;

const TRPC_CODE_BY_ERROR_CODE: Record<SanitizedErrorCode, TrpcErrorCode> = {
  [SANITIZED_ERROR_CODES.AI_QUOTA_EXHAUSTED]: "TOO_MANY_REQUESTS",
  [SANITIZED_ERROR_CODES.AI_PROVIDER_UNAVAILABLE]: "TOO_MANY_REQUESTS",
  [SANITIZED_ERROR_CODES.AI_CONTENT_REJECTED]: "BAD_REQUEST",
  [SANITIZED_ERROR_CODES.AI_OUTPUT_UNUSABLE]: "BAD_REQUEST",
  [SANITIZED_ERROR_CODES.UPSTREAM_UNAVAILABLE]: "SERVICE_UNAVAILABLE",
  [SANITIZED_ERROR_CODES.INTERNAL_ERROR]: "INTERNAL_SERVER_ERROR",
};

/**
 * SOURCE OF TRUTH KEYWORDS: logRawError
 *
 * WHAT:  Writes the UNREDACTED error to the server log under a trace id.
 * WHY:   Redacting the user copy is only half the job — the operator must lose
 *        nothing. This is where the full provider message, status and stack
 *        survive, so the real cause is still one grep away while the user sees
 *        none of it.
 * WHERE: Called by classifyError and by the errorFormatter net; never from
 *        client code.
 */
export function logRawError(
  traceId: string,
  context: string,
  errorCode: SanitizedErrorCode,
  error: unknown,
): void {
  /* Guarded so a classifier call that ever ends up in a client bundle stays
   * silent rather than printing internals into the user devtools console. */
  if (typeof window !== "undefined") return;

  console.error("[error]", {
    traceId,
    context,
    errorCode,
    statusCode: readStatusCode(error),
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

/**
 * SOURCE OF TRUTH KEYWORDS: safeMessage, allowlist, sanitize, leak
 *
 * WHAT:  The user-safe text for a caught error, for procedures that must choose
 *        their OWN tRPC status rather than take the classifier's.
 * WHY:   Several non-AI procedures deliberately answer with a specific code the
 *        UI branches on — PRECONDITION_FAILED to offer Reconnect, CONFLICT for a
 *        stale list action. Those must keep their status, so they cannot use
 *        toProcedureError, but they were still interpolating `error.message`
 *        straight from a service and would happily forward an upstream API's
 *        response body. This applies the same allowlist without touching the
 *        status, and logs whatever it rejected so nothing is lost.
 * WHERE: src/trpc/routers/linkedin-posts.ts and profile-lookup.ts.
 */
export function safeMessage(
  error: unknown,
  context: string,
  fallback: string,
): string {
  if (isUserFacingError(error)) return error.message;

  logRawError(
    createTraceId(),
    context,
    SANITIZED_ERROR_CODES.INTERNAL_ERROR,
    error,
  );
  return fallback;
}

/**
 * SOURCE OF TRUTH KEYWORDS: classifyError
 *
 * WHAT:  Maps any thrown value to `{ errorCode, trpcCode, message, traceId,
 *        retryable }`, logging the raw error under the trace id.
 * WHY:   An allowlist, not a blocklist: a message reaches the user only if it
 *        arrived as a UserFacingError. Every other input — provider errors,
 *        Prisma errors, plain crashes — gets copy that WE wrote for its
 *        category. That inversion is what makes a forgotten case boring (a
 *        vague toast) instead of a leak.
 * WHERE: The one function behind toProcedureError in src/trpc/init.ts.
 */
export function classifyError(
  error: unknown,
  options: ClassifyErrorOptions,
): ClassifiedError {
  const traceId = createTraceId();

  /* Authored messages short-circuit everything: this branch being the ONLY way
   * a message survives to the browser is what the whole allowlist rests on. */
  if (isUserFacingError(error)) {
    logRawError(traceId, options.context, error.errorCode, error);
    return {
      errorCode: error.errorCode,
      trpcCode: TRPC_CODE_BY_ERROR_CODE[error.errorCode],
      message: error.message,
      retryable: error.retryable,
      traceId,
    };
  }

  const status = readStatusCode(error);
  const signature = buildSignature(error);

  const isModelError = MODEL_ERROR_MARKER.test(signature);

  let errorCode: SanitizedErrorCode = SANITIZED_ERROR_CODES.INTERNAL_ERROR;
  let retryable = false;

  /* Model-specific copy is only reachable for errors the model actually raised;
   * everything else falls through to the neutral branches below. */
  if (isModelError) {
    for (const [code, pattern, isRetryable] of MODEL_PATTERNS) {
      if (pattern.test(signature)) {
        errorCode = code;
        retryable = isRetryable;
        break;
      }
    }
  }

  if (
    errorCode === SANITIZED_ERROR_CODES.INTERNAL_ERROR &&
    UNUSABLE_OUTPUT_PATTERN.test(signature)
  ) {
    errorCode = SANITIZED_ERROR_CODES.AI_OUTPUT_UNUSABLE;
  }

  if (
    errorCode === SANITIZED_ERROR_CODES.INTERNAL_ERROR &&
    INFRASTRUCTURE_PATTERN.test(signature)
  ) {
    errorCode = SANITIZED_ERROR_CODES.UPSTREAM_UNAVAILABLE;
    retryable = true;
  }

  /* Status is the last word where prose gave nothing. A 5xx is upstream weather
   * whoever served it; a 429 is capacity, attributed to the model only when the
   * model is what raised it. A 401/403 deliberately falls through to
   * INTERNAL_ERROR — a rejected key is an OPERATOR problem and must never read
   * to the user as something they did wrong or can fix. */
  if (errorCode === SANITIZED_ERROR_CODES.INTERNAL_ERROR && status !== null) {
    if (status >= 500) {
      errorCode = SANITIZED_ERROR_CODES.UPSTREAM_UNAVAILABLE;
      retryable = true;
    } else if (status === 429) {
      errorCode = isModelError
        ? SANITIZED_ERROR_CODES.AI_PROVIDER_UNAVAILABLE
        : SANITIZED_ERROR_CODES.UPSTREAM_UNAVAILABLE;
      retryable = true;
    }
  }

  logRawError(traceId, options.context, errorCode, error);

  const override = options.messages?.[errorCode];
  const message =
    override ??
    (errorCode === SANITIZED_ERROR_CODES.INTERNAL_ERROR
      ? options.fallbackMessage
      : SANITIZED_ERROR_MESSAGES[errorCode]);

  return {
    errorCode,
    trpcCode: TRPC_CODE_BY_ERROR_CODE[errorCode],
    message,
    retryable,
    traceId,
  };
}
