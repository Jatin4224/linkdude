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
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { BRANDING } from "@/lib/config";
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

/* Geist is the app-wide sans font (matches funnelmods). Its variable
 * (--font-geist-sans) is set on <html>, where globals.css's `html { @apply
 * font-sans }` + `--font-sans: var(--font-geist-sans)` resolve it. Geist Mono
 * backs --font-geist-mono / the `font-mono` utility. */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* SOURCE OF TRUTH KEYWORDS: Instrument_Serif, --font-instrument-serif,
 *   --font-display, font-display, display accent, italic clause
 *
 * The landing page's display accent face. Loaded ITALIC ONLY because that is the
 * only cut the design uses — every heading pairs an upright Geist clause with an
 * italic serif one, and shipping the upright cut too would double the bytes for
 * a style nothing renders. next/font self-hosts and preloads it, so it costs no
 * third-party request and produces no layout shift. Resolved through
 * --font-display in globals.css (Georgia italic is the fallback), which is what
 * the `font-display` utility reads. */
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
});

export const metadata: Metadata = {
  metadataBase: BRANDING.metadataBase,
  title: {
    default: BRANDING.appName,
    template: `%s — ${BRANDING.appName}`,
  },
  description: BRANDING.appDescription,
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
        geistSans.variable,
        geistMono.variable,
        instrumentSerif.variable,
      )}
    >
      <body
        className="min-h-full flex flex-col antialiased"
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          forcedTheme="dark"
          enableSystem={false}
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
