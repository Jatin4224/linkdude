/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ProductTourMock, TOUR_DESIGN, data-tour, TourNodeKey,
 *   macOS window, traffic lights, title bar, icon rail, mac-window, fixed design
 *   size, decorative mock, aria-hidden
 *
 * WHAT:  The product the camera flies around — one 1200×740 drawing of the app,
 *        inside a dark macOS window, with all five surfaces on screen at once:
 *        the composer, the voice profile, the draft, the month calendar and the
 *        profile analysis.
 *
 * WHY:   IT IS A NATIVE WINDOW, NOT A BROWSER. Rounded corners, a hairline a
 *        shade lighter than the fill, the three traffic lights at the top left,
 *        a sidebar toggle, the app's name, and line-style window actions at the
 *        right — and no address bar, no tabs, no Windows caption buttons. The
 *        window is the first thing the visitor ever sees of this section: its
 *        title bar is the strip peeking under the hero before a single scroll,
 *        so the dots and the name carry the whole promise that something else is
 *        down there.
 *
 *        THE DOTS AND THE BAR ARE REAL ELEMENTS, never an image. The camera
 *        scales this window from 98% of the viewport down to a third of it and
 *        back; a raster title bar would be soft at one end of that range and
 *        blurry at the other, and the peek pose — where the bar is almost the
 *        only thing on screen — is the largest it ever gets.
 *
 *        ABSOLUTELY POSITIONED IN DESIGN PIXELS, EVERY ONE OF THEM. The panes
 *        are at the exact coordinates TOUR_RECTS was measured against, so a stop
 *        frames what it says it frames. This is the one file in the app where
 *        hard pixel offsets are correct rather than a smell: the window has a
 *        FIXED size and is only ever scaled, so it never reflows, never re-wraps
 *        a line mid-zoom, and is identical on a phone and a 4K monitor.
 *
 *        THE COMPOSER AND THE VOICE PROFILE SHARE A COLUMN AND A HEIGHT. That is
 *        the mock's one piece of load-bearing composition: the tour's first
 *        movement pans straight down from one to the other at a single zoom,
 *        which only reads as a pan if the two panels are the same size in the
 *        same column. Moving either breaks the choreography, not just the
 *        layout.
 *
 *        ITS PALETTE IS macOS'S, NOT THIS APP'S — see the `--mac-*` tokens in
 *        globals.css for why that is deliberate rather than an oversight. The
 *        type is the system UI stack at 12–13px so it reads as a native app;
 *        the captions outside the window keep the site's own families, and that
 *        contrast is the point. The brand accent appears only on the active row,
 *        the primary button and the status dots.
 *
 *        IT IS DECORATIVE AND SAYS SO. `aria-hidden` on the root, every control
 *        a span, no focus stop anywhere inside: a screen reader gets the
 *        captions, which carry the same four claims in real text.
 *
 *        NOTHING HERE IS STATEFUL. Every value the tour animates is written
 *        straight to the DOM by the renderer through a `data-tour` handle, so
 *        this component renders exactly once. The server HTML is the tour's
 *        FINISHED state, which is what a visitor whose JavaScript never arrives
 *        sees.
 * WHERE: src/app/(marketing)/_components/product-tour/product-tour.tsx.
 */

import type * as React from "react";

import {
  LINKEDIN_MAX_COMMENTARY,
  MARKETING_COMPOSER,
  MARKETING_COMPOSER_CONTROLS,
  MARKETING_COMPOSER_RECENT,
  MARKETING_FEATURES,
  MARKETING_PROFILE_ROWS,
  MARKETING_PROFILE_SCORE,
  MARKETING_TOUR,
  TOUR_CALENDAR,
  TOUR_DESIGN,
  TOUR_DRAFT,
} from "@/lib/config";
import { getRawResourceLimit } from "@/lib/resources";
import { cn } from "@/lib/utils";

/* The generations readout, from the real free-plan cap — the same derivation
 * ComposerShowcase uses, so the two panels cannot advertise different quotas. */
const FREE_GENERATIONS = getRawResourceLimit("aiGeneration", "free");
const GENERATION_TOTAL =
  FREE_GENERATIONS === "unlimited" ? null : FREE_GENERATIONS;

/* The posts the voice profile was trained on. Reuses the composer's recent list
 * rather than inventing a second one. */
