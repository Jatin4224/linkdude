/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: metadata, RootLayout
 *
 * WHAT:  Root <html>/<body> layout, global metadata, and the mount point for
 *        TRPCReactProvider (which hosts the QueryClient, the optimistic
 *        feature-gate observer, and the AuthRedirectObserver).
 * WHY:   The tRPC provider has to wrap every page so `trpc.X.useQuery()`
 *        calls anywhere in the tree share one cache, and so the cache
 *        observers (auth-redirect, feature-gate) can see every query /
 *        mutation. Mounting it at the root layout is the single place that
 *        makes that true for all routes.
 * WHERE: Reads BRANDING from src/lib/config; wraps every route segment under
 *        src/app/; renders TRPCReactProvider from src/trpc/react-provider.
 */

import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import {
  BRANDING,
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  getThemeablePathPrefixes,
} from "@/lib/config";
import {
  hasMissingRequiredEnv,
  getEnvChecklist,
  getOptionalEnvChecklist,
} from "@/lib/config/required-env";
import { TRPCReactProvider } from "@/trpc/react-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { SetupChecklist } from "@/components/global/setup-checklist";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

/**
 * SOURCE OF TRUTH KEYWORDS: Archivo, Geist_Mono, --font-archivo,
 *   --font-geist-mono, two fonts, font stack, --font-sans, --font-mono,
 *   --font-paper-display, --font-condensed
 *
 * WHAT:  The app's entire type stack: one sans and one mono.
 *
 * WHY:   IT USED TO BE SIX FAMILIES — Geist, Geist Mono, Instrument Serif,
 *        Archivo, Archivo Black and Archivo Narrow — and four of them were
 *        doing a job one variable family does better.
 *
 *        ARCHIVO SPANS BODY TO DISPLAY BY WEIGHT. It is loaded here across
 *        400–900, which is what lets it be the body face, the paper surfaces'
 *        text AND the heavy poster words those surfaces are built around.
 *        Archivo Black was a separate static family sitting at one weight;
 *        Archivo at 900 is the same design at the same darkness, reached
 *        through the axis the variable font already ships. Archivo Narrow went
 *        the same way — the condensed headings now take plain Archivo, which
 *        is the one visible trade in this consolidation.
 *
 *        GEIST MONO STAYS because a mono is not a style choice here. Thirty-six
 *        places use it for tabular numerals, audit rows and label caps, where
 *        the point is that digits align and the text reads as data. A
 *        proportional face with `tabular-nums` aligns the digits and still
 *        reads as prose.
 *
 *        INSTRUMENT SERIF IS SIMPLY GONE. It was declared as --font-display and
 *        no component ever read it, so it cost a font download and bought
 *        nothing.
 * WHERE: The two variables land on <html> below; globals.css maps every
 *        --font-* token onto them.
 */
/*
 * NO `weight` ARRAY, AND THAT IS THE WHOLE POINT. Archivo is a VARIABLE font,
 * so omitting weight ships one file carrying the entire 100–900 axis — which
 * is what lets --font-paper-display reach 900 and the body sit at 400 out of a
 * single download.
 *
 * Listing weights instead asks next/font for one STATIC instance per weight,
 * and five of those broke the Vercel build outright: Turbopack's Google-font
 * resolver emits one @font-face src per weight per unicode range and then
 * fails with "next/font/google queries have exactly one entry" — fifteen
 * errors for five weights across three ranges. It compiled locally and died in
 * CI, which is the worst way to find out. Do not reintroduce the array.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: BRANDING.metadataBase,
  title: {
    default: BRANDING.appName,
    template: `%s — ${BRANDING.appName}`,
  },
  description: BRANDING.appDescription,
  /* The app-wide social defaults. They live HERE rather than on the landing page
   * because they are true of every route, and because a page that declares its
   * own `openGraph` block replaces the inherited one entirely — images included.
   * Keeping the only declaration at the root means src/app/opengraph-image.tsx
   * attaches to every page instead of just the ones nobody customised. Note the
   * absence of `images`: naming one here would override the generated card. */
  openGraph: {
    type: "website",
    siteName: BRANDING.appName,
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "h-full",
        archivo.variable,
        geistMono.variable,
      )}
    >
      <body
        className="min-h-full flex flex-col antialiased"
        suppressHydrationWarning
      >
        {/* Dark stays the default, so nobody sees a change until they choose
            one. The themeable prefixes are resolved here on the server because
            the portal path comes from a server-only env var. */}
        <ThemeProvider
          attribute="class"
          defaultTheme={DEFAULT_THEME}
          storageKey={THEME_STORAGE_KEY}
          themeablePrefixes={getThemeablePathPrefixes()}
          enableSystem
          disableTransitionOnChange
        >
          {/* Developer setup gate: until every REQUIRED env var is set, show the
              checklist instead of the app (optional integrations fail soft and
              are not gated). */}
          {hasMissingRequiredEnv() ? (
            <SetupChecklist
              items={getEnvChecklist()}
              optional={getOptionalEnvChecklist()}
            />
          ) : (
            <TRPCReactProvider>{children}</TRPCReactProvider>
          )}
          <Toaster position="bottom-right" />
          {/* Web traffic — visitors, page views, referrers — for the /portal
              dashboard's traffic panel. Deliberately OUTSIDE the setup-checklist
              branch: marketing pages are the traffic worth measuring, and they
              render even while the app itself is unconfigured.

              Production-only because the component renders a raw <script>
              element, which React 19 warns about on every client render
              ("Encountered a script tag while rendering React component").
              Vercel Analytics ignores localhost traffic anyway, so gating it
              costs no data and keeps the dev console readable. */}
          {process.env.NODE_ENV === "production" ? <Analytics /> : null}
        </ThemeProvider>
      </body>
    </html>
  );
}
