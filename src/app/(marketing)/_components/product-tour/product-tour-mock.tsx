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

/* ---------- the window's geometry, in design pixels ----------
 * The title bar is 40px, the icon rail 52 and the nav 148, which puts the
 * content column's left edge at 200 — the x TOUR_RECTS is measured from. */
const BAR = 40;
const RAIL = 52;
const NAV = 148;
const COL = RAIL + NAV; // 200

/** Every pane: a compartment separated by a hairline, never a floating card. */
const PANE = "absolute border-l border-[var(--mac-line)]";

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
          <span className="text-[12.5px] text-[var(--mac-dim)]">
            {MARKETING_COMPOSER.subtitle}
          </span>

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
        {MARKETING_TOUR.sidebar.slice(0, 5).map((item, index) => (
          <span
            key={item}
            className={cn(
              "flex size-[30px] items-center justify-center",
              ROW,
              index === 0
                ? "bg-[var(--mac-row)] text-[var(--mac-ink)]"
                : "text-[var(--mac-faint)]",
            )}
          >
            <span
              className={cn(
                "size-[6px] rounded-full",
                index === 0 ? "bg-brand" : "bg-[var(--mac-line)]",
              )}
            />
          </span>
        ))}
      </div>

      {/* ---------- the nav list ---------- */}
      <div
        className="absolute flex flex-col gap-0.5 border-l border-[var(--mac-line)] px-2 pt-2.5"
        style={{ top: BAR, left: RAIL, width: NAV, height: TOUR_DESIGN.height - BAR }}
      >
        <span className={cn(CAP, "px-2 pb-1.5 text-[var(--mac-faint)]")}>
          {MARKETING_COMPOSER.title}
        </span>
        {MARKETING_TOUR.sidebar.map((item, index) => (
          <span
            key={item}
            className={cn(
              "flex h-[26px] items-center gap-2 px-2 text-[12px]",
              ROW,
              index === 0
                ? "bg-[var(--mac-row)] text-[var(--mac-ink)]"
                : "text-[var(--mac-dim)]",
            )}
          >
            <span
              className={cn(
                "size-[5px] flex-none rounded-full",
                index === 0 ? "bg-brand" : "bg-[var(--mac-line)]",
              )}
            />
            {item}
          </span>
        ))}
      </div>

      {/* ---------- 1 · compose — the first tight stop ---------- */}
      <section
        data-tour="paneCompose"
        className={cn(PANE, "w-[380px]")}
        style={{ top: BAR, left: COL, height: 286 }}
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

        {/* The topic box. The topic types itself into `typed`; the placeholder is
            a sibling switched off the moment a character lands. */}
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

        {/* The pane's one saturated control. */}
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

      {/* ---------- 2 · voice profile — the second tight stop ---------- */}
      <section
        data-tour="paneVoice"
        className={cn(PANE, "w-[380px] border-t border-[var(--mac-line)]")}
        style={{ top: BAR + 286, left: COL, height: TOUR_DESIGN.height - BAR - 286 }}
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

          {/* The traits, each one a mark that strikes as it is learned. */}
          <ul className="m-0 mt-2.5 flex list-none flex-col gap-1 p-0">
            {TOUR_DRAFT.traits.map((trait) => (
              <li
                key={trait}
                className={cn(
                  "flex h-[28px] items-center gap-2.5 bg-[var(--mac-window)] px-2.5 text-[12px]",
                  ROW,
                )}
              >
                {/* TWO STATES OF ONE BOX, STACKED. The empty outline is always
                    drawn and the filled mark fades in over it, so the tick is a
                    pure opacity write and the row's height never changes. */}
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
              <span className={cn(CAP, "text-[var(--mac-faint)]")}>
                {item.when}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- 3 · the draft, as LinkedIn renders it ---------- */}
      <section
        data-tour="panePost"
        className={cn(PANE, "w-[320px] bg-[var(--mac-raised)]")}
        style={{ top: BAR, left: COL + 380, height: TOUR_DESIGN.height - BAR }}
      >
        <div
          className={cn(
            "relative mx-3.5 mt-4 min-h-[290px] border border-[var(--mac-line)] bg-[var(--mac-window)] p-3",
            ROW,
          )}
        >
          <span
            data-tour="draftEmpty"
            className="absolute inset-0 grid place-items-center px-8 text-center text-[12px] text-[var(--mac-faint)]"
          >
            {MARKETING_TOUR.draftEmpty}
          </span>

          <div data-tour="draftHead" className="mb-2.5 flex items-center gap-2.5">
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

          {/* The draft. Two of the four lines carry a SWAP — the voice-profile
              version stacked on the generated one in the same grid cell, so the
              rewrite crossfades in place without the paragraph below it moving.
              The highlight behind a line is driven by --tour-lit. */}
          <div className="flex flex-col gap-1.5">
            {TOUR_DRAFT.lines.map((line, index) => {
              const rewrite = TOUR_DRAFT.rewrites.find(
                (entry) => entry.line === index,
              );
              return (
                <p
                  key={line}
                  data-tour-item="line"
                  className={cn(
                    "relative m-0 -mx-1 px-1 text-[12px] leading-normal",
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
            className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--mac-line)] pt-2.5"
          >
            <span className="flex items-center gap-3 text-[10.5px] text-[var(--mac-faint)]">
              {MARKETING_COMPOSER.postActions.slice(0, 3).map((action) => (
                <span key={action}>{action}</span>
              ))}
            </span>
            <span
              data-tour="characters"
              className="text-[10.5px] text-[var(--mac-faint)] tabular-nums"
            >
              {`${String(TOUR_DRAFT.charactersAfter)} / ${String(LINKEDIN_MAX_COMMENTARY)}`}
            </span>
          </div>
        </div>

        <div className="mt-3 mr-3.5 flex justify-end gap-2">
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

      {/* ---------- 4 · the calendar ---------- */}
      <section
        data-tour="paneCalendar"
        className={cn(PANE, "w-[300px]")}
        style={{ top: BAR, left: COL + 700, height: 400 }}
      >
        <div className={PANE_HEAD}>
          <span className={cn(CAP, "text-[var(--mac-ink)]")}>
            {MARKETING_TOUR.calendarTitle}
          </span>
          <span className="text-[11px] text-[var(--mac-faint)] tabular-nums">
            <span data-tour="scheduledCount">0</span> {TOUR_CALENDAR.countLabel}
          </span>
        </div>

        <div className="grid grid-cols-7 px-[17px] pt-2">
          {TOUR_CALENDAR.weekdayInitials.map((initial, index) => (
            <span
              key={`${initial}-${String(index)}`}
              className="flex h-[20px] w-[38px] items-center justify-center text-[10px] text-[var(--mac-faint)]"
            >
              {initial}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 px-[17px]">
          {Array.from({ length: TOUR_CALENDAR.days }, (_, i) => i + 1).map((day) => {
            const taken = day === TOUR_CALENDAR.pickedDay;
            const fills = TOUR_CALENDAR.fills.includes(day);
            return (
              <span
                key={day}
                data-tour={taken ? "dayCell" : undefined}
                className="relative flex h-[36px] w-[38px] items-center justify-center text-[11.5px] tabular-nums"
              >
                {taken ? (
                  <span
                    data-tour="dayRing"
                    className={cn("absolute inset-[3px] border border-brand bg-brand", ROW)}
                  />
                ) : null}
                <span className="relative">{day}</span>
                {fills ? (
                  <span
                    data-tour-item="dot"
                    className="absolute bottom-[4px] left-1/2 size-[4px] -translate-x-1/2 rounded-full bg-brand"
                  />
                ) : null}
              </span>
            );
          })}
        </div>

        <div
          data-tour="nextUp"
          className={cn(
            "mx-3.5 mt-3 flex items-center gap-2.5 border border-[var(--mac-line)] bg-[var(--mac-raised)] px-3 py-2",
            ROW,
          )}
        >
          <div className="min-w-0">
            <p className="m-0 text-[11.5px] leading-tight font-medium">
              {TOUR_CALENDAR.nextSlot}
            </p>
            <span className="block truncate text-[10.5px] text-[var(--mac-faint)]">
              {TOUR_DRAFT.lines[0]}
            </span>
          </div>
          <span
            className={cn(
              "ml-auto flex-none bg-brand px-2 py-[3px] text-[10px] font-medium text-brand-foreground",
              ROW,
            )}
          >
            {TOUR_CALENDAR.nextState}
          </span>
        </div>
      </section>

      {/* ---------- 5 · the profile analysis ---------- */}
      <section
        data-tour="paneProfile"
        className={cn(PANE, "w-[300px] border-t border-[var(--mac-line)]")}
        style={{ top: BAR + 400, left: COL + 700, height: TOUR_DESIGN.height - BAR - 400 }}
      >
        <div className={PANE_HEAD}>
          <span className={cn(CAP, "text-[var(--mac-ink)]")}>
            {MARKETING_TOUR.profileTitle}
          </span>
        </div>

        {/* The score, as a ring: rotated so the arc starts at twelve o'clock and
            dash-offset so it grows clockwise. The renderer writes the offset,
            which is paint rather than layout. */}
        <div className="mx-3.5 mt-3 flex items-center gap-3.5">
          <span className="relative flex size-[70px] flex-none items-center justify-center">
            <svg viewBox="0 0 70 70" className="size-[70px] -rotate-90">
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
            <span
              data-tour="scoreValue"
              className="absolute text-[20px] leading-none font-semibold tabular-nums"
            >
              {String(MARKETING_PROFILE_SCORE.value)}
            </span>
          </span>

          <span className="flex flex-col gap-0.5">
            <span className={cn(CAP, "text-[var(--mac-faint)]")}>
              {MARKETING_PROFILE_SCORE.label}
            </span>
            <span className="text-[11.5px] text-[var(--mac-dim)]">
              out of {MARKETING_PROFILE_SCORE.outOf}
            </span>
          </span>
        </div>

        <ul className="m-0 mx-3.5 mt-2.5 flex list-none flex-col p-0">
          {MARKETING_PROFILE_ROWS.map((row) => (
            <li
              key={row.section}
              data-tour-item="verdict"
              className="flex h-[26px] items-center justify-between gap-2.5 border-t border-[var(--mac-line)] text-[11.5px]"
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
            "mx-3.5 mt-2.5 bg-[var(--mac-raised)] px-2.5 py-2 text-[11px]",
            ROW,
          )}
        >
          <span data-tour="rewriteOld" className="block text-[var(--mac-faint)]">
            {MARKETING_TOUR.rewriteOld}
          </span>
          <span data-tour="rewriteNew" className="block font-medium">
            {MARKETING_TOUR.rewriteNew}
          </span>
        </div>
      </section>
    </div>
  );
}
