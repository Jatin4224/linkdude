/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: AppDemo, DemoPhase, MARKETING_DEMO,
 *   MARKETING_HERO_POST, getSidebarNav, getNavIcon, POST_TONES, Spotlight,
 *   IntersectionObserver, parallax, hero demo, composer mock, queue, phase
 *   machine, prefers-reduced-motion, animate-caret, animate-shimmer,
 *   animate-line-in
 *
 * WHAT:  The hero's live product shot — a mock of the composer that types a
 *        topic, generates a post, and hands it to the schedule queue, on a loop.
 * WHY:   This replaced a static screenshot. A screenshot goes stale the day the
 *        UI changes and says nothing about what using the product feels like;
 *        the thing this page has to communicate is a LOOP (write, ship), and a
 *        loop is much easier to show than to describe. Every label in it is read
 *        from the same registries the real app uses — the sidebar comes from
 *        getSidebarNav(), the tone chips from POST_TONES, the generation counter
 *        from the free plan's real cap — so the demo cannot advertise a nav
 *        item, a tone or an allowance the app does not have.
 *
 *        It is presentational: role="img" plus one aria-label, so a screen
 *        reader is told there is a product shot here rather than being walked
 *        through a composer full of controls that do nothing.
 * WHERE: src/app/(marketing)/_components/hero.tsx.
 */

