/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ChatShell, ChatMessage, ChatTyping, ChatOptions
 *
 * WHAT:  Barrel for the conversational UI primitives.
 * WHY:   One import surface (`@/components/global/chat`) so a consumer does not
 *        depend on the per-file split, and so a bubble can be regrouped without
 *        ripple edits.
 */

export { ChatShell } from "./chat-shell";
export type { ChatShellProps } from "./chat-shell";
export { ChatMessage, ChatTyping } from "./chat-message";
export type { ChatMessageProps, ChatTypingProps, ChatRole } from "./chat-message";
export { ChatOptions } from "./chat-options";
export type { ChatOptionsProps } from "./chat-options";
