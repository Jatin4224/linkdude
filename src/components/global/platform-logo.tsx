/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PlatformLogo, PlatformLogoProps, BrandMark,
 *        BrandMarkProps, BRAND_ICON, brand icon, app icon, logo mark, wordmark
 *
 * WHAT:  BrandMark = the square brand icon on its own. PlatformLogo = that mark
 *        + APP_NAME as the app's wordmark.
 * WHY:   BRAND_ICON is imported in exactly one place so a rebrand is a one-line
 *        swap here — every surface that shows the mark (wordmark, sidebar org
 *        switcher) reads it through BrandMark instead of re-importing the file.
 *        The same source image also backs src/app/icon.png / apple-icon.png, so
 *        the browser tab and the in-app mark can never drift apart.
 * WHERE: BrandMark is consumed by PlatformLogo and by
 *        src/components/global/sidebar/team-switcher.tsx. PlatformLogo is
 *        rendered by src/components/global/auth/auth-shell.tsx and the
 *        onboarding flow header.
 */

import Image from "next/image";
import Link from "next/link";

import BRAND_ICON from "@/app/assets/images/linkdin-dude.png";
import { APP_NAME } from "@/lib/config/branding";
import { cn } from "@/lib/utils";

export interface BrandMarkProps {
  /* Sizing/radius overrides — callers pass e.g. "size-8 rounded-lg". */
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    /* Rendered at 64px so the mark stays crisp on 2x displays at every call
     * site's CSS size, without shipping the 1024px source. */
    <Image
      src={BRAND_ICON}
      alt=""
      width={64}
      height={64}
      className={cn("size-6 shrink-0 rounded-md object-cover", className)}
      priority
      aria-hidden="true"
    />
  );
}

export interface PlatformLogoProps {
  href?: string;
  className?: string;
  showName?: boolean;
}

export function PlatformLogo({
  href = "/",
  className,
  showName = true,
}: PlatformLogoProps) {
  const content = (
    <div className={cn("flex items-center gap-2 font-medium", className)}>
      <BrandMark />
      {showName ? <span>{APP_NAME}</span> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {content}
      </Link>
    );
  }
  return content;
}
