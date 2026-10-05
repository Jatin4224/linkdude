/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: TourPoseKey, TourRect, TourPose, TourCameraFrame,
 *   TourTrackStop, TourStopKey, TourStop, TourFraming, TourNodeKey, TourListKey,
 *   product tour, scroll camera, pinned stage, camera pose, focus rectangle,
 *   tight stop, wide stop
 *
 * WHAT:  The contracts the landing page's scroll-driven product tour is built
 *        from — the poses the camera holds, the scroll timeline that orders
 *        them, the four stops' copy and placement, and the handles its
 *        per-frame renderer writes to.
 * WHY:   The tour is one pure function of scroll progress, and every number it
 *        reads is geometry. Typing that geometry is what keeps the engine
 *        honest: a `TourTrackStop` can only name a pose that exists, and
 *        `TourNodeKey` is a closed union, so a handle renamed in the mock is a
 *        compile error in the renderer instead of a silent `null` that stops one
 *        demo animating. The alternative — the prototype's loose string keys and
 *        `document.querySelector` by id — is exactly the failure this prevents.
 *
 *        NOTHING HERE IS A COMPONENT PROP. These are the shapes of the tour's
 *        CONFIGURATION, which lives in src/lib/config/marketing-tour.ts, so the
 *        choreography can be retuned without opening a .tsx file.
 * WHERE: src/lib/config/marketing-tour.ts declares the values; the engine in
 *        src/app/(marketing)/_components/product-tour/* consumes them.
 */

import type { PaperDisplayLine } from "./paper";

/**
 * SOURCE OF TRUTH KEYWORDS: TourPoseKey, tight stop, wide stop, over pose
 *
 * WHAT:  Every pose the camera can hold.
 * WHY:   THE TOUR HAS TWO KINDS OF STOP AND THE NAMES SAY WHICH. `write` and
 *        `voice` are TIGHT: one panel filling about a third of the screen, at a
 *        shared zoom, so the move between them is a straight pan down one
 *        column rather than a second zoom. `calendar` and `profile` are WIDE:
 *        the whole app at nearly one scale, sliding sideways to free the half of
 *        the screen the caption needs. `over` is the app entire and centred;
 *        `enter` and `exit` are that pose arriving and drifting away.
 *
 *        Keeping them in one union rather than splitting tight from wide is
 *        deliberate — the timeline interpolates between any two of them, and the
 *        hand-off from a tight stop to a wide one is exactly the move that must
 *        not be special-cased.
 */
export type TourPoseKey =
  /* The entry: the title bar peeking above the fold, and the window settled. */
  | "peek"
  | "settled"
  /* The two TIGHT stops, which share a zoom and differ only in y. */
  | "write"
  | "voice"
  /* The WIDE stops. There are only two poses for five of them, because the
     variety at a wide stop comes from the app NAVIGATING underneath the camera
     rather than from the camera travelling somewhere new — see TourScreenKey. */
  | "wideLeft"
  | "wideRight"
  /* The ending: the whole window, centred, at the scale it was already at.
     There is no "exit" pose — the mock leaves by the page scrolling, not by
     the camera moving it anywhere. */
  | "centred";

/**
 * SOURCE OF TRUTH KEYWORDS: TourScreenKey, screen, navigate, content area
 *
 * WHAT:  Which screen of the app is in the window's content area.
 * WHY:   THE APP NAVIGATES. Eight surfaces will not fit on one canvas at a size
 *        the settled pose can show legibly — at 60% of the viewport a canvas
 *        wide enough to hold them puts body text at about six pixels. So the
 *        window stays one size and its CONTENT changes: the active row in the
 *        sidebar moves and the content area crossfades, which is what the
 *        reference recording does after its entry and what a real product tour
 *        looks like.
 *
 *        `create` carries two stops. The composer and the voice profile sit in
 *        one column on that screen, which is what lets the tour's opening
 *        movement be a pan straight down rather than a second zoom — the one
 *        gesture the choreography is built around.
 */
