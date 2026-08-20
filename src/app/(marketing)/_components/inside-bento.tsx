/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: InsideBento, MARKETING_SURFACES,
 *   MARKETING_SURFACE_ROWS, MARKETING_SECTION_HEADINGS, getResourceDefinition,
 *   ProfileScoreMeter, BentoCalendar, bento, tile, data-tilt, Reveal
 *
 * WHAT:  The "Inside" bento — one tile per product surface, each showing a small
 *        piece of the real screen rather than describing it.
 * WHY:   The section this replaced was six identical feature cards, which is the
 *        layout a reader skips. A bento with tiles of different shapes and a
 *        different mock in each one gives the eye somewhere to land and shows
 *        the product instead of listing it. Every tile's small-caps label comes
 *        from RESOURCES, so a renamed surface renames its tile and a removed one
 *        is a compile error rather than a stale claim.
 * WHERE: src/app/(marketing)/page.tsx.
 */

import {
  MARKETING_SECTION_HEADINGS,
  MARKETING_SECTION_IDS,
  MARKETING_SURFACES,
  MARKETING_SURFACE_ROWS,
  type MarketingSurface,
} from "@/lib/config";
import { getResourceDefinition } from "@/lib/resources";
import { MarketingSection } from "@/components/global/marketing";
import { Reveal } from "@/components/global/reveal";
import { DisplayHeading, SectionKicker } from "./display-heading";
import { ProfileScoreMeter } from "./profile-score-meter";
import { cn } from "@/lib/utils";

const COPY = MARKETING_SECTION_HEADINGS.product;

/* The lit surface every tile shares. Kept as one constant rather than repeated
 * per tile because the whole point of a bento is that the tiles read as one
 * material cut into different sizes. `data-tilt` marks them for a possible
 * pointer-driven tilt later — the transition it would need is already here. */
const TILE =
  "relative rounded-2xl bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--card)_88%,oklch(1_0_0)),var(--card)_44%)] p-[clamp(20px,2.2vw,28px)] shadow-[inset_0_0_0_1px_var(--border),inset_0_1px_0_color-mix(in_oklch,oklch(1_0_0)_15%,transparent)] transition-transform duration-[320ms] ease-out";

export function InsideBento() {
  return (
    <MarketingSection id={MARKETING_SECTION_IDS.product}>
      <Reveal>
        <div className="flex flex-col gap-5">
          <SectionKicker>{COPY.kicker}</SectionKicker>
          <DisplayHeading size="section" heading={COPY.heading} />
        </div>
      </Reveal>

      <div className="mt-[clamp(32px,4vw,56px)] grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {MARKETING_SURFACES.map((surface, index) => (
          <Reveal
            key={surface.resource}
            /* Capped stagger: past about eight steps the last tile is waiting
               half a second after the first, which stops reading as a sequence
               and starts reading as lag. */
            delay={Math.min(index, 8) * 70}
            className={cn(surface.wide && "md:col-span-2")}
          >
            <SurfaceTile surface={surface} />
          </Reveal>
        ))}
      </div>
    </MarketingSection>
  );
}

