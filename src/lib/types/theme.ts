/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { z } from "zod";

/**
 * SOURCE OF TRUTH KEYWORDS: THEME_PREFERENCES, themePreferenceSchema,
 *   ThemePreference, light theme, dark theme, system theme, theme toggle,
 *   colour scheme, next-themes
 *
 * WHAT:  The colour schemes a member can choose for the signed-in app.
 * WHY:   A closed set, because next-themes accepts any string and a typo in a
 *        theme name fails silently — the class simply never lands on <html> and
 *        the app renders in whatever it had before. Deriving the type from the
 *        array means the toggle, the default and the labels cannot disagree
 *        about which names exist.
 *
 *        "system" is a real choice rather than an absence of one: it follows
 *        the OS as it changes, which a one-time read of the OS setting does not.
 * WHERE: src/lib/config/theme.ts (default, labels), the theme toggle in
 *        src/components/global/sidebar/nav-user.tsx.
 */
export const THEME_PREFERENCES = ["dark", "light", "system"] as const;
export const themePreferenceSchema = z.enum(THEME_PREFERENCES);
export type ThemePreference = z.infer<typeof themePreferenceSchema>;