const VOICE_SOURCES = MARKETING_COMPOSER_RECENT.slice(0, 2);

/* The hard numbers a feature row already publishes — the page size the carousel
 * really rasterises, and so on. Read from MARKETING_FEATURES rather than typed
 * again, so the mock cannot claim a dimension the feature band contradicts. */
function featureMeta(artifact: string) {
  return (
    MARKETING_FEATURES.find((feature) => feature.artifact === artifact)?.meta ?? []
  );
}

/* ---------- the window's geometry, in design pixels ----------
 * The title bar is 40px, the icon rail 52 and the nav 148, which puts the
 * content column's left edge at 200 — the x TOUR_RECTS is measured from. */
const BAR = 40;
const RAIL = 52;
const NAV = 148;
const COL = RAIL + NAV; // 200

/* The box every screen fills. Derived from the chrome above it rather than
 * written again, so moving the rail or the nav moves all six screens with it. */
const CONTENT_W = TOUR_DESIGN.width - COL;
const CONTENT_H = TOUR_DESIGN.height - BAR;

/**
 * The screen shell: all six occupy the same box and are crossfaded.
 *
 * ONE SCENE IS VISIBLE BY DEFAULT, AND THAT IS ENFORCED HERE rather than left
 * to the renderer. Every screen is stacked in the same box, so "all of them at
 * opacity 1" is a legible, badly-broken picture — the composer, the calendar,
 * the score ring and the deck drawn through each other. That is precisely what
 * the page showed before hydration, when nothing had written an opacity yet.
 * Defaulting them to hidden means the worst case is a missing screen rather
 * than six overlapping ones, at first paint and if the renderer ever fails.
 */
const SCREEN = "absolute flex flex-col opacity-0";

/** The one screen that may be visible before JS has decided — the first stop's. */
const SCREEN_FIRST = "absolute flex flex-col";

/* The body of a screen that is not the composer. CENTRED in whatever the
 * header leaves, because these five each draw one artifact rather than filling
 * a workspace — top-aligned they left the lower half of the window empty, which
 * reads as a screen that failed to load rather than as a focused tool. */
const SCREEN_BODY = "flex flex-1 flex-col justify-center";
const SCREEN_BOX: React.CSSProperties = {
  top: BAR,
  left: COL,
  width: CONTENT_W,
  height: CONTENT_H,
};

/** A pane's own header row. Compact, like a macOS source-list header. */
const PANE_HEAD =
  "flex h-[34px] items-center justify-between gap-2 border-b border-[var(--mac-line)] px-3.5";

/** The mono-ish micro label macOS uses for section headers. */
const CAP = "text-[10.5px] font-medium uppercase tracking-[0.08em]";

const ROW = "rounded-[var(--mac-radius-row)]";

const ROOT_STYLE: React.CSSProperties = {
  width: TOUR_DESIGN.width,
  height: TOUR_DESIGN.height,
};

/* The score ring's circumference, from its own radius — so the arc's dash
 * length and the circle it is drawn on can never disagree. */
const RING_RADIUS = 30;
export const TOUR_RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** The three macOS window dots, in order, with their exact system colours. */
const TRAFFIC = [
  "var(--mac-red)",
  "var(--mac-yellow)",
  "var(--mac-green)",
] as const;

