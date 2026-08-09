/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: SectionHeader, SectionHeaderProps, eyebrow, align,
 *   size, display heading, section title
 *
 * WHAT:  A page/section title primitive — an optional eyebrow, a heading, and an
 *        optional muted description.
 * WHY:   Reused across settings pages (and anywhere a titled section is needed)
 *        so headings stay consistent. Pairs with SettingsSection. The `eyebrow`
 *        / `align` / `size` props are purely additive — every existing caller
 *        keeps the original left-aligned, `text-2xl` rendering — and exist so the
 *        marketing sections can share this primitive instead of forking a second
 *        heading component with its own type scale.
 * WHERE: settings/billing, settings/organization, and every marketing section.
 */

import { cn } from "@/lib/utils";

export interface SectionHeaderProps {
  title: string;
  description?: string;
  /** Small label above the title — a section kicker. */
  eyebrow?: string | undefined;
  /** `display` is the larger marketing scale; `default` is the in-app size. */
  size?: "default" | "display";
  align?: "left" | "center";
}

export function SectionHeader({
  title,
  description,
  eyebrow,
  size = "default",
  align = "left",
}: SectionHeaderProps) {
  const centered = align === "center";
  const display = size === "display";

  return (
    <div
      className={cn(
        "space-y-1",
        display && "space-y-3",
        centered && "mx-auto max-w-2xl text-center",
      )}
    >
      {eyebrow ? (
        <p className="text-xs font-medium uppercase tracking-widest text-brand-soft-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={cn(
          "text-2xl font-semibold tracking-tight",
          display && "text-pretty text-3xl sm:text-4xl",
        )}
      >
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "text-sm text-muted-foreground",
            display && "text-pretty text-base sm:text-lg",
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
