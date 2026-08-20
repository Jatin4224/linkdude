/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_SECTION_IDS, MarketingSectionId,
 *   MARKETING_NAV, MarketingNavItem, MARKETING_FEATURES, MarketingFeature,
 *   MARKETING_PROBLEMS, MARKETING_STEPS, MARKETING_FAQ, MARKETING_FOOTER_GROUPS,
 *   MARKETING_MATRIX_GROUPS, MARKETING_PLAN_BULLET_RESOURCES,
 *   MARKETING_FREE_TIER_RESOURCES, MARKETING_HERO_POST, GET_STARTED_HREF,
 *   GET_STARTED_LABEL, landing page copy, marketing copy
 *
 * WHAT:  Every editorial decision the public landing page makes — section ids
 *        and the nav that points at them, which product surfaces get a card and
 *        what each one claims, the problem/step/FAQ copy, the footer columns,
 *        and how the pricing comparison rows are grouped.
 * WHY:   Copy lives here, not inside the section components, for the same reason
 *        plan names live in PLANS: editing the pitch should be a data edit in one
 *        file, not a hunt through JSX. Everything that is a FACT about the
 *        product (feature names, icons, quotas, prices) is deliberately absent —
 *        those are read live from RESOURCES and PLANS at render time, so a
 *        marketing claim can never drift from what the app actually enforces.
 *        Feature and matrix entries are keyed by ResourceKey, so renaming a
 *        resource breaks the build instead of silently emptying a section.
 * WHERE: Consumed by src/components/global/marketing/* and every section under
 *        src/app/(marketing)/_components. Re-exported from @/lib/config.
 */

import type { LimitResourceKey, ResourceKey } from "@/lib/resources";
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
  why: "why",
  features: "features",
  how: "how",
  pricing: "pricing",
  faq: "faq",
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
 * WHERE: Navbar, hero, feature showcase, pricing cards, final CTA, footer.
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
  { label: "Why", href: `#${MARKETING_SECTION_IDS.why}` },
  { label: "Features", href: `#${MARKETING_SECTION_IDS.features}` },
  { label: "How it works", href: `#${MARKETING_SECTION_IDS.how}` },
  { label: "Pricing", href: `#${MARKETING_SECTION_IDS.pricing}` },
  { label: "FAQ", href: `#${MARKETING_SECTION_IDS.faq}` },
];

/**
 * SOURCE OF TRUTH KEYWORDS: MarketingFeature, MARKETING_FEATURES
 *
 * WHAT:  The product surfaces the landing page sells, in order. The COUNT is
 *        never restated in prose anywhere — FeatureShowcase spells this array's
 *        length out in its own heading, so adding a card here updates the copy
 *        rather than contradicting it.
 * WHY:   Each entry carries only the PITCH. The heading and the icon come from
 *        `RESOURCES[resource].name` / `.nav.icon` at render time, so the card
 *        and the sidebar item a customer later clicks always agree. `proof` is
 *        the concrete capability line under the pitch — it must stay true of the
 *        shipped feature.
 */
export interface MarketingFeature {
  resource: ResourceKey;
  headline: string;
  body: string;
  proof: string;
}

export const MARKETING_FEATURES: readonly MarketingFeature[] = [
  {
    resource: "linkedinPosts",
    headline: "A post, not a first draft",
    body: "Type a topic. Get it back written in your voice, with a hook built to earn the “see more” click — then edit it and publish, or queue it for Tuesday at 9am.",
    proof:
      "Publishes over LinkedIn OAuth. Crop the image you attach, or describe the change and let AI redraw it.",
  },
  {
    resource: "carousel",
    headline: "Slide decks that stop the scroll",
    body: "Type a topic, pick a length and a template, and get the whole deck back — cover, content slides, close. Edit any line, render it to a real PDF, and publish it as a swipeable LinkedIn document.",
    proof:
      "Three to twelve slides, three templates. Re-rendering an edited deck is free.",
  },
  {
    resource: "postLibrary",
    headline: "Nothing you wrote gets lost",
    body: "Every draft, scheduled post, published post and failed one in a single list. Save a half-finished thought, and pick it up in the composer on the day it finally lands.",
    proof: "Drafts cost nothing — you only spend a post when you publish it.",
  },
  {
    resource: "contentCalendar",
    headline: "Your cadence, visible",
    body: "Everything scheduled and everything published, on one month grid. A gap in your posting is something you see coming instead of something you notice a month late.",
    proof: "Reschedule or cancel anything that hasn't fired yet.",
  },
  {
    resource: "profileAnalysis",
    headline: "Fix what the click lands on",
    body: "Paste your profile. Get a score, a section-by-section critique, and rewrites you can paste straight back in — headline, About, the parts people actually read.",
    proof: "Per-role and per-project rewrites on paid plans.",
  },
  {
    resource: "contentPlan",
    headline: "Thirty days, decided",
    body: "Answer a few questions in a guided chat and get a ten-section strategy: your pillars, your cadence, your hooks, and what to post next — built from your own profile.",
    proof: "Regenerate whenever the strategy shifts.",
  },
];