export function ProductTourMock() {
  return (
    <div
      aria-hidden="true"
      style={ROOT_STYLE}
      className="mac-window relative overflow-hidden text-[12.5px] leading-[1.45]"
    >
      {/* ---------- the title bar ---------- */}
      {/* No divider under it: macOS runs the bar into the content and lets the
          SIDEBAR's vertical hairline continue up through it, which is the one
          detail that most says "native window" rather than "web page header". */}
      <div
        data-tour="chrome"
        className="absolute inset-x-0 top-0 flex items-center"
        style={{ height: BAR }}
      >
        {/* The traffic lights. 12px, 8px apart, 16px in from the edge. */}
        <span className="flex items-center gap-2 pl-4">
          {TRAFFIC.map((colour) => (
            <span
              key={colour}
              className="size-3 rounded-full"
              style={{ background: colour }}
            />
          ))}
        </span>

        {/* The sidebar toggle, then the workspace name. */}
        <span className="ml-4 flex items-center gap-2.5">
          <svg viewBox="0 0 16 16" className="size-[15px]">
            <rect
              x="1.5"
              y="2.5"
              width="13"
              height="11"
              rx="2.5"
              fill="none"
              stroke="var(--mac-dim)"
              strokeWidth="1.2"
            />
            <line
              x1="6.5"
              y1="2.5"
              x2="6.5"
              y2="13.5"
              stroke="var(--mac-dim)"
              strokeWidth="1.2"
            />
          </svg>
          <span className="text-[12.5px] font-medium text-[var(--mac-ink)]">
            {MARKETING_COMPOSER.title}
          </span>
        </span>

        {/* The content pane's own title, past the sidebar's hairline — the
            split macOS draws through its toolbar. */}
        <span
          className="ml-auto flex h-full items-center gap-3.5 border-l border-[var(--mac-line)] pr-4 pl-4"
          style={{ width: TOUR_DESIGN.width - COL }}
        >
          {GENERATION_TOTAL === null ? null : (
            <span
              data-tour="generations"
              className="ml-auto text-[11px] text-[var(--mac-faint)] tabular-nums"
            >
              {`${String(GENERATION_TOTAL)} / ${String(GENERATION_TOTAL)} generations left`}
            </span>
          )}

          {/* Window actions: small, muted, line-style. Never Windows buttons. */}
          <span className="flex items-center gap-3">
            {["M3 8h10M8 3v10", "M2 4h12M2 8h12M2 12h9"].map((d) => (
              <svg key={d} viewBox="0 0 16 16" className="size-[14px]">
                <path
                  d={d}
                  fill="none"
                  stroke="var(--mac-faint)"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            ))}
            <span className="flex size-[22px] items-center justify-center rounded-full bg-brand text-[9.5px] font-semibold text-brand-foreground">
              {MARKETING_COMPOSER.authorInitials}
            </span>
          </span>
        </span>
      </div>

      {/* ---------- the icon rail ---------- */}
      {/* A shade off the window fill, the way a macOS source list is. */}
      <div
        data-tour="sidebar"
        className="absolute left-0 flex flex-col items-center gap-2 bg-[var(--mac-rail)] pt-2.5"
        style={{ top: BAR, width: RAIL, height: TOUR_DESIGN.height - BAR }}
      >
        {MARKETING_TOUR.sidebar.slice(0, 5).map((item) => (
          <span
            key={item}
            data-tour-item="railRow"
            className={cn("flex size-[30px] items-center justify-center", ROW)}
          >
            <span className="size-[6px] rounded-full bg-[var(--mac-line)]" />
          </span>
        ))}
      </div>

      {/* ---------- the nav list ---------- */}
      {/* THE ROWS ARE HANDLES. Which one is lit is a function of scroll, not of
          markup: the tour navigates, so the active row moves with the screen in
          the content area. Each row carries a filled backdrop that fades in
          over it, so lighting one is a pure opacity write and the row's height
          never changes. */}
      <div
        className="absolute flex flex-col gap-0.5 border-l border-[var(--mac-line)] px-2 pt-2.5"
        style={{ top: BAR, left: RAIL, width: NAV, height: TOUR_DESIGN.height - BAR }}
      >
        <span className={cn(CAP, "px-2 pb-1.5 text-[var(--mac-faint)]")}>
          {MARKETING_COMPOSER.title}
        </span>
        {MARKETING_TOUR.sidebar.map((item) => (
          <span
            key={item}
            data-tour-item="navRow"
            data-nav={item}
            className={cn(
              "relative flex h-[26px] items-center gap-2 px-2 text-[12px] text-[var(--mac-dim)]",
              ROW,
            )}
          >
            <span
              data-tour-item="navFill"
              className={cn("absolute inset-0 bg-[var(--mac-row)] opacity-0", ROW)}
            />
            <span className="relative size-[5px] flex-none rounded-full bg-[var(--mac-line)]" />
            <span className="relative">{item}</span>
          </span>
        ))}
      </div>


      {/* ================= the content area =================
          SIX SCREENS, STACKED AND CROSSFADED. Each fills the same box, is
          absolutely positioned, and is switched by opacity alone — so the
          window never reflows as the tour navigates, and the two tight stops
          can keep framing fixed rectangles of the `create` screen while the
          other five swap underneath the same camera. */}

      {/* ---------- create: composer, voice profile, draft ----------
          The composer and the voice profile share this screen AND this column
          on purpose: the tour's opening movement is a pan straight down from
          one to the other at a single zoom, which only works if they are the
          same width in the same place. TOUR_RECTS is measured against them. */}
      <div data-tour-screen="create" className={SCREEN_FIRST} style={SCREEN_BOX}>
        <section
          data-tour="paneCompose"
          className="absolute top-0 left-0 h-[286px] w-[380px]"
        >
          <div className={PANE_HEAD}>
            <span className={cn(CAP, "text-[var(--mac-ink)]")}>
              {MARKETING_COMPOSER.sourceTabs[0]}
            </span>
            <span className={cn(CAP, "text-[var(--mac-faint)]")}>
              {MARKETING_COMPOSER.sourceTabs[1]}
            </span>
          </div>

          <span className={cn(CAP, "absolute top-[46px] left-3.5 text-[var(--mac-faint)]")}>
            {MARKETING_COMPOSER.topicLabel}
          </span>

          <div
            className={cn(
              "absolute top-[66px] right-3.5 left-3.5 h-[66px] border border-[var(--mac-line)] bg-[var(--mac-raised)] px-3 py-2.5 text-[12px] leading-snug",
              ROW,
            )}
          >
            <span data-tour="typed">{TOUR_DRAFT.topic}</span>
            <span
              data-tour="caret"
              className="ml-px inline-block h-[13px] w-px bg-brand align-[-2px]"
            />
            <span data-tour="placeholder" className="text-[var(--mac-faint)]">
              {MARKETING_TOUR.topicPlaceholder}
            </span>
          </div>

          <div className="absolute top-[144px] left-3.5 flex gap-1.5">
            {MARKETING_COMPOSER_CONTROLS.map((control) => (
              <span
                key={control.label}
                className={cn(
                  "flex h-[24px] items-center gap-1.5 border border-[var(--mac-line)] px-2.5 text-[11px]",
                  ROW,
                )}
              >
                <span className="text-[var(--mac-faint)]">{control.label}</span>
                <span className="text-[var(--mac-ink)]">{control.value}</span>
              </span>
            ))}
          </div>

          <span
            data-tour="generate"
            className={cn(
              "absolute top-[182px] left-3.5 flex h-[32px] w-[150px] items-center justify-center bg-brand text-[12px] font-medium text-brand-foreground",
              ROW,
            )}
          >
            {MARKETING_COMPOSER.generateLabel}
          </span>
        </section>

        <section
          data-tour="paneVoice"
          className="absolute top-[286px] left-0 h-[414px] w-[380px] border-t border-[var(--mac-line)]"
        >
          <div className={PANE_HEAD}>
            <span className={cn(CAP, "text-[var(--mac-ink)]")}>
              {MARKETING_TOUR.voiceTitle}
            </span>
          </div>

          <div
            className={cn(
              "mx-3.5 mt-3 border border-[var(--mac-line)] bg-[var(--mac-raised)] p-3",
              ROW,
            )}
          >
            <div className="flex items-baseline justify-between gap-2.5 border-b border-[var(--mac-line)] pb-2.5">
              <span className="text-[11.5px] text-[var(--mac-dim)]">
                {MARKETING_TOUR.voiceTrainedLabel}
              </span>
              <span className="text-[11.5px] tabular-nums">
                <span data-tour="trained">
                  {String(MARKETING_TOUR.voiceTrainedCount)}
                </span>{" "}
                {MARKETING_TOUR.voiceTrainedUnit}
              </span>
            </div>

            {/* Two states of one box, stacked: the empty outline is always drawn
                and the filled mark fades in over it, so a tick is a pure
                opacity write and the row never changes height. */}
            <ul className="m-0 mt-2.5 flex list-none flex-col gap-1 p-0">
              {TOUR_DRAFT.traits.map((trait) => (
                <li
                  key={trait}
                  className={cn(
                    "flex h-[28px] items-center gap-2.5 bg-[var(--mac-window)] px-2.5 text-[12px]",
                    ROW,
                  )}
                >
                  <span className="relative flex size-[15px] flex-none items-center justify-center rounded-[4px] border border-[var(--mac-line)]">
                    <span
                      data-tour-item="tick"
                      className="absolute inset-0 flex items-center justify-center rounded-[4px] bg-brand text-brand-foreground opacity-0"
                    >
                      <svg viewBox="0 0 10 10" className="size-[8px]">
                        <path
                          d="M1.5 5.2 4 7.6 8.5 2.6"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                        />
                      </svg>
                    </span>
                  </span>
                  {trait}
                </li>
              ))}
            </ul>

            <span className={cn(CAP, "mt-2.5 block text-[var(--mac-faint)]")}>
              {MARKETING_TOUR.voiceAppliedLabel}
            </span>
          </div>

          <div className="mx-3.5 mt-3 flex flex-col gap-2">
            {VOICE_SOURCES.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-0.5 border-t border-[var(--mac-line)] pt-2"
              >
                <span className="text-[11.5px] leading-snug">{item.title}</span>
                <span className={cn(CAP, "text-[var(--mac-faint)]")}>{item.when}</span>
              </div>
            ))}
          </div>
        </section>

        <section
          data-tour="panePost"
          className="absolute top-0 left-[380px] h-full w-[620px] border-l border-[var(--mac-line)] bg-[var(--mac-raised)]"
        >
          <div className={PANE_HEAD}>
            <span className={cn(CAP, "text-[var(--mac-ink)]")}>Preview</span>
            <span
              data-tour="characters"
              className="text-[10.5px] text-[var(--mac-faint)] tabular-nums"
            >
              {`${String(TOUR_DRAFT.charactersAfter)} / ${String(LINKEDIN_MAX_COMMENTARY)}`}
            </span>
          </div>

          <div
            className={cn(
              "relative mx-5 mt-4 min-h-[300px] border border-[var(--mac-line)] bg-[var(--mac-window)] p-4",
              ROW,
            )}
          >
            <span
              data-tour="draftEmpty"
              className="absolute inset-0 grid place-items-center px-10 text-center text-[12px] text-[var(--mac-faint)]"
            >
              {MARKETING_TOUR.draftEmpty}
            </span>

            <div data-tour="draftHead" className="mb-3 flex items-center gap-2.5">
              <span className="flex size-[32px] flex-none items-center justify-center rounded-full bg-brand text-[10.5px] font-semibold text-brand-foreground">
                {MARKETING_COMPOSER.authorInitials}
              </span>
              <div className="min-w-0">
                <p className="m-0 text-[12px] leading-tight font-medium">
                  {MARKETING_COMPOSER.authorName}
                </p>
                <span className="text-[10.5px] text-[var(--mac-faint)]">
                  {MARKETING_COMPOSER.postedMeta}
                </span>
              </div>
              <span
                data-tour="voiceBadge"
                className={cn(
                  "ml-auto bg-brand px-2 py-[3px] text-[10px] font-medium text-brand-foreground",
                  ROW,
                )}
              >
                {MARKETING_TOUR.voiceBadge}
              </span>
            </div>

            {/* Two of the four lines carry a SWAP — the voice-profile version
                stacked on the generated one in the same grid cell, so the
                rewrite crossfades in place without the paragraph below it
                moving. The highlight is driven by --tour-lit. */}
            <div className="flex flex-col gap-2">
              {TOUR_DRAFT.lines.map((line, index) => {
                const rewrite = TOUR_DRAFT.rewrites.find((e) => e.line === index);
                return (
                  <p
                    key={line}
                    data-tour-item="line"
                    className={cn(
                      "relative m-0 -mx-1 px-1 text-[12.5px] leading-normal",
                      "bg-[color-mix(in_oklab,var(--brand)_calc(var(--tour-lit,0)*45%),transparent)]",
                      ROW,
                    )}
                  >
                    {rewrite ? (
                      <span className="grid">
                        <span data-tour-item="swapOld" className="col-start-1 row-start-1">
                          {line}
                        </span>
                        <span data-tour-item="swapNew" className="col-start-1 row-start-1">
                          {rewrite.text}
                        </span>
                      </span>
                    ) : index === TOUR_DRAFT.emojiLine ? (
                      <>
                        {line}
                        <span data-tour="emoji">{TOUR_DRAFT.emoji}</span>
                      </>
                    ) : (
                      line
                    )}
                  </p>
                );
              })}
            </div>

            <div
              data-tour="draftFoot"
              className="mt-3 flex items-center gap-3 border-t border-[var(--mac-line)] pt-2.5 text-[10.5px] text-[var(--mac-faint)]"
            >
              {MARKETING_COMPOSER.postActions.slice(0, 3).map((action) => (
                <span key={action}>{action}</span>
              ))}
            </div>
          </div>

          <div className="mt-3 mr-5 flex justify-end gap-2">
            <span
              className={cn(
                "flex h-[30px] items-center border border-[var(--mac-line)] px-3 text-[11.5px] text-[var(--mac-dim)]",
                ROW,
              )}
            >
              {MARKETING_COMPOSER.saveLabel}
            </span>
            <span
              data-tour="schedule"
              className={cn(
                "flex h-[30px] min-w-[96px] items-center justify-center bg-brand px-3.5 text-[11.5px] font-medium text-brand-foreground",
                ROW,
              )}
            >
              {MARKETING_TOUR.scheduleLabel}
            </span>
          </div>
        </section>
      </div>

      {/* ---------- carousels: the deck turns its pages ---------- */}
      <div data-tour-screen="carousel" className={SCREEN} style={SCREEN_BOX}>
        <div className={PANE_HEAD}>
          <span className={cn(CAP, "text-[var(--mac-ink)]")}>
            {MARKETING_TOUR.carousel.title}
          </span>
          <span className="text-[11px] text-[var(--mac-faint)] tabular-nums">
            <span data-tour="deckPage">01</span> /{" "}
            <span data-tour="deckTotal">
              {String(MARKETING_TOUR.carousel.pages).padStart(2, "0")}
            </span>
          </span>
        </div>

        {/* Three pages at the ratio the renderer really rasterises, side by
            side. The deck advances by lighting the next one rather than by
            sliding a track — a transform on a row of cards would move the two
            that are not changing, which reads as the whole deck lurching. */}
