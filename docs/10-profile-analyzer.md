# Building the AI Profile Analyzer — a complete walkthrough

This is the full build log for the second feature of the personal-branding tool: **a user supplies their LinkedIn profile — by pasting it or by URL — and AI returns a scored critique with paste-ready rewrites.**

Like [09-linkedin-post-generation.md](./09-linkedin-post-generation.md), it's written so someone who has never touched this codebase can follow along. Every step says *what* we did and *why*.

This feature has a different character from the first one. Feature 1 was mostly *construction* — the APIs did what the docs said. Feature 2 was mostly *discovery*: almost every important decision came from a live call returning something the documentation never mentioned. Those discoveries are the most valuable part of this document, so they're written up rather than hidden.

> **Note on feature 1's doc:** since it was written, the AI layer migrated from the raw Anthropic SDK to the **Vercel AI SDK** with Google Gemini. So `src/lib/config/ai.ts` no longer looks like the snippet in doc 09 — [Step 2](#step-2--structured-output) explains the current shape.

---

## Table of contents

1. [The 10-second version](#the-10-second-version)
2. [The constraint that shaped everything](#the-constraint-that-shaped-everything)
3. [Words you need to know](#words-you-need-to-know)
4. [What you need before you start](#what-you-need-before-you-start)
5. [Step 1 — The registry entry](#step-1--the-registry-entry)
6. [Step 2 — Structured output](#step-2--structured-output)
7. [Step 3 — Types and validation](#step-3--types-and-validation)
8. [Step 4 — The AI service](#step-4--the-ai-service)
9. [Step 5 — The vendor registry](#step-5--the-vendor-registry)
10. [Step 6 — The vendor service](#step-6--the-vendor-service)
11. [Step 7 — The router](#step-7--the-router)
12. [Step 8 — The UI](#step-8--the-ui)
13. [Step 9 — Saved history, and the verb that had to change](#step-9--saved-history-and-the-verb-that-had-to-change)
14. [Step 10 — Showing the meter before the bill](#step-10--showing-the-meter-before-the-bill)
15. [Step 11 — Cost controls, and the lever that doesn't exist](#step-11--cost-controls-and-the-lever-that-doesnt-exist)
16. [Step 12 — Extracting the lookup, and caching what it costs](#step-12--extracting-the-lookup-and-caching-what-it-costs)
17. [How one request flows end to end](#how-one-request-flows-end-to-end)
18. [Two incidents, and what they taught us about the database](#two-incidents-and-what-they-taught-us-about-the-database)
19. [Testing it](#testing-it)
20. [Things only a live call could teach us](#things-only-a-live-call-could-teach-us)
21. [Mistakes that are easy to make](#mistakes-that-are-easy-to-make)
22. [What we deliberately did NOT build](#what-we-deliberately-did-not-build)
23. [File map](#file-map)

---

## The 10-second version

We added **12 new files** and edited **9 existing ones**. Same layer order as feature 1:

```
registry  →  types  →  config  →  services  →  router  →  UI
```

> **This doc is a build log, and the feature outgrew its first version.** Steps 1-8 are the original build, where the analysis was **ephemeral** — returned to the browser, never stored. Step 9 replaced that with a `ProfileAnalysis` table and explains why the original choice was wrong. Steps 10-11 added the quota UI and the cost controls. Where a later step supersedes an earlier one, the earlier text is left in place with a pointer, because the *reasoning* is still what you need in order to understand the change.

Two ideas carried the design:

1. **You cannot read a LinkedIn profile.** Not through the API, not by fetching the page. This is not a limitation we worked around; it's the fact the whole feature is shaped by.
2. **Structured output.** Instead of asking the model for prose and parsing it, we hand it a Zod schema and get back a typed object. One declaration is simultaneously the instruction to the model and the validation of its answer.

---

## The constraint that shaped everything

Before writing a line, we checked whether we could actually get profile data. Two routes, both dead ends — and both worth verifying yourself rather than trusting.

### Route 1: LinkedIn's own API

The app already holds LinkedIn OAuth tokens from feature 1. So can we just ask LinkedIn for the profile?

Look at what `/v2/userinfo` actually returns ([`linkedin.service.ts`](../src/services/linkedin.service.ts)):

```ts
interface LinkedInUserInfo {
  sub: string        // the person's ID
  name?: string
  picture?: string
}
```

That's everything. **No headline, no About, no experience, no skills.** Those live behind `r_basicprofile` / `r_fullprofile`, which LinkedIn grants only to approved partners. A normal developer will not get them.

### Route 2: Let the AI read the public page

Gemini has a `url_context` tool that fetches URLs. Public profiles are, well, public. So we tested it — asking the model to read a public profile and reply `BLOCKED` if it couldn't:

```
Gemini url_context on a public LinkedIn profile:
finish: stop
BLOCKED
```

A direct server-side `fetch` timed out too. LinkedIn aggressively blocks automated reads. The actor we eventually used describes LinkedIn as *"authwalled (common in 2026)"*.

### So the user supplies the text

Every non-scraping LinkedIn optimizer works this way. Two input paths:

| Path | How | Cost | Reliability |
|---|---|---|---|
| **Paste** | User copies headline / About / experience into a form | Free | Always works |
| **URL** | A third-party data vendor scrapes it | Paid per lookup | Best-effort |

**Paste is the primary path.** URL is an enhancement layered on top — and critically, the URL path *fills the paste form* rather than bypassing it. More on why in [Step 8](#step-8--the-ui).

### A warning about the vendor category

We researched vendors before picking one, and the history matters:

**Proxycurl** was the default choice for this for years. LinkedIn sued them in **January 2025**; by **July 2025** they had shut down entirely — API dark, docs pulled. Anyone who built a feature on it lost that feature overnight.

The legal position is genuinely unsettled rather than clear-cut. *hiQ Labs v. LinkedIn* found scraping public data isn't a CFAA violation — but hiQ still lost on **breach of contract**, because scraping violates LinkedIn's User Agreement.

Two consequences we designed around:

- The vendor is **registry-driven**, so swapping one is a config change (see [Step 5](#step-5--the-vendor-registry)).
- Every vendor failure message ends with **"paste your details manually"**, so a dead vendor degrades to the free path instead of a broken page.

---

## Words you need to know

Building on the table in doc 09. New terms for this feature:

| Term | What it actually means |
|---|---|
| **Structured output** | Asking a model to return JSON matching a schema, instead of prose. The provider enforces the shape, so you get a typed object rather than text you have to parse. |
| **`generateObject`** | The Vercel AI SDK function for structured output. Sibling of `generateText`. Takes a Zod schema, returns a validated object. |
| **Scraper / data vendor** | A company that maintains proxy pools, fetches public pages at scale, and resells the data as an API. Apify, Bright Data. |
| **Actor** (Apify) | A packaged scraper on Apify's marketplace. Third-party code you run on their infrastructure — so it has its own pricing, permissions, and quirks *independent of Apify itself*. |
| **Idempotent** | An operation you can safely repeat with the same result. Reads are; a call that costs money each time is **not** — which is why the lookup is a mutation, not a query. |
| **`z.looseObject`** | A Zod object that allows unknown extra keys instead of rejecting them. Essential for scraped data, where the vendor may add fields at any time. |
| **Discriminated by shape** | Here: the same `FetchedProfile` shape is produced from two totally different vendor payloads, so nothing downstream knows which vendor ran. |

---

## What you need before you start

### Gemini API key

Free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey), no card.

```bash
AI_PROVIDER="google"
GOOGLE_GENERATIVE_AI_API_KEY="..."
```

> **Model gotcha:** `gemini-2.5-flash` is retired for new keys and 404s. And `gemini-3.5-flash` — which we pinned initially — returns **HTTP 503 "high demand"** on the free tier often enough to break the feature. We use `gemini-flash-latest`, an alias that tracks the current stable flash model. An alias can shift under you; a pinned model that's frequently unavailable is worse. Revisit when on a paid tier.

### Apify token (optional — only for URL lookup)

Free at [console.apify.com](https://console.apify.com) → Settings → Integrations. **$5/month of credit, forever, no credit card.** When credit runs out, runs stop — no overage, no invoice.

```bash
PROFILE_SOURCE="apify"
APIFY_API_TOKEN="apify_api_..."
```

Leave it unset and the URL field simply doesn't render. Paste still works.

> **Why not Bright Data?** Its free tier is bigger (5,000 records/month) but the account stays inactive until **billing details are on file**. Without a card, every call returns `400 "Customer is not active"`. It's still in the registry as a second option — one env word switches to it.

---

## Step 1 — The registry entry

**File: [`src/lib/resources.ts`](../src/lib/resources.ts)**

Same idea as feature 1: declare the feature, get the plumbing free.

```ts
profileAnalysis: {
  name: 'Profile Analysis',
  description: 'Analyze a LinkedIn profile and suggest improvements',
  permissions: ['create'],
  limit: {
    perPlan: { free: 5, starter: 50, pro: 300, enterprise: 'unlimited', portal: 'unlimited' },
    upgradeMessage: 'Upgrade to {nextPlan} to run more profile analyses',
    availableOnFreeTrial: true,
    unit: 'analyses',
  },
  rateLimit: {
    create: { count: 5, window: '1 m' },
    fetch:  { count: 5, window: '1 m' },
  },
  nav: {
    label: 'Profile Analysis',
    href: '/dashboard/profile-analysis',
    icon: 'UserSearch',
    section: 'main',
    requirePermission: 'create',   // ← REQUIRED. See below.
  },
},
```

> **This snippet is the entry as first written, and much of it has since changed.** It is left as-is because the reasoning below explains *why each value was chosen*, and the later steps only make sense against it. Current state: `permissions` gained `read` and `discard` ([Step 9](#the-registry-change-that-came-free)); `free` dropped from 5 to 3 ([Step 11](#step-11--cost-controls-and-the-lever-that-doesnt-exist)); the whole `fetch` rate limit is **gone**, because lookups became their own `profileLookup` resource ([Step 12](#step-12--extracting-the-lookup-and-caching-what-it-costs)); and `nav.requirePermission` stayed `create` after briefly moving to `read` — see [Step 9](#the-registry-change--and-the-one-that-got-reverted) for why that revert matters.

### Why a separate quota from `aiGeneration`

Same reasoning that split `aiGeneration` from `linkedinPosts` in feature 1. An analysis sends an **entire profile** and asks for structured output — several times the token cost of drafting a post. Sharing a counter would let one analysis silently eat a handful of post drafts.

Free tier is 5 analyses vs 25 generations, reflecting that cost difference.

### The trap: `nav.requirePermission`

This one is worth internalising because **it fails silently**.

Look at how the sidebar builds a nav item ([`resources.ts`](../src/lib/resources.ts)):

```ts
const action = def.nav.requirePermission ?? 'read'
const requirePermission = `${key}:${action}` as Permission
```

The default action is `'read'`. This resource only declares `['create']`. So omitting `requirePermission` produces `profileAnalysis:read` — **a permission that exists nowhere**.

And because of that `as Permission` cast, **there is no compile error**. The nav item would just be invisible to every non-owner, forever, with nothing in the logs.

`aiGeneration` never hit this because it has no `nav` block at all.

> **The general lesson:** when a default value is combined with a type assertion, you lose the compiler's help. Look for `as` in any code that builds identifiers from strings.

### The other silent failure: icons

**File: [`src/components/global/sidebar/nav-icons.tsx`](../src/components/global/sidebar/nav-icons.tsx)**

```ts
import { UserSearch } from 'lucide-react'

export const NAV_ICONS: Record<string, LucideIcon> = {
  // ...existing
  UserSearch,
}
```

`getNavIcon` falls back to a plain circle for unknown names. No crash, no warning — just a wrong-looking sidebar. Same trap as `Sparkles` in feature 1.

---

## Step 2 — Structured output

Before writing the feature, we had to answer: **how do we get structured data out of a model?**

### The naive approach, and why it's bad

```ts
const text = await generateText({ prompt: 'Return JSON with score, strengths...' })
const parsed = JSON.parse(text)   // 💥
```

Three ways this breaks:

1. The model wraps JSON in ```` ```json ```` fences, or adds "Here's your analysis:" — `JSON.parse` throws.
2. It returns valid JSON with the wrong shape — `parsed.score` is a string, or missing.
3. The prompt says one thing and your TypeScript type says another, and they drift over time.

### What we did instead

The Vercel AI SDK's `generateObject` takes a Zod schema, asks the provider for native structured output, and validates the result:

```ts
const { object } = await generateObject({
  model: getAiModel(),
  schema: profileAnalysisSchema,
  system,
  prompt,
})
// `object` is already typed AND validated
```

**One declaration does three jobs**: it instructs the model, it validates the response, and it types the value. They cannot drift, because they're the same object.

### We verified it before committing to it

Never assume a provider supports a feature. We tested `generateObject` + Gemini + Zod v4 with a realistic schema and a deliberately weak profile:

```
generateObject + Gemini + zod v4 -> stop 5657ms
schema-valid: true
score: 35
sample fix: "Rebuild headline to include core skills and impact, e.g., 'Software Engineer at Acme | Pyt..."
```

Schema-valid, sensible score, concrete rewrite. Green light.

### The reliability fix this surfaced

That same testing kept hitting:

```
AI_APICallError: This model is currently experiencing high demand
```

HTTP **503**, which the SDK marks `isRetryable: true`. With the default `maxRetries: 2` and exponential backoff, **one call hung for over 180 seconds** before failing.

That matters enormously here, because model calls run inside a **database transaction** (more in [Step 7](#step-7--the-router)). A 180-second hang blows the transaction *and* holds a Postgres connection the whole time — then fails.

So [`src/lib/config/ai.ts`](../src/lib/config/ai.ts) gained hard ceilings:

```ts
export const AI_MAX_RETRIES = 1
export const AI_TIMEOUT_MS = 45_000
```

Both are applied to every model call in the service. **This fixed the existing post-generation feature too** — it had the same exposure and nobody had noticed.

> **General principle:** any retry policy inside a transaction needs an explicit ceiling. Defaults are tuned for standalone scripts, not for code holding a database connection.

---

## Step 3 — Types and validation

**File: [`src/lib/types/profile-analysis.ts`](../src/lib/types/profile-analysis.ts)**

Per project rules, every custom type lives in `src/lib/types/`.

### Input: what the user supplies

```ts
export const PROFILE_HEADLINE_MAX = 220
export const PROFILE_ABOUT_MAX = 2600
export const PROFILE_EXPERIENCE_MAX = 5000

export const analyzeProfileSchema = z.object({
  headline: z.string().trim()
    .min(10, 'Paste your headline — at least 10 characters')
    .max(PROFILE_HEADLINE_MAX, `Headlines are limited to ${PROFILE_HEADLINE_MAX} characters`),
  about: z.string().trim()
    .min(50, 'Paste your About section — at least 50 characters to analyze')
    .max(PROFILE_ABOUT_MAX, ...),
  experience: z.string().trim().max(PROFILE_EXPERIENCE_MAX).optional(),
})
```

Decisions worth understanding:

- **The maxima are LinkedIn's real field limits.** Advice about text the user can't actually save is useless.
- **`about` has a 50-character minimum.** Without it, someone pastes "I code" and the model invents a profile to critique. A floor forces there to be something real to analyze.
- **`experience` is optional.** It sharpens the analysis considerably, but plenty of users won't paste it — and requiring it would block the feature for them.

### Output: what the model returns

```ts
export const profileAnalysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1).max(500),
  headlineFeedback: sectionFeedbackSchema,
  aboutFeedback: sectionFeedbackSchema,
  strengths: z.array(z.string().min(1).max(300)).min(1).max(3),
  improvements: z.array(profileImprovementSchema).min(1).max(4),
})
```

where:

```ts
export const sectionFeedbackSchema = z.object({
  verdict: z.string().min(1).max(400),
  rewrite: z.string().min(1).max(PROFILE_ABOUT_MAX),
})
```

**Why `rewrite` matters more than `verdict`.** A verdict tells the user what's wrong. A rewrite hands them the fix. The user came here to avoid writing — so the schema *forces* the model to produce finished text, not advice about text.

**Why the array bounds (`.min(1).max(3)`).** Two reasons, and the second is less obvious:

1. The UI stays predictable — no analysis returns 47 strengths.
2. **It's a better prompt.** An unbounded list makes models trail off into filler. "Between 1 and 3" is a concrete target they hit well.

### The vendor schemas: everything optional, on purpose

```ts
export const apifyProfileSchema = z.looseObject({
  name: z.string().nullish(),
  headline: z.string().nullish(),
  about: z.string().nullish(),
  experience: z.array(apifyExperienceSchema).nullish(),
})
```

This looks lax. It's deliberate, and the reasoning generalises to **any** scraped data:

- **Scraped data is not an API contract.** Fields vary per profile — a user with no About section legitimately has no `about` key. Strict validation would turn "this person didn't fill in their About" into a hard crash.
- **`looseObject` allows unknown keys.** If the vendor *adds* a field, nothing breaks. A strict object would reject the whole payload over a field we don't even read.
- **Consequence:** nothing downstream may assume a field is present. The mapper supplies fallbacks, and the form stays editable so the user can fill gaps.

### The schema that catches a lie

```ts
export const scrapedErrorItemSchema = z.object({ error: z.string().min(1) })
```

This exists because of a bug found only by live testing. An actor returned **HTTP 201 — success** — with this body:

```json
[{ "error": "Users on the free Apify plan can run the actor through the UI and not via other methods." }]
```

Because the profile schema is loose, that item **parses cleanly as a valid profile with every field absent**. Without this check, a clear, actionable vendor message would be silently converted into "this profile looks empty."

> **The general lesson:** when your schema is permissive, you must explicitly detect the failure shapes it would otherwise swallow. Permissiveness and error detection have to be designed together.

---

## Step 4 — The AI service

**File: [`src/services/ai.service.ts`](../src/services/ai.service.ts)**

Feature 1 established this file as the app's single seat of model invocation, with one primitive (`generateText`) and one task (`generateLinkedInPost`). We added a second of each.

### The new primitive

```ts
export async function generateStructured<T>({
  system, prompt, schema,
}: GenerateStructuredArgs<T>): Promise<T> {
  const provider = getAiProvider()

  const { object } = await generateObject({
    model: getAiModel(),
    schema,
    maxOutputTokens: AI_MAX_TOKENS,
    providerOptions: provider.providerOptions,
    maxRetries: AI_MAX_RETRIES,
    timeout: AI_TIMEOUT_MS,
    system,
    prompt,
  })

  return object
}
```

Note the generic is `z.ZodType<T>` and the return is `T` — so callers get their exact type back, not `unknown`.

It reads its model and options from the **provider registry** (`getAiModel()` / `getAiProvider()`), exactly like `generateText`. That's what keeps it vendor-agnostic: switching from Gemini to Claude changes one env var and nothing in this function.

### The system prompt is the product

For a critique tool, the prompt *is* the feature. The default failure mode is advice that sounds insightful and is useless — "add more keywords", "tell your story". Every rule exists to prevent a specific failure:

| Rule | The failure it prevents |
|---|---|
| "Every fix must be text the person can paste directly. Never describe what they should write — write it for them." | Advice instead of deliverables. The whole value proposition. |
| "Never invent facts... leave a placeholder like `[X%]` or `[company]`." | The model fabricating achievements. A profile with invented metrics is worse than no rewrite — it's a lie the user might publish. |
| "Quote their actual words when explaining a problem." | Generic feedback that could apply to anyone. Quoting proves it read *their* profile. |
| "Ban generic advice: 'add more keywords', 'be more authentic'..." | Naming the clichés explicitly works far better than "be specific". |
| "The headline rewrite must fit LinkedIn's 220-character limit." | A rewrite the user literally cannot save. |
| "The About rewrite opens with a standalone hook." | LinkedIn truncates About behind "see more" — the first line is the only guaranteed-visible part. |
| "Score honestly. Most profiles land 30-60; reserve 80+ for exceptional." | Flattery. A tool that says "85, looking great!" gives the user nothing to do. |

The placeholder rule is verifiably working — a live run produced:

```
Software Engineer at Acme | Building high-availability [backend/frontend/full-stack]
systems in [Tech Stack] that scale to [X] users
```

Real structure, honest gaps.

### The task

```ts
export async function analyzeLinkedInProfile(
  input: AnalyzeProfileValues
): Promise<ProfileAnalysis> {
  const experienceSection = input.experience
    ? `\n\nEXPERIENCE:\n${input.experience}`
    : '\n\n(No experience section provided — judge only the headline and About, and do not comment on missing experience.)'

  return generateStructured({
    system: PROFILE_ANALYSIS_SYSTEM_PROMPT,
    prompt: `Analyze this LinkedIn profile.\n\nHEADLINE:\n${input.headline}\n\nABOUT:\n${input.about}${experienceSection}`,
    schema: profileAnalysisSchema,
  })
}
```

Two details:

- **Sections are labelled** (`HEADLINE:`, `ABOUT:`) so feedback can be attributed back to the field it belongs to.
- **Missing experience is stated explicitly**, not sent as an empty string. Otherwise the model wastes an `improvements` slot on "you should add experience" — which the user knows, and didn't ask about.

---

## Step 5 — The vendor registry

**File: [`src/lib/config/profile-source.ts`](../src/lib/config/profile-source.ts)**

This mirrors the `AI_PROVIDERS` registry pattern. Given that Proxycurl died mid-lawsuit, **assume your vendor will be replaced** and make replacement cheap.

```ts
export interface ProfileSourceDefinition {
  readonly label: string
  readonly apiKeyEnvVar: string
  readonly consoleUrl: string
  readonly endpoint: string
  readonly buildHeaders: (apiKey: string) => Record<string, string>
  readonly buildBody: (profileUrl: string) => string
}
```

Vendors disagree about **everything**, which is why each entry builds its own request:

```ts
// Apify wants an object
buildBody: (profileUrl) => JSON.stringify({ profileUrls: [profileUrl], ... })

// Bright Data wants an array
buildBody: (profileUrl) => JSON.stringify([{ url: profileUrl }])
```

### Choosing the actor — the part docs won't tell you

We started with `dev_fusion~linkedin-profile-scraper`, the best-known LinkedIn actor. It returned HTTP 201 and the error shown in [Step 3](#the-schema-that-catches-a-lie): **free-plan users can't run it via API at all.** Nothing on its page says so.

So we probed candidates empirically. Reading actor metadata and input schemas costs nothing:

```
supreme_coder~linkedin-profile-scraper   required: ["urls"]
thirdwatch~linkedin-profile-scraper      required: []  → profileUrls
myagizm~linkedin-profile-scraper         required: []  → startUrls
apimaestro~linkedin-profile-detail       required: ["username"]
```

Four actors, four different input field names. Then we ran them:

```
FAIL supreme_coder~...   HTTP 400  Input is not valid: Items in input.urls...
PASS thirdwatch~...      9593ms    keys=18
```

`thirdwatch~linkedin-profile-scraper` wins, and the config records **why**, so nobody swaps it casually:

```ts
/* Verified callable via the API on Apify's FREE plan. That is not a given and is
 * the binding constraint on this choice: `dev_fusion~linkedin-profile-scraper`
 * answers HTTP 201 with `{ error: "Users on the free Apify plan can run the
 * actor through the UI and not via other methods." }`. Re-verify free-plan API
 * access before swapping this id — the actor page does not state the restriction. */
const APIFY_ACTOR_ID = 'thirdwatch~linkedin-profile-scraper'
```

### The cookie rule

Several popular LinkedIn actors ask for your `li_at` session cookie. **Never use these in a product.** They act *as* the account whose cookie is supplied, which risks getting a real person's LinkedIn restricted or banned. Cookie-free actors scrape public pages through their own proxies instead.

### Turning on the fallback tiers

The actor's own input schema, read live:

```
useFallbacks        boolean  default=true
  When direct LinkedIn access is authwalled (common in 2026), fall back to
  extracting public profile data from Brave Search, Google, and Bing.
preferFullProfile   boolean  default=false
  Try residential LinkedIn recovery before partial search results.
usePremiumFallback  boolean  default=false
  When all our scraping tiers fail, call harvestapi's scraper as a final fallback.
```

Two recovery tiers are **off by default**. With them off, an authwalled profile returns an empty array after ~26 seconds. So we enable both:

```ts
buildBody: (profileUrl) =>
  JSON.stringify({
    profileUrls: [profileUrl],
    maxProfiles: 1,
    useFallbacks: true,
    preferFullProfile: true,
    usePremiumFallback: true,
  }),
```

They cost more per lookup. That's the right trade: **a lookup that finds nothing still costs 26 seconds of the user's time.** `maxProfiles: 1` caps the blast radius — we only ever send one URL, so this guards against a future bug fanning out.

### Timeouts, sized by measurement

```ts
export const PROFILE_FETCH_TIMEOUT_MS = 75_000
```

Not a guess. A failing direct lookup already burns ~26s **before** the recovery tiers start. At the original 40s we'd have paid for the fallbacks and then aborted before collecting the result — the worst of both.

---

## Step 6 — The vendor service

**File: [`src/services/profile-source.service.ts`](../src/services/profile-source.service.ts)**

Starts with `import 'server-only'` — it reads a **billable** credential. A leaked AI key is bad; a leaked scraping key is someone else's invoice.

### Per-vendor mapping

```ts
const PROFILE_MAPPERS: Record<ProfileSource, (raw: unknown) => FetchedProfile | null> = {
  apify:      (raw) => { const p = apifyProfileSchema.safeParse(raw);      return p.success ? mapApifyProfile(p.data) : null },
  brightdata: (raw) => { const p = brightDataProfileSchema.safeParse(raw); return p.success ? mapBrightDataProfile(p.data) : null },
}
```

Typing it as `Record<ProfileSource, ...>` means **adding a vendor without a mapper is a compile error**. The union and the map can't drift.

Everything downstream sees only `FetchedProfile` and never learns which vendor ran. That's the payoff: when Apify dies, one entry changes and the router, the UI, and the analysis service are untouched.

### The reality of scraped data

The live response taught us the actual shape — which differed from the docs we'd coded against:

```
EXPERIENCE[0] KEYS: position, companyName, startDate, duration
EXPERIENCE[0]: { "position": "Co-chair", "companyName": "Gates Foundation",
                 "startDate": { "year": 2000 }, "duration": "26 yrs" }
```

**There is no `description` field.** Roles are facts, not prose. So the mapper reconstructs a role list:

```
Co-chair | Gates Foundation | 26 yrs | from 2000

Founder | Breakthrough Energy | 11 yrs | from 2015
```

Thinner than a pasted Experience section — and that's an honest limitation of the URL path, handled two ways: the field stays editable, and the prompt is told not to fault a section it wasn't given.

### Four ways a lookup fails

This is the most defensive code in the feature, and every branch came from something we actually observed:

```ts
// 1. Network / hung vendor
catch (error) {
  if (error.name === 'AbortError') throw new Error('The profile lookup took too long...')
}

// 2. HTTP error — and the remedies DIFFER
const needsActorApproval = /permission|not-approved|approvePermissions/i.test(body)
const isAccountProblem = response.status === 401 || response.status === 402 ||
  /not active|suspend|billing|payment|quota|credit|exceed/i.test(body)

// 3. HTTP 2xx with an EMPTY array
if (empty) throw new Error('No profile was found at that URL...')

// 4. HTTP 2xx with an error INSIDE
const vendorError = scrapedErrorItemSchema.safeParse(record)
```

**Why go to this trouble?** Because these all look identical from the outside — a failed lookup — but need completely different actions:

| Failure | The actual fix |
|---|---|
| Actor not approved | One click in the Apify console |
| Account not active | Add billing details |
| Empty array | Check the URL; the profile may be private |
| Error inside 201 | Your plan can't use this endpoint |

Early on, all four reported *"this profile may be private"*. That sends the user to inspect their own LinkedIn URL while the real problem is a billing page. **A wrong error message is worse than a vague one** — it actively wastes time.

### Logging that stays useful

```ts
function describePayload(value: unknown): string {
  if (value == null) return String(value)
  if (Array.isArray(value)) return `array[${value.length}]`
  if (typeof value === 'object') return `object{${Object.keys(value).join(',')}}`
  return typeof value
}
```

Logs the **shape** — key names only, never scraped personal data. If the vendor renames a field, that's diagnosable from the server log instead of needing someone to re-run probes by hand.

---

## Step 7 — The router

**File: [`src/trpc/routers/profile-analysis.ts`](../src/trpc/routers/profile-analysis.ts)**

Three procedures. The split between them is the most important architectural decision in this feature.

### Why fetch and analyze are separate

The obvious design is one button: paste URL → get analysis. We didn't build that, for a measured reason.

Every mutation in this codebase runs inside a **Prisma transaction** ([`protected.ts`](../src/trpc/procedures/protected.ts)), with a default 10-second timeout:

```ts
if (type === 'mutation') {
  await prisma.$transaction(async (tx) => { ... }, { timeout: txTimeout })
}
```

Measured timings:

```
fetch   : 8.8s   (up to 75s worst case with fallback tiers)
analyze : 8.7s   (up to 45s)
```

Chained, that's ~17s typically and **potentially 120s**. Against a 10s default it fails outright; even at 60s it fails intermittently — **after already spending money on the scrape.** And it holds a Postgres connection the entire time.

Feature 1 hit this exact bug: image publishing worked for small images and failed for large ones, because the upload blew the 10s transaction. That's why `linkedinPosts.create` now carries `txTimeout: 60_000`.

So: **two endpoints, two transactions.**

There's a product benefit too, and it's arguably the better argument. Scraped profiles are often incomplete or subtly wrong. Splitting the steps means the user **reviews what was scraped before spending an analysis on it**. Analyzing the wrong text is worse than not analyzing.

### `fetch` — deliberately not named `create`

```ts
fetch: protectedProcedure({
  requirePermission: permissions.PROFILE_ANALYSIS_CREATE,
  txTimeout: 90_000,
  audit: false,
})
```

Three deliberate choices:

- **Not `create`.** From doc 09's path rule, `create` increments the usage counter — but a lookup is not an analysis. Naming it `fetch` keeps it off the counter. Its cost is contained by the `fetch` rate limit from Step 1, which is then the **only** thing between a stuck client and a real invoice.
- **`txTimeout: 90_000`** must exceed `PROFILE_FETCH_TIMEOUT_MS` (75s), or the transaction dies before the service's own abort fires — turning a clean "lookup timed out" into an opaque Prisma error.
- **`audit: false`.** Nothing is created or changed; an audit row per lookup is noise.

### Why it's a mutation and not a query

This is a genuine fork worth understanding, because the framework treats them differently:

> ```
> - mutation: wrap in a transaction
> - query:    skip the transaction; pass the plain prisma client
> ```

Making `fetch` a **query** would skip the transaction entirely — no connection held, no timeout ceiling. Tempting.

We kept it a mutation anyway. **React Query refetches queries on window focus by default.** Every refetch here is a *billed* vendor call. A user tabbing back and forth would silently burn their credit.

Holding a connection for up to 90s is the accepted cost of never spending money by accident. It's documented in the code as something to revisit if Neon pool pressure appears.

> **The general lesson:** "is this a query or a mutation?" isn't about whether it writes to *your* database. It's about whether repeating it is safe. Non-idempotent operations are mutations, full stop.

### `fetchStatus` — why the UI can't decide this itself

```ts
fetchStatus: protectedProcedure()
  .input(z.object({ organizationId: z.string().min(1) }))
  .query(() => ({ canFetchByUrl: isProfileFetchConfigured() })),
```

Whether a vendor key exists is a **server fact**. The key is never in the client bundle (that's the point of `server-only`), so the browser cannot know. Without this, the UI would render a URL field that always errors on installs without a vendor.

It returns a boolean and nothing else — not the key, not the endpoint, not the env var name.

### `create` — the analysis itself

```ts
create: protectedProcedure({
  requirePermission: permissions.PROFILE_ANALYSIS_CREATE,
  txTimeout: 60_000,
})
  .input(analyzeProfileSchema.and(z.object({ organizationId: z.string().min(1) })))
  .mutation(async ({ input }) => {
    if (!isAiConfigured()) {
      const provider = getAiProvider()
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `AI analysis is not configured. Add ${provider.apiKeyEnvVar} to enable it.`,
      })
    }
    return await aiService.analyzeLinkedInProfile(input)
  })
```

Same shape as `aiGeneration.create` from feature 1: named `create` so the quota fires, and the config check runs **before** the quota is spent so an operator's missing key doesn't cost the user an analysis.

Note the error message names the env var **for whichever provider is configured** — so it stays correct after switching from Gemini to Claude.

---

## Step 8 — The UI

**Files: [`src/app/(dashboard)/dashboard/profile-analysis/`](../src/app/(dashboard)/dashboard/profile-analysis/)**

Three components, all route-local. Nothing was made global — no second surface needs them yet, and premature globalisation is its own mess.

### The URL field fills the form

The single most important UX decision:

```tsx
React.useEffect(() => {
  if (!fetched) return
  form.reset({
    headline: fetched.headline,
    about: fetched.about,
    experience: fetched.experience,
  })
}, [fetched, form])
```

A lookup **populates the paste form**. It does not skip it. So:

- The user sees exactly what was scraped and can fix it
- The name is displayed (*"Loaded Bill Gates — review the fields below"*), so a wrong-profile fetch is obvious **before** an analysis is spent
- Both paths converge on one code path afterwards
- If the vendor dies, the form still works — it's the same form

`form.reset` rather than `setValue` marks the fields pristine: a fetched profile isn't user input yet.

### Permission gating, done properly this time

```tsx
const canAnalyze = hasPermission(permissions.PROFILE_ANALYSIS_CREATE)
```

The server is authoritative, so this is UX rather than security — but without it a member lacking the permission clicks a live button and gets a FORBIDDEN toast. With it, the button is disabled and explains why.

> Feature 1's composer *doesn't* do this — a known gap. Getting it right in new code is free; retrofitting is a chore.

### The result view

Rewrites are the product, so each gets a copy button:

```tsx
async function handleCopy() {
  try {
    await navigator.clipboard.writeText(text)
    setCopied(true)
  } catch {
    toast.error('Could not copy. Select the text and copy manually.')
  }
}
```

The `catch` isn't defensive padding — `navigator.clipboard` genuinely fails in insecure contexts and some browsers.

Scores are banded rather than shown bare:

```ts
const SCORE_BANDS = [
  { min: 75, label: 'Strong', ... },
  { min: 50, label: 'Solid, needs sharpening', ... },
] as const

const BASE_BAND = { label: 'Needs work', ... } as const

function bandFor(score: number): { label: string; className: string } {
  return SCORE_BANDS.find((band) => score >= band.min) ?? BASE_BAND
}
```

A number invites arguing with the number; a label says what to do about it.

> **TypeScript detail:** the floor case is a **separate constant**, not a `min: 0` row. This project has `noUncheckedIndexedAccess: true`, so `SCORE_BANDS[SCORE_BANDS.length - 1]` is typed `T | undefined` — using it as a fallback wouldn't compile without a cast, and casts are banned here. Restructuring beats casting.

---

## Step 9 — Saved history, and the verb that had to change

Steps 1-8 shipped the analyzer with the result held in React state and nothing written to the database. That was a deliberate choice at the time — it matched `aiGeneration` and skipped a migration. It was also wrong, and the reason is worth stating precisely.

**The quota is spent at the moment the model answers.** `profileAnalysis.create` increments the usage counter inside the procedure transaction. A free-tier org has five analyses *in total*. So an ephemeral result meant a page refresh destroyed something the org had already paid for, with no way to get it back. Post generation does not have this problem in the same way — a draft you lose can be regenerated for one more of a much larger allowance.

### The model

`ProfileAnalysis` stores the input and the output side by side. The input columns exist so a history row is self-contained: it can be compared against a later run without the user re-pasting anything.

`score` and `summary` are **denormalised out of** the `result` JSON. The list renders a score and a one-line summary per row; without the copies, drawing the list would mean parsing a full critique payload for every entry.

`result` itself is a `Json` column rather than a spread of columns, because the critique is nested — per-section feedback objects, a strengths array, an improvements array. The precedent is `ActivityLog.metadata`.

### The Json column is the one place an untyped value enters the app

Prisma types a `Json` column as `Prisma.JsonValue`. That is exactly the kind of value this codebase does not allow to spread. So `profile-analysis.service.ts` parses every row back through `profileAnalysisSchema` — the *same* schema `generateObject` used to produce it — before it crosses the service boundary:

```ts
function toStoredAnalysis(row: ProfileAnalysisRow): StoredProfileAnalysis | null {
  const parsed = profileAnalysisSchema.safeParse(row.result);
  if (!parsed.success) return null;
  return { id: row.id, /* … */ result: parsed.data };
}
```

`safeParse` and a `null` return, not `parse` and a throw. If the critique schema ever changes, rows written under the old shape stop parsing — and throwing would take down the entire history list, hiding every valid analysis alongside the one stale row.

The payoff is at the top of the stack: `StoredProfileAnalysis.result` is typed `ProfileAnalysis`, so a critique loaded from history and a critique that just came back from the model are **the same type**. `AnalysisResult` renders both with no branch, and `ProfileAnalyzer` holds one piece of state instead of two.

### The verb: `discard`, not `delete`

This is the part that is easy to get wrong, and it is not a naming preference.

`protectedProcedure` decrements the usage counter on any path matching `<resource>.delete` ([`src/trpc/procedures/protected.ts`](../src/trpc/procedures/protected.ts)). That behaviour is correct for a quota counting **things you hold** — delete a post, free a slot. It is wrong for this one, which counts **model spend**. The API call was already billed; removing the saved row does not un-bill it.

Under the name `delete`, this sequence would be an unlimited free tier:

```
analyze  → counter 1/5
delete   → counter 0/5   ← the money is gone, the quota is not
analyze  → counter 1/5   ← forever
```

The registry documents the way out, in `getMutationFeatureMap`:

> *Rigid by design — if a procedure should bump a counter but doesn't fit `<resource>.create` / `<resource>.delete`, **rename the procedure** rather than special-casing here.*

So the verb is `discard`. That one decision keeps both the server-side bump and the client-side optimistic map from firing, and the infrastructure layer stays closed — no flag, no exception list, no edit to `protected.ts`.

The UI states it in the confirmation copy, because a user who assumes a refund would otherwise clear their history to "get analyses back":

> The critique and its rewrites are removed permanently. This does not return the analysis to your monthly allowance — the model call has already been paid for.

`discard` also throws `NOT_FOUND` when `deleteMany` reports `count === 0`, so a stale list row reports honestly instead of silently succeeding.

### The registry change — and the one that got reverted

`permissions` gained two verbs:

```ts
permissions: ["create", "read", "discard"],
```

`PROFILE_ANALYSIS_READ` and `PROFILE_ANALYSIS_DISCARD` are generated by `buildPermissionConstants()` — `permissions.ts` was not touched. They also appear automatically as toggles in the role builder, because `permission-switches.tsx` derives its groups from `RESOURCES`. An owner can grant them in two clicks.

The tempting follow-on was to fix Step 1's documented workaround by moving the nav from `create` to `read`, since `read` now exists and is the more natural gate for a page. **That was tried and reverted**, and the reason is a good lesson about adding permissions to a live system.

Custom roles store one `OrganizationRole` row per literal `resource:permission` string, `hasPermission` is an exact string match, and **nothing backfills existing roles when the registry gains a permission**:

```ts
// use-active-organization.ts
if (isOwner) return true
return activeOrganization.permissions.includes(permission)
```

`profileAnalysis:read` did not exist when any current role was created. So gating the nav on it removes the page from every existing custom-role member — silently, with nothing in the logs. Owners never see it, because they bypass every check.

That is the *same silent failure* Step 1 warns about, reached from the opposite direction: there, the nav asked for a permission that existed nowhere in the registry; here, for one that existed in the registry but in nobody's role.

So the nav stays on `create`:

```ts
nav: { …, requirePermission: "create" },
```

> **The general lesson:** adding a permission is backwards-compatible. *Requiring* a new permission is not. Anything already gated must keep asking for a permission that existing roles actually hold, until a backfill grants the new one.

### Reuse — closing a thread the first version left open

The model stores `about` and `experience`, and the schema comment justified them as *"kept so history rows are re-runnable."* In the first version that was not true: `PROFILE_ANALYSIS_LIST_SELECT` did not select them and nothing read them back. Two `TEXT` columns of profile prose were written on every analysis and never used.

Columns that are written and never read are pure cost, so the fix was to make the comment true rather than delete the evidence. `StoredProfileAnalysis` now carries the original submission:

```ts
input: AnalyzeProfileValues
```

and each history row gets a reuse action that refills the form.

Two details worth copying:

**The prefill goes through the existing `fetched` prop.** A vendor lookup and a history reuse want the identical thing — put these values in the fields — so routing both through one path means there is only one way for the form to be populated, and only one place for it to go wrong. `name: null` suppresses the "Loaded &lt;name&gt;" line, which belongs to the URL flow.

**Reuse refills, it does not re-analyze.** Analyzing straight from the button would spend quota on a click whose stated intent was only "show me this one again."

**And an `exactOptionalPropertyTypes` trap.** The column is `String?` (nullable), the schema field is `.optional()`. Those are *different things* under this project's config — an explicit `undefined` is not a legal value for an optional property. So the key is omitted rather than set to undefined:

```ts
return {
  headline: row.headline,
  about: row.about,
  ...(row.experience === null ? {} : { experience: row.experience }),
}
```

Writing `experience: row.experience ?? undefined` looks equivalent and does not compile.

---

## Step 10 — Showing the meter before the bill

With history working, the page still had a hole. The plan caps analyses, the counter increments the instant the model answers, and **the UI said nothing about either**. The experience on the free tier was:

```
analyses 1-5   →  work, with no indication a limit exists
analysis 6     →  click Analyze
                  request goes to the server
                  server rejects it
                  red toast: "limit reached"
                  no upgrade path, no explanation
```

The user discovers the cap by hitting it. On a metered action that is the wrong moment — the decision to spend was already made, and the error is a dead end.

Worse, this was a **documented convention the page was ignoring**. [doc 07 Step 7](./07-adding-a-feature.md) says the trigger for a limited resource gets wrapped in `<FeatureGate>` so the cap opens the upgrade modal. `profile-analyzer.tsx` never imported it.

### Wrapping the button

```tsx
<FeatureGate resource="profileAnalysis">
  <Button type="submit" variant="brand" disabled={busy} className="w-full">
```

The mechanism is worth understanding. `FeatureGate` uses `React.cloneElement` to inject its own `onClick` into whatever single child it is given. At the limit that handler calls `e.preventDefault()` — and because this is a **submit** button, preventing the click prevents the form submission. The request never leaves the browser. Then it opens `UpgradeModal`.

It also fails **closed**: while the gate query is still loading, the child renders `disabled`, so a fast click cannot outrun the check.

This is UX only — the server re-checks the limit on every request regardless. The gate exists so the user gets an offer instead of an error.

> **Placement detail:** the wrap lives in `profile-form.tsx`, not the parent. `FeatureGate` wraps exactly one element, and the button is inside the form.

### The meter, and why it is global

**File: [`src/components/global/usage-meter/`](../src/components/global/usage-meter/)**

```
3 of 5 analyses used
[======------]
```

Three decisions in it:

**It went in `components/global/`, not the route folder.** Post generation (`aiGeneration`, 25 free) and publishing (`linkedinPosts`, 10 free) have the identical gap. Per the project rules, anything reusable across routes is global. Building it route-local would have guaranteed a second copy later.

**It takes one prop and fetches its own numbers.**

```tsx
<UsageMeter resource="profileAnalysis" />
```

The alternative — `usage={3} limit={5}` from the parent — creates a way for the displayed numbers to disagree with the server's, because two places would know the count. Calling `useFeatureGate` inside the component means there is exactly one source.

**Its label comes from the registry.** The word "analyses" is read from `RESOURCES[resource].limit.unit`. A `label` prop would be a second source of truth for something `resources.ts` already owns.

### The type that prevented a silent bug

The obvious prop type is `ResourceKey`. It is wrong, and reading `getFeatureGates` is what showed why:

```ts
// Flag-only resources are in the gate map too:
gates[resourceKey] = { usage: 0, limit: null, atLimit: ..., isUnlimited: false, ... }
```

`auditLogs` is a **flag** resource, not a limit resource — it has no quota, so its gate carries `limit: null`. Pass it to a meter and you render an empty box, silently, forever.

So the prop is typed `LimitResourceKey`, the existing union from `resources.ts` that contains only resources declaring a `limit`. Passing `auditLogs` is now a compile error.

> **The general lesson:** when a map is keyed by a broad union but only some members are meaningful, narrow the parameter to the subset. The type system already knows which ones — `LimitResourceKey` was sitting there unused.

### A correction worth recording

The plan for this step said `useFeatureGate` returns `currentUsage`, `available`, and `percentage`. It does not:

```ts
export type FeatureGateData = {
  usage: number
  limit: number | null
  atLimit: boolean
  isUnlimited: boolean
  featureName: string
}
```

Those other three fields belong to `UsageMetricsData`, a *different* internal type in the same file. The meter computes its own percentage from `usage / limit`. Cheap to fix here — but it is exactly the kind of thing that becomes a runtime `undefined` if you write UI from memory instead of from the type.

### The invalidation that already worked

Does the meter update after an analysis? `create.onSuccess` already calls:

```ts
await Promise.all([
  utils.profileAnalysis.list.invalidate(),
  utils.usage.invalidate(),
])
```

tRPC invalidates by **router prefix**, so `utils.usage.invalidate()` covers `usage.getFeatureGates` — the exact query the meter reads. No change was needed. Worth checking rather than assuming, because the alternative failure is subtle: the meter would simply show a stale number for five minutes (the gate query's `staleTime`) and nobody would call it a bug.

---

## Step 11 — Cost controls, and the lever that doesn't exist

The free quota was 5 analyses. The ask was to drop it to 3, because **Apify lookups cost money**.

The change itself is one line. The interesting part is that **it does not do what it sounds like it does.**

### Two meters, not one

| Action | What it costs | What limits it |
|---|---|---|
| `profileAnalysis.create` | a Gemini call | the plan quota — 3 on free |
| `profileAnalysis.fetch` | **an Apify lookup** | a rate limit only — **no lifetime cap** |

*(That row describes the state at the time. Step 12 moved the lookup to its own resource with its own quota — the second row no longer applies.)*

[Step 7](#fetch--deliberately-not-named-create) deliberately kept `fetch` off the usage counter, because a lookup is not an analysis. That was the right call for quota accounting and it has a consequence nobody had stated: **the expensive call is the uncapped one.**

The rate limiter is keyed on `userId:organizationId:clientIp`. At the original `{ count: 5, window: '1 m' }`, one free account could legitimately run **5 lookups a minute — 300 an hour — indefinitely**, without ever clicking Analyze.

So lowering the analysis quota capped the cheap call and left the expensive one alone.

### The lever that doesn't exist

The obvious fix is to tighten the `fetch` rate limit. Look at the type first:

```ts
export interface ResourceRateLimit {
  [action: string]: { count: number; window: `${number} ${'s'|'m'|'h'|'d'}` }
}
```

There is no `perPlan`. **Rate limits in this registry are flat — one setting for every plan.** Only `limit.perPlan` is plan-aware.

That makes the rate limit a blunt instrument: anything strict enough to contain a free account also throttles a Pro customer who is paying for 300 analyses. There is no way to express "3/day for free, 100/day for pro" in a rate limit here.

### What we did, and what we deliberately didn't

Applied — a moderate tightening, sized to cap runaway clients without touching real workflows:

```ts
fetch: { count: 20, window: '1 h' },   // was { count: 5, window: '1 m' }
```

That drops the ceiling from 300/hour to 20/hour — roughly 93% — while staying well above any human's actual usage. It is insurance against a stuck client or a script, not a business control.

**The real fix is a separate quota,** because quotas *are* per-plan:

```ts
profileLookup: {
  name: 'Profile Lookups',
  permissions: ['create'],
  limit: {
    perPlan: { free: 3, starter: 50, pro: 300, enterprise: 'unlimited', portal: 'unlimited' },
    upgradeMessage: 'Upgrade to {nextPlan} for more profile lookups',
    availableOnFreeTrial: true,
    unit: 'lookups',
  },
}
```

A free user then gets 3 Apify calls *ever*, not 3 per hour. It needs its own router so the path becomes `profileLookup.create` and the counter wiring fires — the same naming rule from [Step 9](#the-verb-discard-not-delete), used in the opposite direction. **No migration is required**: `UsageMetrics` is keyed by a `featureKey` string, so a new metered resource needs no schema change. And `<UsageMeter resource="profileLookup" />` next to the URL field would be a one-liner.

> **Built in [Step 12](#step-12--extracting-the-lookup-and-caching-what-it-costs).** The 20/hour stopgap above is gone — the quota replaced it, and the rate limit that remains is burst protection only.

> **The general lesson:** before you change a number to control a cost, confirm the number governs the thing that costs money. Here the quota and the expense were on two different procedures, and the fix that felt obvious touched neither.

---

## Step 12 — Extracting the lookup, and caching what it costs

Step 11 concluded that lookups need their own quota. The trigger to actually do it was a different question: *"the profile fetch is useful in other features too — can we make it global?"*

Both turn out to be the same change, which is worth noticing. A capability that needs its own cost control also needs its own permission and its own namespace, because those are the same thing: **a resource**.

### Most of it was already global

The instinct was to go build a shared module. The first thing to check is whether one already exists — and here it effectively did:

| Layer | Already reusable? |
|---|---|
| `profile-source.service.ts` — vendor HTTP + mapping | ✅ `fetchProfileFromUrl(url)`, knows nothing about analysis |
| `config/profile-source.ts` — vendor registry | ✅ swapping Apify for Bright Data is one env var |
| **tRPC procedure** | ❌ `profileAnalysis.fetch` |
| **Permission** | ❌ required `profileAnalysis:create` |
| **Quota / rate limit** | ❌ metered under the `profileAnalysis` resource |
| **Types** | ❌ `FetchedProfile` lived in `types/profile-analysis.ts` |

So this was not "build a shared thing". It was **lift the ceiling off a shared thing that was already there** — the service had always been generic, and only the plumbing above it was feature-shaped.

Under the old shape, an outreach-drafting feature wanting to look up a profile would have had to ask for `profileAnalysis:create` and would have shared the analyzer's rate limit. Both wrong, and worse with every feature added.

### The type module, and which way the arrow points

`fetchProfileSchema`, the vendor payload schemas, `FetchedProfile`, and the LinkedIn field ceilings moved to `src/lib/types/profile-lookup.ts`.

The rule that decided the direction: **`profile-analysis.ts` imports from `profile-lookup.ts`, never the reverse.** A shared capability must not know about the features built on it. Getting this backwards is how "shared" modules end up importing from three features and becoming unmovable.

The old names are re-exported from `profile-analysis.ts` and the barrel, so nothing downstream broke.

> **One gotcha:** `export { X } from './y'` re-exports without binding `X` locally. `analyzeProfileSchema` validates against `PROFILE_HEADLINE_MAX`, so the file needs a real `import` **as well as** the re-export. The compiler catches it immediately, but the fix is not obvious if you have not hit it.

### The cache, and why it forced a two-procedure split

Every lookup is a billed vendor call, and the same profile gets requested repeatedly — a retry, a page reload, a second feature wanting the same person. Without a cache each of those is another invoice line for byte-identical data. Making the lookup *global* makes this worse, not better: more callers, more duplicate requests.

So a `ProfileLookup` table caches the mapped result. And that immediately collided with the counter wiring, in [`protected.ts`](../src/trpc/procedures/protected.ts):

> *`.create` increments, `.delete` decrements — always, for every resource that declares a `limit`. **No opt-out**: counters always reflect reality.*

Serving a cache hit from `create` would therefore charge a lookup for data that cost nothing. There is no flag to suppress that, and adding one would punch a hole in an invariant the whole app relies on.

The answer is two procedures rather than one clever one:

```
profileLookup.get     query,    read permission   -> cached profile or null. FREE.
profileLookup.create  mutation, create permission -> spends a lookup. ALWAYS increments.
```

`create` still checks the cache first and short-circuits before touching the vendor — so a duplicate request inside the TTL never bills twice even if the caller forgets to call `get`. But it still increments, because the user asked to spend a lookup and the counter must reflect what was asked for. That asymmetry is deliberate: **the cache saves the vendor charge, not the quota unit.**

This is the third time in this document the same rule has applied: when the convention does not fit, change the shape of the code, not the convention. `discard` instead of `delete`, `fetch` instead of `create`, and now `get` alongside `create`.

### Two details that quietly decide the bill

**URLs are normalised before they become cache keys.**

```
/in/jatin      /in/jatin/      /IN/Jatin      /in/jatin?utm_source=x
```

That is one person. Keyed raw, it is four cache rows and therefore four charges. `normaliseProfileUrl` lowercases, strips query and hash, drops the trailing slash, and collapses `uk.` / `www.` to one canonical host — applied on every read *and* write so no caller can bypass it.

**The cache is per organization, never global.** A shared cache would be cheaper and is the obvious optimisation. It would also reveal which profiles another tenant has been researching — a competitive-intelligence leak wearing the costume of a performance win. `organizationId` is part of the unique key, not merely an index.

**TTL is 7 days.** Profiles change slowly, so a short TTL spends money re-fetching text that has not moved. The UI shows the age and can offer a fresh fetch, so the ceiling never traps anyone.

### The registry entry

```ts
profileLookup: {
  name: 'Profile Lookups',
  permissions: ['create', 'read'],     // read = use the cache; create = spend
  limit: { perPlan: { free: 3, starter: 50, pro: 300, ... }, unit: 'lookups' },
  rateLimit: { create: { count: 5, window: '1 m' } },   // burst only
  audit: { entity: 'profileLookup', describe: { create: 'Looked up a LinkedIn profile' } },
}
```

The flat `fetch: { count: 20, window: '1 h' }` came **off** `profileAnalysis`. Free tier now gets 3 lookups *total* rather than 20 per hour forever — which was the actual hole. What remains is burst protection so a stuck client cannot spend a month's quota in a minute.

`<UsageMeter resource="profileLookup" />` sits beside the URL field and `<FeatureGate resource="profileLookup">` wraps the Fetch button — both free, because [Step 10](#step-10--showing-the-meter-before-the-bill) built them against `LimitResourceKey` rather than one hard-coded resource. That is the payoff for having generalised them once.

> **The general lesson:** "make it reusable" is usually not a rewrite. Find the layer that is already generic — there often is one — and ask what is sitting on top of it that shouldn't be. Here the answer was a permission, a quota, a namespace, and a type file, and none of the actual logic changed.

---

## How one request flows end to end

**User pastes a URL and clicks Fetch:**

```
1.  profile-analyzer.tsx → fetchProfile.mutate({ profileUrl, organizationId })

2.  protectedProcedure wrapper                        ← AUTOMATIC
    ├─ logged in? in this org? has profileLookup:create?     (Step 12)
    ├─ PLAN LIMIT: under the lookup quota? → 402 + upgrade   (Step 12)
    ├─ rate limit: 5 lookups/min (burst only)
    └─ open transaction (90s ceiling)

3.  profile-lookup.ts create handler                  ← OUR CODE
    ├─ isProfileFetchConfigured()  → PRECONDITION_FAILED if no vendor key
    ├─ readCachedLookup()  → CACHE HIT? return it, vendor never called
    └─ profileSourceService.fetchProfileFromUrl()
        ├─ POST to Apify (75s abort ceiling)
        ├─ check: HTTP error? empty array? error-inside-200?
        └─ PROFILE_MAPPERS[apify] → FetchedProfile
    └─ writeCachedLookup()  → upsert on (organizationId, normalised url)

4.  protectedProcedure wrapper                        ← AUTOMATIC
    ├─ increment the LOOKUP counter (always — see Step 12)
    └─ commit

5.  profile-form.tsx → form.reset(fetched)   — fields fill, user reviews
```

**Then the user clicks Analyze:**

```
6.  analyze.mutate({ headline, about, experience, organizationId })

7.  protectedProcedure wrapper                        ← AUTOMATIC
    ├─ permission + rate limit (5/min)
    ├─ PLAN LIMIT: under the analysis quota?  → 402 + upgrade message
    └─ open transaction (60s ceiling)

8.  create handler → aiService.analyzeLinkedInProfile()
    └─ generateStructured() → generateObject()
        ├─ maxRetries: 1, timeout: 45s
        └─ Gemini returns JSON validated against profileAnalysisSchema

8b. recordAnalysis(ctx.db, …)                         ← Step 9
    └─ INSERT the row, in the SAME transaction, so a failed
       write rolls the counter back with it

9.  protectedProcedure wrapper                        ← AUTOMATIC
    ├─ increment the analysis counter
    └─ commit

10. AnalysisResult renders — score, rewrites, copy buttons
11. UsageMeter refetches via utils.usage.invalidate() ← Step 10
```

Steps 2, 4, 7 and 9 are free — they exist because of Step 1's registry entry.

---

## Two incidents, and what they taught us about the database

Neither of these was a bug in the feature. Both happened while shipping it, both looked like something other than what they were, and both are the kind of thing that costs an afternoon if you have not seen it before.

### Incident 1 — "We need to reset the public schema"

Adding the `ProfileAnalysis` model meant getting the table into the database. The instinct — and what [doc 07](./07-adding-a-feature.md) says — is:

```bash
npx prisma migrate dev --name add_profile_analysis
```

Which answered:

```
Drift detected: Your database schema is not in sync with your migration history.
[+] Added tables
  - account, activity_log, invitation, linkedin_account, ... (15 tables)

We need to reset the "public" schema at ep-sparkling-meadow-...neon.tech
You may use prisma migrate reset to drop the development database.
All data will be lost.
```

**Do not run that.** Read what it actually says: the tables it lists as "unexpected" are *every table in the app*.

The cause: **this project has no `prisma/migrations/` directory.** It has never used migrations. [doc 09](./09-linkedin-post-generation.md) builds its tables with `npx prisma db push`. So `migrate dev` compared an empty migration history against a full database, concluded the entire schema was drift, and offered to reconcile by deleting all of it.

The correct command here is:

```bash
npx prisma db push
```

Before running anything destructive, you can see exactly what will change — this is read-only:

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel   prisma/schema.prisma \
  --script
```

For this change it printed one `CREATE TABLE`, two `CREATE INDEX`, and two `ADD FOREIGN KEY` — purely additive, nothing dropped. That is the confirmation worth having before touching a database with real rows in it.

> **Two lessons.** First: `migrate dev` and `db push` are different workflows and mixing them produces exactly this false alarm — know which one your project uses (`ls prisma/migrations` answers it in one second). Second: when a tool offers to delete everything, read the diff before accepting the remedy. The database was completely fine.
>
> Note that doc 07's walkthrough says `migrate dev`. It is describing the general Prisma flow, not this repo's actual practice. This repo uses `db push`.

### Incident 2 — a database error that had nothing to do with the database

Shortly after, the app started failing at **login**:

```
Invalid `prisma.session.findFirst()` invocation:
Timed out fetching a new connection from the connection pool.
(Current connection pool timeout: 10, connection limit: 13)
```

Read it carefully. It never says the database is slow, down, or unreachable. It says: *I waited 10 seconds for one of your 13 connections and none came free.*

**What a connection is.** In Postgres a connection is an operating-system **process** on the database server, holding several megabytes of its own memory. That is why they are scarce and why every deployment caps them. Opening one also costs a TCP handshake, TLS, and auth — tens of milliseconds — so applications keep a **pool** and lend them out.

Both numbers in that error were Prisma defaults we had never set: `connection_limit` defaults to `physical cores × 2 + 1` (13 on a 6-core machine — a number derived from the developer's laptop, not from the app), and `pool_timeout` defaults to 10 seconds.

**Why 13 wasn't enough.** The default assumes queries are fast. At 1-5ms, one connection serves hundreds of requests a second. This app breaks that assumption, and [Step 7](#why-fetch-and-analyze-are-separate) explains why: every mutation runs inside a transaction, and a transaction *is a state of one specific connection*, so it holds that connection for its entire body.

```ts
await prisma.$transaction(async (tx) => {
  const result = await callTheAI(input)   // ← 60 SECONDS, zero database work
  await tx.profileAnalysis.create(...)
  await incrementUsage(...)
})
```

Five procedures do this: `profileLookup.create` (90s — `profileAnalysis.fetch` when this incident happened), `profileAnalysis.create` (60s), `aiGeneration.create` (60s), `linkedinPosts.create` (60s), `billing.*` (20s). A few concurrent analyses park most of the pool on network latency. Then the session lookup — which runs on **every single request** — queues behind them and dies at 10 seconds.

That is why it surfaced at login. The auth query is not slow; it is the highest-frequency query, so it is the first to notice there is nothing left to borrow. **It was the casualty, not the cause.**

**The immediate mitigation**, in `DATABASE_URL`:

```
&connection_limit=25&pool_timeout=20
```

Safe here because the app connects to Neon's `-pooler` endpoint, where PgBouncer multiplexes many client connections onto far fewer real Postgres processes — 25 does not mean 25 backends.

**But be honest about what that is.** It raises the ceiling; it does not fix the cause. You now need roughly twice the concurrency to hit the same wall.

**The real fix** is to move the slow call out of the transaction:

```
CURRENT                        CORRECT
─────────                      ────────
BEGIN                          call Gemini      ← 60s, holding NO connection
  call Gemini  ← 60s idle      BEGIN            ← now borrow one
  INSERT row                     INSERT row     ← ~2ms
  UPDATE counter                 UPDATE counter
COMMIT                         COMMIT           ← released immediately
```

Same atomicity over the writes, connection held for milliseconds. It has **not** been done, because the transaction is opened by `protected.ts` — the shared factory doc 07 says a feature should never edit — so it is a platform change affecting all five procedures, not a fix to this feature.

The exposure was predicted in the code before it happened, in `profile-source.service.ts`:

> *"Holding a connection this long is the accepted cost of not spending money by accident; revisit if Neon pool pressure ever shows up."*

That is what a good trade-off looks like written down: the benefit, the cost, and the trigger for revisiting. The trigger fired.

> **The rule:** never perform network I/O inside a database transaction. Not an API call, not a file upload, not a webhook. A transaction holds a scarce, process-backed resource — its body should contain database statements and nothing else.
>
> **And the PgBouncer trap:** a pooler does not save you. In transaction mode it assigns a server connection *per transaction*, so a 60-second transaction pins one for 60 seconds. A long transaction defeats both pools at once.

---

## Testing it

```bash
npx tsc --noEmit     # must print nothing
npm run lint         # must print nothing
npm run build        # catches server/client boundary violations
npm run dev
```

`npm run build` matters most: `tsc` won't notice a `server-only` file imported into a client component, but the build fails loudly.

In the browser:

| # | Do this | Expect |
|---|---|---|
| 1 | Open the dashboard | "Profile Analysis" in the sidebar with a magnifier icon |
| 2 | Paste a weak headline + About, click **Analyze Profile** | Score, rewrites, and fixes within ~10s |
| 3 | Submit a 20-character About | Inline field error, no network call |
| 4 | Paste your LinkedIn URL, click **Fetch profile** | Fields populate; your name shown above them |
| 5 | Edit a fetched field, then **Analyze** | Analysis reflects your edit, not the scrape |
| 6 | Click **Copy** on the headline rewrite | Button flips to "Copied" for 2s |
| 7 | Reload the page after an analysis | The critique is still there, under **Past analyses** ([Step 9](#step-9--saved-history-and-the-verb-that-had-to-change)) |
| 8 | Click a past analysis | It reopens in the result pane, unchanged |
| 9 | Discard one | Row disappears and **the usage counter does not move** — this is the assertion that proves `discard` is doing its job |
| 10 | Look above the form | *"n of 3 analyses used"* with a bar ([Step 10](#step-10--showing-the-meter-before-the-bill)) |

### The checks that prove the wiring

```sql
SELECT * FROM "usageMetrics" WHERE "organizationId" = '<your org id>';
```

`profileAnalysis` should be **1** after one analysis — and should **not** move when you only fetch, nor when you discard. We wrote no counting code; that's Step 1 working, plus the verb choice from Step 9.

Since [Step 12](#step-12--extracting-the-lookup-and-caching-what-it-costs) there is a **second** row to watch, `profileLookup`, with its own counter. The checks that prove that wiring:

| Do this | Expect |
|---|---|
| Fetch a profile by URL | `profileLookup` = 1, `profileAnalysis` unchanged |
| Fetch the **same** URL again | Counter goes to 2, but the response is instant — the cache served it and **no vendor call was made** |
| Fetch the same URL with a trailing slash or `?utm_source=x` | Still a cache hit — normalisation collapsed it to one key |
| Check `profile_lookup` rows | One row per profile, not one per fetch — refresh upserts |

Then set your plan to `free` and run 4 analyses. The 4th is blocked — and since [Step 10](#step-10--showing-the-meter-before-the-bill), it is blocked **in the browser**: the Analyze button opens the upgrade modal and fires no request at all.

Reaching the cap honestly costs 3 model calls. Cheaper: set `currentUsage` to the limit on that row directly, then reload.

### Test the failure paths too

They're most of the code:

| Do this | Expect |
|---|---|
| Unset `APIFY_API_TOKEN`, restart | URL field disappears entirely; paste still works |
| Fetch `linkedin.com/in/definitely-not-real-99812` | *"No profile was found at that URL..."* |
| Unset `GOOGLE_GENERATIVE_AI_API_KEY`, restart | *"AI analysis is not configured. Add GOOGLE_GENERATIVE_AI_API_KEY..."* — and **no quota consumed** |

---

## Things only a live call could teach us

The most useful section of this document. Every one of these cost real debugging time and **none** is in any documentation.

| What we assumed | What actually happened |
|---|---|
| Gemini's `url_context` can read a public LinkedIn page | Returned `BLOCKED` |
| `gemini-2.5-flash` works | 404 — retired for new API keys |
| A pinned model is more reliable than an alias | `gemini-3.5-flash` returned 503 "high demand" constantly on free tier |
| SDK retry defaults are fine | `maxRetries: 2` + backoff = one call hanging **180+ seconds** |
| Bright Data's free tier works with just a token | `400 "Customer is not active"` — needs billing details on file even for free |
| Apify actors just run | `403 full-permission-actor-not-approved` — needs a one-time console approval |
| A popular actor works on the free plan | `dev_fusion` returns **HTTP 201** with `{error: "...free Apify plan...UI and not via other methods"}` |
| A failed scrape returns an HTTP error | Returns **HTTP 201 with `array[0]`** — after 26 seconds |
| Fallback tiers are on by default | Two of three are **off**; without them authwalled profiles return nothing |
| The actor's fields match its docs | Docs said `fullName`/`summary`/`experiences`; reality was `name`/`about`/`experience`, and roles have **no description** |

Two patterns worth extracting:

**1. Vendors report failure inside success.** HTTP 2xx does not mean it worked. Check for empty collections and error keys in the body, always.

**2. Error handling can't be written from documentation.** Every branch in [Step 6](#four-ways-a-lookup-fails) exists because we saw the failure. If you integrate a vendor and your error handling is "if (!res.ok) throw", you have not finished.

---

## Mistakes that are easy to make

| Mistake | What happens | Fix |
|---|---|---|
| Omitting `nav.requirePermission` on a create-only resource | Nav item invisible to all non-owners. **No compile error** — it's `as Permission`-cast | Set it explicitly to a verb the resource declares |
| Icon string not in `NAV_ICONS` | Sidebar shows a plain circle, silently | Add the import + map entry |
| Naming the lookup `create` | It increments the analysis counter — a lookup isn't an analysis | Use a non-counting verb like `fetch` |
| Making a paid lookup a `query` | React Query refetches on window focus → silent billing | Non-idempotent = mutation |
| `txTimeout` ≤ the service's own timeout | Transaction dies first; clean timeout becomes an opaque Prisma error | Keep `txTimeout` comfortably above it |
| Chaining scrape + model call in one procedure | ~120s worst case inside one transaction; fails after spending money | Split into two endpoints |
| Strict Zod schema on scraped data | A user with no About section crashes the lookup | `looseObject` + `.nullish()` everywhere |
| Loose schema with no error detection | `{error: "..."}` parses as an empty profile; the real message is lost | Add an explicit error-item schema |
| Trusting `if (!res.ok)` alone | Misses empty arrays and errors inside 2xx | Check the body shape too |
| Reporting every vendor failure identically | User checks their URL while the real fix is a billing page | Branch the message per cause |
| Using an actor that wants `li_at` | You act as that account; risks a real person's LinkedIn ban | Cookie-free actors only |
| Indexing an array for a fallback | `noUncheckedIndexedAccess` makes it `T \| undefined` | Declare the fallback as its own constant |
| `description?: string \| null` on a mapped object | `exactOptionalPropertyTypes` rejects explicit `undefined` | Use `description: string \| null \| undefined` |
| Naming the history delete `delete` | Refunds quota for money already spent → unlimited free tier | Rename the verb (`discard`) so the convention doesn't match |
| Writing `undefined` to a nullable Prisma column | `exactOptionalPropertyTypes` rejects `string \| undefined` against `string \| null` | Normalise at the write: `experience: args.experience ?? null` |
| Typing a usage meter's prop `ResourceKey` | Flag resources have `limit: null` → silent empty box | Narrow to `LimitResourceKey` |
| Running `prisma migrate dev` in a `db push` project | "Drift detected", offers to **drop the whole database** | Check `ls prisma/migrations` first; use `db push` here |
| An external API call inside `$transaction` | One connection held for 60-90s; pool starves and *auth* starts failing | Call the API first, open the transaction only for the writes |
| Assuming a rate limit can protect a plan tier | `ResourceRateLimit` has no `perPlan` — one setting for everyone | Use a `limit.perPlan` quota; only quotas are plan-aware |
| Serving a cache hit from `<resource>.create` | The counter has **no opt-out** — free data charges a quota unit | Free reads get their own `get` query; `create` means "spend one" |
| Caching a paid lookup globally instead of per tenant | Cheaper, and it leaks which profiles another org researched | Put `organizationId` in the unique key, not just an index |
| Using the raw URL as a cache key | `/in/x`, `/in/x/`, `/IN/X`, `?utm=` are 4 keys and 4 charges for one person | Normalise on every read and write |
| A "shared" module importing from a feature | The dependency arrow inverts and the module stops being movable | Shared code never imports the features built on it |
| `export { X } from './y'` and then using `X` locally | Re-export does not bind the name in this module | Add a real `import` alongside the re-export |
| Gating existing UI on a **newly added** permission | Custom roles don't have it and nothing backfills them — the page vanishes for them, silently | Keep the gate on a permission current roles hold, or ship a backfill |
| A `delete` service returning `void` | `computeDeleteDecrement` sees no `count` and decrements by 1 — deleting nothing still refunds quota | Return `deleteMany`'s `{ count }` and let the caller surface it |
| `field: value ?? undefined` for an optional prop | `exactOptionalPropertyTypes` rejects an explicit `undefined` | Omit the key: `...(v === null ? {} : { field: v })` |

---

## What we deliberately did NOT build

| Not built | Why | When |
|---|---|---|
| ~~**Saved analysis history**~~ | ~~Chose ephemeral to match `aiGeneration` and skip a migration~~ | **Built — see [Step 9](#step-9--saved-history-and-the-verb-that-had-to-change)** |
| **Score-over-time chart** | History rows now exist, so the data is there. Held back because two data points aren't a trend and the strip already shows the movement | When a typical org has run enough analyses for a line to mean something |
| **PDF upload** | LinkedIn's own "Save to PDF" export is free, fully compliant, richer than scraping, and immune to vendor shutdowns. Costs a PDF-parsing dependency | Strong candidate — it's the *durable* input path |
| **Auto-apply rewrites** | Would need `w_member_social`-style write access to profile fields. LinkedIn exposes no such API | Not possible |
| **Analyzing someone else's profile** | Works technically, but the prompt and UI assume "your profile" | Competitor analysis would be its own feature |
| **Bulk analysis** | Needs async jobs — a lookup already takes tens of seconds | Only with a queue |
| ~~**A `profileLookup` quota**~~ | ~~Apify lookups have no lifetime cap — only a flat rate limit that can't vary by plan~~ | **Built — see [Step 12](#step-12--extracting-the-lookup-and-caching-what-it-costs)** |
| **A `docs/11-profile-lookup.md`** | Step 12 turned the lookup into a standalone capability with its own resource, router, cache, and types. It is documented here only because this is where it grew up — it is no longer part of this feature | When a second feature consumes it, which is the moment the split stops being theoretical |
| ~~**Re-running an analysis from history**~~ | ~~The `about` / `experience` columns are written for exactly this and are never read back~~ | **Built — see [Reuse](#reuse--closing-a-thread-the-first-version-left-open)** |
| **Moving the model call out of the transaction** | The fix for the pool incident. Touches `protected.ts`, so it is a platform change affecting five procedures, not a feature change | Deliberate platform work |
| **A backfill for new permissions** | Adding a verb to `RESOURCES` does not grant it to existing custom roles, so any newly-required permission is a silent regression. Owners can re-save each role by hand today | Worth a one-off script when a permission next needs to be *required* |

### Known limitations to plan for

**The URL path is best-effort.** LinkedIn is increasingly authwalled. Some profiles return nothing even with every fallback enabled. The paste path is the guarantee; treat URL as a convenience.

**Experience from a URL is thin.** No descriptions, only role/company/duration. Users who want deep experience feedback should paste.

**Vendor risk is real.** Proxycurl was the market leader and is gone. The registry means swapping is cheap — but budget for doing it eventually.

**Free credit runs out.** $5/month ≈ 500 lookups, and the fallback tiers we enabled consume more per call. Runs stop rather than billing you; the URL field should ideally surface that state.

---

## File map

**New files (12):**

```
src/lib/types/profile-analysis.ts                              Input, output, and vendor schemas
src/lib/config/profile-source.ts                               Vendor registry + timeouts
src/services/profile-source.service.ts                         Vendor HTTP + per-vendor mapping
src/services/profile-analysis.service.ts                       Persistence + Json re-validation   [Step 9]
src/lib/types/profile-lookup.ts                                URL + vendor + FetchedProfile      [Step 12]
src/services/profile-lookup.service.ts                         Per-org cache, TTL, URL normalise  [Step 12]
src/trpc/routers/profile-lookup.ts                             status / get / create              [Step 12]
src/trpc/routers/profile-analysis.ts                           create / list / discard
src/app/(dashboard)/dashboard/profile-analysis/page.tsx        Thin shell
  .../_components/profile-analyzer.tsx                         Orchestration + permission gating
  .../_components/profile-form.tsx                             URL field + paste fields
  .../_components/analysis-result.tsx                          Score, rewrites, copy buttons
  .../_components/analysis-history.tsx                         Saved analyses + discard            [Step 9]
src/components/global/usage-meter/usage-meter.tsx              Plan-usage bar, any limit resource  [Step 10]
src/components/global/usage-meter/index.ts                     Barrel                              [Step 10]
```

**Edited files (9):**

```
prisma/schema.prisma                          + ProfileAnalysis model [9]; + ProfileLookup cache  [Step 12]
src/lib/resources.ts                          + profileAnalysis entry; + read/discard, audit [9];
                                              free 5→3 [11]; + profileLookup resource, fetch
                                              rate limit removed                                 [Step 12]
src/lib/types/profile-analysis.ts             lookup types moved out, re-exported                [Step 12]
src/trpc/routers/_app.ts                      + profileLookup mounted                            [Step 12]
src/lib/types/index.ts                        + re-exports
src/lib/config/index.ts                       + AI_MAX_RETRIES, AI_TIMEOUT_MS
src/lib/config/ai.ts                          + retry/timeout ceilings; model → gemini-flash-latest
src/services/ai.service.ts                    + generateStructured, analyzeLinkedInProfile, prompt
src/trpc/routers/_app.ts                      + profileAnalysis mounted
src/components/global/sidebar/nav-icons.tsx   + UserSearch
.env.example                                  + PROFILE_SOURCE, APIFY_API_TOKEN, BRIGHTDATA_API_KEY
```

**Environment change forced by the pool incident:**

```
DATABASE_URL   + &connection_limit=25&pool_timeout=20
```

**Fixes to existing code that this feature forced:**

- `AI_MAX_RETRIES` / `AI_TIMEOUT_MS` also protect **post generation**, which had the same 180-second-hang exposure.
- The model switch to `gemini-flash-latest` fixes 503s in **both** AI features.

---

## The one thing to remember

Doc 09's lesson was: *declare the feature in the registry and the plumbing wires itself.* That still holds — Step 1 is still where quotas, permissions, rate limits, and navigation come from.

This feature adds a second lesson, about integrating anything you don't control:

> **Verify with a live call before you design around it.** Every significant decision here — two endpoints instead of one, which actor, loose schemas, four separate failure branches, the timeout numbers — came from running the thing and reading what came back. None of it came from documentation, and several assumptions the documentation supported turned out to be false.
>
> The corollary: when a vendor can fail, assume it *will*, and make sure your feature degrades to something that still works. Here that's the paste form — which is why it's the primary path, and the URL field is the enhancement.

Steps 9-11 added a third, which only appeared once the feature was in use rather than being built:

> **Know what your numbers actually govern.** Three of the hardest problems here were mismatches between a control and the thing it was meant to control. A `delete` verb refunded quota for money already spent. A quota capped the cheap call while the expensive one ran uncapped. A transaction guaranteed atomicity by holding a database connection through a 60-second network call, and the first symptom was users unable to log in.
>
> None of those were visible in the code that contained them. Each one only showed up by tracing a value end to end — what increments this counter, what does this limit apply to, what is held while this runs. When something meters cost, correctness is not "does it work" but "does it measure the right thing."

### Where this feature stands

Working and shipped: paste and URL input, structured critique, saved history with discard, a usage meter, and a client-side upgrade path at the cap.

One thread left open:

**The model call still runs inside the transaction** — mitigated by a bigger connection pool, not fixed. It touches `protected.ts` and affects five procedures, so it is platform work rather than a change to this feature.

Closed since the first version: saved history and `discard` (Step 9), quota UX and the upgrade path (Step 10), the free-tier drop (Step 11), and the lookup extraction with its own quota and cache (Step 12). Plus, during the pre-push review: reuse-from-history, the nav permission regression, `.env.example` missing the pool settings, `docs/07` recommending a command that offers to drop the database, and a pre-existing counter drift in `linkedinPosts.delete`.

**A note on this document.** It started as the build log for one feature and now covers a capability that outgrew it — the lookup has its own resource, router, cache, and types, and the analyzer is merely its first consumer. When a second feature starts calling `profileLookup`, Step 12 should move to its own doc. Until then it lives here, because this is where the reasoning happened and splitting it early would separate the decisions from the context that produced them.