export type TourScreenKey =
  | "create"
  | "carousel"
  | "studio"
  | "calendar"
  | "ideas"
  | "profile";

/**
 * SOURCE OF TRUTH KEYWORDS: TourRect, design coordinates, focus rectangle
 *
 * WHAT:  A rectangle in the mock's own design coordinates — [x, y, w, h].
 * WHY:   A tuple rather than an object: these are read in a hot loop and written
 *        as a table in config, where four named fields per row would bury the
 *        numbers the table exists to let someone compare at a glance.
 */
export type TourRect = readonly [x: number, y: number, width: number, height: number];

/**
 * SOURCE OF TRUTH KEYWORDS: TourPose, camera pose, anchor, scale
 *
 * WHAT:  One resolved camera pose: the scale to draw the mock at, which point of
 *        it to frame, where on screen that point lands, and how present it is.
 * WHY:   Stored as scale + centre + anchor rather than as a finished transform,
 *        because interpolation has to happen on these separately — the scale
 *        geometrically and the two points linearly. Pre-composing the matrix
 *        would make an even-feeling zoom impossible.
 *
 *        `opacity` is on the POSE, not applied at the call site, because exactly
 *        one pose uses it: `exit`, where the mock drifts and fades as the
 *        section lets go. Carrying it here means the fade interpolates on the
 *        same curve as the drift it belongs to.
 */
export interface TourPose {
  scale: number;
  /** The point of the mock being framed, in design coordinates. */
  centerX: number;
  centerY: number;
  /** Where that point sits in the stage, in CSS pixels. */
  anchorX: number;
  anchorY: number;
  /** 1 everywhere except the exit drift. */
  opacity: number;
}

/**
 * SOURCE OF TRUTH KEYWORDS: TourCameraFrame, transform, translate scale
 *
 * WHAT:  What one frame of the camera resolves to.
 * WHY:   `opacity` folds together the exit fade and the cross-fade a
 *        reduced-motion reader gets in place of a flight, so the renderer writes
 *        one value rather than deciding between two.
 */