<div className={SCREEN_BODY}>
        <div className="flex items-start gap-5 px-8 pt-8">
          {MARKETING_TOUR.carousel.slides.map((slide, index) => (
            <div
              key={slide}
              data-tour-item="slide"
              className={cn(
                "flex aspect-[1080/1350] w-[200px] flex-col justify-between border border-[var(--mac-line)] bg-[var(--mac-raised)] p-4",
                ROW,
              )}
            >
              <span className={cn(CAP, "text-[var(--mac-faint)]")}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[15px] leading-tight font-medium">{slide}</span>
              <span className="h-[3px] w-10 bg-brand" />
            </div>
          ))}
        </div>

        <div className="mt-7 flex items-center gap-3 px-8">
          <span
            className={cn(
              "bg-brand px-2.5 py-[5px] text-[10.5px] font-medium text-brand-foreground",
              ROW,
            )}
          >
            {MARKETING_TOUR.carousel.outputLabel}
          </span>
          {featureMeta("carousel").map((meta) => (
            <span key={meta.label} className="text-[11px] text-[var(--mac-faint)]">
              {meta.label} <span className="text-[var(--mac-dim)]">{meta.value}</span>
            </span>
          ))}
        </div>
</div>
      </div>

      {/* ---------- studio: the avatar drops into the banner ---------- */}
      <div data-tour-screen="studio" className={SCREEN} style={SCREEN_BOX}>
        <div className={PANE_HEAD}>
          <span className={cn(CAP, "text-[var(--mac-ink)]")}>
            {MARKETING_TOUR.studio.title}
          </span>
          <span className="text-[11px] text-[var(--mac-faint)]">
            {MARKETING_TOUR.studio.label}
          </span>
        </div>

