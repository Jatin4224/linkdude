/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PLAN_KEYS, PlanKey, PlanDefinition, PLANS,
 *   PLAN_ORDER, BillingInterval, getPlanPriceId, getPlanByPriceId, getNextPlan,
 *   isPaidPlan, PLAN_PRICE_CURRENCY, PLAN_PRICE_LOCALE, HIGHLIGHTED_PLAN,
 *   getPlanPriceAmount, formatPlanPrice, getPlanMonthlyEquivalent,
 *   getPlanYearlySavingPercent
 *
 * WHAT:  Plan identity + display metadata AND the Stripe price-id mapping per
 *        (plan, interval). Per-plan VALUES (caps, flags) live in
 *        src/lib/resources.ts under each resource's perPlan table — this file
 *        is the plan's branding/identity and its Stripe wiring.
 * WHY:   Price ids are env-driven (created in the Stripe dashboard) so the same
 *        code ships to any account; the (plan, interval) → priceId lookup and
 *        the reverse (priceId → plan) both live here so the checkout flow and
 *        the webhook agree on the mapping.
 * WHERE: PlanKey types RESOURCES.perPlan; PLANS metadata powers the pricing UI;
 *        price helpers used by the billing router + Stripe webhook; the display
 *        amounts drive the marketing pricing section
 *        (src/app/(marketing)/_components/pricing-section.tsx).
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PLAN_KEYS, PlanKey
 *
 * WHAT:  THE single list of every plan identifier, ordered cheapest → most
 *        expensive with the hidden `portal` tier last. `PlanKey` (the type),
 *        `PLAN_ORDER` (purchasable upgrade order), `PLANS` (metadata) and
 *        RESOURCES.perPlan tables ALL derive from this one tuple — never
 *        re-list plan keys anywhere else.
 * WHY:   One authoritative tuple means adding/removing a plan is a one-line
 *        change that TypeScript then enforces everywhere (perPlan exhaustiveness,
 *        the runtime guard, the upgrade order).
 * WHERE: PlanKey below; PLAN_KEYS re-exported by resources.ts for the runtime
 *        guard in feature-gate.ts.
 *
 * `portal` is a hidden, non-purchasable tier for the platform-admin workspace
 * (isPortalOrganization). It grants everything (unlimited limits, all flags) and
 * is never shown in pricing or the upgrade order.
 */
export const PLAN_KEYS = [
  "free",
  "starter",
  "pro",
  "enterprise",
  "portal",
] as const;

export type PlanKey = (typeof PLAN_KEYS)[number];

export type BillingInterval = "monthly" | "yearly";

export interface PlanDefinition {
  name: string;
  icon: string;
  showPlan: boolean;
  trialDays: number;
  /* DISPLAY-ONLY amounts in whole currency units (19 = $19). Never used to
   * charge anyone — Stripe owns the real amount behind the price id below.
   * Required (not optional) so adding a plan is a compile error until its
   * pricing copy exists, and so the pricing page can never render a blank
   * cell. A PAID plan left at 0 is the documented "contact sales" signal. */
  price: {
    monthly: number;
    yearly: number;
  };
  /* Stripe recurring Price ids per interval. `free` has none. Env-driven, so
   * values are `string | undefined` (exactOptionalPropertyTypes). */
  stripe: {
    monthly?: string | undefined;
    yearly?: string | undefined;
  };
}

/* Env readers for the operator-tunable plan attributes. A blank/unset var
 * falls back to the template default, so the app runs out-of-the-box while
 * still letting an operator rename plans, retitle trials, or hide a tier from
 * pricing WITHOUT touching code (matches funnelmods' env-driven plans). */
