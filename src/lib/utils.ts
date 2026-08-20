import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/* Imported from the SPECIFIC module, never the `@/lib/config` barrel: that
 * barrel re-exports the prisma singleton, and this file is imported by nearly
 * every client component through `cn` — one barrel import here would drag the
 * database client into the browser bundle. */
import { MIN_SCHEDULE_LEAD_MS } from "@/lib/config/scheduler"
import { RESOURCES } from "@/lib/resources"

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

/**
 * SOURCE OF TRUTH KEYWORDS: toLocalDateTimeInput, earliestSchedule,
 *   datetime-local, MIN_SCHEDULE_LEAD_MS
 *
 * WHAT:  Formats a Date for an `<input type="datetime-local">`, and the earliest
 *        value such an input may offer.
 * WHY:   `datetime-local` wants `YYYY-MM-DDTHH:mm` in LOCAL time, which
 *        `toISOString()` cannot produce — it converts to UTC and silently shifts
 *        the value by the user's offset, so a user in UTC+5:30 picking 09:00
 *        schedules 03:30. Built from the local getters, which is the only correct
 *        source.
 *
 *        Lives here rather than beside either caller because the post composer
 *        and the carousel publish dialog both schedule, and a second copy of a
 *        timezone-sensitive formatter is exactly the kind of near-duplicate that
 *        drifts into a bug nobody reproduces. Same reasoning as initialsOf above.
 *
 *        The returned string also SORTS chronologically, which is what lets
 *        callers validate with a pure string compare instead of constructing a
 *        Date during render — `Date.now()` in a render body is impure and the
 *        React Compiler rejects it.
 * WHERE: The post composer's schedule field and the carousel publish dialog.
 */
export function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/* The earliest value a schedule picker will accept, matching the server's floor
 * so a too-soon time is refused before the round trip rather than after it.
 * Call it in a `useState` initializer, never in a render body. */
export function earliestSchedule(): string {
  return toLocalDateTimeInput(new Date(Date.now() + MIN_SCHEDULE_LEAD_MS));
}

/**
 * SOURCE OF TRUTH KEYWORDS: buildDraftComposerHref, draftId, reopen a draft
 *
 * WHAT:  The link that reopens a saved draft in the composer.
 * WHY:   Two surfaces now hand a user back to an unfinished post — the post
 *        library's Edit action and the content plan's "Draft this" — and a second
 *        copy of the query-param contract is how one of them would keep working
 *        after the other was renamed. Same reasoning as the schedule helpers
 *        above.
 *
 *        The path is read from the RESOURCES entry rather than written out,
 *        because that registry is where the composer's route is declared; a
 *        literal here would be a second place to update when it moves.
 * WHERE: The post library's row actions and the content plan's post-idea action.
 */
export function buildDraftComposerHref(postId: string): string {
  return `${RESOURCES.linkedinPosts.nav.href}?draftId=${encodeURIComponent(postId)}`;
}
