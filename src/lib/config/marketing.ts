/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_SECTION_IDS, MarketingSectionId,
 *   MARKETING_NAV, MarketingNavItem, MarketingHeading, MARKETING_HERO,
 *   MARKETING_LOOP_STEPS, MarketingLoopStep, MARKETING_SURFACES,
 *   MarketingSurface, MARKETING_SURFACE_ROWS, MARKETING_DEMO,
 *   MARKETING_SECTION_HEADINGS, MARKETING_PLAN_PITCHES, MARKETING_FAQ,
 *   MARKETING_FOOTER_GROUPS, MARKETING_MATRIX_GROUPS, MARKETING_CLOSING,
 *   MARKETING_PLAN_BULLET_RESOURCES, MARKETING_FREE_TIER_RESOURCES,
 *   MARKETING_HERO_POST, GET_STARTED_HREF, GET_STARTED_LABEL, landing page copy,
 *   marketing copy, two-part heading, italic clause
 *
 * WHAT:  Every editorial decision the public landing page makes — section ids
 *        and the nav that points at them, the two-part headings, the loop rows,
 *        which product surfaces get a bento tile and what each one claims, the
 *        hero demo's script, the plan pitches, the FAQ, the footer columns, and
 *        how the pricing comparison rows are grouped.
 * WHY:   Copy lives here, not inside the section components, for the same reason
 *        plan names live in PLANS: editing the pitch should be a data edit in one
 *        file, not a hunt through JSX. Everything that is a FACT about the
 *        product (feature names, icons, quotas, prices) is deliberately absent —
 *        those are read live from RESOURCES and PLANS at render time, so a
 *        marketing claim can never drift from what the app actually enforces.
 *        Surface and matrix entries are keyed by ResourceKey, so renaming a
 *        resource breaks the build instead of silently emptying a section.
 * WHERE: Consumed by src/components/global/marketing/* and every section under
 *        src/app/(marketing)/_components. Re-exported from @/lib/config.
 */

import type { LimitResourceKey, ResourceKey } from "@/lib/resources";
import { APP_DOMAIN, APP_NAME } from "./branding";
import { AUTH_ROUTES } from "./auth-routes";
import { REGISTRATION_OPEN } from "./registration";

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_SECTION_IDS, MarketingSectionId
 *
 * WHAT:  The anchor id of each in-page section.
 * WHY:   The nav links and the `id=` on the sections read the same constant, so
 *        an anchor can never point at a section that renamed itself.
 */
export const MARKETING_SECTION_IDS = {
  top: "top",
  loop: "loop",
  product: "product",
  pricing: "pricing",
  faq: "faq",
} as const;

export type MarketingSectionId =
  (typeof MARKETING_SECTION_IDS)[keyof typeof MARKETING_SECTION_IDS];

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingHeading, two-part heading, italic clause,
 *   font-display, display accent, DisplayHeading
 *
 * WHAT:  A display heading split into its upright clause and its italic one.
 * WHY:   The whole typographic idea of this page is one heading in two voices —
 *        an uppercase Geist statement, then the turn of the sentence set in
 *        Instrument Serif italic in the accent colour. Modelling it as two
 *        fields rather than one string with markup in it means the rule lives in
 *        the component that renders it, so every heading on the page is
 *        guaranteed to break the same way and a copy edit never has to get the
 *        markup right.
 * WHERE: DisplayHeading in src/app/(marketing)/_components/display-heading.tsx.
 */
export interface MarketingHeading {
  /** Upright, uppercase, Geist. */
  lead: string;
  /** Instrument Serif italic, accent colour, NOT uppercased. */
  accent: string;
}

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
 * WHERE: Navbar, hero, pricing cards, final CTA, footer.
 */
export const GET_STARTED_HREF: string = REGISTRATION_OPEN
  ? AUTH_ROUTES.signUp
  : AUTH_ROUTES.signIn;

export const GET_STARTED_LABEL: string = REGISTRATION_OPEN
  ? "Get started free"
  : "Sign in";

