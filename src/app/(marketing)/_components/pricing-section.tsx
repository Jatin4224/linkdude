/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: PricingSection, PLANS, PLAN_ORDER, HIGHLIGHTED_PLAN,
 *   formatPlanPrice, formatPlanMonthlyEquivalent, getPlanYearlySavingPercent,
 *   MARKETING_PLAN_PITCHES, MARKETING_PLAN_BULLET_RESOURCES,
 *   formatResourceAllowance, PlanComparison, BillingInterval, interval toggle
 *
 * WHAT:  The plan cards, the monthly/yearly switch, and the collapsed full
 *        comparison beneath them.
 * WHY:   A client component only because the interval is state. Everything it
 *        renders is derived: names and trials from PLANS, amounts from the
 *        env-driven display prices, bullets and the comparison from RESOURCES.
 *        Nothing about a plan is typed twice, so hiding a tier or changing a cap
 *        updates this section without anyone editing it. A paid tier priced at
 *        zero renders as "Custom" — the documented contact-sales signal.
 *
 *        The comparison table is a DISCLOSURE rather than its own section. As an
 *        always-open band it was the largest thing on the page and it sat
 *        between the cards and the FAQ, so every reader paid for a table most of
 *        them did not want. Collapsed, it is one line of text until asked for.
 * WHERE: src/app/(marketing)/page.tsx.
 */

import * as React from "react";
import Link from "next/link";
import { CheckIcon } from "lucide-react";

import {
  FLAG_RESOURCE_KEYS,
  formatResourceAllowance,
  getResourceDefinition,
  getResourceFlagForPlan,
} from "@/lib/resources";
import {
  formatPlanMonthlyEquivalent,
  formatPlanPrice,
  getPlanPriceAmount,
  getPlanYearlySavingPercent,
  GET_STARTED_HREF,
  GET_STARTED_LABEL,
  HIGHLIGHTED_PLAN,
  MARKETING_PLAN_BULLET_RESOURCES,
  MARKETING_PLAN_PITCHES,
  MARKETING_SECTION_HEADINGS,
  MARKETING_SECTION_IDS,
  PLANS,
  PLAN_ORDER,
  type BillingInterval,
  type PlanKey,
} from "@/lib/config";
import { MarketingSection } from "@/components/global/marketing";
import { Reveal } from "@/components/global/reveal";
import { Button } from "@/components/ui/button";
import { DisplayHeading, SectionKicker } from "./display-heading";
import { PlanComparison } from "./plan-comparison";
import { cn } from "@/lib/utils";

const COPY = MARKETING_SECTION_HEADINGS.pricing;

/* The same expression the comparison table uses, so a tier hidden by env
 * disappears from both surfaces at once. */
const VISIBLE_PLANS: readonly PlanKey[] = PLAN_ORDER.filter(
  (plan) => PLANS[plan].showPlan,
);

const INTERVALS: readonly BillingInterval[] = ["monthly", "yearly"];

/* Quotas first, then whatever flags the tier unlocks. Flags come last because
 * they are the differentiator a reader scans for after they have satisfied
 * themselves the numbers are big enough. */
function planBullets(plan: PlanKey): readonly string[] {
  const quotas = MARKETING_PLAN_BULLET_RESOURCES.map((resource) =>
    formatResourceAllowance(resource, plan),
  );
  const flags = FLAG_RESOURCE_KEYS.filter((resource) =>
    getResourceFlagForPlan(resource, plan),
  ).map((resource) => getResourceDefinition(resource).name);
  return [...quotas, ...flags];
}

