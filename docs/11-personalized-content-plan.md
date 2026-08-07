# Building the Personalized Content Plan — a complete walkthrough

This is the full build log for the third feature of the personal-branding tool: **a guided chat reads your LinkedIn profile, asks you four questions, and returns a ten-section 30-day posting strategy.**

Like [09-linkedin-post-generation.md](./09-linkedin-post-generation.md) and [10-profile-analyzer.md](./10-profile-analyzer.md), it's written so someone who has never opened this codebase can follow along. Every step says *what* we did and *why* — and where a decision has a cost, the cost is stated rather than hidden.

This feature has a different character again. Feature 2 was *discovery* — live API calls kept returning things the docs never mentioned. Feature 3 was mostly *composition*: almost every server-side piece already existed, and the real work was deciding **what not to build**. The two genuinely new things were a conversational UI (the app had none) and a much larger AI response than anything before it — and that second one produced the only real bug, which is written up in full in [Step 12](#step-12--the-bug-only-a-live-call-could-find).

---

## Table of contents

1. [The 10-second version](#the-10-second-version)
2. [What we're building](#what-were-building)
3. [Words you need to know](#words-you-need-to-know)
4. [Four decisions made before any code](#four-decisions-made-before-any-code)
5. [Step 1 — The database model](#step-1--the-database-model)
6. [Step 2 — Types, and the two-schema trick](#step-2--types-and-the-two-schema-trick)
7. [Step 3 — The step registry](#step-3--the-step-registry)
8. [Step 4 — The section registry](#step-4--the-section-registry)
9. [Step 5 — The registry entry, and the metering puzzle](#step-5--the-registry-entry-and-the-metering-puzzle)
10. [Step 6 — The AI service](#step-6--the-ai-service)
11. [Step 7 — The service layer](#step-7--the-service-layer)
12. [Step 8 — The router, and six verbs that each mean something](#step-8--the-router-and-six-verbs-that-each-mean-something)
13. [Step 9 — Deleting code before writing any](#step-9--deleting-code-before-writing-any)
14. [Step 10 — The chat primitives](#step-10--the-chat-primitives)
15. [Step 11 — The screen](#step-11--the-screen)
16. [Step 12 — The bug only a live call could find](#step-12--the-bug-only-a-live-call-could-find)
17. [Step 13 — Three times the framework changed the design](#step-13--three-times-the-framework-changed-the-design)
18. [How one session flows end to end](#how-one-session-flows-end-to-end)
19. [Testing it](#testing-it)
20. [Mistakes that are easy to make](#mistakes-that-are-easy-to-make)
21. [What we deliberately did NOT build](#what-we-deliberately-did-not-build)
22. [File map](#file-map)

---

## The 10-second version

**18 new files, 12 edited.** Same layer order as every feature before it:

```
prisma  →  types  →  config  →  registry  →  services  →  router  →  UI
```

Three ideas carried the design:

1. **The conversation is never stored.** There is no message table. The transcript is *rebuilt* on every render by replaying a config registry against the answers on one database row. This is the single decision that most of the rest of the feature follows from.
2. **The script is config, not code.** The questions, their quick-reply chips, and the Refine buttons all come from one `Record` keyed by a const tuple. Adding a question is one entry; nothing else changes.
3. **One schema, two strictnesses.** The same Zod object is the model's output contract *and* the database validator — but it is handed to the model slightly stricter than it is used for storage, and [Step 2](#step-2--types-and-the-two-schema-trick) explains why that asymmetry is load-bearing in both directions.

---

## What we're building

The user lands on `/dashboard/content-plan` and sees a chat.

```
┌────────────────────────────────────────────────────┐
│ ◎  Personalized Content Plan                   ⓘ  │
│    Your guided LinkedIn strategy                   │
├────────────────────────────────────────────────────┤
│                                                    │
│  🤖 Let's build your content plan. Paste your      │
│     LinkedIn profile URL and I'll read it first.   │
│                                                    │
│                    https://linkedin.com/in/… 👤    │
│                                                    │
│  🤖 ┌──────────────────────────────────────┐       │
│     │ ✨ Profile Insights                  │       │
│     │ • You have a rare differentiator:…   │       │
│     │ • Your headline undersells that…     │       │
│     └──────────────────────────────────────┘       │
│                                                    │
│  🤖 What best describes what you do?               │
│                              im developer  👤      │
│  🤖 What niche do you want to be known for?        │
│                                     tech  👤       │
│  🤖 Who do you want to reach?                      │
│                              ai startups  👤       │
│  🤖 What are you here to do? Pick up to two.       │
│              Grow audience, Find a job  👤         │
│                                                    │
│  🤖 ┌──────────────────────────────────────┐       │
│     │ ✨ Your Strategy is Ready  [Save][New]│       │
│     ├──────────────────────────────────────┤       │
│     │ 🎯 Profile Positioning         [copy]│       │
│     │ 👥 Target Audience                   │       │
│     │ 📌 Content Formats                   │       │
│     │ 🏛️ Content Pillars             [copy]│       │
│     │ 📅 30-Day Calendar             [copy]│       │
│     │ 💡 Post Idea Bank              [copy]│       │
│     │ 🪝 Hook Bank                   [copy]│       │
│     │ 📢 CTA Strategy                [copy]│       │
│     │ 📈 Posting Strategy                  │       │
│     │ ⚠️ Gap Analysis                      │       │
│     └──────────────────────────────────────┘       │
│     ┌──────────────────────────────────────┐       │
│     │ Refine Strategy                      │       │
│     │ [👤 Edit Role][🧭 Edit Niche]…       │       │
│     └──────────────────────────────────────┘       │
├────────────────────────────────────────────────────┤
│  [ composer — chips, or the URL form, or Start New ]│
└────────────────────────────────────────────────────┘
```

Close the tab, come back tomorrow, and the bot opens with **"Welcome back! Your content plan progress was saved."** followed by everything you already answered.

---

## Words you need to know

Building on the tables in docs 09 and 10. New terms for this feature:

| Term | What it means here |
|---|---|
| **Session** | One `ContentPlan` row. One per member per organization. Not a history — there is exactly one in flight. |
| **Transcript** | The rendered list of chat turns. **Derived, never stored.** |
| **Step** | One question in the scripted flow. Declared in `CONTENT_PLAN_STEPS`. |
| **Section** | One card in the generated strategy. Declared in `CONTENT_PLAN_SECTIONS`. |
| **Brief** | The short "Profile Insights" read-back shown before the questions. A small AI call. |
| **Draft answers** | Answers as they exist mid-session — every field optional. |
| **Refine** | Change one answer on a finished plan and regenerate. Costs another quota unit. |

---

## Four decisions made before any code

These were settled first, because each one changes what gets built.

### 1. The conversation is scripted, not model-driven

Two options:

| | Scripted | Model-driven |
|---|---|---|
| Who picks the next question | A config file | The model, per turn |
| AI calls per session | **1** (plus the small brief) | **N + 1** |
| Deterministic | Yes | No |
| Adding a question | One config entry | Prompt engineering |

The questions are the same for everyone — role, niche, audience, goal. Paying for a model call to decide what to ask next would buy latency and non-determinism and nothing else. Worse, in this codebase **every mutation runs inside a Prisma transaction** (see [03-procedures-and-routers.md](./03-procedures-and-routers.md)), so a model call per turn means holding a Postgres connection open on every single answer.

Scripted, one call at the end.

### 2. The profile comes from the existing lookup

Feature 2 already built `profileLookup` — a metered, cached, vendor-backed "URL → profile text" capability, deliberately extracted as *its own resource* precisely so a second feature could use it. This is that second feature. We wrote **zero** scraping code.

### 3. One row, draft plus result

A single `ContentPlan` row holds the in-progress answers *and*, once generated, the strategy. Not two tables, not a history list. The mockup shows Save / New with exactly one plan on screen, and building a history nobody asked for means a list view, a discard flow, and its own permissions.

### 4. Its own resource in the registry

`contentPlan` gets its own `RESOURCES` entry: own permissions, own per-plan limit, own rate limit, own audit templates, own sidebar item. The alternative — riding on `aiGeneration`'s quota — would make one ten-section plan indistinguishable from one post draft in the usage meter, when it costs many times more.

---

## Step 1 — The database model

`prisma/schema.prisma`

```prisma
model ContentPlan {
  id             String @id @default(cuid())
  organizationId String // Tenant scope
  authorId       String // The member whose plan this is

  status String @default("collecting")  // "collecting" | "ready" | "saved"

  profileUrl String?
  profile    Json?   // FetchedProfile snapshot
  insights   Json?   // ContentPlanInsights
  answers    Json    // partial ContentPlanAnswers while collecting
  result     Json?   // ContentPlanResult

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  author       User         @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@unique([organizationId, authorId])
  @@index([organizationId, updatedAt])
  @@index([authorId])
  @@map("content_plan")
}
```

Four things here are decisions, not boilerplate.

**`@@unique([organizationId, authorId])` — per member, not per org.**
Everything else in this app is org-scoped and stays that way: tenancy, quota, audit are all organization-level, and every query filters `organizationId` first. But a content plan is built from *one person's* LinkedIn profile. With a single shared org row, a teammate opening this page would resume your half-finished chat and read positioning advice written about a profile that isn't theirs. The unique key makes the resume a `findUnique` rather than a "most recent unfinished row" guess.

**`status` is a `String`, not an enum.**
Matching every other status in this schema. The set of values is owned by the Zod tuple `CONTENT_PLAN_STATUSES`; making it a database enum means a migration every time a state is added.

**Four `Json` columns.**
Precedent: `ProfileAnalysis.result`, `ProfileLookup.profile`, `ActivityLog.metadata`. The shapes are nested and owned by Zod schemas that re-validate them on read, so no untyped value ever reaches the router. A column per field would mean a migration every time the plan grows a section — exactly the coupling the registries exist to avoid.

**`profile` is a *snapshot*, not a foreign key to `ProfileLookup`.**
The lookup cache has a seven-day TTL and gets overwritten on refresh. If this row pointed at the cache instead of copying it, a refresh would silently change the input a finished plan was generated from — you'd be reading a strategy about a profile the row no longer describes.

**One thing that is *not* here: a message table.** See [Step 11](#step-11--the-screen).

> **Migration:** `npx prisma db push`. Never `migrate dev` — there is no `prisma/migrations/` directory, and `migrate dev` will offer to drop the database. Doc [07](./07-adding-a-feature.md) covers this at length.

---

## Step 2 — Types, and the two-schema trick

`src/lib/types/content-plan.ts` — new. Per [08-types-and-grep.md](./08-types-and-grep.md), **all** schemas live in `lib/types` and nowhere else.

### The two const tuples

```ts
export const CONTENT_PLAN_STEP_KEYS = [
  "profileUrl", "role", "niche", "audience", "goals",
] as const;

export const CONTENT_PLAN_SECTION_KEYS = [
  "positioning", "targetAudience", "contentFormats", "contentPillars",
  "calendar", "postIdeas", "hooks", "ctas", "postingStrategy", "gaps",
] as const;
```

These are declared here and *described* in `lib/config` ([Steps 3](#step-3--the-step-registry) and [4](#step-4--the-section-registry)). That split is the whole drift guard: the registries are `Record<ContentPlanStepKey, …>`, so **adding a key here without describing it there is a compile error**, not a step that renders as a blank bubble.

Order matters and is deliberate. `CONTENT_PLAN_STEP_KEYS` is the order the chat asks; `CONTENT_PLAN_SECTION_KEYS` is the order the cards render.

### Answers, in two strictnesses

```ts
export const contentPlanAnswersSchema = z.object({
  profileUrl: z.string().trim().regex(LINKEDIN_PROFILE_URL_PATTERN, "…"),
  role:     z.string().trim().min(1).max(CONTENT_PLAN_ANSWER_MAX),
  niche:    z.string().trim().min(1).max(CONTENT_PLAN_ANSWER_MAX),
  audience: z.string().trim().min(1).max(CONTENT_PLAN_ANSWER_MAX),
  goals:    z.array(z.string().trim().min(1).max(CONTENT_PLAN_ANSWER_MAX))
              .min(1).max(CONTENT_PLAN_GOALS_MAX),
});

export const contentPlanDraftAnswersSchema = contentPlanAnswersSchema.partial();
```

**Why both exist.** A partially-answered session is legitimate for the *entire life* of a session — that is the feature. The stored `answers` column is read back through the **draft** schema, so a session interrupted after two questions still parses on resume. Under the strict schema it would fail validation and the user would silently lose exactly the progress the feature promises to keep. The strict schema is used in one place only: the moment before generating.

**`LINKEDIN_PROFILE_URL_PATTERN` is imported, not rewritten.** It already exists in `profile-lookup.ts`. A second regex would be a second thing to keep correct.

**`goals` is an array.** The mockup answers both *"Grow audience"* and *"Find a job"* — those pull a strategy in different directions and the plan is expected to serve both. Capped at 2: the plan has to serve them all, and three is a wish list.

### The result schema, and why every array is `.default([])`

```ts
export const contentPlanResultSchema = z.object({
  positioning:     z.string().min(1).max(2000),
  targetAudience:  z.array(z.string().min(1).max(400)).max(4).default([]),
  contentFormats:  z.array(z.string().min(1).max(200)).max(5).default([]),
  contentPillars:  z.array(contentPlanPillarSchema).max(5).default([]),
  calendar:        z.array(contentPlanCalendarWeekSchema).max(4).default([]),
  postIdeas:       z.array(z.string().min(1).max(400)).max(6).default([]),
  hooks:           z.array(z.string().min(1).max(300)).max(6).default([]),
  ctas:            z.array(z.string().min(1).max(300)).max(3).default([]),
  postingStrategy: z.string().min(1).max(1500),
  gaps:            z.array(z.string().min(1).max(400)).max(4).default([]),
});
```

`.default([])` means **a plan saved before a new section existed keeps parsing** instead of vanishing from the page with no error anywhere. Feature 2 learned this the hard way — doc 10 has the same note on `sectionInsights`.

**Here is the trick.** `.default([])` also makes the field *optional in the JSON schema handed to the model* — and an optional array is one the model will happily skip. So the leniency that protects stored rows is exactly wrong to send to the model.

The answer is to hand the model a **stricter variant** and parse the reply back through the **lenient** original:

```ts
// in ai.service.ts
schema: contentPlanResultSchema.extend({
  targetAudience: contentPlanResultSchema.shape.targetAudience.unwrap().min(1),
  // …one per array
}),
// …then:
return contentPlanResultSchema.parse(result);
```

`.unwrap()` peels the `ZodDefault` off and returns the inner array **with its `.max()` intact**, so anything that passes the model-facing check also passes the storage parse. One declaration still governs both; the strictness differs only in the direction each needs.

> This exact `.extend()` / `.parse()` pairing is copied from `analyzeLinkedInProfile` in feature 2. It was already the house answer to this problem.

**How strict the model-facing minimums should be is a separate question, and we got it wrong the first time.** See [Step 12](#step-12--the-bug-only-a-live-call-could-find).

### `StoredContentPlan`

```ts
export interface StoredContentPlan {
  id: string;
  status: ContentPlanStatus;
  profileUrl: string | null;
  profile: FetchedProfile | null;
  insights: ContentPlanInsights | null;
  answers: ContentPlanDraftAnswers;
  result: ContentPlanResult | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Every Json field is **typed**, not `Prisma.JsonValue`. The service parses each through its schema before it crosses this boundary. That is what lets the chat render a resumed session and a just-generated one with the same code and no branch — the same reasoning as `StoredProfileAnalysis` in doc 10.

Everything is re-exported from `src/lib/types/index.ts`, so consumers import from `@/lib/types`.

---

## Step 3 — The step registry

`src/lib/config/content-plan-steps.ts` — new. Modelled directly on `profile-sections.ts` from feature 2.

```ts
export interface ContentPlanStepDefinition {
  readonly prompt: string;               // exactly what the bot says
  readonly kind: "url" | "choice";       // which composer renders
  readonly options: readonly string[];   // quick-reply chips
  readonly allowFreeText: boolean;       // offer "Something else"
  readonly multiSelect: boolean;
  readonly placeholder: string;
  readonly editLabel: string;            // "🎯 Edit Goal" — drives the Refine bar
  readonly promptLabel: string;          // "Goals" — how the model is told
}

export const CONTENT_PLAN_STEPS: Record<
  ContentPlanStepKey,
  ContentPlanStepDefinition
> = { … };
```

`Record<ContentPlanStepKey, …>` is the compile-time guard. Add `"tone"` to the tuple in `lib/types` and this file stops compiling until you describe it.

**One entry drives four places at once:** the bot's question bubble, the chips in the composer, the button on the Refine bar, and the label the model sees in the prompt. Before this registry those would have been the same strings typed into a component, an edit bar, a prompt builder and a renderer — drifting independently. Feature 2 wrote up the same reasoning for `PROFILE_SECTIONS`.

### The helpers, and why the cursor is derived

```ts
export const CONTENT_PLAN_STEP_ENTRIES = CONTENT_PLAN_STEP_KEYS.map(…);

export const CONTENT_PLAN_QUESTION_KEYS = CONTENT_PLAN_STEP_KEYS.filter(
  (key) => CONTENT_PLAN_STEPS[key].kind === "choice",
);

export function contentPlanAnswerText(answers, key): string
export function isContentPlanAnswered(answers, key): boolean
export function firstUnansweredContentPlanStep(answers): ContentPlanStepKey | null
export function nextContentPlanStep(key): ContentPlanStepKey | null
```

- **`CONTENT_PLAN_STEP_ENTRIES`** exists because object key order is not a contract and this array is. It is the script, in order.
- **`CONTENT_PLAN_QUESTION_KEYS`** filters on `kind`, not on index. The Refine bar must not offer "edit the profile URL" — but expressing that as "skip index 0" breaks the day a second url-kind step appears.
- **`contentPlanAnswerText`** exists because `goals` is an array and everything else is a string. Centralised so the chat bubble, the Refine bar and the prompt cannot render the same answer three different ways.
- **`isContentPlanAnswered`** exists because empty-string *and* empty-array both mean "not answered", and both are reachable from a draft row written mid-edit.
- **`firstUnansweredContentPlanStep`** is the one that matters most. **The chat never stores "which step am I on."** Deriving it means a session resumed on another device lands in the same place, and an answer edited through the Refine bar cannot leave a saved cursor pointing at a question that is now already answered. It returns `null` when everything is answered, which the caller reads as "ready to generate" — no separate flag.

---

## Step 4 — The section registry

`src/lib/config/content-plan-sections.ts` — new.

```ts
export interface ContentPlanSectionDefinition {
  readonly label: string;   // "Target Audience"
  readonly emoji: string;   // "🎯"
  readonly kind: "prose" | "bullets" | "pillars" | "calendar";
  readonly copyable: boolean;
  readonly description: string;
}
```

**Ten sections, four shapes.** That is the point. The result view renders one card per entry and switches on `kind`, so there are **four body renderers, not ten cards**. Adding an eleventh section is one entry here plus one field on the schema, with nothing to change in the view.

**Why emoji and not lucide icons.** These headings are also what the user copies into a document, and an icon component does not survive the clipboard. An emoji does.

**`copyable` is per-section, and two are deliberately `false`.** `gaps` is a critique of your current profile and `targetAudience` is a description of other people — copying either into a post is not something anyone wants to do. Copy buttons on everything would be noise.

### Serializers

```ts
export function serializeContentPlanAnswers(answers): string
export function serializeContentPlanSection(result, key): string
export function contentPlanSectionCopyText(result, key): string
```

`serializeContentPlanAnswers` renders the answers as the prose the model reads, labelled from the step registry. **The model reads text, not JSON** — feeding it raw objects spends tokens on braces and reliably degrades output. This is the same lesson `serializeProfileSection` recorded in feature 2, reused here rather than relearned.

`serializeContentPlanSection` is an **exhaustive switch** over the section key. Without it, the result view would carry one `switch` for rendering and a second, separately-maintained `switch` for copying. The exhaustiveness means a fifth shape is a compile error rather than a copy button that silently yields `[object Object]`.

---

## Step 5 — The registry entry, and the metering puzzle

`src/lib/resources.ts`. If you haven't read [02-the-registry.md](./02-the-registry.md), read it before this section — one entry here auto-wires permissions, the quota gate, the usage counter, rate limits, audit rows, and the sidebar item.

```ts
contentPlan: {
  name: "Content Plans",
  description: "Turn a LinkedIn profile plus a few answers into a posting strategy",
  permissions: ["create", "read", "update", "discard"],
  limit: {
    perPlan: { free: 1, starter: 15, pro: 100, enterprise: "unlimited", portal: "unlimited" },
    upgradeMessage: "Upgrade to {nextPlan} to generate more content plans",
    availableOnFreeTrial: true,
    unit: "plans",
  },
  rateLimit: {
    create: { count: 3, window: "1 m" },
    brief:  { count: 5, window: "1 m" },
  },
  audit: {
    entity: "contentPlan",
    describe: {
      create:  "Generated a personalized content plan",
      brief:   "Started a content plan from a LinkedIn profile",
      update:  "Updated a content plan session",
      discard: "Discarded a content plan",
    },
  },
  nav: {
    label: "Content Plan",
    href: "/dashboard/content-plan",
    icon: "Compass",
    section: "main",
    requirePermission: "create",
  },
},
```

Three traps this entry is written around. All three are documented in `resources.ts` itself; all three have bitten this codebase before.

### Trap 1 — `discard`, never `delete`

The counter wiring in `protectedProcedure` decrements the usage counter on **any** `<resource>.delete` path. That is right for a quota counting *things held* and wrong for this one, which counts **model spend**: the API call is already paid for, and dropping the row does not un-spend it.

Under the name `delete`, **generate → New → generate would be an unlimited free tier.** Renaming the verb is the documented escape hatch — it keeps both the server bump and the client optimistic map from firing, with no special-casing in the infrastructure layer.

Feature 2 hit this exact thing and named its verb `discard` for the same reason.

### Trap 2 — `nav.requirePermission: "create"`, not the `read` default

Custom roles store one `OrganizationRole` row per literal `resource:permission` string, and **nothing backfills them** when a new permission is added to the registry. `contentPlan:read` exists in no current role, so gating the nav on it would remove this page from every existing custom-role member — silently, on the day it ships.

`profileAnalysis` does the same for the same reason.

### Trap 3 — the router key must equal the registry key

`contentPlan` in `_app.ts` must be spelled exactly as here, or **none** of the quota, counter, audit or permission wiring fires. There is no error; the feature just silently isn't metered.

### The `Compass` icon

`RESOURCES` stores icons as plain strings — it must stay free of React imports. `NAV_ICONS` in `src/components/global/sidebar/nav-icons.tsx` is the one place those strings resolve to components, and an unmapped name falls back to a neutral `Circle` **without erroring**. So the sidebar item would appear, look wrong, and tell you nothing. One line added:

```ts
Compass: CompassIcon,
```

### The metering puzzle

There are two AI touchpoints in this feature, and only one of them is quota-metered. This is a real design decision, so here is the reasoning in full.

| Call | What it does | Cost | Metered? |
|---|---|---|---|
| `brief` | 2-4 sentence read-back of the profile | Small | **No** — rate-limited only |
| `create` | The full ten-section strategy | Large | **Yes** |

Metering `brief` too would bill a user who pasted a URL and then closed the tab. Leaving it entirely ungated would violate the rule that every AI-spend endpoint is gated.

The resolution: `brief` **can only run against a profile the org has already paid `profileLookup` for**. It reads that cache server-side and refuses if there's no hit. So `profileLookup`'s own quota is the real ceiling on how many distinct profiles a plan session can start from, and `brief`'s rate limit is burst protection on top.

If you'd rather `brief` cost a unit, it's a rename — make it a second metered resource. The choice is explicit rather than accidental, which is the point of writing it down.

**Refining costs another unit.** A Refine regeneration comes back through `create` and increments the counter again. That is correct rather than harsh — it is a second model call of the same size — and it's what stops the Refine bar from being an unmetered "generate again" button. The bar says so before you click.

---

## Step 6 — The AI service

`src/services/ai.service.ts`. This is the **only** file in the app that talks to a model provider — see the header on `src/lib/config/ai.ts`. We added functions to it; we did not construct a client.

### A shared serializer

```ts
function serializeFetchedProfile(profile: FetchedProfile): string
```

Used by *both* content-plan prompts. A second serializer would eventually describe the profile differently and the brief and the strategy would start disagreeing about the same person. Empty sections are stated as absent rather than sent as blank labelled blocks — feature 2 found that an empty labelled block reliably produces **invented entries**.

### The brief

```ts
const PROFILE_BRIEF_SYSTEM_PROMPT = `You are reading a real person's LinkedIn profile…

Hard rules:
- Return 2 to 4 observations. Fewer, sharper points beat a list.
- Each observation must cite something specific from THIS profile…
- Name the differentiator: the thing this person has that most people in their field do not.
- You may name one weakness, but state it as an observation, not a fix.
- Never invent facts. If the profile does not say it, you do not know it.
- No score, no rating, no rewritten headline, no numbered action list.
…`;
```

Every rule stops a specific failure. The last one matters most: this call runs **before** the app knows your goal, niche or audience, so it has none of the inputs a strategy needs and must not pretend otherwise. Its only job is to prove the profile was actually read, which is what makes the three questions that follow feel worth answering. Left unconstrained it drifts into the full critique that `profileAnalysis` already sells.

### The plan

```ts
const CONTENT_PLAN_SYSTEM_PROMPT = `You are a LinkedIn content strategist building a
30-day plan for one real person…

Hard rules:
- Everything must be traceable to THIS profile. Name their real projects, employers,
  stack and skills. A plan that would work for any person in their field is a failed plan.
- Never invent facts, metrics, employers or results. Where a number would strengthen a
  post, leave a marked placeholder like [X%] or [company].
- The positioning section must contain text they can paste…
- Content pillars are recurring themes they could post against every week for a month
  without running dry…
- The calendar covers four weeks. Weekly, not daily — a day-by-day plan is one they
  abandon by Thursday.
- Return every section. Aim for: 2-4 audience entries, 3-5 formats, 3-5 pillars,
  exactly 4 calendar weeks, 5-6 post ideas, 5-6 hooks, 2-3 CTAs, 2-4 gaps.
- No markdown anywhere. LinkedIn renders it literally…
- Avoid "delve", "leverage", "unlock", "game-changer", "supercharge", and em dashes.`;
```

The default failure mode is a plan that could belong to anyone — *"post consistently, share your journey, engage with your network"* — which reads as a strategy while being unusable. Every rule pushes the output back onto **this person's** material.

That "Aim for" line is not decoration. It carries the counts that used to be enforced in the schema — [Step 12](#step-12--the-bug-only-a-live-call-could-find) explains why they moved.

### Prompt order

```ts
function buildContentPlanPrompt(answers, profile) {
  return `Build a 30-day LinkedIn content plan for this person.

WHAT THEY TOLD YOU:
${serializeContentPlanAnswers(answers)}

THEIR PROFILE:
${serializeFetchedProfile(profile)}`;
}
```

**Answers first, profile second, deliberately.** The goal and audience are what the plan is *for*. Putting them after a long profile dump reliably produces a plan about the profile with the goal bolted on at the end.

---

## Step 7 — The service layer

`src/services/content-plan.service.ts` — new. The service rules (doc [03](./03-procedures-and-routers.md)): `import "server-only"` at the top, `db: DbClient` as the **first** parameter, pure Prisma only — no auth, no audit, no transactions, no counters.

`db` first is not stylistic. It means the service **enlists in the caller's transaction**. The generation mutation writes the result and bumps the usage counter in one transaction; a service that reached for the global `prisma` client would put the write outside the rollback that protects it.

### The select constant

```ts
const CONTENT_PLAN_SELECT = {
  id: true, status: true, profileUrl: true, profile: true,
  insights: true, answers: true, result: true,
  createdAt: true, updatedAt: true,
} as const satisfies Prisma.ContentPlanSelect;

type ContentPlanRow = Prisma.ContentPlanGetPayload<{
  select: typeof CONTENT_PLAN_SELECT;
}>;
```

Named rather than inlined so the read path and the row type cannot drift — the type derives from this exact object. **`authorId` is deliberately absent:** the caller already knows whose plan it asked for, and returning it would put a user id in a client payload for no reason. Same instinct as the `SAFE_SELECT` constants elsewhere in the app.

### The mapper, and why every parse is a `safeParse`

```ts
function toStoredContentPlan(row: ContentPlanRow): StoredContentPlan {
  const answers  = contentPlanDraftAnswersSchema.safeParse(row.answers);
  const profile  = fetchedProfileSchema.safeParse(row.profile);
  const insights = contentPlanInsightsSchema.safeParse(row.insights);
  const result   = contentPlanResultSchema.safeParse(row.result);
  const status   = contentPlanStatusSchema.safeParse(row.status);

  return {
    …,
    status:  status.success  ? status.data  : "collecting",
    profile: profile.success ? profile.data : null,
    answers: answers.success ? answers.data : {},
    result:  result.success  ? result.data  : null,
  };
}
```

Four Json columns arrive untyped and are parsed here — **once**, rather than at each of the six procedures that return a plan.

Every parse **falls back rather than throws**. A row holding a payload written under an older shape must still open: the session is the user's work in progress, and failing the read would lose it outright to protect against a field that has merely moved. `answers` falling back to `{}` means the chat reads it as "start from the top" — recoverable, unlike an error page. An unrecognised `status` falls back to `"collecting"`, the one reading that cannot show a strategy that isn't there.

### The five operations

| Function | Prisma call | Why that call |
|---|---|---|
| `readContentPlan` | `findUnique` | Exactly one row per member per org by construction, so resuming is a lookup, not a guess |
| `startContentPlan` | `upsert` that **resets** | Pasting a URL means starting over |
| `saveContentPlanProgress` | `updateMany` | Update-only; a session must already exist |
| `recordContentPlan` | `update` | Writes result + answers together |
| `markContentPlanSaved` | `updateMany` scoped to `status: "ready"` | Save can't promote a session with no strategy |
| `discardContentPlan` | `deleteMany` | No-op must not throw |

Two worth expanding:

**`startContentPlan` resets on update, it does not merge.**

```ts
const seed = {
  status: "collecting",
  profileUrl: args.profileUrl,
  profile: args.profile,
  insights: args.insights,
  answers: { profileUrl: args.profileUrl },
  result: Prisma.DbNull,
};
```

Keeping the previous answers would carry a strategy built for one person's profile onto another's — the one way this feature can produce confidently wrong output. `result` is cleared for the same reason.

Note `Prisma.DbNull`, not `null`. Prisma reserves JS `null` for the JSON value `null` and needs the sentinel to mean SQL NULL. A bare `null` is a type error here — which is why `Prisma` is imported as a **value**, not just a type.

Note also that the URL is seeded as the first answer, so the questionnaire resumes at the *next* step rather than re-asking for a profile already loaded.

**`discardContentPlan` uses `deleteMany`** so a "Start New" on an already-empty session returns `0` instead of throwing `RecordNotFound`. The button is reachable in states where no row exists, and that is not an error.

---

## Step 8 — The router, and six verbs that each mean something

`src/trpc/routers/content-plan.ts` — new, mounted as `contentPlan` in `_app.ts`.

| Procedure | Permission | Metered | txTimeout |
|---|---|---|---|
| `get` | `read` | no | — (query) |
| `brief` | `create` | no | 45s |
| `saveProgress` | `update` | no | default |
| `create` | `create` | **yes** | 110s |
| `save` | `update` | no | default |
| `discard` | `discard` | no | default |

**The verbs are split along what each one *spends*, not along what it touches.** That is the organising principle, and it's why there are six rather than three.

### `get` — the whole "Welcome back" mechanism

```ts
get: protectedProcedure({ requirePermission: permissions.CONTENT_PLAN_READ })
  .input(withOrganization)
  .query(async ({ ctx, input }) =>
    contentPlanService.readContentPlan(ctx.db, input.organizationId, ctx.user.id),
  ),
```

A read-only query, so no counter and no audit — nothing was spent. Gated on `read` rather than `create` so a member who may revisit a plan doesn't need permission to buy new ones.

### `brief` — named to avoid the counter

Named `brief`, **not** `create`, and that's the load-bearing part: the counter fires on `<resource>.create`, and the quota unit for this feature is a *generated strategy*.

It reads the lookup cache rather than fetching:

```ts
const cached = await profileLookupService.readCachedLookup(
  ctx.db, input.organizationId, input.profileUrl,
);
if (!cached) {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "That profile has not been looked up yet. Fetch the profile first…",
  });
}
```

**Re-reading the cache server-side rather than accepting profile data in the input** is what stops a caller handing us a profile that was never looked up. This procedure can only ever describe a profile the org has actually paid for.

`PRECONDITION_FAILED` rather than `NOT_FOUND`: nothing is missing, the caller simply skipped the step that pays for the profile.

### `create` — the metered one

```ts
create: protectedProcedure({
  requirePermission: permissions.CONTENT_PLAN_CREATE,
  txTimeout: 110_000,
})
```

Named `create` so the quota, counter, rate limit and audit row wire themselves from the registry entry. The counter measures model spend — and that is precisely why **the result is persisted**: the charge lands the moment the model answers, so without a row a refresh would destroy something the org has already paid for.

**The profile comes from the session, never from the input.** The client sends the *answers*, because those are what the user just confirmed on screen and a Refine regeneration must not race a progress save. But the profile is the expensive, verified half and must come from what the server already stored.

The `try/catch` is not decoration:

```ts
} catch (error) {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: … });
}
```

Because this runs inside the procedure transaction, **the throw is what rolls the usage increment back**. The org is never billed for a plan it cannot see.

### `assertAiConfigured` runs first, everywhere

```ts
function assertAiConfigured(): void {
  if (isAiConfigured()) return;
  const provider = getAiProvider();
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: `AI generation is not configured. Add ${provider.apiKeyEnvVar}…`,
  });
}
```

An unconfigured provider is an operator problem and the user shouldn't lose a plan to it. Checked at the top rather than left to the model call, because **by the time the SDK throws, the counter has already incremented.**

### `discard` succeeds on a no-op

Unlike `saveProgress` and `save`, which `NOT_FOUND` when they change nothing. "Start New" is reachable with no session open, and starting fresh when nothing exists has already achieved what the user asked for.

---

## Step 9 — Deleting code before writing any

Before building the UI we removed three duplications. `.claude/CLAUDE.md` is explicit: *"if you see yourself reading from a pattern of another component, and you think it can be globalized, globalize it."* Each of these was about to get a third copy.

### `CopyButton`

Lived as a local helper inside `profile-analysis/_components/analysis-result.tsx`. Lifted to `src/components/global/copy-button/`, with the analyzer updated to import it. Now the confirmation timing, the failure toast and the accessible label are identical everywhere.

Gained one prop the original didn't need — `iconOnly`, for dense card headers where a text label would crowd the title.

> Removing the local copy also orphaned two imports (`CopyIcon`, `toast`) in `analysis-result.tsx`. With `noUnusedLocals`, that's a build failure, not a warning — worth remembering when you lift a helper out of a file.

### `initialsOf`

Already duplicated in `sidebar/nav-user.tsx` and `linkedin/post-preview.tsx`, and the two **behaved differently**: one took a name plus an email fallback, one took a name only; one returned two letters for a single-word name, the other returned one. The same person could show `J` in one place and `JA` in another.

Unified in `src/lib/utils.ts`:

```ts
export function initialsOf(name: string | null | undefined, fallback = ""): string
```

Two words give their initials; anything else gives its first two characters. Both call sites updated.

### `PageHeader`

Had `title` and `actions` but no icon or subtitle, and this screen needs *"Personalized Content Plan / Your guided LinkedIn strategy"* with a glyph. Extended rather than replaced, with three new optional props: `icon`, `description`, and `bare`.

`icon` takes a **node**, not an icon name, so a caller passes whichever lucide icon it already imports without this component owning a second icon registry alongside `NAV_ICONS`.

`bare` is covered in [Step 13](#step-13--three-times-the-framework-changed-the-design).

---

## Step 10 — The chat primitives

`src/components/global/chat/` — new. The app had **no** conversational UI: no message bubble, no chat shell, nothing that scrolls programmatically. Built as globals rather than route-local because a second conversational surface should get these by importing, not by copying a div with the right padding.

All three are **presentational only** — they take props and render, exactly like `LinkedInPostPreview`. None of them knows what a content plan is.

### `ChatMessage`

```tsx
export interface ChatMessageProps {
  role: "assistant" | "user";
  name?: string | null | undefined;
  avatarUrl?: string | null | undefined;
  unstyled?: boolean | undefined;
  children: React.ReactNode;
  className?: string | undefined;
}
```

**`children`, not a `text` prop.** Half the assistant turns in this app are not text — they're result cards, option chips and action bars. A text prop would have forced every one of those to sit outside the bubble and lose the alignment.

**`unstyled`** drops the bubble background and padding, keeping only the alignment and avatar gutter. For assistant turns whose content is already a `Card` — a bubble around a card reads as a box inside a box.

Alignment uses `flex-row-reverse` rather than `justify-end`, so the avatar stays adjacent to its own bubble at every width. The bubble is capped at `max-w-[min(42rem,85%)]` so a long answer wraps into a readable column instead of running the full width of a desktop monitor.

Colours are tokens only: `bg-brand text-brand-foreground` for the user, `bg-muted text-foreground` for the bot. No hex, no `text-white`.

### `ChatTyping`

An assistant bubble with a spinner **and a label**. The model calls behind this feature take tens of seconds, which is long enough that a still screen reads as broken. Naming what is happening is what makes the wait legible — *"Building your 30-day plan"* is a reason to wait; a bare spinner is not.

### `ChatShell`

Owns two things that are easy to get wrong.

**Scrolling inside the page rather than growing it.** Otherwise the composer walks off the bottom of the viewport.

**Following new turns**, via a sentinel div and `scrollIntoView`:

```tsx
const endRef = React.useRef<HTMLDivElement>(null);
React.useEffect(() => {
  endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
}, [scrollKey]);
```

The follow is **unconditional**, not "only when already at the bottom". Every turn here is either the user's own action or a direct response to it — there's no background chatter to interrupt someone scrolled up reading — and the conditional version silently strands people who scrolled one line to re-read a question.

`scrollKey` is a *value*, not the children. `children` is a new array every render, so depending on it would scroll on every keystroke in the composer.

The `min-h-0` on both the wrapper and the `ScrollArea` is load-bearing: without it a flex child refuses to shrink below its content height and the column grows the page instead of scrolling itself.

### `ChatOptions`

The quick-reply chips. Built from `<button aria-pressed>` rather than a radio group — there is no `radio-group` or `toggle-group` in `components/ui`, and adding one to express what is really a row of buttons would be a dependency bought for styling. The `aria-pressed` pattern is already the house idiom (`HeadlineChoices` in the analyzer).

**Single-select submits on tap; multi-select confirms with a Continue button.** With single-select the tap *is* the answer and a Continue button is a second click for nothing. With multi-select there is no way to know the user is finished, so the button is what says so.

State-reset behaviour is covered in [Step 13](#step-13--three-times-the-framework-changed-the-design).

---

## Step 11 — The screen

`src/app/(dashboard)/dashboard/content-plan/`. `page.tsx` is a thin server shell with `metadata`; everything else lives in `_components/`.

### The transcript is derived

This is the most important function in the feature.

```tsx
const transcript = React.useMemo<ContentPlanTurn[]>(() => {
  const turns: ContentPlanTurn[] = [];

  if (!plan) {
    turns.push({ id: "intro", role: "assistant",
                 node: CONTENT_PLAN_STEPS.profileUrl.prompt });
    return turns;
  }

  if (isResumed) {
    turns.push({ id: "welcome", role: "assistant",
      node: plan.result === null
        ? "Welcome back! Your content plan progress was saved."
        : "Welcome back! Here's the plan we built together." });
  }

  for (const step of CONTENT_PLAN_STEP_ENTRIES) {
    if (!isContentPlanAnswered(answers, step.key)) break;

    if (step.kind !== "url") {
      turns.push({ id: `q-${step.key}`, role: "assistant", node: step.prompt });
    }
    turns.push({ id: `a-${step.key}`, role: "user",
                 node: contentPlanAnswerText(answers, step.key) });

    if (step.kind === "url" && plan.insights) {
      turns.push({ id: "insights", role: "assistant", unstyled: true,
                   node: <ContentPlanInsightsCard … /> });
    }
  }

  if (plan.result) { /* result view + refine bar */ }
  else if (currentStep) { /* the next question */ }

  return turns;
}, [plan, currentStep, editing, isResumed, isBusy, …]);
```

**There is no message table and none is needed.** Each answered step contributes the question the registry declares plus the answer the row holds. Three consequences:

1. A resumed session and a live one produce **byte-identical** transcripts, so nothing downstream branches on which it's looking at.
2. Resuming works across devices — the answers are on the row, not in a browser.
3. **Rewording a question retroactively improves old sessions** instead of leaving them quoting text that no longer exists anywhere.

The URL step is not replayed as a question, because the Profile Insights card below it *is* its answer — re-showing "paste your URL" above them reads as if the app is asking again.

### The composer switches on `kind`

```tsx
if (activeStep.kind === "url")  return <ContentPlanUrlStep … />;
return <ChatOptions key={currentStep} … />;
```

Not a chain of state flags. A step added to the registry gets the right input with nothing changed here.

The URL step is a **real** React Hook Form with `zodResolver(startContentPlanSchema)` — the same object the router validates against — because that field starts a chain that spends money: a vendor lookup, then a model call. An obvious typo is caught locally, for free, instead of after the first charge.

### The two-call start

```tsx
if (canLookUp) {
  setBusyLabel("Reading your LinkedIn profile");
  await lookup.mutateAsync({ profileUrl, organizationId });
  await utils.usage.invalidate();
}
setBusyLabel("Working out what stands out");
await brief.mutateAsync({ profileUrl, organizationId });
```

Two calls in sequence, deliberately. `profileLookup.create` owns the paid vendor fetch — and its own quota, counter and cache — so this screen never fetches a profile itself. Running it first is what makes `brief`'s cache read always hit.

### Progress saves on every answer

```tsx
await saveProgress.mutateAsync({ answers: nextAnswers, organizationId });
await refreshSession();

const complete = contentPlanAnswersSchema.safeParse(nextAnswers);
if (!complete.success) return;
await runGeneration(complete.data);
```

That single call is the whole of the "Welcome back" promise. Batching it to the end would mean an interrupted session loses exactly the answers the user already gave.

The completed set is validated **locally** before generating, so a malformed value fails for free instead of spending a quota unit to learn the same thing from the server.

### `isResumed`, and a bug caught before shipping

The first version derived the greeting from `plan !== null`, which meant **"Welcome back!" appeared two seconds after you pasted your URL** — reading as if the app had lost track of a conversation that had just started.

The fix is to track it from the event that actually starts a plan:

```tsx
const [startedHere, setStartedHere] = React.useState(false);
const isResumed = plan !== null && !startedHere;
```

`setStartedHere(true)` in `handleStart`, `false` in `handleStartNew`. The query tells you a row exists; it does not tell you who put it there. (An earlier attempt used a ref read during render — see [Step 13](#step-13--three-times-the-framework-changed-the-design).)

### Permission gating, twice

Every spending action is gated client-side on the **same** permission the server enforces, so a member without it sees a disabled control and a sentence explaining why, rather than clicking into a `FORBIDDEN` toast.

```tsx
const canGenerate = hasPermission(permissions.CONTENT_PLAN_CREATE);
const canLookUp   = hasPermission(permissions.PROFILE_LOOKUP_CREATE);
```

Note `canLookUp` is separate — a lookup is its own metered resource, so a member may be allowed to build a plan without being allowed to spend vendor budget.

### The result view

Iterates the section registry and switches on `kind`:

```tsx
{CONTENT_PLAN_SECTION_ENTRIES.map((section) => (
  <ContentPlanSectionCard key={section.key} sectionKey={section.key} result={result} />
))}
```

**A section with no content is skipped entirely** rather than rendered as an empty card. Every array is defaulted so a model omission can't fail the generation — which means empty is a state that genuinely reaches this component, and an empty card reads as a bug rather than as an omission.

The action bar **leads, it does not trail**. The plan is long, and Save has to be reachable the moment it arrives rather than after ten cards of scroll.

---

## Step 12 — The bug only a live call could find

Everything above typechecked, linted and built cleanly. The first live generation returned:

```
No object generated: response did not match schema.
```

That message names the symptom and hides the cause. There were **two** causes, and both were ours.

### Cause 1 — the token budget was sized for a different feature

`src/lib/config/ai.ts`:

```ts
/* A LinkedIn post caps at 3000 characters, so generation never needs a large
 * budget. */
export const AI_MAX_TOKENS = 4096;
```

That comment is correct — for feature 1. This feature asks for **ten sections in one structured response**. At the schema's ceilings that's roughly:

| Section | Worst case |
|---|---|
| positioning | ~500 tokens |
| targetAudience | ~400 |
| contentFormats | ~250 |
| contentPillars | ~650 |
| calendar | ~1200 |
| postIdeas | ~600 |
| hooks | ~450 |
| ctas | ~225 |
| postingStrategy | ~375 |
| gaps | ~400 |
| **JSON overhead** | ~10% |
| **Total** | **~5,500** |

Over budget before you count anything else — and on Anthropic, `providerOptions` enables `thinking: { type: "adaptive" }`, whose **reasoning tokens draw on the same budget**.

The output gets truncated mid-object. Truncated JSON does not match the schema. The SDK reports a validation error and never mentions the budget.

**The fix**, deliberately local rather than global:

```ts
export interface GenerateStructuredArgs<T> {
  …
  maxOutputTokens?: number | undefined;
  timeoutMs?: number | undefined;
}
```

```ts
const CONTENT_PLAN_MAX_TOKENS = 16_000;
const CONTENT_PLAN_TIMEOUT_MS = 90_000;
```

Raising `AI_MAX_TOKENS` globally would quietly enlarge every other call's worst case. Overshooting costs nothing — output is billed on tokens **produced**, not on the ceiling.

And because the AI timeout moved to 90s, `txTimeout` on `contentPlan.create` had to move above it, 60s → **110s**. If the transaction dies first, a clean "generation timed out" becomes an opaque Prisma error. This is the same relationship `profileLookup.create` keeps with its vendor timeout.

### Cause 2 — validation that threw away work you'd paid for

The first model-facing schema was far too strict:

```ts
// BEFORE — wrong
calendar:  contentPlanCalendarWeekSchema.array().length(4),
postIdeas: …unwrap().min(5).max(6),
hooks:     …unwrap().min(5).max(6),
```

A run that returned four hooks instead of five was **discarded whole** — after the org had already been billed for it. Enforcing a preference as validation converts a slightly-imperfect result into a total loss.

```ts
// AFTER — right
targetAudience: contentPlanResultSchema.shape.targetAudience.unwrap().min(1),
// …one per array, all .min(1)
```

The arrays are still **required**, so the model can't skip a section. But the *counts* moved into the system prompt:

```
- Return every section. Aim for: 2-4 audience entries, 3-5 formats, 3-5 pillars,
  exactly 4 calendar weeks, 5-6 post ideas, 5-6 hooks, 2-3 CTAs, 2-4 gaps.
```

Guidance the model usually follows beats validation that destroys work when it doesn't. The maxima still ride through `.unwrap()` unchanged, so anything passing the model-facing check also passes the storage parse.

### The lesson

> **A schema mismatch from `generateObject` is not always a schema problem.** Check `finishReason` first — `"length"` means you ran out of budget and the JSON was truncated. Only after ruling that out is it worth looking at the shape.

And more generally: **strictness has a direction.** Toward storage, be lenient, so old rows survive. Toward the model, be strict about *presence* and lenient about *quantity* — otherwise you're paying for results you then throw away.

---

## Step 13 — Three times the framework changed the design

### The React compiler banned two patterns

**`setState` inside an effect.** `ChatOptions` originally synced its picks from the `selected` prop:

```tsx
React.useEffect(() => {
  setPicked([...selected]);   // ❌ react-hooks/set-state-in-effect
}, [selected.join(" ")]);
```

Lint rejected it, and lint was right — the effect would also fire on unrelated re-renders (a sibling mutation settling, a query refetching) and wipe picks the user had made but not yet confirmed.

The supported answer is to **reset state with a key**:

```tsx
<ChatOptions key={currentStep} … />
```

React remounts the component per question, which is fresh initial state by construction. The component now reads `selected` exactly once and documents that resetting is the caller's job.

**Refs read during render.** The first `isResumed` implementation latched a ref on the first settled fetch:

```tsx
const resumedRef = React.useRef<boolean | null>(null);
if (resumedRef.current === null && session.isSuccess) {   // ❌ Cannot access refs during render
  resumedRef.current = plan !== null;
}
```

Rejected as impure. The replacement — event-driven state, shown in [Step 11](#step-11--the-screen) — is genuinely better anyway, because it tracks the thing we actually mean ("this visit started the plan") instead of a proxy for it.

### The layout needed a computed height

A chat pins a composer below a scrolling transcript, which only works if something above it has a **definite** height. The sidebar wrapper is `min-h-svh`, so `flex-1` under it means "at least the viewport" and grows with content — the composer would have been pushed off the bottom of the page.

Hence `bare` on `ContentLayout`:

```tsx
<div className="flex min-h-0 flex-col h-[calc(100svh-4rem)] md:h-[calc(100svh-5rem)]">
  {children}
</div>
```

`4rem` is the header (`h-16`); the extra `1rem` from `md` up is the `m-2` that the inset sidebar variant adds above and below. This lives in `ContentLayout` because that component owns the header and therefore knows its height.

---

## How one session flows end to end

```
USER pastes https://linkedin.com/in/jatin-sharma-…
  │
  ├─ ContentPlanUrlStep validates against startContentPlanSchema (client, free)
  │
  ├─▶ profileLookup.create        [metered: profileLookup quota]
  │     ├─ cache hit? return it, no vendor charge
  │     └─ else vendor fetch → writeCachedLookup
  │
  ├─▶ contentPlan.brief           [rate-limited, NOT quota-metered]
  │     ├─ assertAiConfigured()
  │     ├─ readCachedLookup() ── no hit? PRECONDITION_FAILED
  │     ├─ aiService.generateProfileBrief()   ← small AI call
  │     └─ startContentPlan()  → row created, status "collecting"
  │
  ├─ contentPlan.get invalidated → transcript rebuilds
  │    → Profile Insights card renders
  │    → firstUnansweredContentPlanStep() returns "role"
  │
USER taps "Developer"
  ├─▶ contentPlan.saveProgress    [update permission, free]
  └─ transcript rebuilds → next question is "niche"
     … repeat for niche, audience, goals …

On the LAST answer:
  ├─▶ contentPlan.saveProgress
  ├─ contentPlanAnswersSchema.safeParse(next) ── complete!
  │
  └─▶ contentPlan.create          [METERED: contentPlan quota]
        │  ── protectedProcedure opens a transaction ──
        ├─ quota gate (auto, from RESOURCES.limit)
        ├─ rate limit (auto, 3/min)
        ├─ assertAiConfigured()
        ├─ readContentPlan() → profile snapshot
        ├─ aiService.generateContentPlan()   ← 16k budget, 90s ceiling
        │     └─ strict-ish schema → contentPlanResultSchema.parse()
        ├─ recordContentPlan() → status "ready"
        ├─ usage counter +1 (auto)
        ├─ audit row (auto)
        │  ── commit ──  (any throw above rolls ALL of this back)
        │
        └─ client: invalidate contentPlan.get + usage
             → result view + refine bar render
```

Note the symmetry at the bottom: the counter bump, the audit row and the write all commit together, so a failed generation cannot leave the org billed for a plan it can't see.

---

## Testing it

**Before anything:** `npx prisma db push`. Without it every call fails with *"The table `public.content_plan` does not exist"*.

Then:

1. **The registry wiring.** Does "Content Plan" appear in the sidebar with a compass icon? That proves the `RESOURCES` entry *and* the `NAV_ICONS` key are both correct. A `Circle` icon means the `NAV_ICONS` key is missing.
2. **The happy path.** Paste a real LinkedIn URL → insights bullets appear → answer all four questions → all ten sections render → copy buttons work.
3. **Resume.** Refresh mid-questions. You should get *"Welcome back! Your content plan progress was saved."* and every answered step replayed. **Do not skip this** — it's the feature's main promise and the thing the derived-transcript design exists for.
4. **The greeting.** Start a fresh plan and confirm you do **not** get "Welcome back!" immediately after pasting the URL.
5. **Metering.** The usage meter should go up by exactly one per generation, and **not** go down on New. If it decrements, someone renamed `discard` to `delete`.
6. **Refine.** Edit one answer, confirm the plan regenerates and the meter moves again.
7. **Tenancy.** Sign in as a second member of the same org. They must get their own empty session, not yours.
8. **Permissions.** A member without `contentPlan:create` should see a disabled composer and an explanation, never a `FORBIDDEN` toast.

Static checks: `npm run typecheck` and `npx eslint src` must both be clean, and `npm run build` should list `/dashboard/content-plan` in the route table.

---

## Mistakes that are easy to make

**Naming the discard verb `delete`.** Free unlimited generations. The single highest-cost mistake in this file.

**Adding a section to `CONTENT_PLAN_SECTION_KEYS` and stopping there.** The `Record` won't compile until you describe it — that's the guard working. But you *also* need a field on `contentPlanResultSchema`, or the card renders nothing.

**Making the model-facing schema stricter than the storage schema's maxima.** Anything the model returns that passes generation must also pass `contentPlanResultSchema.parse()`. Use `.unwrap()` so the maxima carry through rather than retyping them.

**Enforcing counts as validation.** Covered at length in [Step 12](#step-12--the-bug-only-a-live-call-could-find). Put quantities in the prompt.

**Forgetting the token budget when you add a section.** Every new section eats the 16k. It's generous now; it isn't infinite.

**Raising `AI_TIMEOUT_MS` without raising `txTimeout`.** The transaction dies first and you get an opaque Prisma error instead of a clean timeout.

**Reading `plan !== null` as "resumed".** It means a row exists, not that someone came back to it.

**Storing which step you're on.** Derive it. A stored cursor goes stale the moment the Refine bar edits an answer in the middle of a finished set.

**Accepting profile data in a router input.** `brief` re-reads the cache server-side on purpose. Trusting the client here means generating plans about profiles nobody paid to look up.

**Using `null` for a nullable Json column.** Prisma needs `Prisma.DbNull`, and that requires importing `Prisma` as a value.

---

## What we deliberately did NOT build

| Not built | Why |
|---|---|
| **A message/conversation table** | The transcript is derivable from the answers. Storing it would mean old sessions quote wording that no longer exists. |
| **Streaming** | No procedure in this app streams. Every mutation runs in a transaction, and a streaming endpoint would hold a Postgres connection for the stream's lifetime. |
| **A model-driven conversation** | N+1 model calls, non-deterministic, and each one inside a transaction. |
| **Plan history** | The mockup is Save / New with one plan on screen. History needs a list view, a discard flow and its own permissions. The escape hatch is documented on the model: drop the `@@unique`, add `@@index([organizationId, createdAt])`, change `readContentPlan` to a `findFirst`. |
| **Editing the generated plan** | The output is copy-to-clipboard. An editor is a different feature with its own persistence story. |
| **Scheduling posts from the calendar** | `linkedinPosts` already publishes. Wiring the calendar into it is a good next feature, not part of this one. |
| **A `radio-group` component** | The `aria-pressed` button pattern was already the house idiom. |

---

## File map

### New — 18 files

```
src/lib/types/content-plan.ts                    schemas + types
src/lib/config/content-plan-steps.ts             the question script
src/lib/config/content-plan-sections.ts          the section registry + serializers
src/services/content-plan.service.ts             pure Prisma
src/trpc/routers/content-plan.ts                 6 procedures

src/components/global/copy-button/
  copy-button.tsx                                lifted out of profile-analysis
  index.ts
src/components/global/chat/
  chat-shell.tsx                                 scroll + composer frame
  chat-message.tsx                               bubbles + ChatTyping
  chat-options.tsx                               quick-reply chips
  index.ts

src/app/(dashboard)/dashboard/content-plan/
  page.tsx                                       thin server shell
  _components/
    content-plan-chat.tsx                        the orchestrator
    content-plan-url-step.tsx                    RHF + zod URL form
    content-plan-insights.tsx                    Profile Insights card
    content-plan-result.tsx                      10 section cards + Save/New
    content-plan-refine.tsx                      Refine Strategy bar
    index.ts
```

### Edited — 12 files

```
prisma/schema.prisma                             + ContentPlan, + 2 back-relations
src/lib/types/index.ts                           + barrel exports
src/lib/config/index.ts                          + barrel exports
src/lib/resources.ts                             + contentPlan entry
src/lib/utils.ts                                 + initialsOf
src/services/ai.service.ts                       + 2 prompts, 2 tasks, budget overrides
src/trpc/routers/_app.ts                         + contentPlan mount
src/components/global/sidebar/nav-icons.tsx      + Compass
src/components/global/sidebar/nav-user.tsx       − local initialsOf
src/components/global/linkedin/post-preview.tsx  − local initialsOf
src/components/global/page-header.tsx            + icon/description/bare
src/app/(dashboard)/dashboard/profile-analysis/
  _components/analysis-result.tsx                − local CopyButton
```

### Where to start reading

If you're picking this up cold, in order:

1. `src/lib/types/content-plan.ts` — what the data is
2. `src/lib/config/content-plan-steps.ts` — what the conversation is
3. `src/trpc/routers/content-plan.ts` — what each call costs
4. `_components/content-plan-chat.tsx`, specifically `buildTranscript` — how it all renders

Everything else follows from those four.
