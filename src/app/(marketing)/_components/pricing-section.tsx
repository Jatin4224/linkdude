/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: PricingSection, PLANS, PLAN_ORDER, HIGHLIGHTED_PLAN,
 *   formatPlanPrice, formatPlanMonthlyEquivalent, getPlanYearlySavingPercent,
 *   BillingIntervalToggle, getPlanIcon, formatResourceAllowance,
 *   MARKETING_PLAN_BULLET_RESOURCES
 *
 * WHAT:  The plan cards and the monthly/yearly switch.
 * WHY:   The only client component on the page, and only because the interval is
 *        state. Everything it renders is derived: names and trials from PLANS,
 *        amounts from the env-driven display prices, bullets from RESOURCES.
 *        Nothing about a plan is typed twice, so hiding a tier or changing a cap
 *        updates this section without anyone editing it. A paid tier priced at
 *        zero renders as "Custom" — the documented contact-sales signal.
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
  MARKETING_SECTION_IDS,
  PLANS,
  PLAN_ORDER,
  type BillingInterval,
  type PlanKey,
} from "@/lib/config";
import { MarketingSection } from "@/components/global/marketing";
import { Spotlight } from "@/components/global/spotlight";
import { BillingIntervalToggle, getPlanIcon } from "@/components/global/billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* The same expression the comparison table uses, so a tier hidden by env
 * disappears from both surfaces at once. */
const VISIBLE_PLANS: readonly PlanKey[] = PLAN_ORDER.filter(
  (plan) => PLANS[plan].showPlan,
);

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
    <MarketingSection
      id={MARKETING_SECTION_IDS.pricing}
      eyebrow="Pricing"
      title="Start free. Pay when it's working."
      description="Every plan includes the whole product. What changes is how much of it you can use."
    >
      <div className="mb-12 flex flex-col items-center gap-3">
        <BillingIntervalToggle
          interval={interval}
          onIntervalChange={setInterval}
          className="w-fit"
        />
        {savingPercent === null ? null : (
          <p className="text-xs text-muted-foreground">
            Save {savingPercent}% paying yearly.
          </p>
        )}
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-4">
        {VISIBLE_PLANS.map((plan) => {
          const def = PLANS[plan];
          const Icon = getPlanIcon(def.icon);
          const highlighted = plan === HIGHLIGHTED_PLAN;
          const amount = getPlanPriceAmount(plan, interval);
          /* A paid tier with no amount is priced on a call, not free. */
          const contactSales = amount === 0 && plan !== "free";
          const yearly = interval === "yearly";

          return (
            <div key={plan} className="relative">
              {/* The badge sits OUTSIDE the spotlight shell: that shell clips to
                  its radius, and a badge straddling the top edge would be cut in
                  half by it. */}
              {highlighted ? (
                <Badge className="absolute -top-2.5 left-6 z-20">
                  Most popular
                </Badge>
              ) : null}

              <Spotlight
                className={cn(
                  "h-full",
                  /* One turning ring on the page, spent on the tier we want
                     read first. */
                  highlighted && "border-conic-brand lg:scale-[1.02]",
                )}
              >
                <Card className="surface-raised h-full border-border/80">
                  <CardContent className="flex h-full flex-col gap-5 p-6">
                    <div className="flex items-center gap-2.5">
                      <Icon className="size-5 text-brand" />
                      <span className="font-semibold">{def.name}</span>
                    </div>

                    <div className="flex flex-col gap-1">
                      {contactSales ? (
                        <p className="text-3xl font-semibold">Custom</p>
                      ) : (
                        <>
                          <p className="text-3xl font-semibold tabular-nums">
                            {yearly
                              ? formatPlanMonthlyEquivalent(plan)
                              : formatPlanPrice(plan, "monthly")}
                            <span className="text-base font-normal text-muted-foreground">
                              /mo
                            </span>
                          </p>
                          {/* Yearly shows the per-month equivalent with the real
                              billing terms underneath — quoting the annual total
                              as a monthly price would be a lie. */}
                          <p className="text-xs text-muted-foreground">
                            {yearly
                              ? `${formatPlanPrice(plan, "yearly")} billed yearly`
                              : "Billed monthly"}
                          </p>
                        </>
                      )}
                    </div>

                    {def.trialDays > 0 ? (
                      <Badge variant="secondary" className="w-fit">
                        {def.trialDays}-day trial
                      </Badge>
                    ) : plan === "free" ? (
                      <Badge variant="secondary" className="w-fit">
                        No card required
                      </Badge>
                    ) : null}

                    <ul className="flex flex-col gap-2.5">
                      {planBullets(plan).map((bullet) => (
                        <li
                          key={bullet}
                          className="flex items-start gap-2 text-sm"
                        >
                          <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand" />
                          <span className="text-muted-foreground">{bullet}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      variant={highlighted ? "brand" : "outline"}
                      size="lg"
                      className="mt-auto w-full"
                      nativeButton={false}
                      render={<Link href={GET_STARTED_HREF} />}
                    >
                      {contactSales ? "Talk to us" : GET_STARTED_LABEL}
                    </Button>
                  </CardContent>
                </Card>
              </Spotlight>
            </div>
          );
        })}
      </div>
    </MarketingSection>
  );
}
