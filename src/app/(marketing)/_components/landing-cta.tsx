/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LandingCtaPair, LandingCtaPairProps, GET_STARTED_HREF,
 *   GET_STARTED_LABEL, acid button, primary CTA, secondary CTA, marketing button
 *
 * WHAT:  The primary/secondary button pair, used identically in the hero and in
 *        the closing band.
 * WHY:   Two call sites is exactly when a pair like this should stop being
 *        copied: the shadow, the mono type treatment and the 52px height are
 *        five classes each, and the hero and the closing CTA drifting apart is
 *        the kind of thing nobody notices until the page looks unfinished. Only
 *        the secondary button varies, so that is the only prop.
 *
 *        Colour comes from the Button `acid` variant rather than classes here,
 *        so the accent stays a token swap in one place.
 * WHERE: hero.tsx and final-cta.tsx.
 */

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { GET_STARTED_HREF, GET_STARTED_LABEL } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LandingCtaPairProps {
  secondaryLabel: string;
  secondaryHref: string;
  className?: string | undefined;
}

export function LandingCtaPair({
  secondaryLabel,
  secondaryHref,
  className,
}: LandingCtaPairProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Button
        variant="acid"
        /* The glow is what separates this from a coloured rectangle, and the
           inset top highlight is what stops the fill reading as flat. Both are
           mixed off --acid, so they follow the token. */
        className="h-13 rounded-xl px-[26px] font-mono text-[13px] font-medium uppercase tracking-[0.06em] shadow-[0_16px_40px_-14px_color-mix(in_oklch,var(--acid)_70%,transparent),inset_0_1px_0_color-mix(in_oklch,oklch(1_0_0)_40%,transparent)]"
        nativeButton={false}
        render={<Link href={GET_STARTED_HREF} />}
      >
        {GET_STARTED_LABEL}
        <ArrowRightIcon className="size-[15px]" />
      </Button>

      <Button
        variant="outline"
        className="h-13 rounded-xl border-rail bg-transparent px-[22px] font-mono text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground hover:bg-card/60 hover:text-foreground dark:border-rail dark:bg-transparent"
        nativeButton={false}
        render={<Link href={secondaryHref} />}
      >
        {secondaryLabel}
      </Button>
    </div>
  );
}