function envStr(key: string, fallback: string): string {
  const value = process.env[key];
  return value !== undefined && value.trim().length > 0
    ? value.trim()
    : fallback;
}
function envBool(key: string, fallback: boolean): boolean {
  const value = process.env[key];
  if (value === undefined || value.trim().length === 0) return fallback;
  return value.trim() === "true";
}
function envInt(key: string, fallback: number): number {
  const value = process.env[key];
  if (value === undefined || value.trim().length === 0) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * SOURCE OF TRUTH KEYWORDS: PLAN_PRICE_CURRENCY, PLAN_PRICE_LOCALE
 *
 * WHAT:  ISO-4217 currency and BCP-47 locale used to format every displayed
 *        plan amount.
 * WHY:   The locale is PINNED rather than auto-detected on purpose: an implicit
 *        locale resolves from the OS on the Node server and from the browser on
 *        the client, so the same price renders as two different strings and
 *        React reports a hydration mismatch. One env-driven value renders
 *        identically on both sides.
 * WHERE: formatPlanPrice below; formatResourceLimit (src/lib/resources.ts)
 *        reuses the locale so quantities and prices group digits the same way.
 */
export const PLAN_PRICE_CURRENCY = envStr("NEXT_PUBLIC_PRICE_CURRENCY", "USD");
export const PLAN_PRICE_LOCALE = envStr("NEXT_PUBLIC_PRICE_LOCALE", "en-US");

/**
 * SOURCE OF TRUTH KEYWORDS: HIGHLIGHTED_PLAN
 *
 * WHAT:  The plan that gets the "Most popular" treatment on the pricing page,
 *        or null when the env value names no real plan.
 * WHY:   Resolved with `.find` over PLAN_KEYS rather than a cast — a typo'd env
 *        value then highlights nothing instead of producing a PlanKey that
 *        doesn't exist and crashing a lookup at render time.
 * WHERE: The marketing pricing cards.
 */
const HIGHLIGHTED_PLAN_RAW = envStr("NEXT_PUBLIC_HIGHLIGHT_PLAN", "pro");

export const HIGHLIGHTED_PLAN: PlanKey | null =
  PLAN_KEYS.find((key) => key === HIGHLIGHTED_PLAN_RAW) ?? null;

/**
 * SOURCE OF TRUTH KEYWORDS: PLANS
 *
 * WHAT:  Per-plan display metadata + Stripe price ids. `name`, `showPlan` and
 *        `trialDays` are env-driven (with defaults) so the operator can rebrand
 *        plans, hide a tier from pricing, and set trial lengths from .env; the
 *        `icon` and Stripe price ids round out the entry. `portal` is the hidden
 *        admin tier and stays fixed (never sold, never renamed).
 * WHERE: Pricing/plan-picker UI + billing price helpers below.
 */
export const PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    name: envStr("NEXT_PUBLIC_FREE_NAME", "Free"),
    icon: "Package",
    showPlan: envBool("NEXT_PUBLIC_FREE_SHOW_PLAN", true),
    trialDays: envInt("NEXT_PUBLIC_FREE_TRIAL_DAYS", 0),
    price: {
      monthly: envInt("NEXT_PUBLIC_FREE_MONTHLY_AMOUNT", 0),
      yearly: envInt("NEXT_PUBLIC_FREE_YEARLY_AMOUNT", 0),
    },
    stripe: {},
  },
  starter: {
    name: envStr("NEXT_PUBLIC_STARTER_NAME", "Starter"),
    icon: "Rocket",
    showPlan: envBool("NEXT_PUBLIC_STARTER_SHOW_PLAN", true),
    trialDays: envInt("NEXT_PUBLIC_STARTER_TRIAL_DAYS", 14),
    price: {
      monthly: envInt("NEXT_PUBLIC_STARTER_MONTHLY_AMOUNT", 19),
      yearly: envInt("NEXT_PUBLIC_STARTER_YEARLY_AMOUNT", 190),
    },
    stripe: {
      monthly: process.env["NEXT_PUBLIC_STARTER_PRICE_MONTHLY"],
      yearly: process.env["NEXT_PUBLIC_STARTER_PRICE_YEARLY"],
    },
  },
  pro: {
    name: envStr("NEXT_PUBLIC_PRO_NAME", "Pro"),
    icon: "Zap",
    showPlan: envBool("NEXT_PUBLIC_PRO_SHOW_PLAN", true),
    trialDays: envInt("NEXT_PUBLIC_PRO_TRIAL_DAYS", 14),
    price: {
      monthly: envInt("NEXT_PUBLIC_PRO_MONTHLY_AMOUNT", 49),
      yearly: envInt("NEXT_PUBLIC_PRO_YEARLY_AMOUNT", 490),
    },
    stripe: {
      monthly: process.env["NEXT_PUBLIC_PRO_PRICE_MONTHLY"],
      yearly: process.env["NEXT_PUBLIC_PRO_PRICE_YEARLY"],
    },
  },
  enterprise: {
    name: envStr("NEXT_PUBLIC_ENTERPRISE_NAME", "Enterprise"),
    icon: "Building",
    showPlan: envBool("NEXT_PUBLIC_ENTERPRISE_SHOW_PLAN", true),
    trialDays: envInt("NEXT_PUBLIC_ENTERPRISE_TRIAL_DAYS", 30),
    price: {
      monthly: envInt("NEXT_PUBLIC_ENTERPRISE_MONTHLY_AMOUNT", 149),
      yearly: envInt("NEXT_PUBLIC_ENTERPRISE_YEARLY_AMOUNT", 1490),
    },
    stripe: {
      monthly: process.env["NEXT_PUBLIC_ENTERPRISE_PRICE_MONTHLY"],
      yearly: process.env["NEXT_PUBLIC_ENTERPRISE_PRICE_YEARLY"],
    },
  },
  /* Hidden platform-admin tier — never sold, never in PLAN_ORDER, not renamable.
   * The zero price is unreachable: portal is filtered out of every pricing
   * surface by PLAN_ORDER before an amount is ever read. */
  portal: {
    name: "Portal",
    icon: "ShieldCheck",
    showPlan: false,
    trialDays: 0,
    price: { monthly: 0, yearly: 0 },
    stripe: {},
  },
};