import * as React from "react";
import { CalendarCheckIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";

import { MARKETING_DEMO, MARKETING_HERO_POST } from "@/lib/config";
import {
  getRawResourceLimit,
  getResourceDefinition,
  getSidebarNav,
} from "@/lib/resources";
import { POST_TONES } from "@/lib/types";
import { getNavIcon } from "@/components/global/sidebar/nav-icons";
import { Spotlight } from "@/components/global/spotlight";
import { cn, initialsOf } from "@/lib/utils";

/**
 * SOURCE OF TRUTH KEYWORDS: DemoPhase
 *
 * WHAT:  The four stages the demo cycles through.
 * WHY:   A union rather than booleans: the stages are mutually exclusive, and a
 *        `isGenerating && !isWritten` pair is how a UI ends up in a state its
 *        author never drew. Keys MARKETING_DEMO.status / .hint, so a new stage
 *        without its copy is a build error.
 */
type DemoPhase = "typing" | "generating" | "written" | "queued";

/* Timings are the design's, in one block: the sequence is the only thing on this
 * page with a script, and reading it as a list is how you can tell whether it
 * will feel rushed. ~14 characters a second is about a fast typist. */
const TYPE_STEP_MS = 42;
const TYPE_CHARS_PER_STEP = 3;
const GENERATE_DELAY_MS = 420;
const GENERATE_MS = 1250;
const QUEUE_DELAY_MS = 3350;
const LOOP_HOLD_MS = 3600;
const LINE_STAGGER_MS = 130;

/* Only while the frame is near the top of the page, and never more than 70px —
 * a parallax that keeps accumulating turns into a layout bug halfway down. */
const PARALLAX_FACTOR = 0.11;
const PARALLAX_MAX_PX = 70;
const PARALLAX_UNTIL_PX = 1400;

const TOPIC = MARKETING_DEMO.topic;

/* Six rows, from the registry that builds the real sidebar. Flattened at module
 * scope because RESOURCES is static — there is nothing to recompute per render,
 * and per REQUEST it would be the same six strings every time. */
const DEMO_NAV = getSidebarNav()
  .flatMap((section) => section.items)
  .slice(0, 6);

/* The generation counter in the title bar, derived rather than typed: it is a
 * quota claim sitting in the most-looked-at element on the page. */
const GENERATION_CAP = getRawResourceLimit("aiGeneration", "free");
const GENERATION_UNIT =
  getResourceDefinition("aiGeneration").limit?.unit ?? "generations";

function generationLabel(spent: boolean): string {
  if (GENERATION_CAP === "unlimited") return `Unlimited ${GENERATION_UNIT}`;
  const remaining = spent ? GENERATION_CAP - 1 : GENERATION_CAP;
  return `${remaining} / ${GENERATION_CAP} ${GENERATION_UNIT} left`;
}

/* Tone labels are authored lowercase in POST_TONES because they are enum values
 * the model reads; the chip is the one place a human sees them. */
function toneLabel(tone: string): string {
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}

/* The accent treatment shared by the active sidebar row, the active tone chip,
 * the scheduled queue card and the armed schedule button. One constant because
 * "this is the selected thing" should look identical everywhere in the frame. */
const ACCENT_SURFACE =
  "bg-[color-mix(in_oklch,var(--acid-soft)_70%,transparent)] text-acid shadow-[inset_0_0_0_1px_color-mix(in_oklch,var(--acid)_28%,transparent)]";

export function AppDemo() {
  const reduceMotion = useReducedMotion();
  const frameRef = React.useRef<HTMLDivElement | null>(null);
  const parallaxRef = React.useRef<HTMLDivElement | null>(null);

  /* The FINAL state is the initial state, which is what the server renders and
   * what a reduced-motion or no-JS visitor keeps: a finished post, not an empty
   * box. The loop rewinds to `typing` on mount when motion is allowed. */
  const [phase, setPhase] = React.useState<DemoPhase>("written");
  const [typed, setTyped] = React.useState(TOPIC.length);
  const [visible, setVisible] = React.useState(false);

  const running = visible && !reduceMotion;

  /* Only run while the frame is on screen. A four-stage loop with a 1.1s
   * shimmer in it has no business burning frames behind the fold, and on a
   * phone that is most of the page.
   *
   * No fallback for a missing IntersectionObserver, unlike Reveal. There, not
   * running means invisible content and something has to rescue it; here, not
   * running means the demo simply keeps the finished post it rendered with —
   * which is the state we WANT a browser that old to see. The guard exists only
   * so `new IntersectionObserver` cannot throw. */
  React.useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => setVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* Rewind to the start of the loop the first time the frame is both visible and
   * allowed to move. Guarded by a ref so scrolling the hero out and back does
   * not restart the sequence from the beginning under the reader. */
  const started = React.useRef(false);
  React.useEffect(() => {
    if (!running || started.current) return;
    started.current = true;
    setPhase("typing");
    setTyped(0);
  }, [running]);

  /* Phase 1 — the topic types itself in. A functional update keeps this effect
   * off the `typed` dependency, so the interval is created once per phase rather
   * than being torn down and rebuilt on every character. */
  React.useEffect(() => {
    if (!running || phase !== "typing") return;
    const id = window.setInterval(() => {
      setTyped((n) => Math.min(n + TYPE_CHARS_PER_STEP, TOPIC.length));
    }, TYPE_STEP_MS);
    return () => window.clearInterval(id);
  }, [running, phase]);

  /* Every stage change in one place, so the sequence can be read top to bottom.
   * Each branch returns its own cleanup — leaving a timer behind here is how a
   * loop like this ends up running two copies of itself after a fast scroll. */
  React.useEffect(() => {
    if (!running) return;

    if (phase === "typing") {
      if (typed < TOPIC.length) return;
      const id = window.setTimeout(
        () => setPhase("generating"),
        GENERATE_DELAY_MS,
      );
      return () => window.clearTimeout(id);
    }

    if (phase === "generating") {
      const id = window.setTimeout(() => setPhase("written"), GENERATE_MS);
      return () => window.clearTimeout(id);
    }

    if (phase === "written") {
      const id = window.setTimeout(() => setPhase("queued"), QUEUE_DELAY_MS);
      return () => window.clearTimeout(id);
    }

    const id = window.setTimeout(() => {
      setTyped(0);
      setPhase("typing");
    }, LOOP_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [running, phase, typed]);

  /* Parallax. Written straight to style.transform on an animation frame rather
   * than through state: this fires on every scroll event, and a setState per
   * frame would re-render the entire demo subtree while the reader is moving. */
  React.useEffect(() => {
    if (reduceMotion) return;
    const node = parallaxRef.current;
    if (!node) return;

    let frame = 0;
    function apply() {
      frame = 0;
      if (!node) return;
      const y = window.scrollY;
      const offset =
        y < PARALLAX_UNTIL_PX
          ? Math.min(y * PARALLAX_FACTOR, PARALLAX_MAX_PX)
          : PARALLAX_MAX_PX;
      node.style.transform = `translate3d(0, ${offset}px, 0)`;
    }

    function onScroll() {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(apply);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    apply();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
      node.style.transform = "";
    };
  }, [reduceMotion]);

  const generated = phase === "written" || phase === "queued";
  const queued = phase === "queued";
  const hint = MARKETING_DEMO.hint[phase];

  return (
    <div
      ref={parallaxRef}
      role="img"
      aria-label={`A preview of the ${MARKETING_DEMO.addressBar} composer: a topic is typed in, written up as a LinkedIn post, and scheduled for ${MARKETING_DEMO.scheduleLabel}.`}
      /* Bleeds to the column rails and overlaps the section hairline by 1px, so
         the frame is cut off by the page's own grid rather than floating inside
         it — that is what makes it read as a window into the app. */
      className="-mx-(--gutter) -mb-px mt-[clamp(36px,5.5vw,72px)]"
    >
      <Spotlight
        className="rounded-b-none rounded-t-[18px] border border-b-0 border-border bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--card)_90%,oklch(1_0_0)),var(--card)_42%)] p-[13px] shadow-[inset_0_1px_0_color-mix(in_oklch,oklch(1_0_0)_14%,transparent),0_50px_130px_-50px_color-mix(in_oklch,var(--brand)_46%,transparent)] [--spot-color:color-mix(in_oklch,var(--acid)_11%,transparent)] [--spot-size:21.25rem]"
      >
        <div ref={frameRef}>
          {/* Title bar */}
          <div className="mb-[13px] flex items-center gap-3 px-1">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-[9px] rounded-full bg-rail"
                />
              ))}
            </div>
            <p className="flex-1 text-center font-mono text-[11px] text-dim">
              {MARKETING_DEMO.addressBar}
            </p>
            <p className="font-mono text-[11px] tabular-nums text-dim">
              {generationLabel(generated)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-[13px] lg:grid-cols-[minmax(0,190px)_minmax(0,2fr)_minmax(0,260px)]">
            <DemoSidebar />
            <DemoComposer
              typed={typed}
              phase={phase}
              generated={generated}
              queued={queued}
              hint={hint}
            />
            <DemoQueue queued={queued} />
          </div>
        </div>
      </Spotlight>
    </div>
  );
}

/* ---------- panels ---------- */

function DemoSidebar() {
  return (
    <div className="hidden rounded-[13px] bg-[oklch(0.015_0_0)] p-2 lg:block">
      {DEMO_NAV.map((item, index) => {
        const Icon = getNavIcon(item.icon);
        /* The first row is the one the demo is "on" — the composer beside it. */
        const active = index === 0;
        return (
          <div
            key={item.key}
            className={cn(
              "flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 font-mono text-[11px]",
              active ? ACCENT_SURFACE : "text-dim",
            )}
          >
            <Icon className="size-[15px] shrink-0" />
            <span className="truncate">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}

interface DemoComposerProps {
  typed: number;
  phase: DemoPhase;
  generated: boolean;
  queued: boolean;
  hint: string;
}

function DemoComposer({
  typed,
  phase,
  generated,
  queued,
  hint,
}: DemoComposerProps) {
  return (
    <div className="flex flex-col gap-3 rounded-[13px] bg-[oklch(0.015_0_0)] p-3">
      {/* Topic input */}
      <div className="relative min-h-11 overflow-hidden rounded-[11px] border border-border px-3.5 py-3">
        <p className="font-mono text-[12.5px] leading-relaxed text-foreground">
          {TOPIC.slice(0, typed)}
          {phase === "typing" ? (
            <span className="animate-caret ml-0.5 inline-block h-[1.1em] w-0.5 translate-y-[3px] bg-acid" />
          ) : null}
        </p>
        {phase === "generating" ? (
          <span
            aria-hidden="true"
            className="animate-shimmer pointer-events-none absolute inset-y-0 left-0 w-full bg-[linear-gradient(100deg,transparent_20%,color-mix(in_oklch,var(--acid)_18%,transparent),transparent_80%)]"
          />
        ) : null}
      </div>

      {/* Tone chips — the real enum the generator accepts. */}
      <div className="flex flex-wrap gap-1.5">
        {POST_TONES.map((tone, index) => (
          <span
            key={tone}
            className={cn(
              "rounded-[7px] px-2.5 py-1.5 font-mono text-[10.5px]",
              index === 0
                ? ACCENT_SURFACE
                : "border border-border text-dim",
            )}
          >
            {toneLabel(tone)}
          </span>
        ))}
      </div>

      {/* Post area. The min-height is load-bearing: it reserves the tallest
          state so the frame never changes size as the sequence runs, which would
          push the whole page around on a loop. */}
      <div className="flex min-h-58 flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-brand-soft font-medium text-[13px] text-brand-soft-foreground">
            {initialsOf(MARKETING_HERO_POST.authorName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">
              {MARKETING_HERO_POST.authorName}
            </p>
            <p
              className={cn(
                "font-mono text-[10px]",
                queued ? "text-acid" : "text-dim",
              )}
            >
              {MARKETING_DEMO.status[phase]}
            </p>
          </div>
        </div>

        {phase === "generating" ? (
          <div className="flex flex-col gap-2.5 pt-1">
            {[88, 100, 72, 54].map((width, index) => (
              <span
                key={width}
                style={{ width: `${width}%` }}
                className={cn(
                  "h-3 rounded-full",
                  index === 3
                    ? "bg-[color-mix(in_oklch,var(--acid)_30%,transparent)]"
                    : "bg-muted",
                )}
              />
            ))}
          </div>
        ) : null}

        {generated ? (
          <div className="flex flex-col gap-2.5">
            {MARKETING_HERO_POST.paragraphs.map((line, index) => {
              /* The stagger is a CSS variable rather than an inline
                 animation-delay so the keyframe stays in globals.css with the
                 rest of the motion. */
              const style: React.CSSProperties & { "--line-delay": string } = {
                "--line-delay": `${index * LINE_STAGGER_MS}ms`,
              };
              return (
                <p
                  key={line}
                  style={style}
                  className="animate-line-in text-[13.5px] leading-[1.66] text-muted-foreground"
                >
                  {line}
                </p>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Action row. Divs, not buttons — see the file header on why the demo
          stays out of the a11y tree as a set of controls. */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-[9px] px-3.5 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.05em] transition-colors duration-[320ms] ease-out",
            queued
              ? "bg-[color-mix(in_oklch,var(--muted)_70%,transparent)] text-dim"
              : "bg-acid text-acid-foreground",
          )}
        >
          Publish
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-[9px] px-3 py-2 font-mono text-[11px] transition-colors duration-[320ms] ease-out",
            queued ? ACCENT_SURFACE : "border border-border text-dim",
          )}
        >
          <CalendarCheckIcon className="size-[13px]" />
          {MARKETING_DEMO.scheduleLabel}
        </span>
        {hint ? (
          <span className="ml-auto font-mono text-[10.5px] text-dim">
            {hint}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function DemoQueue({ queued }: { queued: boolean }) {
  return (
    <div className="hidden flex-col gap-2.5 rounded-[13px] bg-[oklch(0.015_0_0)] p-3 lg:flex">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium">Queue</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-dim">
          Next 7 days
        </p>
      </div>
      {MARKETING_DEMO.queue.map((item, index) => {
        /* The first card is the one the composer hands off to, so it lights up
           at the same moment the schedule button does. */
        const lit = queued && index === 0;
        return (
          <div
            key={item.time}
            className={cn(
              "rounded-[10px] px-2.5 py-2.5 transition-colors duration-[380ms] ease-out",
              lit
                ? ACCENT_SURFACE
                : "bg-[color-mix(in_oklch,var(--card)_65%,transparent)]",
            )}
          >
            <p
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.08em]",
                lit ? "text-acid" : "text-dim",
              )}
            >
              {item.time}
            </p>
            <p className="mt-1 truncate text-[11.5px]">{item.title}</p>
          </div>
        );
      })}
    </div>
  );
}