export interface MarketingProblem {
  title: string;
  body: string;
  /** Key into NAV_ICONS (src/components/global/sidebar/nav-icons.tsx). */
  icon: string;
}

export const MARKETING_PROBLEMS: readonly MarketingProblem[] = [
  {
    title: "The blank box",
    body: "You already know the topic. Twenty minutes later the draft still isn't a post, and the tab is still open.",
    icon: "Sparkles",
  },
  {
    title: "The cadence gap",
    body: "Three posts in one good week, then nothing for a month. The algorithm notices long before you do.",
    icon: "CalendarDays",
  },
  {
    title: "The profile that undoes it",
    body: "The post earns the click. Then a stale headline and an empty About lose the follow you just paid for.",
    icon: "UserSearch",
  },
];

export interface MarketingStep {
  title: string;
  body: string;
}

export const MARKETING_STEPS: readonly MarketingStep[] = [
  {
    title: "Connect LinkedIn",
    body: "One OAuth click. Nothing goes out that you haven't approved.",
  },
  {
    title: "Get your plan",
    body: "A guided chat reads your profile and returns a 30-day strategy.",
  },
  {
    title: "Write and ship",
    body: "Post or deck. Publish now, drop it on the calendar, or save it as a draft.",
  },
];

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
      "Yes, and as a real one. You give it a topic and a slide count, it writes the whole deck, and you edit any line you don't like. The app then renders it to an actual PDF and publishes it through LinkedIn's document API, which is what makes a deck swipeable in the feed rather than a strip of images. Three templates, three to twelve slides. Only the generation counts against your plan — re-rendering an edited deck is free.",
  },
  {
    question: "Can I save a post and finish it later?",
    answer:
      "Yes, and a draft costs you nothing. Saving never touches your post allowance — you only spend a post at the moment you publish or schedule one. Drafts, scheduled posts, published posts and anything that failed all sit in one library, and opening a draft drops it straight back into the composer where you left it.",
  },
  {
    question: "Can I change the image on a post?",
    answer:
      "You can crop and adjust anything you upload, or describe the change you want in plain English and let the model redraw the image for you. The result appears beside the original and only replaces your attachment once you accept it, so a generation you didn't want never overwrites your photo — and the original stays one click away.",
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
  {
    question: "Is there an audit trail?",
    answer:
      "Every meaningful action in a workspace is recorded with who did it and when. The audit log view is available on Pro and above.",
  },
];

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
      { label: "Features", href: `#${MARKETING_SECTION_IDS.features}` },
      { label: "How it works", href: `#${MARKETING_SECTION_IDS.how}` },
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
      { label: "Why it works", href: `#${MARKETING_SECTION_IDS.why}` },
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
      "aiImageEdit",
      "carousel",
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
 * the full matrix is directly below it. `satisfies` is load-bearing: it refuses
 * any key that isn't actually a quota, so a bullet can never reference a
 * resource that has no number to show. */
export const MARKETING_PLAN_BULLET_RESOURCES = [
  "linkedinPosts",
  "aiGeneration",
  "carousel",
  "profileAnalysis",
  "member",
] as const satisfies readonly LimitResourceKey[];

/* The numbers the free-tier band shows. Six, and the band grids them 2/3/6 —
 * keep any change to this list on a length that divides evenly, or the last row
 * strands a lone tile. */
export const MARKETING_FREE_TIER_RESOURCES = [
  "linkedinPosts",
  "aiGeneration",
  "carousel",
  "aiImageEdit",
  "profileAnalysis",
  "contentPlan",
] as const satisfies readonly LimitResourceKey[];

/**
 * SOURCE OF TRUTH KEYWORDS: MARKETING_HERO_POST
 *
 * WHAT:  The sample post rendered inside the hero's LinkedInPostPreview.
 * WHY:   A realistic post, not lorem ipsum: the mockup is the product demo, and
 *        it has to survive being read. Deliberately SHORT — the hero has to show
 *        the shape of a generated post (hook, turn, close) without the card
 *        growing tall enough to out-shout the headline beside it.
 */
export const MARKETING_HERO_POST = {
  authorName: "Priya Raman",
  timestamp: "Now",
  commentary: `I turned down a role that paid 30% more.

Not because of the work. Because of one answer.

"What do the first 90 days look like?" — silence, then "we'll figure that out once you're in."

A team that can't describe your first quarter usually can't describe their own.

Ask the 90-day question. Listen to the pause.`,
} as const;
