/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ThemePreference } from "@/lib/types";

import { PORTAL_PATH } from "./portal";
import { ROUTES } from "./routes";

/**
 * SOURCE OF TRUTH KEYWORDS: DEFAULT_THEME, THEME_STORAGE_KEY,
 *   THEME_PREFERENCE_LABELS, FORCED_THEME, getThemeablePathPrefixes,
 *   isThemeablePath, light theme, dark theme, theme toggle, forcedTheme
 *
 * WHAT:  Where the light/dark choice applies, what it defaults to, and what
 *        each option is called.
 * WHY:   DARK BY DEFAULT. The app shipped dark-only, so a member who never
 *        touches the toggle must see exactly what they saw before it existed.
 *
 *        ONLY THE SIGNED-IN APP IS THEMEABLE. Marketing and auth carry their
 *        own art direction and were never built against the light tokens, so
 *        they stay forced to dark. Forcing never WRITES the stored choice, so a
 *        member who picked light and then visits the landing page comes back to
 *        a light dashboard.
 *
 *        The prefixes are resolved on the SERVER and passed down, because
 *        PORTAL_PATH reads a server-only env var: evaluated in the browser it
 *        would always fall back to "/portal" and force a relocated portal dark.
 * WHERE: src/app/layout.tsx (passes the prefixes to ThemeProvider),
 *        src/components/theme-provider.tsx, the toggle in nav-user.tsx.
 */
export const DEFAULT_THEME = "dark" as const satisfies ThemePreference;

/* Namespaced so it cannot collide with next-themes' generic "theme" key if a
 * second app ever shares the origin. */
export const THEME_STORAGE_KEY = "app-theme";

/* What non-themeable surfaces render as — the look they were designed in. */
export const FORCED_THEME = "dark" as const satisfies ThemePreference;

export const THEME_PREFERENCE_LABELS = {
  dark: "Dark",
  light: "Light",
  system: "System",
} as const satisfies Record<ThemePreference, string>;

export function getThemeablePathPrefixes(): readonly string[] {
  return [ROUTES.dashboard, PORTAL_PATH];
}

/* Segment-aware, so "/dashboard-old" is not mistaken for "/dashboard". */
export function isThemeablePath(
  pathname: string,
  prefixes: readonly string[],
): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
