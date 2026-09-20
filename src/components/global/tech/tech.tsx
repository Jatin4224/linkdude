"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: Bracketed, TechSurface, TechSection, TechPanel,
 *   TechLabel, TechRule, TechMeta, TechStat, TechBadge, TechButton,
 *   TechAsciiPanel, crop marks, registration marks, technical editorial
 *
 * WHAT:  The technical-editorial kit — the primitives an engineering-document
 *        surface is assembled from.
 * WHY:   GLOBAL rather than route-local, per the project rule: none of these
 *        knows anything about the studio, and a second surface wanting this
 *        language should compose them rather than copy them.
 *
 *        Two rules do most of the work, and both are easy to erode:
 *
 *        1. A MODULE IS A FILL, NOT A BORDER. Nothing here draws an outline. A
 *           box is a lifted fill against the page, which is what keeps the design
 *           reading as a system of planes rather than a grid of containers.
 *        2. BRACKETS MARK A FEW THINGS. Nav, primary action, stat blocks, cards
 *           and inputs — and nothing else. Body text, images and whole sections
 *           never get them. A page where everything is bracketed is a page where
 *           the mark means nothing.
 *
 *        Three families: Archivo Narrow for condensed display, Geist for UI sans,
 *        Geist Mono for labels, metadata, numbers and intro copy.
 *
 *        Colour is INHERITED from the app, not declared here. This scope sets
 *        only radius and shadow, because those are the two things the app theme
 *        states differently from this language — which is why the studio no
 *        longer looks like a different product from its neighbours.
 * WHERE: `src/app/(dashboard)/dashboard/studio/`.
 */

import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * SOURCE OF TRUTH KEYWORDS: Bracketed
 *
 * WHAT:  The crop-mark motif — four L-shaped marks on the box corners, edges
 *        between them left open.
 * WHY:   A component AND a class, because both call sites are real: wrapping
 *        arbitrary children wants an element, while a component that already has
 *        its own root (a button, an input) only wants the class. Exposing one
 *        without the other would force a wrapper div into every button.
 *
 *        `tone="dark"` is not optional decoration — on an accent-filled surface
 *        the accent marks disappear into the fill, so the variant exists to keep
 *        the motif legible rather than to offer a choice.
 */
export function Bracketed({
  tone = "accent",
  size = "md",
  asChild = false,
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  tone?: "accent" | "dark" | undefined;
  size?: "md" | "lg" | undefined;
  /** Apply the marks to the single child instead of a wrapper. */
  asChild?: boolean | undefined;
}) {
  const marks = cn(
    "brackets",
    tone === "dark" && "brackets-dark",
    size === "lg" && "brackets-lg",
  );

  if (asChild && React.isValidElement<{ className?: string }>(children)) {
    return React.cloneElement(children, {
      className: cn(marks, children.props.className, className),
    });
  }

  return (
    <div {...rest} className={cn(marks, className)}>
      {children}
    </div>
  );
}

export function TechSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return <div className={cn("tech-scope", className)}>{children}</div>;
}

export function TechLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return <span className={cn("tech-label", className)}>{children}</span>;
}

export function TechRule({ className }: { className?: string | undefined }) {
  return <hr className={cn("tech-hairline", className)} />;
}

/**
 * SOURCE OF TRUTH KEYWORDS: TechSection
 *
 * WHAT:  A band of the page: a small mono label, a large condensed heading, an
 *        optional mono intro, then content.
 * WHY:   Renders no fill and no marks. A section is defined by its space and its
 *        hairline, never by being boxed — boxing sections is precisely how this
 *        language turns into an admin dashboard.
 */
