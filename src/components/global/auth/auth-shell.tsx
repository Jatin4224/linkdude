/*
 *   *
 *    *    */

/**
 * SOURCE OF TRUTH KEYWORDS: AuthShell, AuthShellProps, PlatformLogo,
 *   BRAND_MASCOT, surface-raised, aurora-blob, bg-grid-lines, bg-grain,
 *   auth layout, split panel
 *
 * WHAT:  The chrome every (auth) route renders inside — a brand panel on the
 *        left and the form panel on the right, from lg up.
 * WHY:   Sign-in used to be a bare centred box on flat black, which read as a
 *        different product from the marketing page a user had just come through.
 *        The split reuses the landing's own surfaces (aurora, grid, grain,
 *        surface-raised) so the two are visibly one system, and there is no rule
 *        down the middle — both halves share a continuous backdrop.
 *
 *        The form comes FIRST in the DOM and is moved right with `order`, not by
 *        being written second: tab order and screen-reader order should reach
 *        the thing the visitor came for before the sales copy, whatever side it
 *        is painted on.
 *
 *        Deliberately NOT animated. Sign-in is a page people hit repeatedly and
 *        often with a password manager already firing; an entrance animation on
 *        a high-frequency screen only adds delay between intent and input. The
 *        ambient aurora is the exception, because it never gates interaction.
 * WHERE: Used by every page under src/app/(auth)/ — sign-in, sign-up,
 *        forgot-password, reset-password, accept-invitation.
 */

import * as React from "react";
import Image from "next/image";

import BRAND_MASCOT from "@/app/assets/images/linkdin-dude.png";
import { APP_NAME } from "@/lib/config";
import { PlatformLogo } from "@/components/global/platform-logo";

export interface AuthShellProps {
  children: React.ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="relative isolate min-h-svh lg:grid lg:grid-cols-2">
      {/* Same page-wide grain as the marketing surfaces — the detail that keeps
          large flat dark areas from reading as dead screen. */}
      <div
        aria-hidden="true"
        className="bg-grain pointer-events-none fixed inset-0 z-50 opacity-[0.03] mix-blend-overlay"
      />

      {/* ---------- Form column (painted right on lg) ---------- */}
      <div className="relative flex flex-col justify-center overflow-hidden px-6 py-12 md:px-10 lg:order-2">
        <div
          aria-hidden="true"
          className="bg-grid-lines pointer-events-none absolute inset-0 -z-20 opacity-40"
        />
        <div
          aria-hidden="true"
          className="animate-aurora-a aurora-blob aurora-brand pointer-events-none absolute -top-40 left-1/4 -z-10 size-96 opacity-30"
        />

        <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
          <div className="self-center lg:hidden">
            <PlatformLogo href="/" />
          </div>

          {/* A lit panel rather than a bare stack, so the fields have an edge to
              sit on instead of floating on the background. */}
          <div className="surface-raised rounded-xl border p-6 shadow-xl sm:p-8">
            {children}
          </div>
        </div>
      </div>

      {/* ---------- Brand column (painted left on lg) ----------
          hidden below lg: at phone widths it would push the form off the first
          screen, and the form is the only thing anyone came here to reach. */}
      <div className="relative hidden overflow-hidden lg:order-1 lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div
          aria-hidden="true"
          className="bg-grid-lines pointer-events-none absolute inset-0 -z-20 opacity-50"
        />
        <div
          aria-hidden="true"
          className="bg-brand-glow pointer-events-none absolute inset-x-0 -top-32 -z-10 h-120"
        />
        <div
          aria-hidden="true"
          className="animate-aurora-b aurora-blob aurora-accent pointer-events-none absolute bottom-0 left-0 -z-10 size-96 opacity-25"
        />

        <div className="absolute left-10 top-10">
          <PlatformLogo href="/" />
        </div>

        <div className="flex max-w-md flex-col items-center gap-8 px-10 text-center">
          <Image
            src={BRAND_MASCOT}
            alt=""
            width={288}
            height={288}
            priority
            aria-hidden="true"
            className="h-auto w-44 drop-shadow-2xl mask-[radial-gradient(closest-side,oklch(0_0_0)_70%,transparent_100%)]"
          />

          <div className="flex flex-col gap-4">
            <h2 className="text-balance text-3xl font-semibold leading-tight tracking-tight">
              You&rsquo;re one post away from becoming a LinkedIn influencer.
            </h2>

            <p className="text-pretty text-muted-foreground">
              Thought leadership, minus the three hours staring at an empty box.{" "}
              {APP_NAME} writes the hook. You take the credit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
