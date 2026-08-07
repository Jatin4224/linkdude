import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * SOURCE OF TRUTH KEYWORDS: initialsOf, avatar fallback, AvatarFallback
 *
 * WHAT:  The letters shown in an avatar when there is no image.
 * WHY:   Every avatar in the app needs this and it had grown two slightly
 *        different copies — one that took a name only and one that fell back to
 *        an email — which meant the same person could show "J" in one place and
 *        "JA" in another. Unified here: two words give their initials, anything
 *        else gives its first two characters, so a single-word name and an email
 *        both produce two letters instead of one.
 *
 *        `fallback` covers the real case that forced the second copy: a user row
 *        whose name is null but whose email is always present.
 * WHERE: The sidebar user menu, the LinkedIn post preview, and the chat bubbles.
 */
export function initialsOf(
  name: string | null | undefined,
  fallback = "",
): string {
  const source = name?.trim() || fallback.trim();
  if (!source) return "";

  const parts = source.split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`
      : source.slice(0, 2);
  return letters.toUpperCase();
}