<div className={SCREEN_BODY}>
        <div className="flex gap-2 px-8 pt-6">
          {MARKETING_TOUR.studio.presets.map((preset) => (
            <span
              key={preset}
              data-tour-item="preset"
              className={cn(
                "border border-[var(--mac-line)] px-3 py-[5px] text-[11px] text-[var(--mac-dim)]",
                ROW,
              )}
            >
              {preset}
            </span>
          ))}
        </div>

        {/* The banner at the size the renderer draws it, with the hole LinkedIn
            punches in its lower edge — which is the reason this surface exists,
            and so the reason the avatar DROPS the last few pixels into it. */}
        <div className="px-8 pt-5">
          <div
            data-tour="studioBanner"
            className={cn(
              "flex aspect-[1584/396] items-center border border-[var(--mac-line)] bg-[var(--mac-raised)] px-7",
              ROW,
            )}
          >
            <span className="text-[26px] leading-none font-semibold tracking-[-0.02em]">
              {MARKETING_TOUR.studio.bannerLine}
            </span>
          </div>

          <div className="-mt-9 flex flex-col gap-2 pl-7">
            <span
              data-tour="studioAvatar"
              className="size-[62px] rounded-full border-4 border-[var(--mac-window)] bg-brand"
            />
            <div data-tour="studioName" className="flex flex-col">
              <span className="text-[13px] leading-tight font-medium">
                {MARKETING_TOUR.studio.name}
              </span>
              <span className="text-[11.5px] leading-tight text-[var(--mac-faint)]">
                {MARKETING_TOUR.studio.role}
              </span>
            </div>
          </div>
        </div>
