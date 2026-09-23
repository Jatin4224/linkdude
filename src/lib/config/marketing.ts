/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_SECTION_IDS, MarketingSectionId,
 *   MARKETING_HERO_BEATS, MarketingHeroBeat, MARKETING_HERO_ORBIT,
 *   MARKETING_STATEMENT, MARKETING_FREE_CAPS, MARKETING_COMPOSER,
 *   MARKETING_COMPOSER_TONES, MARKETING_POST_LINES, MARKETING_COMPOSER_QUEUE,
 *   MarketingComposerRecentItem, MARKETING_STEPS, MarketingStep,
 *   MarketingStepArtifact, MARKETING_PROFILE_ROWS, MarketingProfileRow,
 *   MARKETING_CALENDAR, MARKETING_CLOSING, MARKETING_FOOTER_GROUPS,
 *   MarketingFooterGroup, MarketingNavItem, GET_STARTED_HREF,
 *   GET_STARTED_LABEL, MARKETING_DISCLAIMER, landing page copy, paper design
 *
 * WHAT:  Every editorial decision the public landing page makes — the hero's two
 *        beats and the marks scattered around them, the blue statement band, the
 *        composer screenshot's contents, the three how-it-works steps and the
 *        artifact each one shows, the closing band, and the footer columns.
 * WHY:   Copy lives here, not inside the section components, for the same reason
 *        plan names live in PLANS: editing the pitch should be a data edit in one
 *        file, not a hunt through JSX. Everything that is a FACT about the
 *        product — the free plan's caps, the capability list in the ticker — is
 *        deliberately absent, because those are read live from RESOURCES at
 *        render time and a marketing claim must never be able to drift from what
 *        the gate actually enforces. Only which resources to SHOW is editorial,
 *        and that is what MARKETING_FREE_CAPS holds.
 *
 *        Display headlines are typed as PaperDisplayLine rather than as strings,
 *        so the design system's rule 5 (individually boxed words in Archivo
 *        Black) is expressed in the data and enforced by the renderer. Rule 4 —
 *        one blue per screen — is a copy constraint that lives here too: at most
 *        one word per section may carry the `blue` variant.
 * WHERE: Consumed by src/app/(marketing)/_components/* and
 *        src/components/global/marketing/*. Re-exported from @/lib/config.
 */

import type { LimitResourceKey } from "@/lib/resources";
import type {
  PaperDisplayLine,
  PaperOrbitMark,
  PaperScatterMark,
} from "@/lib/types/paper";
import { APP_NAME } from "./branding";
import { AUTH_ROUTES } from "./auth-routes";
import { REGISTRATION_OPEN } from "./registration";

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_SECTION_IDS, MarketingSectionId
 *
 * WHAT:  The anchor id of each in-page section.
 * WHY:   The footer links, the `id=` on the sections and the header's
 *        past-the-hero scroll test all read the same constant, so an anchor can
 *        never point at a section that renamed itself — and the header cannot
 *        end up watching an element that no longer exists.
 */
export const MARKETING_SECTION_IDS = {
  top: "top",
  why: "why",
  free: "free",
  composer: "composer",
  how: "how",
  start: "start",
} as const;

export type MarketingSectionId =
  (typeof MARKETING_SECTION_IDS)[keyof typeof MARKETING_SECTION_IDS];

/**
 * SOURCE OF TRUTH KEYWORDS: GET_STARTED_HREF, GET_STARTED_LABEL
 *
 * WHAT:  Where every primary call-to-action points, and what it says.
 * WHY:   With self-serve signup disabled, proxy.ts already bounces /sign-up to
 *        /sign-in. Pointing the CTA straight at sign-in turns a redirect the
 *        visitor watches happen into one they never experience, and the label
 *        stops promising an account they are not allowed to create. One switch,
 *        every CTA on the page — the value is inlined at build time, so the page
 *        stays fully static.
 * WHERE: The header, the hero, the blue band, the closing band, the footer.
 */