export interface TourCameraFrame {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

/**
 * SOURCE OF TRUTH KEYWORDS: TourTrackStop, scroll timeline, keyframe, hold
 *
 * WHAT:  One keyframe of the scroll timeline — at this progress, hold this pose.
 * WHY:   Two consecutive stops naming the SAME pose is how the timeline encodes
 *        a hold, which is what gives each demo room to play without the camera
 *        drifting under it. That idiom is why this is a list of stops rather
 *        than a list of transitions.
 */
export type TourTrackStop = readonly [progress: number, pose: TourPoseKey];

/**
 * SOURCE OF TRUTH KEYWORDS: TourFraming, caption placement, inside outside,
 *   caption side, tight stop, wide stop
 *
 * WHAT:  Where a stop's caption is drawn.
 * WHY:   THE TWO KINDS OF STOP PUT THE CAPTION IN DIFFERENT PLACES, and this is
 *        the field that says which. At a tight stop the caption sits INSIDE the
 *        app window, in the space the faded panels just vacated, immediately
 *        beside the focused panel — so the measurement it needs is the focused
 *        panel's screen box, which only the camera knows. At a wide stop it
 *        sits OUTSIDE the app on plain black, on whichever half of the screen
 *        the app has slid away from.
 *
 *        A union rather than a pair of booleans: "inside, on the left" is not a
 *        state this choreography has, and a boolean pair would let someone write
 *        it.
 */
export type TourFraming = "inside-right" | "outside-left" | "outside-right";

/**
 * SOURCE OF TRUTH KEYWORDS: TourStopKey, TourStop, caption, label heading body
 *
 * WHAT:  One of the four stops — its caption's three parts, the scroll window it
 *        owns, where its caption is framed, and when that caption is readable.
 * WHY:   ONE declaration drives three things that must agree: the camera's hold,
 *        the caption's fade, and which pane of the mock keeps its opacity while
 *        the rest fade out. Written separately they drift, and the symptom is a
 *        caption describing a panel the camera has already left.
 *
 *        The caption is THREE PARTS rather than a heading and a body, because a
 *        reader arriving mid-scroll needs to know which feature they are looking
 *        at before they read the claim about it — the label is that, and it is
 *        the only part guaranteed short enough to be read at a glance.
 */
export type TourStopKey =
  | "write"
  | "voice"
  | "carousels"
  | "studio"
  | "schedule"
  | "ideas"
  | "profile";

export interface TourStop {
  key: TourStopKey;
  /** The small muted line above the heading — the feature's own name. */
  label: string;
  /** Display words for the heading, on the black ground. */
  heading: PaperDisplayLine;
  body: string;
  /** The stop's scroll window, as progress through the section. */
  from: number;
  to: number;
  /** When the caption is readable. Inset from the window so two never overlap. */
  captionFrom: number;
  captionTo: number;
  framing: TourFraming;
  /** Which pose this stop frames — and so which pane keeps the floor. */
  pose: TourPoseKey;
  /** Which screen is in the window's content area while this stop is live. */
  screen: TourScreenKey;
  /**
   * Which sidebar row is lit, as it is spelled in MARKETING_TOUR.sidebar.
   * Per STOP, not per screen: the Voice stop stays on the composer's screen so
   * the camera can pan down one column to it, but the row it lights is Voice,
   * because that is the surface the caption is talking about.
   */
  nav: string;
}

/**
 * SOURCE OF TRUTH KEYWORDS: TourNodeKey, data-tour, handle, renderer target
 *
 * WHAT:  Every element inside the mock the per-frame renderer writes to, as it
 *        is spelled in the mock's `data-tour` attribute.
 * WHY:   A CLOSED UNION is the whole point. The renderer resolves these once
 *        into a lookup and writes to them sixty times a second; a typo in a
 *        string key would silently freeze one demo, which is the hardest class
 *        of bug to notice on a page that only animates while being scrolled.
 *        Named for what the reader sees, not for the markup, so the mock can be
 *        restructured without renaming the timeline.
 * WHERE: Spelled onto elements in product-tour-mock.tsx, resolved in
 *        product-tour.tsx.
 */
export type TourNodeKey =
  /* The window's own chrome, which fades at the tight stops but never away. */
  | "chrome"
  | "sidebar"
  /* Panes — faded to the window's ground so one surface has the floor. */
  | "paneCompose"
  | "paneVoice"
  | "panePost"
  | "paneCalendar"
  | "paneProfile"
  /* 1 · Write */
  | "generations"
  | "typed"
  | "caret"
  | "placeholder"
  | "generate"
  | "draftEmpty"
  | "draftHead"
  | "draftFoot"
  | "characters"
  /* 2 · Voice */
  | "trained"
  | "voiceBadge"
  | "emoji"
  /* 3 · Schedule */
  | "schedule"
  | "dayRing"
  | "dayCell"
  | "nextUp"
  | "scheduledCount"
  /* Carousels */
  | "deckPage"
  | "deckTotal"
  /* Studio */
  | "studioBanner"
  | "studioAvatar"
  | "studioName"
  /* Ideas */
  | "planFilled"
  /* 4 · Profile */
  | "scoreValue"
  | "scoreArc"
  | "rewrite"
  | "rewriteOld"
  | "rewriteNew";

/**
 * SOURCE OF TRUTH KEYWORDS: TourListKey, data-tour-item, repeated handle
 *
 * WHAT:  The handles that exist many times over and are written to as a group.
 * WHY:   Separate from TourNodeKey because they resolve to a NodeList rather
 *        than one element, and the renderer staggers them by index. Folding them
 *        into the single-node union would make every lookup optional-array.
 */
export type TourListKey =
  | "slide"
  | "ideaSlot"
  | "navRow"
  | "navFill"
  | "railRow"
  | "preset"
  | "idea"
  | "line"
  | "swapOld"
  | "swapNew"
  | "tick"
  | "dot"
  | "verdict";