export function TechSection({
  index,
  label,
  title,
  description,
  intro,
  actions,
  children,
  className,
}: {
  /** A real ordinal in the page. Omitted rather than invented when meaningless. */
  index?: string | undefined;
  label?: string | undefined;
  title: string;
  /** Plain supporting line. */
  description?: string | undefined;
  /** Richer alternative to description, for emphasising a phrase in bold. */
  intro?: React.ReactNode | undefined;
  actions?: React.ReactNode | undefined;
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className={cn("flex flex-col gap-6", className)}>
      <TechRule />

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex max-w-2xl flex-col gap-3">
          {index ?? label ? (
            <span className="flex items-center gap-3">
              {index ? <TechLabel>{index}</TechLabel> : null}
              {label ? (
                <TechLabel className="text-foreground/70">{label}</TechLabel>
              ) : null}
            </span>
          ) : null}

          <h2 className="tech-display text-4xl sm:text-5xl">{title}</h2>

          {intro ? (
            <p className="tech-intro">{intro}</p>
          ) : description ? (
            /* Sans, not mono. Mono is for labels and numbers; a paragraph set in
               it is a terminal readout, which is slower to read. */
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>

        {actions}
      </div>

      {children}
    </section>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: TechPanel
 *
 * WHAT:  A module — surface fill, optional crop marks, square.
 * WHY:   `bracket` defaults ON because the panels that exist in this app are all
 *        genuine modules, but it is opt-out rather than forced: a panel that only
 *        groups two controls does not need registering, and turning the marks off
 *        is how a page keeps a few of them meaning something.
 */
export function TechPanel({
  bracket = true,
  interactive = false,
  selected = false,
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  bracket?: boolean | undefined;
  interactive?: boolean | undefined;
  selected?: boolean | undefined;
}) {
  return (
    <div
      {...rest}
      data-selected={selected ? "" : undefined}
      className={cn(
        "tech-surface-fill relative flex flex-col",
        bracket && "brackets",
        interactive && "cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: TechStat
 *
 * WHAT:  A figure worth reading at a glance: mono label above, large accent
 *        value below, centred in a bracketed module.
 * WHY:   Takes a real value and nothing else. The brief's warning about invented
 *        technical data is the binding constraint on this component — there is no
 *        prop for a decorative unit or a fake delta, because the moment one
 *        exists someone fills a row of them to balance a layout.
 */
export function TechStat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string | undefined;
}) {
  return (
    <TechPanel className={cn("items-center gap-2 px-6 py-7 text-center", className)}>
      <TechLabel>{label}</TechLabel>
      <span className="tech-display text-4xl text-[color:var(--ed-accent)]">
        {value}
      </span>
    </TechPanel>
  );
}

export function TechBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "tech-label bg-[color:var(--ed-surface-deep)] px-2 py-1 leading-none",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: TechButton
 *
 * WHAT:  The two actions this language has.
 * WHY:   PRIMARY is an accent fill with light marks — a solid instruction.
 *        SECONDARY is a different object: a low-contrast diagonal fill, a solid
 *        bottom bar, and two short tick marks at the upper corners only. It
 *        deliberately does NOT get crop marks, because a full set would make it
 *        read as a module rather than as a control, and the pair would stop being
 *        distinguishable at a glance.
 *
 *        Wraps the app's own Button so variants, sizing, disabled handling and
 *        focus all keep working — this changes the surface, not the control.
 */
export function TechButton({
  tone = "primary",
  accentBar = false,
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Button> & {
  tone?: "primary" | "secondary" | undefined;
  /** Secondary only: makes the bottom bar the accent rather than neutral. */
  accentBar?: boolean | undefined;
}) {
  const shared =
    "rounded-none font-condensed text-[0.8125rem] font-bold uppercase tracking-[0.04em]";

  if (tone === "secondary") {
    return (
      <span className="relative inline-flex">
        <Button
          {...rest}
          variant="ghost"
          className={cn(
            shared,
            "tech-stripe bg-[color:var(--ed-surface)] text-[color:var(--ed-ink)]",
            "hover:bg-[color:var(--ed-surface)]",
            /* The bar thickens on hover — the whole state change, no colour
               shift, because a second signal would make two objects move. */
            "border-b-[3px] hover:border-b-[5px]",
            accentBar
              ? "border-b-[color:var(--ed-accent)]"
              : "border-b-[color:#b9b9b9]",
            "transition-[border-bottom-width] duration-150",
            className,
          )}
        >
          {children}
          <span aria-hidden className="ml-2">
            →
          </span>
        </Button>

        {/* Two ticks at the upper corners only. Not a bracket set: a full frame
            would make a control look like a container. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 h-[6px] w-[1.5px] bg-[color:var(--ed-accent)]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-[6px] w-[1.5px] bg-[color:var(--ed-accent)]"
        />
      </span>
    );
  }

  return (
    <Button
      {...rest}
      className={cn(
        shared,
        "brackets brackets-dark bg-[color:var(--ed-accent)] text-white hover:bg-[color:var(--ed-accent)] hover:opacity-90",
        className,
      )}
    >
      {children}
    </Button>
  );
}

export function TechMeta({
  items,
  className,
}: {
  items: readonly { label: string; value: string }[];
  className?: string | undefined;
}) {
  return (
    <dl className={cn("flex flex-wrap items-center gap-x-6 gap-y-1", className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <dt className="tech-label">{item.label}</dt>
          <dd className="font-mono text-xs text-[color:var(--ed-ink)]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* The character set for the texture panel. Four glyphs, because a longer set
 * starts to look like content rather than like noise. */
const ASCII_GLYPHS = ["1", "$", "%", "#"] as const;

/**
 * SOURCE OF TRUTH KEYWORDS: TechAsciiPanel
 *
 * WHAT:  A dark panel filled with a dim monospace character field.
 * WHY:   The ONE texture in the design, and it earns its place by being the only
 *        one. Generated rather than an image so it costs no request and scales,
 *        and seeded deterministically so it does not reshuffle on every render —
 *        a texture that changes when React re-renders reads as a glitch.
 *
 *        `aria-hidden` and unselectable: it is decoration, and a screen reader
 *        announcing four hundred dollar signs is the worst outcome this file
 *        could produce.
 */
export function TechAsciiPanel({
  rows = 14,
  columns = 28,
  className,
}: {
  rows?: number | undefined;
  columns?: number | undefined;
  className?: string | undefined;
}) {
  const lines = React.useMemo(() => {
    /* A cheap deterministic hash rather than Math.random: same panel every
     * render, and identical between server and client so it cannot hydrate
     * differently than it was sent. */
    const out: string[] = [];
    for (let row = 0; row < rows; row++) {
      let line = "";
      for (let column = 0; column < columns; column++) {
        const seed = (row * 31 + column * 17 + row * column) % 11;
        line += seed < 5 ? " " : (ASCII_GLYPHS[seed % ASCII_GLYPHS.length] ?? " ");
      }
      out.push(line);
    }
    return out;
  }, [rows, columns]);

  return (
    <div
      aria-hidden
      className={cn(
        "select-none overflow-hidden bg-[#111315] p-5 font-mono text-[10px] leading-[1.35] text-[color:var(--ed-accent)]/35",
        className,
      )}
    >
      {lines.map((line, index) => (
        <div key={index} className="whitespace-pre">
          {line}
        </div>
      ))}
    </div>
  );
}