export interface MarketingNavItem {
  label: string;
  href: string;
}

export const MARKETING_NAV: readonly MarketingNavItem[] = [
  { label: "The loop", href: `#${MARKETING_SECTION_IDS.loop}` },
  { label: "Inside", href: `#${MARKETING_SECTION_IDS.product}` },
  { label: "Pricing", href: `#${MARKETING_SECTION_IDS.pricing}` },
  { label: "FAQ", href: `#${MARKETING_SECTION_IDS.faq}` },
];

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_HERO, hero copy, eyebrow, subhead
 *
 * WHAT:  The first screen's copy.
 * WHY:   APP_NAME is interpolated rather than typed, so renaming the app in .env
 *        doesn't leave the headline selling a product that no longer goes by
 *        that name. The reassurance line is the only allowance claim on the page
 *        that is NOT generated — it makes no numeric promise, so there is
 *        nothing for it to contradict.
 */
export const MARKETING_HERO = {
  eyebrow: "For founders who keep meaning to post",
  heading: {
    lead: "You already know",
    accent: "what to say.",
  },
  subhead: `Type the thing you already know. ${APP_NAME} writes it as a post in your voice, queues it for the morning it should go out, and fixes the profile people land on when it works.`,
  secondaryCta: "See the loop",
  reassurance: "Free forever · no card · no trial timer",
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_HERO_POST, MARKETING_DEMO, demo script,
 *   hero demo, composer mock, queue cards, phase machine copy
 *
 * WHAT:  The sample post the hero's app demo writes, and the chrome around it —
 *        the topic being typed, the status line for each phase, and the queue.
 * WHY:   A realistic post, not lorem ipsum: the demo IS the product shot, and it
 *        has to survive being read. The topic and the post are a matched pair —
 *        the demo types the topic and then "generates" this post from it, so
 *        editing one without the other breaks the illusion the section is built
 *        on. Kept as data so the phase machine in app-demo.tsx holds timing and
 *        no prose.
 * WHERE: src/app/(marketing)/_components/app-demo.tsx.
 */
export const MARKETING_HERO_POST = {
  authorName: "Priya Raman",
  authorRole: "Founder",
  paragraphs: [
    "We priced our first ten customers wrong. All ten.",
    "Not too high — too specific. A number per feature taught them to buy features instead of outcomes.",
    "The eleventh got one number and one promise. She closed in a day.",
    "Price the outcome. Let the features be free.",
  ],
} as const;

export const MARKETING_DEMO = {
  topic: "what I learned pricing our first ten customers",
  /* Chrome only. Built from APP_DOMAIN so a rebrand moves it, and prefixed
   * "app." because that is the subdomain the real dashboard would sit on. */
  addressBar: `app.${APP_DOMAIN} / create`,
  scheduleLabel: "Tue 9:00 AM",
  /* One entry per phase of the demo's state machine. DemoPhase indexes these
   * records, so adding a phase without its copy is a build error. */
  status: {
    typing: "ready when you are",
    generating: "writing…",
    written: "draft · in your voice",
    queued: "scheduled · in your voice",
  },
  hint: {
    typing: "",
    generating: "",
    written: "draft saved",
    queued: "queued for Tuesday",
  },
  queue: [
    { time: "TUE 9:00", title: "Pricing our first ten" },
    { time: "THU 8:30", title: "Hiring slowly on purpose" },
    { time: "FRI 9:00", title: "The 90-day question" },
    { time: "MON 8:00", title: "What we stopped building" },
  ],
} as const;

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingLoopStep, MARKETING_LOOP_STEPS, the loop,
 *   Write Ship Land, mascot bubble
 *
 * WHAT:  The three jobs the product does, in the order they happen.
 * WHY:   This section replaced the separate "problems" and "how it works" bands.
 *        One row states the job, the body says what it does, and `bubble` is the
 *        mascot's line — the concrete capability that proves the claim above it.
 *        `bubble` must stay TRUE of the shipped feature; it is the sentence a
 *        reader will hold us to.
 */
export interface MarketingLoopStep {
  kicker: string;
  title: string;
  body: string;
  bubble: string;
}

export const MARKETING_LOOP_STEPS: readonly MarketingLoopStep[] = [
  {
    kicker: "Write",
    title: "A post, not a first draft",
    body: 'Type a topic. It comes back with a hook built to earn the "see more" click, in the voice your profile and your answers taught it. Edit any line before it goes anywhere.',
    bubble:
      "Or turn the same topic into a 3–12 slide carousel — rendered to a PDF and posted as a swipeable document.",
  },
  {
    kicker: "Ship",
    title: "Queued, not remembered",
    body: "Publish now, or drop it on the calendar for the morning it should go out. Scheduled posts fire on their own, and drafts cost you nothing until they do.",
    bubble: "Reschedule or cancel anything up to the moment it fires.",
  },
  {
    kicker: "Land",
    title: "The profile catches it",
    body: "A post that works sends people to your profile. Paste it in and get a score, a critique per section, and rewrites for the headline and About people actually read.",
    bubble: "Per-role and per-project rewrites on paid plans.",
  },
];

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingSurface, MARKETING_SURFACES, bento,
 *   inside section, product surfaces
 *
 * WHAT:  The product surfaces the "Inside" bento shows, in layout order.
 * WHY:   Each entry carries only the PITCH — the tile's small-caps label comes
 *        from `RESOURCES[resource].name` at render time, so the tile and the
 *        sidebar item a customer later clicks always agree, and a renamed
 *        resource is a compile error rather than a stale marketing claim.
 *        `wide` is the one layout decision that belongs to the copy: the
 *        calendar tile earns two columns because it renders a month grid, and
 *        which tile that is changes if the running order does.
 */
export interface MarketingSurface {
  resource: ResourceKey;
  headline: string;
  body: string;
  /** Spans two columns in the bento grid. */
  wide?: boolean;
}

export const MARKETING_SURFACES: readonly MarketingSurface[] = [
  {
    resource: "contentCalendar",
    headline: "Your cadence, visible",
    body: "Everything scheduled and everything published on one grid. A gap you can see is a gap you fill — the month you notice late is the month you stop.",
    wide: true,
  },
  {
    resource: "profileAnalysis",
    headline: "Fix what the click lands on",
    body: "A score, a section-by-section critique, and rewrites you can paste straight back in.",
  },
  {
    resource: "linkedinPosts",
    headline: "Nothing you wrote gets lost",
    body: "Drafts, scheduled, published and failed in one list. A draft never spends a post.",
  },
  {
    resource: "contentPlan",
    headline: "Thirty days, decided",
    body: "A guided chat reads your profile and returns pillars, cadence and the next thing to post.",
  },
  {
    resource: "carousels",
    headline: "Decks that stop the scroll",
    body: "A topic becomes a 3–12 slide deck, rendered to a real PDF and published as a swipeable document.",
  },
];

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_SURFACE_ROWS, bento mock rows
 *
 * WHAT:  The three mock rows rendered inside each of the small bento tiles.
 * WHY:   Illustrative UI, not claims — a label and a status chip, keyed by the
 *        same ResourceKey as the tile so a tile can never end up showing another
 *        surface's rows. The wide calendar tile and the profile-score tile draw
 *        their own mock instead, so they are deliberately absent here and the
 *        renderer treats a missing entry as "this tile draws itself".
 */
export interface MarketingSurfaceRow {
  label: string;
  value: string;
}

export const MARKETING_SURFACE_ROWS: Readonly<
  Partial<Record<ResourceKey, readonly MarketingSurfaceRow[]>>
> = {
  linkedinPosts: [
    { label: "Pricing our first ten", value: "Scheduled" },
    { label: "Hiring slowly on purpose", value: "Draft" },
    { label: "The 90-day question", value: "Published" },
  ],
  contentPlan: [
    { label: "Pillar · Pricing in public", value: "3×/wk" },
    { label: "Pillar · Hiring", value: "1×/wk" },
    { label: "Pillar · Build notes", value: "2×/wk" },
  ],
  carousels: [
    { label: "Cover · Pricing mistakes", value: "01" },
    { label: "The number per feature", value: "02" },
    { label: "One number, one promise", value: "03" },
  ],
};

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_SECTION_HEADINGS, section kickers,
 *   numbered sections
 *
 * WHAT:  The kicker and two-part heading for each numbered section.
 * WHY:   The numbering ("01 /", "02 /") is part of the copy rather than derived
 *        from array position: the sections are separate components, and a
 *        derived counter would let a reorder in page.tsx silently renumber the
 *        design. Keyed by section id so a heading and its anchor stay together.
 */
export interface MarketingSectionHeading {
  kicker: string;
  heading: MarketingHeading;
  /** Supporting paragraph beside the heading. Empty means the section has none. */
  body: string;
}

export const MARKETING_SECTION_HEADINGS = {
  loop: {
    kicker: "01 / The loop",
    heading: { lead: "Write it. Ship it.", accent: "Land it." },
    body: "Three jobs in the order they actually happen. Each one is useful alone — together they're the reason the posting sticks past week two.",
  },
  product: {
    kicker: "02 / Inside",
    heading: {
      lead: "Six surfaces you'd otherwise open",
      accent: "six tabs for.",
    },
    body: "",
  },
  pricing: {
    kicker: "03 / Pricing",
    heading: { lead: "Start free.", accent: "Pay when it's working." },
    body: "Every plan includes the whole product. What changes is how much of it you can use.",
  },
  faq: {
    kicker: "04 / Questions",
    heading: { lead: "Asked before", accent: "signing up" },
    body: "",
  },
} as const satisfies Record<string, MarketingSectionHeading>;

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_PLAN_PITCHES, plan pitch, pricing copy
 *
 * WHAT:  The one-line pitch under each plan's price.
 * WHY:   Looked up by PlanKey at render time rather than typed into the card, so
 *        a plan renamed in .env keeps its pitch and a plan added to PLAN_KEYS
 *        renders with no pitch instead of the wrong one. Deliberately says
 *        nothing numeric — the bullets underneath are generated from RESOURCES,
 *        and a pitch that repeated a cap would be the one place on this page
 *        that could contradict the gate.
 */
export const MARKETING_PLAN_PITCHES: Readonly<Record<string, string>> = {
  free: "Enough to publish for a month and see whether it changes anything.",
  starter: "For posting several times a week without watching the counter.",
  pro: "Daily posting, carousels every week, and the audit trail.",
  enterprise: "Unlimited everything, and seats for the whole team.",
};

export interface MarketingFaqItem {
  question: string;
  answer: string;
}

export const MARKETING_FAQ: readonly MarketingFaqItem[] = [
  {
    question: "Does it actually post to LinkedIn?",
    answer:
      "Yes. You connect your account once over LinkedIn's official OAuth, and from then on you can publish immediately or schedule for later. Scheduled posts go out on their own; you can reschedule or cancel any of them until the moment they fire.",
  },
  {
    question: "Will it sound like me, or like AI?",
    answer:
      "You see every draft in the composer before anything leaves your account, and you edit it there. The strategy behind the drafts is built from your own profile and your own answers, so the starting point is already closer to your voice than a blank box is.",
  },
  {
    question: "Can it make carousels?",
    answer:
      "Yes. Give it a topic and it returns a 3–12 slide deck you can edit slide by slide, rendered to a real PDF and published to LinkedIn as a swipeable document rather than a link. Carousels have their own monthly allowance, separate from your posts.",
  },
  {
    question: "Can I save a post and finish it later?",
    answer:
      "Yes. Anything you generate can sit as a draft for as long as you like, and a draft costs you nothing against your plan until you publish or schedule it. Drafts, scheduled posts, published posts and anything that failed all live in one list.",
  },
  {
    question: "What happens when I hit a plan limit?",
    answer:
      "You see it coming — the usage meter sits above the action, so you know how much is left before you spend it. When you do reach the cap the app names the next plan up rather than just failing.",
  },
  {
    question: "Can my team share a workspace?",
    answer:
      "Yes. Workspaces are organisations with real role-based access control, so you can invite teammates and define exactly which actions each role is allowed to take. Seat counts scale with the plan.",
  },
  {
    question: "Do I need a card to start?",
    answer:
      "No. The free tier is genuinely free and needs no card, and the paid plans start with a trial. You only enter payment details when you decide to upgrade.",
  },
];

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_CLOSING, final CTA copy
 *
 * WHAT:  The closing band's heading and body.
 * WHY:   The quota line under the buttons is NOT here — it is generated from
 *        RESOURCES in the component, because it is the page's last numeric
 *        promise and the one most likely to be read as a commitment.
 */
export const MARKETING_CLOSING = {
  heading: {
    lead: "Your next thirty posts are",
    accent: "one conversation away.",
  },
  body: "Connect LinkedIn, answer a few questions, and leave with a month of posts already on the calendar.",
} as const;

export interface MarketingFooterGroup {
  label: string;
  items: readonly MarketingNavItem[];
}

/* Product links are ON-PAGE ANCHORS, never /dashboard/* — a dashboard link in a
 * public footer sends an anonymous visitor into a redirect to sign-in, which
 * reads as a broken site. */
export const MARKETING_FOOTER_GROUPS: readonly MarketingFooterGroup[] = [
  {
    label: "Product",
    items: [
      { label: "The loop", href: `#${MARKETING_SECTION_IDS.loop}` },
      { label: "Inside", href: `#${MARKETING_SECTION_IDS.product}` },
      { label: "Pricing", href: `#${MARKETING_SECTION_IDS.pricing}` },
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
    label: "Support",
    items: [
      { label: "FAQ", href: `#${MARKETING_SECTION_IDS.faq}` },
      { label: "Why it works", href: `#${MARKETING_SECTION_IDS.loop}` },
    ],
  },
];

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingMatrixGroup, MARKETING_MATRIX_GROUPS
 *
 * WHAT:  How the pricing comparison rows are grouped and ordered.
 * WHY:   Row ORDER is editorial, so it lives here rather than in RESOURCES,
 *        which is ordered by architecture. Typed as ResourceKey so a renamed
 *        resource is a compile error; anything not listed is appended by the
 *        table under a trailing group, so a newly added quota can never vanish
 *        from pricing just because nobody updated this list.
 */
export interface MarketingMatrixGroup {
  label: string;
  resources: readonly ResourceKey[];
}

export const MARKETING_MATRIX_GROUPS: readonly MarketingMatrixGroup[] = [
  {
    label: "Create & publish",
    resources: [
      "linkedinPosts",
      "aiGeneration",
      "carousels",
      "aiImageEdit",
      "contentPlan",
    ],
  },
  {
    label: "Profile intelligence",
    resources: ["profileAnalysis", "profileLookup", "profileDeepInsights"],
  },
  {
    label: "Team & workspace",
    resources: ["member", "auditLogs"],
  },
];

/* The quotas worth repeating as bullets on a pricing card. Deliberately short —
 * the full matrix is one disclosure below it. `satisfies` is load-bearing: it
 * refuses any key that isn't actually a quota, so a bullet can never reference a
 * resource that has no number to show. */
export const MARKETING_PLAN_BULLET_RESOURCES = [
  "linkedinPosts",
  "aiGeneration",
  "carousels",
  "profileAnalysis",
  "contentPlan",
  "member",
] as const satisfies readonly LimitResourceKey[];

/* The numbers the free-tier counter row shows. */
export const MARKETING_FREE_TIER_RESOURCES = [
  "linkedinPosts",
  "aiGeneration",
  "carousels",
  "profileAnalysis",
  "contentPlan",
] as const satisfies readonly LimitResourceKey[];
