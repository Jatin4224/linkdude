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
14. [How one request flows end to end](#how-one-request-flows-end-to-end)
15. [Testing it](#testing-it)
16. [Things only a live call could teach us](#things-only-a-live-call-could-teach-us)
17. [Mistakes that are easy to make](#mistakes-that-are-easy-to-make)
18. [What we deliberately did NOT build](#what-we-deliberately-did-not-build)
19. [File map](#file-map)

---

## The 10-second version

We added **8 new files** and edited **8 existing ones**. Same layer order as feature 1:

```
registry  →  types  →  config  →  services  →  router  →  UI
```

No database migration. The analysis is **ephemeral** — it returns to the browser and is never stored, exactly like AI post generation.

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

### The registry change that came free

Adding `read` to `permissions` let `nav.requirePermission` finally be correct. Step 1 documented a workaround — the nav was pinned to `create` because `read` did not exist on the resource, and the default would have produced a permission string matching nothing. Now:

```ts
permissions: ["create", "read", "discard"],
nav: { …, requirePermission: "read" },
```

A member who may review past critiques but not spend org quota can now reach the page. `PROFILE_ANALYSIS_READ` and `PROFILE_ANALYSIS_DISCARD` are generated by `buildPermissionConstants()` — `permissions.ts` was not touched.

---

## How one request flows end to end

**User pastes a URL and clicks Fetch:**

```
1.  profile-analyzer.tsx → fetchProfile.mutate({ profileUrl, organizationId })

2.  protectedProcedure wrapper                        ← AUTOMATIC
    ├─ logged in? in this org? has profileAnalysis:create?
    ├─ rate limit: 5 fetches/min
    └─ open transaction (90s ceiling)

3.  profile-analysis.ts fetch handler                 ← OUR CODE
    ├─ isProfileFetchConfigured()  → PRECONDITION_FAILED if no vendor key
    └─ profileSourceService.fetchProfileFromUrl()
        ├─ POST to Apify (75s abort ceiling)
        ├─ check: HTTP error? empty array? error-inside-200?
        └─ PROFILE_MAPPERS[apify] → FetchedProfile

4.  Transaction commits. No counter bump (verb isn't `create`).

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

9.  protectedProcedure wrapper                        ← AUTOMATIC
    ├─ increment the analysis counter
    └─ commit

10. AnalysisResult renders — score, rewrites, copy buttons
```

Steps 2, 4, 7 and 9 are free — they exist because of Step 1's registry entry.

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

### The checks that prove the wiring

```sql
SELECT * FROM usage_metrics WHERE "organizationId" = '<your org id>';
```

`profileAnalysis` should be **1** after one analysis — and should **not** move when you only fetch. We wrote no counting code; that's Step 1 working.

Then set your plan to `free` and run 6 analyses. The 6th is blocked with *"Upgrade to Starter to run more profile analyses"* — the exact string from the registry.

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

### Known limitations to plan for

**The URL path is best-effort.** LinkedIn is increasingly authwalled. Some profiles return nothing even with every fallback enabled. The paste path is the guarantee; treat URL as a convenience.

**Experience from a URL is thin.** No descriptions, only role/company/duration. Users who want deep experience feedback should paste.

**Vendor risk is real.** Proxycurl was the market leader and is gone. The registry means swapping is cheap — but budget for doing it eventually.

**Free credit runs out.** $5/month ≈ 500 lookups, and the fallback tiers we enabled consume more per call. Runs stop rather than billing you; the URL field should ideally surface that state.

---

## File map

**New files (10):**

```
src/lib/types/profile-analysis.ts                              Input, output, and vendor schemas
src/lib/config/profile-source.ts                               Vendor registry + timeouts
src/services/profile-source.service.ts                         Vendor HTTP + per-vendor mapping
src/services/profile-analysis.service.ts                       Persistence + Json re-validation   [Step 9]
src/trpc/routers/profile-analysis.ts                           fetchStatus / fetch / create / list / discard
src/app/(dashboard)/dashboard/profile-analysis/page.tsx        Thin shell
  .../_components/profile-analyzer.tsx                         Orchestration + permission gating
  .../_components/profile-form.tsx                             URL field + paste fields
  .../_components/analysis-result.tsx                          Score, rewrites, copy buttons
  .../_components/analysis-history.tsx                         Saved analyses + discard            [Step 9]
```

**Edited files (9):**

```
prisma/schema.prisma                          + ProfileAnalysis model                             [Step 9]
src/lib/resources.ts                          + profileAnalysis entry; + read/discard, audit, nav read
src/lib/types/index.ts                        + re-exports
src/lib/config/index.ts                       + AI_MAX_RETRIES, AI_TIMEOUT_MS
src/lib/config/ai.ts                          + retry/timeout ceilings; model → gemini-flash-latest
src/services/ai.service.ts                    + generateStructured, analyzeLinkedInProfile, prompt
src/trpc/routers/_app.ts                      + profileAnalysis mounted
src/components/global/sidebar/nav-icons.tsx   + UserSearch
.env.example                                  + PROFILE_SOURCE, APIFY_API_TOKEN, BRIGHTDATA_API_KEY
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
