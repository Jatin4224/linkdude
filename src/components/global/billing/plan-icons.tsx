/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PLAN_ICONS, getPlanIcon, PlanIconName, PlanDefinition,
 *   PLANS, plan icon, billing icon, pricing icon, LucideIcon, Package, Rocket
 *
 * WHAT:  Maps the `icon` string on a PLANS entry to a lucide component, with a
 *        safe fallback.
 * WHY:   PLANS stores icons as plain strings so src/lib/config stays free of
 *        React imports. This module deliberately carries NO "use client"
 *        directive: the map used to live inside plan-selector.tsx, which is a
 *        client component, so the static marketing pricing cards could not read
 *        it without pulling the whole selector into the browser bundle. Mirrors
 *        the NAV_ICONS pattern exactly.
 * WHERE: src/components/global/billing/plan-selector.tsx (client) and
 *        src/app/(marketing)/_components/pricing-section.tsx.
 */

import {
  Building2Icon,
  PackageIcon,
  RocketIcon,
  ShieldCheckIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";

/* Keyed by the exact strings used in PLANS[*].icon. */
export const PLAN_ICONS: Record<string, LucideIcon> = {
  Package: PackageIcon,
  Rocket: RocketIcon,
  Zap: ZapIcon,
  Building: Building2Icon,
  ShieldCheck: ShieldCheckIcon,
};

export type PlanIconName = keyof typeof PLAN_ICONS;

/**
 * SOURCE OF TRUTH KEYWORDS: getPlanIcon
 *
 * WHAT:  Resolves a plan icon string to a component, falling back to the neutral
 *        package mark so an unmapped name never crashes a pricing surface.
 * WHERE: Plan selector + marketing pricing cards.
 */
export function getPlanIcon(name: string): LucideIcon {
  return PLAN_ICONS[name] ?? PackageIcon;
}