/**
 * SOURCE OF TRUTH KEYWORDS: PLAN_ORDER
 *
 * WHAT:  The purchasable plans, cheapest → most expensive — every PLAN_KEY
 *        except the hidden `portal` admin tier.
 * WHY:   Derived from the one PLAN_KEYS source (no parallel list). It is
 *        deliberately INDEPENDENT of `showPlan`: `showPlan` only controls
 *        whether a plan is rendered in the pricing table, and is env-toggleable
 *        — a hidden Enterprise tier must still stay in PLAN_ORDER so the
 *        webhook can map its Stripe price back to the plan and getNextPlan keeps
 *        a stable upgrade ladder. The pricing UI filters by showPlan itself.
 * WHERE: getPlanByPriceId / getNextPlan below; plan-selector + Stripe webhook.
 */
export const PLAN_ORDER: readonly PlanKey[] = PLAN_KEYS.filter(
  (plan) => plan !== "portal",
);

/**
 * SOURCE OF TRUTH KEYWORDS: isPaidPlan
 *
 * WHAT:  True for any plan other than `free`.
 * WHERE: Onboarding + billing branch on whether checkout is needed.
 */
export function isPaidPlan(plan: PlanKey): boolean {
  return plan !== "free";
}

/**
 * SOURCE OF TRUTH KEYWORDS: getPlanPriceId
 *
 * WHAT:  Resolves the Stripe Price id for a (plan, interval), or null.
 * WHY:   Returns null for free or when the env var is unset so callers fail
 *        with a clear "price not configured" message rather than a Stripe 400.
 * WHERE: billing.createSubscription / upgradeOrganization.
 */
export function getPlanPriceId(
  plan: PlanKey,
  interval: BillingInterval,
): string | null {
  return PLANS[plan].stripe[interval] ?? null;
}

/**
 * SOURCE OF TRUTH KEYWORDS: getPlanByPriceId
 *
 * WHAT:  Reverse lookup — finds the plan key owning a given Stripe Price id.
 * WHY:   The webhook receives a price id and must map it back to a plan key to
 *        store on the Subscription row.
 * WHERE: Stripe webhook handlers (src/services/stripe.service.ts).
 */