</div>
      </div>

      {/* ---------- calendar: the month fills in ---------- */}
      <div data-tour-screen="calendar" className={SCREEN} style={SCREEN_BOX}>
        <div className={PANE_HEAD}>
          <span className={cn(CAP, "text-[var(--mac-ink)]")}>
            {MARKETING_TOUR.calendarTitle}
          </span>
          <span className="text-[11px] text-[var(--mac-faint)] tabular-nums">
            <span data-tour="scheduledCount">0</span> {TOUR_CALENDAR.countLabel}
          </span>
        </div>

<div className={SCREEN_BODY}>
        <div className="flex gap-10 px-8 pt-6">
          <div className="w-[420px]">
            <div className="grid grid-cols-7">
              {TOUR_CALENDAR.weekdayInitials.map((initial, index) => (
                <span
                  key={`${initial}-${String(index)}`}
                  className="flex h-[24px] items-center justify-center text-[10.5px] text-[var(--mac-faint)]"
                >
                  {initial}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: TOUR_CALENDAR.days }, (_, i) => i + 1).map((day) => {
                const taken = day === TOUR_CALENDAR.pickedDay;
                const fills = TOUR_CALENDAR.fills.includes(day);
                return (
                  <span
                    key={day}
                    data-tour={taken ? "dayCell" : undefined}
                    className="relative flex h-[50px] items-center justify-center text-[12.5px] tabular-nums"
                  >
                    {taken ? (
                      <span
                        data-tour="dayRing"
                        className={cn(
                          "absolute inset-[4px] border border-brand bg-brand",
                          ROW,
                        )}
                      />
                    ) : null}
                    <span className="relative">{day}</span>
                    {fills ? (
                      <span
                        data-tour-item="dot"
                        className="absolute bottom-[7px] left-1/2 size-[4px] -translate-x-1/2 rounded-full bg-brand"
                      />
                    ) : null}
                  </span>
                );
              })}
            </div>
          </div>

          <div
            data-tour="nextUp"
            className={cn(
              "h-fit w-[300px] border border-[var(--mac-line)] bg-[var(--mac-raised)] p-4",
              ROW,
            )}
          >
            <span className={cn(CAP, "block text-[var(--mac-faint)]")}>Next out</span>
            <p className="m-0 mt-2 text-[13px] leading-tight font-medium">
              {TOUR_CALENDAR.nextSlot}
            </p>
            <span className="mt-1 block text-[11.5px] leading-snug text-[var(--mac-dim)]">
              {TOUR_DRAFT.lines[0]}
            </span>
            <span
              className={cn(
                "mt-3 inline-block bg-brand px-2 py-[3px] text-[10px] font-medium text-brand-foreground",
                ROW,
              )}
            >
              {TOUR_CALENDAR.nextState}
            </span>
          </div>
        </div>
