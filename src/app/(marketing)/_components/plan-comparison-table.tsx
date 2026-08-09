/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PlanComparisonTable, getPricingMatrix, PricingCell,
 *   PricingMatrixRow, MARKETING_MATRIX_GROUPS, PLAN_ORDER, PLANS, comparison table
 *
 * WHAT:  The full plan-by-plan feature matrix, generated from the resource
 *        registry and grouped by the editorial order in MARKETING_MATRIX_GROUPS.
 * WHY:   A real semantic <table>, not a CSS grid: this is genuinely tabular, and
 *        `scope="col"` / `scope="row"` gives screen readers the row/column
 *        association that a grid would have to reconstruct with hand-written
 *        aria. No `table` primitive is installed and none is added — a shadcn
 *        `add table` would pull in the Radix build of the registry alongside
 *        this project's @base-ui primitives. Any limit or flag resource missing
 *        from the groups is appended under a trailing group, so a newly added
 *        quota can never silently disappear from pricing.
 * WHERE: src/app/(marketing)/page.tsx, directly under PricingSection.
 */

import { CheckIcon, MinusIcon } from "lucide-react";

import { MARKETING_MATRIX_GROUPS, PLANS, PLAN_ORDER } from "@/lib/config";
import {
  getPricingMatrix,
  type PricingCell,
  type PricingMatrixRow,
} from "@/lib/resources";
import { MarketingSection } from "@/components/global/marketing";
import { cn } from "@/lib/utils";

const VISIBLE_PLANS = PLAN_ORDER.filter((plan) => PLANS[plan].showPlan);

/* Groups resolved once at module scope: the matrix is static data, so there is
 * nothing to recompute per request. */
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
  if (!cell) {
    return <span className="text-muted-foreground">—</span>;
  }

  if (cell.kind === "boolean") {
    return cell.included ? (
      <>
        <CheckIcon className="mx-auto size-4 text-brand" />
        <span className="sr-only">Included</span>
      </>
    ) : (
      <>
        <MinusIcon className="mx-auto size-4 text-muted-foreground" />
        <span className="sr-only">Not included</span>
      </>
    );
  }

  return (
    <span
      className={cn(
        "tabular-nums",
        cell.unlimited ? "font-medium text-foreground" : "text-muted-foreground",
      )}
    >
      {cell.label}
    </span>
  );
}

export function PlanComparisonTable() {
  return (
    <MarketingSection
      title="Everything, side by side"
      description="The same limits the app enforces — this table is generated from them."
      spacingClassName="pb-24 sm:pb-32"
    >
      {/* Horizontal scroll is on a plain div rather than ScrollArea so the whole
          section stays a server component with zero client JS. */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-3xl border-collapse text-sm">
          <thead>
            <tr className="border-b bg-card/50">
              <th scope="col" className="w-2/5 px-5 py-4 text-left font-medium">
                Feature
              </th>
              {VISIBLE_PLANS.map((plan) => (
                <th
                  key={plan}
                  scope="col"
                  className="px-4 py-4 text-center font-medium"
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
                  className="bg-muted/40 px-5 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {group.label}
                </th>
              </tr>
              {group.rows.map((row) => (
                <tr key={row.key} className="border-b last:border-0">
                  <th
                    scope="row"
                    className="px-5 py-3.5 text-left align-top font-normal"
                  >
                    <span className="font-medium">{row.name}</span>
                    {row.description ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">
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
    </MarketingSection>
  );
}
