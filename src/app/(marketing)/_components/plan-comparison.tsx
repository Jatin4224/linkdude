/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: PlanComparison, getPricingMatrix, PricingCell,
 *   PricingMatrixRow, MARKETING_MATRIX_GROUPS, PLAN_ORDER, PLANS, Collapsible,
 *   comparison table, disclosure, data-panel-open
 *
 * WHAT:  The full plan-by-plan feature matrix, generated from the resource
 *        registry and hidden behind a disclosure.
 * WHY:   A real semantic <table>, not a CSS grid: this is genuinely tabular, and
 *        `scope="col"` / `scope="row"` gives screen readers the row/column
 *        association a grid would have to reconstruct with hand-written aria. No
 *        `table` primitive is installed and none is added — a shadcn `add table`
 *        would pull in the Radix build of the registry alongside this project's
 *        @base-ui primitives. Any limit or flag resource missing from the groups
 *        is appended under a trailing group, so a newly added quota can never
 *        silently disappear from pricing.
 *
 *        Built on the installed Collapsible for the same reason the FAQ is: the
 *        registry's accordion is the Radix build, and pulling it in would leave
 *        two incompatible primitive systems in components/ui.
 * WHERE: src/app/(marketing)/_components/pricing-section.tsx.
 */

import * as React from "react";
import { CheckIcon, ChevronDownIcon, MinusIcon } from "lucide-react";

import {
  HIGHLIGHTED_PLAN,
  MARKETING_MATRIX_GROUPS,
  PLANS,
  PLAN_ORDER,
} from "@/lib/config";
import {
  getPricingMatrix,
  type PricingCell,
  type PricingMatrixRow,
} from "@/lib/resources";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const VISIBLE_PLANS = PLAN_ORDER.filter((plan) => PLANS[plan].showPlan);

/* Groups resolved once at module scope: the matrix is static data, so there is
 * nothing to recompute per render. */
const GROUPED_ROWS = (() => {
  const matrix = getPricingMatrix();
  const claimed = new Set<string>();

  const groups = MARKETING_MATRIX_GROUPS.map((group) => {
    const rows: PricingMatrixRow[] = [];
    for (const key of group.resources) {
      const row = matrix.find((candidate) => candidate.key === key);
      if (!row) continue;
      claimed.add(key);
      rows.push(row);
    }
    return { label: group.label, rows };
  }).filter((group) => group.rows.length > 0);

  const leftovers = matrix.filter((row) => !claimed.has(row.key));
  if (leftovers.length > 0) {
    groups.push({ label: "Everything else", rows: leftovers });
  }

  return groups;
})();

function CellValue({ cell }: { cell: PricingCell | undefined }) {
  if (!cell) return <span className="text-dim">—</span>;

  if (cell.kind === "boolean") {
    return cell.included ? (
      <>
        <CheckIcon className="mx-auto size-4 text-acid" />
        <span className="sr-only">Included</span>
      </>
    ) : (
      <>
        <MinusIcon className="mx-auto size-4 text-dim" />
        <span className="sr-only">Not included</span>
      </>
    );
  }

  return (
    <span
      className={cn(
        "font-mono text-[11px] tabular-nums",
        /* "Unlimited" is the one cell value that is an argument rather than a
           number, so it gets the accent and everything else stays quiet. */
        cell.unlimited ? "text-acid" : "text-dim",
      )}
    >
      {cell.label}
    </span>
  );
}

export function PlanComparison() {
  return (
    <Collapsible className="group flex flex-col items-center gap-6">
      <CollapsibleTrigger className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-[0.09em] text-acid transition-opacity hover:opacity-80">
        {/* Two labels rather than one that stays put: a disclosure whose label
            does not change leaves the reader guessing which way it will go. */}
        <span className="group-data-panel-open:hidden">
          Compare all {VISIBLE_PLANS.length} plans, line by line
        </span>
        <span className="hidden group-data-panel-open:inline">
          Hide the full comparison
        </span>
        {/* base-ui exposes open state as data-panel-open — not Radix's
            data-state="open". */}
        <ChevronDownIcon className="size-4 transition-transform duration-[240ms] ease-out group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent className="w-full">
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-rail">
                <th
                  scope="col"
                  className="w-2/5 px-5 py-4 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.1em] text-dim"
                >
                  Feature
                </th>
                {VISIBLE_PLANS.map((plan) => (
                  <th
                    key={plan}
                    scope="col"
                    className={cn(
                      "px-4 py-4 text-center font-mono text-[10.5px] font-medium uppercase tracking-[0.1em]",
                      /* The highlighted tier keeps its accent in the table
                         too, so the column a reader was steered towards on the
                         cards is the one they can still find here. */
                      plan === HIGHLIGHTED_PLAN ? "text-acid" : "text-dim",
                    )}
                  >
                    {PLANS[plan].name}
                  </th>
                ))}
              </tr>
            </thead>

            {GROUPED_ROWS.map((group) => (
              <tbody key={group.label}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={VISIBLE_PLANS.length + 1}
                    className="bg-[color-mix(in_oklch,var(--muted)_40%,transparent)] px-5 py-2 text-left font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-dim"
                  >
                    {group.label}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.key} className="border-b border-rail last:border-0">
                    <th
                      scope="row"
                      className="px-5 py-3.5 text-left align-top text-[13px] font-normal"
                    >
                      <span className="font-medium">{row.name}</span>
                      {row.description ? (
                        <span className="mt-0.5 block text-[11.5px] text-dim">
                          {row.description}
                        </span>
                      ) : null}
                    </th>
                    {VISIBLE_PLANS.map((plan) => (
                      <td
                        key={plan}
                        className="px-4 py-3.5 text-center align-middle"
                      >
                        <CellValue cell={row.cells[plan]} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
