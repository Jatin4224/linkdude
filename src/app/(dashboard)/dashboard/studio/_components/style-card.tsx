"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: StyleCard, StyleCardProps, StyleMiniature,
 *   gallery card, style preview
 *
 * WHAT:  One gallery card — a miniature of what the style looks like, its name,
 *        why it works, and the button that starts a profile from it.
 * WHY:   THE MINIATURE IS THE POINT. The first version of this gallery showed
 *        three bullet points and a button, which asked people to choose a visual
 *        style by reading about it. Nobody picks a design from prose.
 *
 *        It is drawn in the DOM from the same palette and the same avatar
 *        geometry the renderer uses, NOT rendered through satori. This is the one
 *        place an approximation is correct: twelve real renders on mount would be
 *        twelve server round trips to draw thumbnails nobody downloads, and a
 *        card is a colour field with a headline on it — the approximation is
 *        honest at 200px wide.
 *
 *        The palette values arrive as inline styles because they ARE data — the
 *        member's chosen colours, not theme tokens describing the app's chrome.
 *        Every other colour here is a token, per the project rule.
 * WHERE: The studio gallery.
 */

import * as React from "react";

import { DESIGN_CANVAS_PRESETS } from "@/lib/types";
import type { DesignPalette, StudioTemplate } from "@/lib/config";
import { FeatureGate } from "@/components/feature-gate";
import {
  TechButton,
  TechLabel,
  TechPanel,
} from "@/components/global/tech";
import { cn } from "@/lib/utils";


export interface StyleCardProps {
  template: StudioTemplate;
  palette: DesignPalette;
  isPending: boolean;
  disabled: boolean;
  onUse: () => void;
}

/* The avatar circle, from the same normalised geometry the renderer reads, so the
 * miniature shows the real constraint rather than a decorative dot. */
const AVATAR = DESIGN_CANVAS_PRESETS.linkedinBanner.safeZones.find(
  (zone) => zone.id === "avatar",
);

function StyleMiniature({
  template,
  palette,
}: {
  template: StudioTemplate;
  palette: DesignPalette;
}) {
  const headline = template.sampleContent["headline"] ?? "Your headline here";
  const eyebrow = template.sampleContent["eyebrow"];

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: "1584 / 396",
        backgroundColor: palette.background,
        borderColor: palette.border,
      }}
    >
      {/* Content in the right two-thirds, mirroring insetLeft — the single
          strongest convention in the real layouts. */}
      <div className="absolute inset-y-0 right-0 flex w-[64%] flex-col justify-center gap-[3px] pr-3">
        {eyebrow ? (
          <span
            className="truncate text-[5px] font-bold uppercase tracking-[0.18em]"
            style={{ color: palette.accent }}
          >
            {eyebrow}
          </span>
        ) : null}

        <span
          className="line-clamp-2 text-[10px] font-bold leading-tight"
          style={{ color: palette.foreground }}
        >
          {headline}
        </span>

        <span className="flex items-center gap-1 pt-[2px]">
          <span
            className="rounded-full px-[6px] py-[2px] text-[4px] font-bold"
            style={{ backgroundColor: palette.accent, color: palette.background }}
          >
            {template.sampleContent["ctaLabel"] ?? "Call to action"}
          </span>
          <span
            className="rounded-full border px-[5px] py-[2px] text-[4px]"
            style={{ borderColor: palette.border, color: palette.muted }}
          >
            {template.sampleContent["proofA"] ?? "Proof"}
          </span>
        </span>
      </div>

      {/* The avatar's footprint, dashed — so the empty left third reads as a
          deliberate reservation rather than an unbalanced design. */}
      {AVATAR ? (
        <span
          aria-hidden
          className="absolute rounded-full border border-dashed opacity-40"
          style={{
            borderColor: palette.muted,
            left: `${String((AVATAR.x - AVATAR.width / 2) * 100)}%`,
            top: `${String((AVATAR.y - AVATAR.height / 2) * 100)}%`,
            width: `${String(AVATAR.width * 100)}%`,
            height: `${String(AVATAR.height * 100)}%`,
          }}
        />
      ) : null}
    </div>
  );
}

export function StyleCard({
  template,
  palette,
  isPending,
  disabled,
  onUse,
}: StyleCardProps) {
  return (
    <TechPanel className="gap-0">
      <div className="border-b border-[color:color-mix(in_oklab,var(--border)_70%,transparent)]">
        <StyleMiniature template={template} palette={palette} />
      </div>

      <div className="flex flex-col gap-2 p-4 pb-3">
        <h3 className="tech-display text-xl">{template.label}</h3>
        <TechLabel>
          {[template.tone, ...template.roles]
            .map((word) => word.replace(/([A-Z])/g, " $1"))
            .join(" / ")}
        </TechLabel>
      </div>

      <ul className="flex flex-1 flex-col gap-2 px-4 pb-4">
        {template.whyItWorks.map((reason, index) => (
          <li key={reason} className="flex gap-3 text-[0.8125rem] leading-snug">
            <span className="tech-label pt-0.5 tabular-nums">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="text-muted-foreground">{reason}</span>
          </li>
        ))}
      </ul>

      {/* Gated at the BUTTON, not the card — the FeatureGate rule. */}
      <FeatureGate resource="studio">
        <TechButton
          size="sm"
          className={cn(
            "mt-auto w-full border-t border-[color:color-mix(in_oklab,var(--border)_70%,transparent)]",
            isPending && "opacity-80",
          )}
          disabled={disabled}
          onClick={onUse}
        >
          {isPending ? "Initialising" : "Use this style"}
        </TechButton>
      </FeatureGate>
    </TechPanel>
  );
}