export const GET_STARTED_HREF: string = REGISTRATION_OPEN
  ? AUTH_ROUTES.signUp
  : AUTH_ROUTES.signIn;

export const GET_STARTED_LABEL: string = REGISTRATION_OPEN
  ? "Get started free"
  : "Sign in";

/** The reassurance that rides under every CTA. Makes no numeric promise, so
 *  there is nothing here for a plan change to contradict. */
export const MARKETING_REASSURANCE = "Free forever · no card";

/** The one line the product is legally required to be clear about. Repeated on
 *  the landing footer and the sign-in form column. */
export const MARKETING_DISCLAIMER = "Not affiliated with LinkedIn Corporation.";

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingHeroIntroBeat, MARKETING_HERO_INTRO,
 *   MARKETING_HERO_SIGNOFF, MARKETING_HERO_BEAT_COUNT, hero beats, sticky hero,
 *   scroll beat, call and response
 *
 * WHAT:  The hero's introduction, as three call-and-response pairs and the line
 *        that closes them. Scroll progress through the sticky stage maps to an
 *        index here; each beat ADDS a pair rather than replacing the last.
 * WHY:   A CALL AND A RESPONSE, which is why the shape is a pair rather than a
 *        sentence. The reader's half states what they already do; the product's
 *        half is what it adds. Split across the stage — calls left of the
 *        character, responses right of it — the layout carries the argument
 *        before a word is read.
 *
 *        THEY ACCUMULATE. Each pair stays on screen, receding as the next
 *        arrives, so the sign-off lands on top of everything it has just
 *        claimed. Swapping them one at a time was the other option and it leaves
 *        the last line standing alone, with the promise it summarises already
 *        gone from the screen.
 *
 *        ONE BLUE, AND IT IS THE NAME. Every response boxes its last word in
 *        INK, because accumulation puts all three on screen at once and three
 *        blue boxes would break rule 4 outright. The accent is spent on the
 *        sign-off, so the one saturated thing in the hero is the product's name,
 *        arriving last.
 *
 *        This replaced a two-beat problem story ("Before an idea becomes a
 *        post" / "It died in your notes app"). That framing did not disappear —
 *        MARKETING_STATEMENT's body still tells it, one section down.
 * WHERE: src/app/(marketing)/_components/sticky-hero.tsx, and the beat count is
 *        read by the navbar to know when the hero has been passed.
 */
export interface MarketingHeroIntroBeat {
  /** The reader's half, left of the mascot. */
  call: string;
  /** The product's half, right of it. */
  response: PaperDisplayLine;
}

export const MARKETING_HERO_INTRO: readonly MarketingHeroIntroBeat[] = [
  {
    call: "You build.",
    response: [
      { text: "We'll help you", variant: "plain" },
      { text: "get seen", variant: "ink" },
    ],
  },
  {
    call: "You create.",
    /* Split after "you", like the other two, rather than after "stay". The
     * side column is about 370px wide, and "WE'LL HELP YOU STAY" set in
     * Archivo Black needs roughly 450 — so that grouping wrapped to three lines
     * and left STAY orphaned on its own. Boxing the whole verb phrase fixes the
     * wrap AND makes all three responses the same shape: a plain opener and one
     * boxed promise. */
    response: [
      { text: "We'll help you", variant: "plain" },
      { text: "stay consistent", variant: "ink" },
    ],
  },
  {
    call: "You want opportunities.",
    response: [
      { text: "We'll help you", variant: "plain" },
      { text: "get there", variant: "ink" },
    ],
  },
];

/* The last beat, and the hero's only blue. */
export const MARKETING_HERO_SIGNOFF: PaperDisplayLine = [
  { text: "This is", variant: "plain" },
  { text: APP_NAME, variant: "blue" },
];

/* The pairs plus the sign-off. Derived rather than written down, because the
 * hero and the navbar both need it and a second literal is how they drift. */
export const MARKETING_HERO_BEAT_COUNT = MARKETING_HERO_INTRO.length + 1;

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_HERO_ORBIT, PaperOrbitMark, sphere,
 *   latitude, longitude, hero orbit, decorative marks
 *
 * WHAT:  The marks that orbit the hero mascot on an invisible sphere.
 * WHY:   Latitudes are spread across the range rather than clustered, because
 *        marks sharing a latitude travel the same ring and read as a necklace
 *        instead of a globe. Longitudes are spread too, so the sphere never has
 *        a bare side facing the reader. Radii vary a little: a set at one exact
 *        distance describes a perfect sphere, which reads as a diagram — an
 *        uneven shell reads as objects that happen to be floating.
 *
 *        NINE marks, not six. The previous flat scatter only had to fill the
 *        visible plane; a sphere hides roughly half its contents behind the
 *        mascot at any moment, so the same apparent density costs more of them.
 * WHERE: src/app/(marketing)/_components/sticky-hero.tsx via PaperOrbit.
 */
export const MARKETING_HERO_ORBIT: readonly PaperOrbitMark[] = [
  { icon: "square-dashed", latitude: 38, longitude: 0, size: 34, radius: 1 },
  { icon: "arrow-right", latitude: 12, longitude: 45, size: 46, radius: 1.05 },
  { icon: "asterisk", latitude: -30, longitude: 90, size: 28, radius: 0.92 },
  { icon: "grid", latitude: 52, longitude: 135, size: 24, radius: 0.88 },
  { icon: "triangle", latitude: -8, longitude: 180, size: 44, radius: 1.02 },
  { icon: "waves", latitude: 26, longitude: 225, size: 38, radius: 0.95 },
  { icon: "square-dashed", latitude: -46, longitude: 270, size: 26, radius: 1.04 },
  { icon: "asterisk", latitude: 4, longitude: 305, size: 32, radius: 0.9 },
  { icon: "grid", latitude: -22, longitude: 335, size: 22, radius: 1.06 },
];

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_AUTH_SCATTER
 *
 * WHAT:  The same treatment on the sign-in brand panel, at a smaller count.
 * WHY:   Four marks, not six, and all on one layer: the panel has no mascot in
 *        front of them to hide behind, and the run is placed to lead the eye
 *        from the mascot back toward the form column.
 * WHERE: src/components/global/auth/auth-shell.tsx via PaperScatter.
 */
export const MARKETING_AUTH_SCATTER: readonly PaperScatterMark[] = [
  { icon: "square-dashed", top: "13%", right: "12%", size: 30, tilt: -12, duration: 7.5, delay: 0 },
  { icon: "asterisk", top: "28%", left: "7%", size: 26, tilt: 14, duration: 8.4, delay: 0.7 },
  { icon: "arrow-right", top: "40%", right: "26%", size: 38, tilt: 6, duration: 9.2, delay: 1.4 },
  { icon: "grid", top: "10%", left: "36%", size: 22, tilt: 20, duration: 8, delay: 2 },
];

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_STATEMENT, blue band, statement section
 *
 * WHAT:  The full-height blue band that answers the hero.
 * WHY:   The one section on the page that IS the accent rather than merely
 *        using it, so its display line inverts — the product name is boxed in
 *        white, because a blue box on blue is nothing. APP_NAME is interpolated
 *        rather than typed so a rename in .env cannot leave the loudest sentence
 *        on the site selling a product that no longer goes by that name.
 */
export const MARKETING_STATEMENT = {
  /* NOT a second introduction. The hero now closes on "This is LinkDude", and
   * this band used to open "That's why we're building LinkDude" immediately
   * below it — the name revealed twice, a screen apart. It states the job
   * instead, which is what the body underneath was already describing. */
  intro: "The whole job, in one line",
  heading: [
    { text: "Say it", variant: "plain" },
    { text: "once", variant: "paper" },
  ] as PaperDisplayLine,
  body: "Type the thing you already know. It comes back written in your voice, queued for the morning it should go out.",
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_FREE_CAPS, free plan caps, quota band
 *
 * WHAT:  Which of the free plan's allowances the caps row shows, and the two
 *        mono labels that frame it.
 * WHY:   The KEYS are editorial — four cells is what the ruled row is designed
 *        for — but the numbers and the labels are not here at all: both are read
 *        from RESOURCES at render time, so this row cannot advertise an
 *        allowance the gate would refuse, and a cap edited in the registry
 *        updates the marketing claim in the same commit. `satisfies` refuses any
 *        key that is not actually a quota, so a cell can never reference a
 *        resource with no number to show.
 * WHERE: src/app/(marketing)/_components/free-plan-caps.tsx.
 */
export const MARKETING_FREE_CAPS = {
  label: "What free actually means",
  note: "Every month · no card",
  resources: [
    "linkedinPosts",
    "aiGeneration",
    "carousels",
    "profileAnalysis",
  ] as const satisfies readonly LimitResourceKey[],
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_COMPOSER, MARKETING_COMPOSER_TONES,
 *   MARKETING_POST_LINES, MARKETING_COMPOSER_RECENT, MarketingComposerRecentItem,
 *   composer screenshot, product shot
 *
 * WHAT:  The composer screenshot's heading and everything drawn inside it — the
 *        chrome, the topic, the tone chips, the draft, and the queue beside it.
 * WHY:   A realistic post, not lorem ipsum: this section IS the product shot,
 *        and it has to survive being read closely. The topic and the post are a
 *        matched pair — the panel shows this post generated from that topic —
 *        so editing one without the other breaks the illusion the section is
 *        built on. The generations counter is NOT here: it is derived from the
 *        free plan's real aiGeneration cap in the component, as is the draft's
 *        character count, which is measured off the post below.
 * WHERE: src/app/(marketing)/_components/composer-showcase.tsx.
 */
export const MARKETING_COMPOSER = {
  lead: "No mockups. This is the part that does the work.",
  heading: [
    { text: "The", variant: "plain" },
    { text: "composer", variant: "blue" },
  ] as PaperDisplayLine,
  /* The screen's own header, not a browser bar. The panel used to be topped by
   * `app.<domain> / create`, which on a developer's machine reads as
   * "app.localhost" — a URL nobody will ever visit, on the one section whose
   * lead line promises this is not a mockup. */
  title: "Create post",
  subtitle: "Generate a draft, edit it in place, publish or schedule",
  /* The two sources the composer really accepts. Blog URL is a genuine reason
   * to sign up and appeared nowhere on this page before. */
  sourceTabs: ["Topic", "Blog URL"] as const,
  topicLabel: "What's the post about?",
  topic: "what I learned pricing our first ten customers",
  generateLabel: "Generate post",
  /* The line that ties this panel to the voice row further down the band. */
  voiceNote: "Drafts are written in your voice.",
  voiceAction: "Manage",
  authorName: "Priya Raman",
  authorInitials: "PR",
  /* What LinkedIn itself prints under the name on an unposted draft. */
  postedMeta: "Now",
  /* Caption for the draft artifact in the how-it-works band, where there is no
   * room for the whole composer — it says the two things that panel proves. */
  draftLabel: "Draft · in your voice",
  /* The post as the network will show it. Drawn, never interactive. */
  postActions: ["Like", "Comment", "Repost", "Send"] as const,
  charactersLabel: "characters",
  saveLabel: "Save as draft",
  publishLabel: "Post to LinkedIn",
  recentLabel: "Recent posts",
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_COMPOSER_CONTROLS, goal, tone, length
 *
 * WHAT:  The three choices the composer actually offers, with a plausible
 *        setting for each.
 * WHY:   Replaces four invented chips — "Founder voice", "Contrarian", "Story",
 *        "Teardown" — which were a tone vocabulary the product does not have.
 *        Every value below is a real option: the goals are POST_GOAL_LABELS, the
 *        tones POST_TONE_LABELS and the lengths POST_LENGTH_LABELS. Copied as
 *        strings rather than imported so the panel is a fixed picture, but if a
 *        vocabulary changes, those three records are what to check against.
 */
export const MARKETING_COMPOSER_CONTROLS: readonly {
  label: string;
  value: string;
}[] = [
  { label: "Goal", value: "Comments" },
  { label: "Tone", value: "Contrarian" },
  { label: "Length", value: "Medium" },
];

export const MARKETING_POST_LINES: readonly string[] = [
  "We priced our first ten customers wrong. All ten.",
  "Not too high — too specific. A number per feature taught them to buy features instead of outcomes.",
  "The eleventh got one number and one promise. She closed in a day.",
  "Price the outcome. Let the features be free.",
];

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingComposerRecentItem, recent posts
 *
 * WHAT:  One row of the composer's right rail — when it went out, and what it
 *        said.
 * WHY:   Named for RECENT rather than a queue, which is what the rail became
 *        when the panel stopped inventing a schedule the app does not keep on
 *        this screen. `live` went with it: nothing in a list of published posts
 *        is "next out".
 */
export interface MarketingComposerRecentItem {
  when: string;
  title: string;
}

/* What the composer's right rail really lists: posts that have already gone
 * out. The panel used to show a "Queue · next 7 days" that exists nowhere in the
 * app — scheduling lives in the calendar, which the step above this section
 * already draws, so the page was illustrating the same idea twice and putting it
 * on the wrong screen. Relative dates rather than invented ones. */
export const MARKETING_COMPOSER_RECENT: readonly MarketingComposerRecentItem[] = [
  { when: "Published · 2 days ago", title: "Why we killed the free trial" },
  { when: "Published · last week", title: "What the first 90 days should look like" },
  { when: "Published · 12 days ago", title: "Carousel · 7 slides · hiring" },
];

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingStep, MarketingStepArtifact,
 *   MARKETING_STEPS, how it works, dark band, step artifact
 *
 * WHAT:  The three jobs the product does, in the order they happen, each paired
 *        with the artifact drawn beside it.
 * WHY:   `artifact` is a closed union rather than a component reference so the
 *        copy stays data: the section switches on it exhaustively, which means a
 *        fourth step is a compile error until someone has decided what it shows.
 *        On this band the display words invert — `plain` reads white against the
 *        ink ground, and `paper` boxes a word in white where the blue box is
 *        already spent elsewhere in the section.
 */
export type MarketingStepArtifact = "draft" | "calendar" | "score";

export interface MarketingStep {
  marker: string;
  lead: string;
  headline: PaperDisplayLine;
  body: string;
  artifact: MarketingStepArtifact;
}

export const MARKETING_STEPS: readonly MarketingStep[] = [
  {
    marker: "[1]",
    lead: `${APP_NAME} lets you`,
    headline: [
      { text: "Write", variant: "plain" },
      { text: "what you", variant: "plain" },
      { text: "already know", variant: "blue" },
    ],
    body: "Type a topic. It comes back with a hook built to earn the “see more” click. Edit any line before it goes anywhere.",
    artifact: "draft",
  },
  {
    marker: "[2]",
    lead: "then",
    headline: [
      { text: "Queue it", variant: "plain" },
      { text: "for Tuesday", variant: "paper" },
    ],
    body: "Publish now or drop it on the calendar. Scheduled posts fire on their own, and drafts cost you nothing until they do.",
    artifact: "calendar",
  },
  {
    marker: "[3]",
    lead: "and",
    headline: [
      { text: "Fix the profile", variant: "plain" },
      { text: "it lands on", variant: "blue" },
    ],
    body: "A post that works sends people to your profile. Get a score, a critique per section, and rewrites you can paste back in.",
    artifact: "score",
  },
];

/* The score artifact's headline figure. `value` drives both the numeral and the
 * meter's width, so the two can never disagree. */
export const MARKETING_PROFILE_SCORE = {
  label: "Profile score",
  value: 82,
  outOf: 100,
} as const;

export interface MarketingProfileRow {
  section: string;
  verdict: string;
  /** Already strong — rendered grey rather than accented. */
  good?: boolean;
}

export const MARKETING_PROFILE_ROWS: readonly MarketingProfileRow[] = [
  { section: "Headline", verdict: "Rewrite ready" },
  { section: "About", verdict: "Rewrite ready" },
  { section: "Experience", verdict: "Strong", good: true },
];

/* The calendar artifact's month. Two states, because that is the distinction the
 * real calendar draws: already out, and going out. */
export const MARKETING_CALENDAR = {
  month: "March",
  scheduledLabel: "9 scheduled",
  days: 28,
  published: [2, 4, 9, 11] as readonly number[],
  scheduled: [16, 18, 20, 23, 25, 27, 30] as readonly number[],
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingFeature, MARKETING_FEATURES, feature rows,
 *   studio, voice, carousel, ideas, content plan, technical metadata
 *
 * WHAT:  The four surfaces the landing page explains in full — what each one is,
 *        and the hard numbers that prove it exists.
 * WHY:   The page used to describe a composer, a calendar and a profile score,
 *        which was the whole product when it was written and is now about a
 *        third of it. Everything else reached the page only as a name scrolling
 *        past in the capability ticker, which tells a reader a feature EXISTS
 *        and nothing about what it does.
 *
 *        EVERY META VALUE IS A REAL NUMBER FROM THE APP, not a marketing round
 *        figure: the banner size is the one the renderer draws
 *        (DESIGN_CANVAS_PRESETS.linkedinBanner), the page size is the one the
 *        carousel rasterises (CAROUSEL_PAGE_PRESETS.portrait), and the 30-day
 *        calendar is a real section of a generated plan. They are repeated here
 *        as COPY rather than imported, because a marketing claim that changes
 *        silently when a default moves is worse than one that goes stale loudly
 *        — but if any of them drifts, this comment is the place that says which
 *        source of truth to check.
 *
 *        One boxed word per title, alternating PAPER and blue. Not ink: these
 *        rows live on the dark band now, and an ink box on ink is a word that
 *        disappears. Paper is the same inversion the steps above them already
 *        use for the same reason.
 *
 *        NO ORDINALS, and that is the point of the shape. These four are a SET,
 *        not a sequence — nobody does studio before voice. Numbering them made
 *        them look like a second run of the how-it-works steps, which are a
 *        genuine order (write, queue, fix the profile) and are numbered for that
 *        reason. A name is the marker here; a number would be a claim about
 *        order that is not true.
 * WHERE: src/app/(marketing)/_components/feature-rows.tsx.
 */
export interface MarketingFeature {
  /** The surface's own name, and the row's only marker. */
  label: string;
  /**
   * Which diagram the row draws. A closed union rather than a free string, so a
   * feature added here without a drawing is a compile error in the renderer
   * instead of a blank column on the page.
   */
  artifact: "studio" | "voice" | "carousel" | "ideas";
  title: PaperDisplayLine;
  body: string;
  /** Checkable facts — see the note above about where each one comes from. */
  meta: readonly { label: string; value: string }[];
}

export const MARKETING_FEATURES: readonly MarketingFeature[] = [
  {
    label: "Studio",
    artifact: "studio",
    title: [
      { text: "Your profile,", variant: "plain" },
      { text: "designed", variant: "paper" },
    ],
    body: "Banner, headshot and featured cover, drawn at the sizes LinkedIn actually uses and exported ready to upload.",
    meta: [
      { label: "Banner", value: "1584 × 396" },
      { label: "Export", value: "PNG" },
    ],
  },
  {
    label: "Voice",
    artifact: "voice",
    title: [
      { text: "Drafts that sound", variant: "plain" },
      { text: "like you", variant: "blue" },
    ],
    body: "Paste posts you have already written. The voice profile learns how you build a sentence, and every draft after that follows it.",
    meta: [
      { label: "Learns from", value: "Your own posts" },
      { label: "Applies to", value: "Every draft" },
    ],
  },
  {
    label: "Carousel",
    artifact: "carousel",
    title: [
      { text: "Decks people", variant: "plain" },
      { text: "swipe", variant: "paper" },
    ],
    body: "Draft a multi-slide deck, edit every slide, then render a PDF and publish it as a LinkedIn document post.",
    meta: [
      { label: "Page", value: "1080 × 1350" },
      { label: "Output", value: "PDF" },
    ],
  },
  {
    label: "Ideas & plan",
    artifact: "ideas",
    title: [
      { text: "Ideas become a", variant: "plain" },
      { text: "plan", variant: "blue" },
    ],
    body: "Catch the thought the moment it lands, then turn a pile of them into a month you can draft straight from.",
    meta: [
      { label: "Capture", value: "One line" },
      { label: "Plan", value: "30-day calendar" },
    ],
  },
];

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_CLOSING, final CTA copy
 *
 * WHAT:  The closing band's lead-in, display line and reassurance.
 * WHY:   The page's last words, and its only three-box display line — ink for
 *        the middle word, blue for the last, which is the one place the two
 *        boxed treatments appear together and still spends only one blue.
 */
export const MARKETING_CLOSING = {
  lead: "Your next thirty posts are",
  heading: [
    { text: "One", variant: "plain" },
    { text: "conversation", variant: "ink" },
    { text: "away", variant: "blue" },
  ] as PaperDisplayLine,
  secondaryLabel: "Sign in",
  reassurance: "Free forever · no card · no trial timer",
} as const;

export interface MarketingNavItem {
  label: string;
  href: string;
}

export interface MarketingFooterGroup {
  label: string;
  items: readonly MarketingNavItem[];
}

/* Product links are ON-PAGE ANCHORS, never /dashboard/* — a dashboard link in a
 * public footer sends an anonymous visitor into a redirect to sign-in, which
 * reads as a broken site. The reference's Company and Legal columns are dropped
 * for the same reason: those pages do not exist in this app, and three columns
 * of href="#" is a worse failure than three columns that go somewhere. */
export const MARKETING_FOOTER_GROUPS: readonly MarketingFooterGroup[] = [
  {
    label: "Product",
    items: [
      { label: "How it works", href: `#${MARKETING_SECTION_IDS.how}` },
      { label: "The composer", href: `#${MARKETING_SECTION_IDS.composer}` },
      { label: "What free means", href: `#${MARKETING_SECTION_IDS.free}` },
    ],
  },
  {
    label: "Get started",
    items: [
      { label: GET_STARTED_LABEL, href: GET_STARTED_HREF },
      { label: "Sign in", href: AUTH_ROUTES.signIn },
    ],
  },
  {
    label: "Why now",
    items: [
      { label: "The idea", href: `#${MARKETING_SECTION_IDS.why}` },
      { label: "Start posting", href: `#${MARKETING_SECTION_IDS.start}` },
    ],
  },
];

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_AUTH_PANEL, MARKETING_AUTH_ASSURANCES,
 *   AuthFormMode, sign-in copy, sign-up copy, brand panel, assurance lines,
 *   kicker, welcome back, start posting
 *
 * WHAT:  Everything editorial on the sign-in / sign-up screen — the marketing
 *        panel beside the form, and the three assurance lines under the button,
 *        in the order each mode wants them.
 * WHY:   Sign-in and sign-up are ONE component; only these strings differ. Keying
 *        them by AuthFormMode rather than branching in JSX means adding a mode is
 *        a compile error here until it has copy, and it keeps the auth component
 *        about the auth flow rather than about the pitch. The two orderings are
 *        the point of the split: a returning user is reassured that nothing
 *        posts without them, while someone creating an account needs to hear
 *        "no card" first — same three facts, different lead.
 * WHERE: src/components/global/auth/auth-shell.tsx (the panel) and
 *        src/components/global/auth/auth-form.tsx (kicker, title, assurances).
 */
export const MARKETING_AUTH_PANEL = {
  /* The old heading promised the OUTCOME — "one post away from becoming a
   * LinkedIn influencer" — which this product cannot deliver and no reader
   * believes. What it can do is draft the post, so that is what the heading
   * now says. The claim shrank; the credibility is the trade. */
  heading: [
    { text: "Your next LinkedIn post,", variant: "plain" },
    { text: "drafted for you", variant: "blue" },
  ] as PaperDisplayLine,
  /* One line, not two. The line that opened this ("the three hours staring at
   * an empty box") described a struggle only people who already post
   * regularly recognise — everyone else read a complaint about a problem they
   * have never had, on the screen where they decide whether to sign up. */
  body: `${APP_NAME} writes the hook. You take the credit.`,
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_AUTH_COPY, kicker, title, description,
 *   googleDescription, emailDescription, sign-in copy, sign-up copy
 *
 * WHAT:  The kicker, title and description at the top of the auth form column,
 *        per mode and per available method.
 * WHY:   Two descriptions per mode, not one, because EMAIL_AUTH_ENABLED changes
 *        what the screen actually offers: "Sign in with your Google account to
 *        continue" is wrong on a screen that also has an email field, and a
 *        single generic line would be wrong on both. Keyed by mode so the form
 *        picks copy rather than branching on strings.
 * WHERE: src/components/global/auth/auth-form.tsx.
 */
export const MARKETING_AUTH_COPY = {
  "sign-in": {
    kicker: "Sign in",
    title: "Welcome back",
    googleDescription: "Sign in with your Google account to continue.",
    emailDescription: "Enter your email below to sign in to your account.",
  },
  "sign-up": {
    kicker: "Create an account",
    title: "Start posting",
    googleDescription: "Sign up with your Google account to get started.",
    emailDescription: "Enter your details below to create your account.",
  },
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_AUTH_TRUST, MarketingAuthTrustPoint,
 *   Google sign-in trust, what Google shares, no password, auth panel
 *
 * WHAT:  What someone deciding whether to press "Continue with Google" needs to
 *        know, beside the button.
 * WHY:   The button asks for a Google account before the product has shown
 *        anything, and the two questions that stops people on are always the
 *        same: what does Google hand over, and what will this thing do to my
 *        LinkedIn. So the first point answers the first question and the second
 *        answers the second; the third removes the last reason to defer.
 *
 *        EVERY LINE IS CHECKABLE. The data line is the literal default Google
 *        grant (openid, email, profile) that src/lib/better-auth/auth.ts asks
 *        for — it requests no extra scopes — so if a scope is ever added, this
 *        line becomes false and must change with it. Nothing here promises a
 *        result; the panel beside it already learned that lesson.
 * WHERE: The brand panel in src/components/global/auth/auth-shell.tsx.
 */
export interface MarketingAuthTrustPoint {
  /** The claim, in three or four words. */
  title: string;
  /** The detail that makes the claim checkable. */
  body: string;
}

export const MARKETING_AUTH_TRUST: readonly MarketingAuthTrustPoint[] = [
  {
    title: "Google shares your name, email and picture",
    body: "That is the whole handover. We never see your password, your contacts or your inbox.",
  },
  {
    title: "Nothing posts until you approve it",
    body: `${APP_NAME} writes drafts. Publishing is a separate button you press yourself.`,
  },
  {
    title: "No card, no trial timer",
    body: "The free plan stays free. Connect your LinkedIn account later, or never.",
  },
];

export const MARKETING_AUTH_ASSURANCES: Readonly<
  Record<"sign-in" | "sign-up", readonly string[]>
> = {
  "sign-in": [
    "Nothing posts to LinkedIn until you approve it.",
    "No card required. The free plan has no trial timer.",
    "Disconnect your LinkedIn account at any time.",
  ],
  "sign-up": [
    "No card required. The free plan has no trial timer.",
    "Nothing posts to LinkedIn until you approve it.",
    "First post drafted about a minute after you connect.",
  ],
};