export function getPlanByPriceId(priceId: string): PlanKey | null {
  for (const plan of PLAN_ORDER) {
    const { monthly, yearly } = PLANS[plan].stripe;
    if (monthly === priceId || yearly === priceId) return plan;
  }
  return null;
}

/**
 * SOURCE OF TRUTH KEYWORDS: getNextPlan
 *
 * WHAT:  The next plan up from the given one, or null at the top.
 * WHERE: Upgrade copy / {nextPlan} interpolation.
 */
export function getNextPlan(plan: PlanKey): PlanKey | null {
  const index = PLAN_ORDER.indexOf(plan);
  if (index === -1 || index === PLAN_ORDER.length - 1) return null;
  return PLAN_ORDER[index + 1] ?? null;
}

/**
 * SOURCE OF TRUTH KEYWORDS: getPlanPriceAmount
 *
 * WHAT:  The raw display amount for a (plan, interval), in whole currency units.
 * WHY:   One read-point for `PLANS[plan].price[interval]` so callers branch on
 *        `=== 0` (the contact-sales signal) instead of reaching into the shape.
 * WHERE: formatPlanPrice + the marketing pricing cards.
 */
export function getPlanPriceAmount(
  plan: PlanKey,
  interval: BillingInterval,
): number {
  return PLANS[plan].price[interval];
}

/**
 * SOURCE OF TRUTH KEYWORDS: formatPlanPrice
 *
 * WHAT:  A localized currency string for a (plan, interval) — "$49", "€490".
 * WHY:   Fraction digits are forced to 0 because plan pricing is quoted in whole
 *        units; "$49.00" on a pricing card reads as noise. Built on the pinned
 *        locale so the server and client strings match exactly.
 * WHERE: The marketing pricing cards.
 */
export function formatPlanPrice(
  plan: PlanKey,
  interval: BillingInterval,
): string {
  return new Intl.NumberFormat(PLAN_PRICE_LOCALE, {
    style: "currency",
    currency: PLAN_PRICE_CURRENCY,
    maximumFractionDigits: 0,
  }).format(getPlanPriceAmount(plan, interval));
}

/**
 * SOURCE OF TRUTH KEYWORDS: getPlanMonthlyEquivalent, formatPlanMonthlyEquivalent
 *
 * WHAT:  A yearly amount expressed as its per-month equivalent, and that value
 *        formatted as currency.
 * WHY:   Yearly pricing is honest only when the headline number is comparable to
 *        the monthly one — showing "$490/mo" on the yearly toggle is a lie, and
 *        showing "$490/yr" next to "$49/mo" makes the reader do the division.
 *        The card shows the per-month figure with "billed yearly" beneath.
 * WHERE: The marketing pricing cards.
 */
export function getPlanMonthlyEquivalent(plan: PlanKey): number {
  return Math.round(PLANS[plan].price.yearly / 12);
}

export function formatPlanMonthlyEquivalent(plan: PlanKey): string {
  return new Intl.NumberFormat(PLAN_PRICE_LOCALE, {
    style: "currency",
    currency: PLAN_PRICE_CURRENCY,
    maximumFractionDigits: 0,
  }).format(getPlanMonthlyEquivalent(plan));
}

/**
 * SOURCE OF TRUTH KEYWORDS: getPlanYearlySavingPercent
 *
 * WHAT:  How much cheaper a year of this plan is than twelve monthly payments,
 *        as a whole percent — or null when there is nothing to claim.
 * WHY:   Returns null (rather than 0 or a negative) for free plans, unpriced
 *        contact-sales tiers, and any yearly amount that isn't actually a
 *        discount, so the UI can simply hide the line instead of advertising
 *        "Save 0%".
 * WHERE: The savings caption beside the billing-interval toggle.
 */
export function getPlanYearlySavingPercent(plan: PlanKey): number | null {
  const { monthly, yearly } = PLANS[plan].price;
  if (monthly <= 0 || yearly <= 0) return null;
  const fullYear = monthly * 12;
  if (yearly >= fullYear) return null;
  return Math.round(((fullYear - yearly) / fullYear) * 100);
}
