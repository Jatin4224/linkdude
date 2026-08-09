/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ProblemCards, MARKETING_PROBLEMS, getNavIcon,
 *   MarketingSection, Reveal, border-hairline-gradient, problem section
 *
 * WHAT:  Three cards naming the failure modes the product exists to remove.
 * WHY:   Sits before the feature section on purpose: a reader who hasn't agreed
 *        there is a problem reads a feature list as noise. Icons resolve through
 *        getNavIcon so this section draws from the same icon registry as the
 *        sidebar rather than importing lucide symbols ad hoc.
 * WHERE: src/app/(marketing)/page.tsx.
 */

import { MARKETING_PROBLEMS, MARKETING_SECTION_IDS } from "@/lib/config";
import { MarketingSection } from "@/components/global/marketing";
import { getNavIcon } from "@/components/global/sidebar/nav-icons";
import { Reveal } from "@/components/global/reveal";
import { Card, CardContent } from "@/components/ui/card";

export function ProblemCards() {
  return (
    <MarketingSection
      id={MARKETING_SECTION_IDS.why}
      eyebrow="The gap"
      title="Consistency is the whole game. Almost nobody is consistent."
      description="Not because people don't have anything to say. Because the distance between having a thought and having a post is further than it looks."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {MARKETING_PROBLEMS.map((problem, index) => {
          const Icon = getNavIcon(problem.icon);
          return (
            <Reveal key={problem.title} delay={index * 60}>
              <Card className="surface-raised h-full border-border/80">
                <CardContent className="flex flex-col gap-3 p-6">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-linear-to-br from-brand/30 to-brand/5 ring-1 ring-inset ring-brand-border">
                    <Icon className="size-5 text-brand-soft-foreground" />
                  </span>
                  <h3 className="font-semibold">{problem.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {problem.body}
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          );
        })}
      </div>
    </MarketingSection>
  );
}