</div>
      </div>

      {/* ---------- ideas: each captured line is given a slot ---------- */}
      <div data-tour-screen="ideas" className={SCREEN} style={SCREEN_BOX}>
        <div className={PANE_HEAD}>
          <span className={cn(CAP, "text-[var(--mac-ink)]")}>
            {MARKETING_TOUR.ideas.title}
          </span>
          <span className="text-[11px] text-[var(--mac-faint)] tabular-nums">
            <span data-tour="planFilled">
              {String(MARKETING_TOUR.ideas.filledSlots)}
            </span>{" "}
            / {MARKETING_TOUR.ideas.totalSlots} {MARKETING_TOUR.ideas.slotsLabel}
          </span>
        </div>

<div className={SCREEN_BODY}>
        <div className="flex flex-col gap-2.5 px-8 pt-6">
          <span className={cn(CAP, "text-[var(--mac-faint)]")}>
            {MARKETING_TOUR.ideas.capturedLabel}
          </span>

          {/* THE SLOT IS THE DEMO. An idea with a date is the inbox's one
              visible distinction, so each row arrives first and is given its
              slot a beat later — cause, then effect. */}
          {MARKETING_TOUR.ideas.items.map((item) => (
            <div
              key={item.text}
              data-tour-item="idea"
              className={cn(
                "flex items-center gap-3 border border-[var(--mac-line)] bg-[var(--mac-raised)] px-4 py-3",
                ROW,
              )}
            >
              <span className="size-[6px] flex-none rounded-full bg-brand" />
              <span className="text-[12.5px]">{item.text}</span>
              <span
                data-tour-item="ideaSlot"
                className={cn(
                  "ml-auto bg-brand px-2 py-[3px] text-[10px] font-medium text-brand-foreground",
                  ROW,
                )}
              >
                {item.slot}
              </span>
            </div>
          ))}

          <span className={cn(CAP, "mt-3 text-[var(--mac-faint)]")}>
            {MARKETING_TOUR.ideas.planLabel}
          </span>
        </div>