function SurfaceTile({ surface }: { surface: MarketingSurface }) {
  const rows = MARKETING_SURFACE_ROWS[surface.resource];

  return (
    <div data-tilt className={cn(TILE, "flex h-full flex-col gap-4")}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-dim">
          {getResourceDefinition(surface.resource).name}
        </p>
        {surface.wide ? (
          <p className="font-mono text-[10.5px] text-acid">
            {CALENDAR_SUMMARY}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold tracking-[-0.035em]">
          {surface.headline}
        </h3>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {surface.body}
        </p>
      </div>

      {/* Each tile draws the piece of its own screen that makes the claim
          concrete. Two surfaces have a bespoke mock and are named here rather
          than inferred from "has no rows" — an inferred fallback would quietly
          hand a future tile the profile score. Anything else renders its rows,
          and a surface with neither renders nothing rather than a broken mock. */}
      <div className="mt-auto pt-2">
        {surface.wide ? (
          <BentoCalendar />
        ) : surface.resource === "profileAnalysis" ? (
          <ProfileScoreAndVerdicts />
        ) : rows ? (
          <MockRows rows={rows} />
        ) : null}
      </div>
    </div>
  );
}

function MockRows({
  rows,
}: {
  rows: readonly { label: string; value: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex items-center justify-between gap-3 rounded-[9px] bg-[color-mix(in_oklch,oklch(0.015_0_0)_65%,transparent)] px-[11px] py-[9px]"
        >
          <span className="truncate text-[11.5px] text-muted-foreground">
            {row.label}
          </span>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.06em] text-dim">
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ---------- profile analysis mock ---------- */

/* The section names are the ones the analyser actually reports on; the verdicts
 * are illustrative. `ready` states take the accent so the tile shows at a glance
 * that the output is something you can act on, not just a grade. */
const PROFILE_VERDICTS: readonly { section: string; verdict: string }[] = [
  { section: "Headline", verdict: "Rewrite ready" },
  { section: "About", verdict: "Rewrite ready" },
  { section: "Experience", verdict: "Strong" },
];

function ProfileScoreAndVerdicts() {
  return (
    <div className="flex flex-col gap-4">
      <ProfileScoreMeter />
      <div className="flex flex-col gap-1.5">
        {PROFILE_VERDICTS.map((row) => (
          <div
            key={row.section}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-[11.5px] text-muted-foreground">
              {row.section}
            </span>
            <span
              className={cn(
                "font-mono text-[10.5px] uppercase tracking-[0.06em]",
                row.verdict.toLowerCase().includes("ready")
                  ? "text-acid"
                  : "text-dim",
              )}
            >
              {row.verdict}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- calendar mock ---------- */

const CALENDAR_SUMMARY = "9 scheduled · 2 gaps";
const CALENDAR_PUBLISHED = new Set([2, 4, 9, 11, 13]);
const CALENDAR_SCHEDULED = new Set([16, 18, 20, 23, 25, 27, 30]);
const CALENDAR_LEAD_BLANKS = 2;
const CALENDAR_DAYS = 30;
const CALENDAR_CELLS = 35;

interface CalendarCell {
  key: string;
  label: number;
  state: "outside" | "published" | "scheduled" | "empty";
}

/* Built once at module scope — a mock month has nothing to recompute, and doing
 * it per render would rebuild 35 objects on every paint of the page. The month
 * starts on a Wednesday, which is what the two leading cells are for. */
const CALENDAR: readonly CalendarCell[] = Array.from(
  { length: CALENDAR_CELLS },
  (_, index): CalendarCell => {
    const day = index - CALENDAR_LEAD_BLANKS + 1;

    if (day < 1) {
      return { key: `lead-${index}`, label: 29 + index, state: "outside" };
    }
    if (day > CALENDAR_DAYS) {
      return {
        key: `trail-${index}`,
        label: day - CALENDAR_DAYS,
        state: "outside",
      };
    }
    if (CALENDAR_PUBLISHED.has(day)) {
      return { key: `day-${day}`, label: day, state: "published" };
    }
    if (CALENDAR_SCHEDULED.has(day)) {
      return { key: `day-${day}`, label: day, state: "scheduled" };
    }
    return { key: `day-${day}`, label: day, state: "empty" };
  },
);

const CELL_STATES: Record<CalendarCell["state"], string> = {
  outside: "text-[color-mix(in_oklch,var(--dim)_40%,transparent)]",
  /* Published is neutral-bright and scheduled is accented on purpose: the thing
     the reader is being shown is the FUTURE half of the month filling up. */
  published:
    "bg-[color-mix(in_oklch,oklch(1_0_0)_13%,transparent)] text-foreground",
  scheduled:
    "bg-[color-mix(in_oklch,var(--acid-soft)_85%,transparent)] text-acid shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--acid)_32%,transparent)]",
  empty: "bg-[color-mix(in_oklch,oklch(1_0_0)_4%,transparent)] text-dim",
};

function BentoCalendar() {
  return (
    <div aria-hidden="true" className="grid grid-cols-7 gap-1.5">
      {CALENDAR.map((cell) => (
        <span
          key={cell.key}
          className={cn(
            "flex h-[30px] items-center justify-center rounded-lg font-mono text-[10.5px] tabular-nums",
            CELL_STATES[cell.state],
          )}
        >
          {cell.label}
        </span>
      ))}
    </div>
  );
}
