/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ThemeProvider, ThemeProviderProps, forcedTheme,
 *   themeablePrefixes, isThemeablePath, FORCED_THEME, light theme, dark theme
 *
 * WHAT:  Client wrapper around next-themes' ThemeProvider — applies a `.dark`
 *        or `.light` class to <html> so the Tailwind/shadcn token variables
 *        switch on the right selector, and forces dark outside the signed-in
 *        app.
 * WHY:   shadcn's CSS keys dark mode off the `.dark` class on a parent
 *        element; next-themes is the canonical way to inject that class
 *        before hydration without a flash of incorrect theme. Wrapping is
 *        required because next-themes is a client component.
 *
 *        Forcing is decided HERE, per route, through next-themes' own
 *        `forcedTheme` rather than by wrapping marketing pages in a `.dark`
 *        div. A wrapper would leave <html>, the body background, the browser's
 *        `color-scheme` and every portaled toast and dialog on the member's
 *        chosen theme — a light toast over a dark landing page. `forcedTheme`
 *        moves all of them together, and it never overwrites the stored choice.
 * WHERE: Mounted by src/app/layout.tsx around the rest of the app tree;
 *        consumed implicitly by every component that uses dark: classes or
 *        reads useTheme() (e.g. src/components/ui/sonner.tsx, the toggle in
 *        src/components/global/sidebar/nav-user.tsx).
 */

"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ThemeProviderProps as NextThemeProviderProps } from "next-themes";

import { FORCED_THEME, isThemeablePath } from "@/lib/config";

export function ThemeProvider({
  children,
  themeablePrefixes,
  ...props
}: NextThemeProviderProps & {
  /** Path prefixes that follow the member's choice; everything else is forced. */
  themeablePrefixes: readonly string[];
}) {
  const pathname = usePathname();
  const forcedTheme = isThemeablePath(pathname, themeablePrefixes)
    ? undefined
    : FORCED_THEME;

  return (
    <NextThemesProvider {...props} forcedTheme={forcedTheme}>
      {children}
    </NextThemesProvider>
  );
}