</div>
      </div>

      {/* ---------- profile: scored, critiqued, rewritten ---------- */}
      <div data-tour-screen="profile" className={SCREEN} style={SCREEN_BOX}>
        <div className={PANE_HEAD}>
          <span className={cn(CAP, "text-[var(--mac-ink)]")}>
            {MARKETING_TOUR.profileTitle}
          </span>
        </div>

<div className={SCREEN_BODY}>
        <div className="flex gap-10 px-8 pt-7">
          {/* A ring, rotated so the arc starts at twelve o'clock and
              dash-offset so it grows clockwise. The renderer writes the offset,
              which is paint rather than layout, and the numeral inside reads
              the same number so the two cannot drift. */}
          <span className="relative flex size-[132px] flex-none items-center justify-center">
            <svg viewBox="0 0 70 70" className="size-[132px] -rotate-90">
              <circle
                cx="35"
                cy="35"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="5"
                stroke="var(--mac-line)"
              />
              <circle
                data-tour="scoreArc"
                cx="35"
                cy="35"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={TOUR_RING_LENGTH}
                strokeDashoffset={
                  TOUR_RING_LENGTH *
                  (1 - MARKETING_PROFILE_SCORE.value / MARKETING_PROFILE_SCORE.outOf)
                }
                className="stroke-brand"
              />
            </svg>
            <span className="absolute flex flex-col items-center">
              <span
                data-tour="scoreValue"
                className="text-[34px] leading-none font-semibold tabular-nums"
              >
                {String(MARKETING_PROFILE_SCORE.value)}
              </span>
              <span className="mt-1 text-[11px] text-[var(--mac-faint)]">
                / {MARKETING_PROFILE_SCORE.outOf}
              </span>
            </span>
          </span>

          <div className="flex-1">
            <span className={cn(CAP, "block text-[var(--mac-faint)]")}>
              {MARKETING_PROFILE_SCORE.label}
            </span>

            <ul className="m-0 mt-3 flex list-none flex-col p-0">
              {MARKETING_PROFILE_ROWS.map((row) => (
                <li
                  key={row.section}
                  data-tour-item="verdict"
                  className="flex h-[34px] items-center justify-between gap-2.5 border-t border-[var(--mac-line)] text-[12.5px]"
                >
                  {row.section}
                  <span
                    className={cn(
                      "text-[10.5px] font-medium",
                      row.good ? "text-[var(--mac-faint)]" : "text-brand",
                    )}
                  >
                    {row.verdict}
                  </span>
                </li>
              ))}
            </ul>

            <div
              data-tour="rewrite"
              className={cn(
                "mt-4 bg-[var(--mac-raised)] px-3.5 py-3 text-[12px]",
                ROW,
              )}
            >
              <span data-tour="rewriteOld" className="block text-[var(--mac-faint)]">
                {MARKETING_TOUR.rewriteOld}
              </span>
              <span data-tour="rewriteNew" className="mt-1 block font-medium">
                {MARKETING_TOUR.rewriteNew}
              </span>
            </div>
          </div>
        </div>
</div>
      </div>
    </div>
  );
}