export function PricingSection() {
  const [interval, setInterval] = React.useState<BillingInterval>("monthly");

  const savingPercent =
    HIGHLIGHTED_PLAN === null
      ? null
      : getPlanYearlySavingPercent(HIGHLIGHTED_PLAN);

  return (
    <MarketingSection id={MARKETING_SECTION_IDS.pricing}>
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="flex flex-col gap-5">
            <SectionKicker>{COPY.kicker}</SectionKicker>
            <DisplayHeading size="section" heading={COPY.heading} />
            <p className="max-w-[30em] text-pretty text-base leading-[1.65] text-muted-foreground">
              {COPY.body}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2.5 sm:items-end">
            <div className="flex rounded-[11px] border border-rail p-[3px]">
              {INTERVALS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setInterval(value)}
                  aria-pressed={interval === value}
                  className={cn(
                    "rounded-lg px-4 py-2 font-mono text-[11.5px] font-medium uppercase tracking-[0.07em] transition-colors",
                    interval === value
                      ? "bg-acid text-acid-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            {savingPercent === null ? null : (
              <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-acid">
                Save {savingPercent}% paying yearly
              </p>
            )}
          </div>
        </div>
      </Reveal>

      <div className="mt-[clamp(32px,4vw,56px)] grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {VISIBLE_PLANS.map((plan, index) => (
          <Reveal
            key={plan}
            delay={Math.min(index, 8) * 70}
            className="h-full"
          >
            <PlanCard plan={plan} interval={interval} />
          </Reveal>
        ))}
      </div>

      <Reveal delay={140} className="mt-10">
        <PlanComparison />
      </Reveal>
    </MarketingSection>
  );
}

function PlanCard({
  plan,
  interval,
}: {
  plan: PlanKey;
  interval: BillingInterval;
}) {
  const def = PLANS[plan];
  const highlighted = plan === HIGHLIGHTED_PLAN;
  const amount = getPlanPriceAmount(plan, interval);
  /* A paid tier with no amount is priced on a call, not free. */
  const contactSales = amount === 0 && plan !== "free";
  const yearly = interval === "yearly";
  const pitch = MARKETING_PLAN_PITCHES[plan];

  /* Trial length is the plan's own, so a tier retimed in .env relabels its own
     button instead of promising 14 days it no longer gives. */
  const ctaLabel = contactSales
    ? "Talk to us"
    : def.trialDays > 0
      ? `Start ${def.trialDays}-day trial`
      : GET_STARTED_LABEL;

  return (
    <div
      data-tilt
      className={cn(
        "flex h-full flex-col gap-[17px] rounded-2xl p-[clamp(20px,2.2vw,26px)] transition-transform duration-[320ms] ease-out",
        highlighted
          ? "bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--card)_88%,var(--acid)),var(--card)_52%)] shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--acid)_34%,transparent),inset_0_1px_0_color-mix(in_oklch,oklch(1_0_0)_16%,transparent),0_28px_70px_-34px_color-mix(in_oklch,var(--acid)_40%,transparent)]"
          : "bg-[color-mix(in_oklch,var(--card)_48%,transparent)] shadow-[inset_0_0_0_1px_var(--rail)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.08em]">
          {def.name}
        </p>
        {highlighted ? (
          <span className="rounded-full bg-acid px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-acid-foreground">
            Most popular
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        {contactSales ? (
          <p className="text-[clamp(36px,3.6vw,46px)] font-semibold leading-[0.9] tracking-[-0.06em]">
            Custom
          </p>
        ) : (
          <>
            <p className="text-[clamp(36px,3.6vw,46px)] font-semibold leading-[0.9] tracking-[-0.06em] tabular-nums">
              {yearly
                ? formatPlanMonthlyEquivalent(plan)
                : formatPlanPrice(plan, "monthly")}
              <span className="text-[15px] font-normal tracking-normal text-dim">
                /mo
              </span>
            </p>
            {/* Yearly shows the per-month equivalent with the real billing terms
                underneath — quoting the annual total as a monthly price would be
                a lie, and making the reader divide is not much better. */}
            <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-dim">
              {plan === "free"
                ? "No card required"
                : yearly
                  ? `${formatPlanPrice(plan, "yearly")} billed yearly`
                  : "Billed monthly"}
            </p>
          </>
        )}
      </div>

      {pitch ? (
        <p className="text-[13px] leading-[1.58] text-muted-foreground">
          {pitch}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2.5">
        {planBullets(plan).map((bullet) => (
          <li key={bullet} className="flex items-start gap-2 text-[13px]">
            <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-acid-dim" />
            <span className="text-muted-foreground">{bullet}</span>
          </li>
        ))}
      </ul>

      <Button
        variant={highlighted ? "acid" : "outline"}
        className={cn(
          "mt-auto h-11 w-full rounded-[11px] font-mono text-[11.5px] font-medium uppercase tracking-[0.06em]",
          !highlighted &&
            "border-border bg-transparent text-foreground hover:bg-card dark:border-border dark:bg-transparent",
        )}
        nativeButton={false}
        render={<Link href={GET_STARTED_HREF} />}
      >
        {ctaLabel}
      </Button>
    </div>
  );
}
