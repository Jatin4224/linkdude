# Building the AI LinkedIn Post feature — a complete walkthrough

This is the full build log for the first feature of the personal-branding tool: **a user types a topic, AI writes a LinkedIn post, the user edits it, and publishes it straight to LinkedIn.**

It is written so someone who has never touched this codebase can follow along and build the same thing. Every step says *what* we did and *why* we did it that way. If you already know the codebase, skip to [The 10-second version](#the-10-second-version) or [How one request flows](#how-one-request-flows-end-to-end).

---

## Table of contents

1. [The 10-second version](#the-10-second-version)
2. [Words you need to know](#words-you-need-to-know)
3. [The mental model: layers](#the-mental-model-layers)
4. [What you need before you start](#what-you-need-before-you-start)
5. [Step 1 — Install the AI SDK](#step-1--install-the-ai-sdk)
6. [Step 2 — The registry (the most important step)](#step-2--the-registry-the-most-important-step)
7. [Step 3 — Database models](#step-3--database-models)
8. [Step 4 — Config layer](#step-4--config-layer)
9. [Step 5 — Types and validation](#step-5--types-and-validation)
10. [Step 6 — Services](#step-6--services)
11. [Step 7 — Routers](#step-7--routers)
12. [Step 8 — The OAuth routes](#step-8--the-oauth-routes)
13. [Step 9 — The UI](#step-9--the-ui)
14. [How one request flows end to end](#how-one-request-flows-end-to-end)
15. [Testing it](#testing-it)
16. [Mistakes that are easy to make](#mistakes-that-are-easy-to-make)
17. [What we deliberately did NOT build](#what-we-deliberately-did-not-build)

---

## The 10-second version

We added **11 new files** and edited **7 existing ones**. The order matters, because each layer depends on the one before it:

```
registry  →  database  →  config  →  types  →  services  →  routers  →  routes  →  UI
```

The single most important idea: **this codebase auto-wires features from a registry file.** You declare your feature once in `src/lib/resources.ts`, and plan limits, usage counters, audit logs, rate limits, permissions, and the sidebar link all appear without you writing them. Understanding that one idea explains most of the design decisions below.

---

## Words you need to know

If you're new, these terms show up constantly. Read this once and the rest will make sense.

| Term | What it actually means |
|---|---|
| **tRPC** | A way to call server functions from the browser as if they were normal functions, with full type safety. Instead of `fetch('/api/posts')` you write `trpc.linkedinPosts.create.useMutation()`. If you rename something on the server, the client stops compiling — that's the point. |
| **Router** | A group of related server functions. `linkedinPostsRouter` holds `create`, `list`, `delete`. |
| **Procedure** | One server function inside a router. Comes in two kinds: `query` (reads data) and `mutation` (changes data). |
| **Zod** | A library that checks data shapes at runtime. You describe what valid data looks like, and Zod rejects anything else *and* gives TypeScript the type for free. |
| **Prisma** | How we talk to the PostgreSQL database. You describe tables in `schema.prisma`, and Prisma generates typed functions like `db.linkedInPost.create(...)`. |
| **Service** | A file that talks to the database or an external API. Contains no business rules — just "fetch this", "save that". |
| **`server-only`** | A magic import that makes the build **fail** if a file ever gets bundled into browser code. We put it on any file that touches secrets. |
| **OAuth** | The "Log in with X" dance. Your app sends the user to LinkedIn, LinkedIn asks "do you allow this app?", and if they say yes LinkedIn sends them back with a code you trade for an access token. |
| **URN** | LinkedIn's ID format. Looks like `urn:li:person:AbC123`. Every LinkedIn thing (person, image, post) has one. |
| **Multi-tenant** | Many separate organizations share one app and one database. Every row must be tagged with which org owns it, or one customer sees another's data. |

---

## The mental model: layers

Every feature in this codebase is built in the same stack of layers. Each layer only knows about the one below it.

```
┌─────────────────────────────────────────────────────┐
│ UI          React components. No business rules.     │
├─────────────────────────────────────────────────────┤
│ Router      Business logic. "Publish only if the     │
│             account is connected."                   │
├─────────────────────────────────────────────────────┤
│ Service     Talks to DB / LinkedIn / Claude.         │
│             No decisions, just actions.              │
├─────────────────────────────────────────────────────┤
│ Types       Zod schemas. What valid data looks like. │
├─────────────────────────────────────────────────────┤
│ Config      Keys, URLs, constants.                   │
├─────────────────────────────────────────────────────┤
│ Database    Prisma models.                           │
├─────────────────────────────────────────────────────┤
│ Registry    Declares the feature exists.             │
└─────────────────────────────────────────────────────┘
```

**Why bother with layers?** Because when something breaks, you know where to look. A wrong plan limit is the registry. A LinkedIn API error is the service. A button that doesn't disable is the UI. Without layers, all three live in one 900-line file and every bug is a scavenger hunt.

---

## What you need before you start

### A LinkedIn Developer app

1. Go to [linkedin.com/developers/apps](https://www.linkedin.com/developers/apps) and click **Create app**.
2. You must attach a **verified LinkedIn Company Page**. LinkedIn will not give you API access without one. If you don't have a page, create one first — it takes a few minutes.
3. Go to the **Products** tab and request these two:
   - **Sign In with LinkedIn using OpenID Connect** → gives you the `openid` and `profile` permissions
   - **Share on LinkedIn** → gives you the `w_member_social` permission (this is the one that lets you post)

   Both are self-serve. Approval is usually instant.
4. Go to the **Auth** tab. Under **OAuth 2.0 settings → Redirect URLs**, add exactly:
   ```
   http://localhost:3000/api/linkedin/callback
   ```
   This must match character for character. A trailing slash will break it.
5. Copy the **Client ID** and **Client Secret** from that same tab.

> **Why two products?** LinkedIn splits "who is this person" from "let this app post for them". You need both: the first tells you the person's URN (their ID), the second gives permission to publish.

### An Anthropic API key

Get one at [console.anthropic.com](https://console.anthropic.com). This is what pays for the AI writing the posts.

### Put them in `.env`

```bash
ANTHROPIC_API_KEY="sk-ant-..."
LINKEDIN_CLIENT_ID="..."
LINKEDIN_CLIENT_SECRET="..."
LINKEDIN_API_VERSION="202601"
```

`.env` is gitignored, so these never reach GitHub. Restart the dev server after editing it — Next.js only reads `.env` at boot.

---

## Step 1 — Install the AI SDK

```bash
npm install @anthropic-ai/sdk
```

That's the whole step. There was **no AI provider in this codebase before this feature** — we checked by grepping for `openai`, `langchain`, `gemini`, and friends, and found nothing. So this feature introduces the first one, which is exactly why we build it as shared infrastructure in Step 4 instead of dumping an API call inside a component.

---

## Step 2 — The registry (the most important step)

**File: `src/lib/resources.ts`**

This is the part that surprises people. In most codebases, if you want "free users can only publish 10 posts a month", you write that check yourself in every endpoint. Here you don't. You **declare** it, and the framework enforces it.

Here's what we added:

```ts
linkedinPosts: {
  name: 'LinkedIn Posts',
  description: 'Generate, publish, and review LinkedIn posts',
  permissions: ['create', 'read', 'delete'],
  limit: {
    perPlan: { free: 10, starter: 100, pro: 500, enterprise: 'unlimited', portal: 'unlimited' },
    upgradeMessage: 'Upgrade to {nextPlan} to publish more posts',
    availableOnFreeTrial: true,
    unit: 'posts',
  },
  audit: {
    entity: 'linkedinPost',
    describe: {
      create: 'Published a LinkedIn post',
      delete: 'Removed a LinkedIn post record',
    },
  },
  rateLimit: {
    create: { count: 5, window: '1 m' },
  },
  nav: {
    label: 'Create Post',
    href: '/dashboard/post-generation',
    icon: 'Sparkles',
    section: 'main',
  },
},
```

### What each part buys you, for free

| Field | What appears automatically |
|---|---|
| `permissions` | The strings `linkedinPosts:create`, `linkedinPosts:read`, `linkedinPosts:delete` become real, typo-proof constants you use as `permissions.LINKEDIN_POSTS_CREATE`. They also show up in the role-builder UI so an admin can grant them. |
| `limit` | Free users are blocked at 10 posts with the message you wrote. The counter increments on every successful publish and decrements on delete. **You write zero counting code.** |
| `audit` | Every publish writes a row to the `ActivityLog` table with your description. It goes in the same database transaction as the post, so if the post fails the log entry disappears too. |
| `rateLimit` | Someone spamming the publish button gets a 429 after 5 attempts per minute. |
| `nav` | "Create Post" appears in the sidebar with a sparkle icon. |

### The magic rule that makes it work

Look at `src/trpc/procedures/protected.ts` and search for `AUTO_DERIVED_FROM_RESOURCES`. The system reads your procedure's **path** and splits it on the dot:

```
linkedinPosts.create
└─ resource ─┘ └verb┘
```

- The part before the dot must match a key in `RESOURCES`.
- The part after the dot is the action.

So `linkedinPosts.create` → look up `RESOURCES.linkedinPosts` → apply its limit, its rate limit, its audit template, and check the `linkedinPosts:create` permission.

**This is why the router name must exactly match the registry key.** If you name the router `linkedinPost` (singular) and the registry key `linkedinPosts` (plural), nothing wires up. The codebase actually guards against this — a mutation whose first path segment isn't in `RESOURCES` throws a loud error telling you to add it, rather than silently skipping every check.

### The second entry: why we separated AI generation

We also added:

```ts
aiGeneration: {
  name: 'AI Generation',
  permissions: ['create'],
  limit: {
    perPlan: { free: 25, starter: 300, pro: 2_000, enterprise: 'unlimited', portal: 'unlimited' },
    upgradeMessage: 'Upgrade to {nextPlan} to generate more posts with AI',
    availableOnFreeTrial: true,
    unit: 'generations',
  },
  rateLimit: { create: { count: 10, window: '1 m' } },
},
```

**Why not just use the `linkedinPosts` limit?** Because generating and publishing are different costs. A user might hit Generate eight times, hate all eight drafts, and never publish. Each of those eight calls costs you real money at Anthropic. If they shared one quota, a free user would burn their 10 posts without ever publishing anything — a terrible experience *and* an uncapped bill.

Two quotas: 25 generations and 10 publishes for free users. Drafting is cheap and forgiving; publishing is the thing worth gating.

### The third edit: reusing what already existed

The registry already had an `integrations` entry described as *"Connect or disconnect third-party services"*. Rather than inventing `linkedinAccount` as a new resource, we added one verb to it:

```ts
integrations: {
  permissions: ['read', 'update', 'disconnect'],   // added 'disconnect'
  audit: {
    entity: 'integration',
    describe: { disconnect: 'Disconnected the {input.provider} account' },
  },
},
```

**Why this matters:** when you add Twitter/X next, you add a branch in the existing integrations router. No new registry entry, no new permission set, no new endpoint. That's what "modular" actually means in practice — not "lots of small files", but "the next thing plugs into a socket that already exists".

Notice `{input.provider}` in the audit template. That's interpolation — at runtime it reads the `provider` field off the request input, so the log says *"Disconnected the linkedin account"*.

### One small extra edit

**File: `src/components/global/sidebar/nav-icons.tsx`**

Icons are referenced by string in the registry (`icon: 'Sparkles'`), so the string has to resolve to a real component:

```ts
import { Sparkles } from 'lucide-react'

export const NAV_ICONS: Record<string, LucideIcon> = {
  // ...existing
  Sparkles,
}
```

Forget this and the sidebar quietly falls back to a plain circle. Not a crash — just a wrong-looking icon, which is harder to notice.

---

## Step 3 — Database models

**File: `prisma/schema.prisma`**

Two new tables.

### `LinkedInAccount` — the connection

```prisma
model LinkedInAccount {
  id             String   @id @default(cuid())
  organizationId String   @unique
  userId         String

  personUrn String
  name      String
  avatarUrl String?

  accessToken           String    @db.Text
  refreshToken          String?   @db.Text
  expiresAt             DateTime
  refreshTokenExpiresAt DateTime?
  scope                 String

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  organization Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user         User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  posts        LinkedInPost[]

  @@index([userId])
  @@map("linkedin_account")
}
```

Decisions worth understanding:

- **`organizationId` is `@unique`** — one LinkedIn identity per organization. This makes reconnecting an *update* instead of piling up dead rows.
- **We store both `organizationId` and `userId`.** The org owns the connection (that's the tenancy key this whole app uses); the user is recorded so the audit trail knows who authorized it.
- **`refreshToken` is nullable.** This is not laziness. LinkedIn only issues refresh tokens to apps it has specially approved. Most apps never get one, which means the connection simply dies after ~60 days and the user must reconnect. The nullable column is us being honest about that instead of assuming a happy path.
- **`onDelete: Cascade`** — delete an organization and its LinkedIn connection goes with it. No orphan rows holding live credentials.
- **`@db.Text`** on the tokens because they can be long, and the default `String` maps to a length-limited column.

### `LinkedInPost` — what we published

```prisma
model LinkedInPost {
  id             String @id @default(cuid())
  organizationId String
  accountId      String
  authorId       String

  commentary String  @db.Text
  imageUrn   String?

  postUrn     String   @unique
  publishedAt DateTime @default(now())

  organization Organization    @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  account      LinkedInAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  author       User            @relation(fields: [authorId], references: [id], onDelete: Cascade)

  @@index([organizationId, publishedAt])
  @@index([accountId])
  @@index([authorId])
  @@map("linkedin_post")
}
```

**Why store posts at all, when LinkedIn already has them?**

Because you cannot read them back. Fetching a member's own posts needs the `r_member_social` permission, and LinkedIn's docs label it *"restricted — available to approved users only"*. You will not get it as a normal developer. So the "Recent Posts" list has to be your own record of what you sent. This is a real constraint that shaped the design, not a preference.

The index `[organizationId, publishedAt]` is deliberate: the only query we run is "recent posts for this org, newest first", and a compound index on exactly those two columns makes it fast.

### Don't forget the back-relations

Prisma requires both sides of a relation. Add to `User`:

```prisma
linkedinAccounts LinkedInAccount[]
linkedinPosts    LinkedInPost[]
```

And to `Organization`:

```prisma
linkedinAccount LinkedInAccount?   // singular + optional, because organizationId is @unique
linkedinPosts   LinkedInPost[]
```

Note `LinkedInAccount?` is singular and optional on `Organization` — that's what `@unique` on `organizationId` means: at most one.

### Push it

```bash
npx prisma validate      # catches syntax and relation errors first
npx prisma db push       # creates the tables
npx prisma generate      # regenerates the typed client
```

> **Windows gotcha:** `prisma generate` may fail with `EPERM ... query_engine-windows.dll.node`. That's the running dev server holding a file lock. Stop the dev server (Ctrl+C) and run it again. The TypeScript types usually get written anyway — only the engine file rename fails.

---

## Step 4 — Config layer

Config files hold keys, URLs, and constants. Nothing else. The pattern here copies `src/lib/config/stripe.ts` exactly, because consistency beats cleverness.

### `src/lib/config/ai.ts`

```ts
import Anthropic from '@anthropic-ai/sdk'

export const AI_MODEL = 'claude-opus-5' as const
export const AI_EFFORT = 'medium' as const
export const AI_MAX_TOKENS = 4096

let client: Anthropic | null = null

export function isAiConfigured(): boolean {
  return Boolean(process.env['ANTHROPIC_API_KEY'])
}

export function getAiClient(): Anthropic {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    throw new Error('[ai] ANTHROPIC_API_KEY is not set. AI generation is unavailable...')
  }
  if (!client) {
    client = new Anthropic({ apiKey })
  }
  return client
}
```

Three ideas here, and each one matters:

**1. Lazy construction.** Notice we build the client *inside* the function, not at the top of the file. If we wrote `const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })` at module level, then a missing key would crash the entire app at boot — including the pages that have nothing to do with AI. This way, only the AI feature breaks, and it breaks with a sentence explaining what to do.

That's called **failing soft**, and every optional integration in this codebase does it.

**2. Memoization.** `let client` outside the function caches the instance. Without it you'd construct a new HTTP client on every single request.

**3. One place for the model name.** `AI_MODEL` lives here and nowhere else. When you upgrade models, it's a one-line change. If the model string were sprinkled across services and components, you'd be grepping.

### `src/lib/config/linkedin.ts`

```ts
export const LINKEDIN_SCOPES = ['openid', 'profile', 'w_member_social'] as const
export const LINKEDIN_API_VERSION = process.env['LINKEDIN_API_VERSION'] ?? '202601'
export const LINKEDIN_MAX_COMMENTARY = 3000
export const LINKEDIN_REDIRECT_PATH = '/api/linkedin/callback'
export const LINKEDIN_OAUTH_STATE_COOKIE = 'linkedin_oauth_state'

export const LINKEDIN_ENDPOINTS = {
  authorization: 'https://www.linkedin.com/oauth/v2/authorization',
  accessToken:   'https://www.linkedin.com/oauth/v2/accessToken',
  userinfo:      'https://api.linkedin.com/v2/userinfo',
  posts:         'https://api.linkedin.com/rest/posts',
  images:        'https://api.linkedin.com/rest/images',
} as const

export function getLinkedInRedirectUri(): string {
  return new URL(LINKEDIN_REDIRECT_PATH, APP_URL).toString()
}
```

**Why `LINKEDIN_API_VERSION` reads from env:** LinkedIn versions its APIs by month (`202601`) and *retires old versions on a rolling schedule*. When yours is sunset, everything breaks. Reading it from an env var means you fix it by changing a value in your hosting dashboard, not by shipping code at 2am.

**Why `getLinkedInRedirectUri()` is a function:** the redirect URL is needed in two places — when sending the user to LinkedIn, and again when trading the code for a token. LinkedIn compares them and rejects the exchange if they differ *by even one character*. Deriving both from one function makes drift impossible.

**Why the cookie name lives here** and not in the route file: Next.js restricts which symbols a route file may export. Exporting a random constant from `route.ts` can break the build. Config constants belong in config.

Finally, both files get re-exported from `src/lib/config/index.ts`, so the rest of the app imports from `@/lib/config` and never needs to know the internal file split.

---

## Step 5 — Types and validation

Per this project's rules, **every custom type lives in `src/lib/types/`** — nowhere else. And every input gets a Zod schema.

### `src/lib/types/ai.ts`

```ts
export const POST_TONES = [
  'professional', 'conversational', 'storytelling', 'contrarian', 'educational',
] as const
export const postToneSchema = z.enum(POST_TONES)
export type PostTone = z.infer<typeof postToneSchema>
```

That's three lines doing four jobs: the list the dropdown renders from, the runtime validator, the TypeScript type, and the guarantee they can never disagree. `z.infer` derives the type *from* the schema, so there's one source of truth.

Now the interesting part:

```ts
export const generatePostSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('topic'),
    topic: z.string().trim().min(10).max(1000),
    tone: postToneSchema,
    length: postLengthSchema,
  }),
  z.object({
    source: z.literal('blog'),
    blogUrl: z.url('Enter a valid blog URL'),
    tone: postToneSchema,
    length: postLengthSchema,
  }),
])
```

**What a discriminated union is, in plain terms:** "this data is one of these shapes, and the `source` field tells you which."

The UI has two tabs — write about a topic, or repurpose a blog post. Without a union you'd write:

```ts
// the bad version
{ source: string, topic?: string, blogUrl?: string }
```

...and then hand-check "if source is blog, is blogUrl present?" in the router, in the service, and in the form. Three places to forget.

With the union, **a blog request that carries a topic doesn't compile.** TypeScript won't let you write it and Zod won't let it through at runtime. The invalid state stops existing.

### `src/lib/types/linkedin.ts`

The image size check is worth reading closely:

```ts
data: z.string().min(1).refine(
  (value) => Math.floor((value.length * 3) / 4) <= LINKEDIN_MAX_IMAGE_BYTES,
  'Image must be 5 MB or smaller'
)
```

Images travel as base64 (text). **Base64 makes data about 33% bigger** — 3 bytes of image become 4 characters of text. So checking the string length would reject a perfectly fine 4 MB image. The `* 3 / 4` converts back to real bytes before comparing.

Small detail, but it's the difference between "why won't my image upload" bug reports and a feature that just works.

Then there's this:

```ts
export interface LinkedInConnectionStatus {
  connected: boolean
  configured: boolean
  name: string | null
  avatarUrl: string | null
  expiresAt: Date | null
  needsReconnect: boolean
}
```

**Why declare this by hand instead of returning the Prisma model?** Because `accessToken` and `refreshToken` live on the same database row. If you returned the model directly, you'd ship posting credentials to the browser — anyone could open DevTools and post as that user forever.

By declaring the safe shape as its own type, the compiler enforces that only these six fields can be returned. Security by type system rather than by remembering.

---

## Step 6 — Services

Services touch the outside world — database, LinkedIn, Claude. They contain **no decisions**. Every service file starts with:

```ts
import 'server-only'
```

If any of these files ever gets imported into browser code, **the build fails**. That's the whole point: these files read bearer tokens, and a token in a browser bundle is a security incident.

### `src/services/ai.service.ts`

The key design choice is splitting it in two:

```ts
// The generic primitive — every future AI feature calls this
export async function generateText({ system, prompt, allowWebFetch }: GenerateTextArgs): Promise<string>

// The one task built on it today
export async function generateLinkedInPost(input: GeneratePostValues): Promise<GeneratedPost>
```

**Why the split?** Because profile analysis, comment drafting, and the AI agent are all coming. If each one constructed its own Anthropic client, you'd have four copies of the retry handling, the refusal check, and the effort setting. Instead they all call `generateText`, and this is the only file in the entire app that imports the Anthropic SDK.

Inside `generateText`:

```ts
const response = await client.messages.create({
  model: AI_MODEL,
  max_tokens: AI_MAX_TOKENS,
  thinking: { type: 'adaptive' },
  output_config: { effort: AI_EFFORT },
  system,
  messages: [{ role: 'user', content: prompt }],
})

if (response.stop_reason === 'refusal') {
  throw new Error('The AI declined this request. Try rewording your topic...')
}
```

- **`thinking: { type: 'adaptive' }`** lets the model decide how much to reason per request instead of you guessing a fixed budget.
- **The refusal check comes before reading the response.** Safety classifiers can decline a request and return a *successful* HTTP 200 with an empty `content` array. Code that does `response.content[0].text` without checking crashes on those. Checking `stop_reason` first turns a crash into a helpful message.

The system prompt is worth reading in full in the file, but here's the thinking behind its rules:

| Rule | Why it exists |
|---|---|
| "Return ONLY the post text" | Otherwise the model writes *"Here's your LinkedIn post:"* and the user has to delete it every single time. |
| "Never use markdown" | LinkedIn has no markdown. `**bold**` renders as literal asterisks. |
| Language rules: no em dashes, the AI-tell word and phrase lists, no reveal bridges ("The result?"), no "It's not X, it's Y" | These are the tells that make a post read as machine-written. Naming them explicitly is more effective than "sound human". |
| Hook rules: the first line is a statement or a number, never a question, inside 140 characters | LinkedIn's mobile feed cuts to "see more" at about 140 characters, and question openers perform worst. |
| "At most one contrast and one list of three" | Readers don't mind the devices; they notice when a post stacks them. |
| "Never invent numbers, names, dates, clients or results" | It replaces "a concrete number beats an abstract claim", which pushed the model to make figures up when the topic had none. |
| "End with a specific question, or a clean final line" | Generic closers ("What do you think?") get no replies and can read as engagement bait. |
| "Never put a link in the post" and "at most two hashtags" | In-body links are shown to fewer people, and extra hashtags add nothing because LinkedIn matches posts by meaning. |

**Where the rules live (updated September 2026).**
- **The word and phrase lists** are in `src/lib/config/post-writing.ts`. The post checker reads the same lists, so what the AI avoids and what the checker flags can't drift apart.
- **The rule text** is in `ai.service.ts` as `LINKEDIN_LANGUAGE_RULES` and `LINKEDIN_HOOK_RULES`, shared by the post, carousel and content plan prompts.
- **Length targets** are 50–80, 150–220 and 250–320 words.
- **Source.** The rules are adapted from [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills) (MIT). See `THIRD_PARTY_NOTICES.md`.

### Check my post and Fix it (added September 2026)

A panel under the editor checks the post as the member types.

**How the check works**
- `checkPost` in `src/lib/post-check.ts` runs in the browser, so it's instant and costs nothing.
- It matches against the same lists in `post-writing.ts` the generators avoid, so a freshly generated post and the check agree.
- Problem codes, severities and copy live in `POST_CHECK_RULES`. The types are in `src/lib/types/post-check.ts`.

**Must fix (blockers)**
- over 3,000 characters
- a link in the post
- too many dashes
- a question, weak or press-release opener
- announced honesty ("Let me be honest")
- an all-caps line
- a reveal line
- "It's not X, it's Y"
- a generic ending
- a paragraph with three or more AI-sounding words

**Worth reviewing (warnings)**
- a first line past 140 characters
- a length well off target (±20%), checked only for a post generated at a chosen length, since the select defaults to Medium
- more than 2 hashtags
- stock phrases
- staccato fragments
- hedging
- emoji clusters
- comment bait
- nothing specific

**Two deliberate choices**
- **AI-sounding words count only at density.** One "robust" is just English.
- **Em dashes are only flagged in excess** (about one per 100 words). People who write with dashes aren't nagged.

**Fix it**
- **Same procedure as Generate.** It sends `aiGeneration.create` with `source: "fix"`, so it spends one generation from the same allowance.
- **Only issue codes are sent**, never free text. The server adds each problem's wording from `POST_CHECK_RULES`.
- **It edits rather than writes.** `LINKEDIN_POST_EDITOR_SYSTEM_PROMPT` changes only what's listed, never adds facts, hedges or confessions, and keeps the member's voice.
- **Undo fix** restores the previous text. It clears as soon as the member types, so it can't discard later edits.

**Where it lives**
- The panel is the global `PostCheckPanel` in `src/components/global/post-check/`.
- It takes an optional `onFix` and `fixResource`, so the carousel caption or the draft library can reuse it later.

### Goal picker and opening lines (added September 2026)

**The goal.** The form asks "What do you want from this post?": No preference, Comments, Reposts, Likes or Saves.
- `goal` is part of the topic and blog branches of `generatePostSchema`. The content plan's "Draft this" sends `DEFAULT_POST_GOAL`.
- The goal picks which hook formulas the model may use. They live in `HOOK_FORMULAS` (`src/lib/config/post-hooks.ts`): 16 shapes condensed from linkedin-skills, each tagged with the goals it serves.
- **Comments:** controlled A/B, contrarian with receipts, time-anchor story, curiosity gap, false binary, story meets evidence.
- **Reposts:** named gratitude, R.I.P. obituary, paid vs free, false binary, diverging curves.
- **Likes:** emotional cold open, bait and switch, status strip.
- **Saves:** explain it simply, exact number, paid vs free, story meets evidence.
- **No preference** offers all 16.
- **No invented facts.** Formulas built on numbers, names or dates are marked `needsSpecifics`, and the prompt allows them only when the topic supplies those facts.

**Opening lines.**
- **One call.** A topic post is a single `generateStructured` call returning the formula used, the post, and two alternative first lines written with other formulas. The model-facing schema is `postWithOpeningsSchema`, parsed back through `generatedPostSchema`.
- **The card.** The composer lists the generated opening first, then the alternatives, each labelled with its formula. **Use** swaps only the first line (`replaceOpeningLine`), spends nothing, and can be reversed by choosing the generated opening again.
- **Blog posts get no alternatives.** The blog path reads the article with the vendor's web-fetch tool, and tools can't share a request with structured output on every vendor. Its `formula` is `null` and `alternativeOpenings` is empty, so the card doesn't appear. Fix it returns the same.

For the blog mode we pass `allowWebFetch: true`, which enables Claude's built-in `web_fetch` tool. **This is why there's no scraping library in `package.json`** — the model reads the URL itself. One less dependency to maintain, and no HTML-stripping code to debug.

The last line matters:

```ts
return generatedPostSchema.parse({ commentary })
```

We validate the model's own output. **AI output is untrusted input like any other.** If the model returns something over 3000 characters, we want that to fail here with a clear error — not at LinkedIn's API after the user has already hit Publish.

### `src/services/linkedin.service.ts`

The biggest file. A few parts deserve explanation.

**The safe select:**

```ts
export const LINKEDIN_ACCOUNT_SAFE_SELECT = {
  name: true,
  avatarUrl: true,
  expiresAt: true,
  refreshToken: false,
} as const satisfies Prisma.LinkedInAccountSelect
```

This is the same pattern the codebase already uses for audit logs (`AUDIT_LOG_SAFE_SELECT`). It's an explicit list of what may leave the server, sitting right next to the code that reads the table.

**Token refresh:**

```ts
const stale = account.expiresAt.getTime() - TOKEN_REFRESH_SKEW_MS <= Date.now()
```

We refresh **five minutes before** expiry, not at expiry. Why? Because a publish request takes a second or two, and a token that's valid when you check but expires mid-request fails in a confusing way. The five-minute buffer makes that impossible.

And when there's no refresh token:

```ts
if (!account.refreshToken) {
  throw new Error('Your LinkedIn connection has expired. Reconnect your account to keep publishing.')
}
```

A sentence the user can act on, rather than letting LinkedIn answer `401` with an opaque body.

**Image upload is two steps, not one:**

```ts
// Step 1: ask LinkedIn where to put it
POST https://api.linkedin.com/rest/images?action=initializeUpload
  body: { initializeUploadRequest: { owner: personUrn } }
  → returns { value: { uploadUrl, image } }

// Step 2: PUT the actual bytes to that URL (a different host!)
PUT <uploadUrl>
  body: <binary>
```

You get back an **image URN** (`urn:li:image:...`). The post doesn't contain the image — it *references* the URN. This trips people up: the upload URL is not the API host, and you must use the exact URL LinkedIn handed you.

**Publishing, and the header nobody expects:**

```ts
const response = await fetch(LINKEDIN_ENDPOINTS.posts, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': LINKEDIN_API_VERSION,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    author: personUrn,
    commentary,
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    ...(imageUrn ? { content: { media: { id: imageUrn } } } : {}),
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }),
})

const postUrn = response.headers.get('x-restli-id')
```

Two things to remember:

1. **All three headers are mandatory.** Miss `X-Restli-Protocol-Version` or `LinkedIn-Version` and LinkedIn rejects the request outright.
2. **The new post's ID comes back in the `x-restli-id` response header, not the body.** The body is empty on a 201. If you're looking for it in the JSON, you'll never find it. This is genuinely surprising and cost real debugging time when the API was designed.

---

## Step 7 — Routers

Routers hold business logic. They're thin because the registry already handled quotas, audit, rate limits, and permissions.

Three new files, each mounted under a key that **exactly matches** its registry key.

### `src/trpc/routers/ai-generation.ts`

```ts
create: protectedProcedure({ requirePermission: permissions.AI_GENERATION_CREATE })
  .input(generatePostSchema.and(z.object({ organizationId: z.string().min(1) })))
  .mutation(async ({ input }) => {
    if (!isAiConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'AI generation is not configured. Add ANTHROPIC_API_KEY to enable it.',
      })
    }
    return await aiService.generateLinkedInPost(input)
  })
```

**Why is it called `create` and not `generate`?** Because of the path rule from Step 2. `aiGeneration.create` matches the registry key + a recognized verb, so the quota and counter fire. `aiGeneration.generate` would not.

Naming your procedure to fit the convention is how you opt into the framework. It feels odd the first time; it's what makes the rest free.

**Why check `isAiConfigured()` first?** So an operator's missing API key doesn't consume the user's generation quota. Fail before spending.

### `src/trpc/routers/linkedin-posts.ts`

The ordering inside `create` is the important part:

```ts
// 1. Get a valid token (refreshing if needed)
const token = await linkedinService.getValidAccessToken(ctx.db, input.organizationId)

// 2. Send it to LinkedIn
const published = await linkedinService.publishPost({ ... })

// 3. ONLY THEN write our record
return linkedinService.recordPublishedPost(ctx.db, { ... })
```

**Why LinkedIn first, database second?**

The whole handler runs inside a database transaction (the framework does this). If LinkedIn rejects the post, we throw before writing anything — so the transaction rolls back, and the audit row and the usage counter roll back with it.

Result: **a failed publish costs the user nothing.** No phantom post in their history, no quota burned.

Do it the other way round and a network blip leaves a row claiming you published something that never reached LinkedIn.

Also note the error codes are chosen deliberately:

| Situation | Code | Why |
|---|---|---|
| No LinkedIn connected | `PRECONDITION_FAILED` | The user can fix this — connect an account. |
| LinkedIn rejected the post | `BAD_GATEWAY` | An upstream service failed, not the user's fault. |

The UI reads these and shows different messages.

### `src/trpc/routers/integrations.ts`

Small. Two procedures: read the connection status, and disconnect. Note the return type is annotated:

```ts
.query(async ({ ctx, input }): Promise<LinkedInConnectionStatus> => ...)
```

That explicit annotation is a tripwire. If someone later edits the service to return the whole Prisma row, **this line stops compiling** — tokens can't silently leak into a response.

### Mounting them

**File: `src/trpc/routers/_app.ts`**

```ts
export const appRouter = createTRPCRouter({
  // ...existing routers
  aiGeneration: aiGenerationRouter,
  linkedinPosts: linkedinPostsRouter,
  integrations: integrationsRouter,
})
```

Say it once more because it's the single most common mistake: **these keys must match the `RESOURCES` keys exactly.**

---

## Step 8 — The OAuth routes

OAuth is a redirect dance, so it can't be a tRPC procedure — the browser has to physically navigate to LinkedIn and back. That means plain Next.js route handlers.

### The flow, drawn out

```
User clicks "Connect LinkedIn"
        │
        ▼
GET /api/linkedin/connect
  • generate a random `state` string
  • save it in an httpOnly cookie
  • redirect to LinkedIn with state in the URL
        │
        ▼
LinkedIn asks: "Allow this app to post for you?"
        │
        ▼  (user clicks Allow)
GET /api/linkedin/callback?code=ABC&state=XYZ
  • does `state` match the cookie?  → if not, reject
  • trade `code` for an access token
  • fetch the user's profile → get their person URN
  • save everything to LinkedInAccount
  • redirect back to the composer with ?connected=1
```

### Why the `state` parameter exists

This is the security part, and it's worth understanding rather than copying.

Without `state`, an attacker could send your logged-in user a link like:

```
https://yourapp.com/api/linkedin/callback?code=ATTACKERS_CODE
```

Your app would dutifully exchange that code and connect **the attacker's LinkedIn account** to **your user's organization**. Now anything the user "publishes" goes to the attacker's feed — or worse, the attacker reads content the user drafts.

The fix: before sending the user off, generate a random value, store it in a cookie the browser can't read from JavaScript (`httpOnly`), and include it in the URL. When LinkedIn sends the user back, the value in the URL must match the cookie. An attacker can't forge that — they can't set a cookie on your domain.

```ts
const state = randomBytes(32).toString('hex')
const response = NextResponse.redirect(buildAuthorizationUrl(state))

response.cookies.set(LINKEDIN_OAUTH_STATE_COOKIE, state, {
  httpOnly: true,                                    // JS can't read it
  sameSite: 'lax',                                   // not sent on cross-site POSTs
  secure: process.env.NODE_ENV === 'production',     // HTTPS only in prod
  path: '/',
  maxAge: 10 * 60,                                   // dies in 10 minutes
})
```

And the comparison:

```ts
function statesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
```

`timingSafeEqual` always takes the same amount of time regardless of where two values differ. A normal `===` returns faster when the first character is wrong, and an attacker measuring response times could theoretically guess the value one character at a time. This is paranoid for a 10-minute token — but it costs one import, and getting into the habit is worth more than the specific risk.

### Errors come back as query params

The callback is a redirect, so it can't return JSON to the app. Every failure sends the user back to the composer with a code in the URL:

```ts
function redirectToComposer(status: string): NextResponse {
  const url = new URL(COMPOSER_PATH, APP_URL)
  if (status === 'connected') {
    url.searchParams.set('connected', '1')
  } else {
    url.searchParams.set('error', status)
  }
  const response = NextResponse.redirect(url)
  response.cookies.delete(LINKEDIN_OAUTH_STATE_COOKIE)   // single use, always
  return response
}
```

The UI translates those codes into readable sentences. And notice the cookie is deleted on **every** path, success or failure — a used state value must never be replayable.

One more detail: real errors get logged server-side, but the browser only sees an opaque code:

```ts
} catch (error) {
  console.error('[linkedin] callback failed:', error)   // full detail in your logs
  return redirectToComposer('exchange_failed')          // vague code for the user
}
```

LinkedIn's error bodies can contain internal detail. Log it where you can debug it; don't paint it on the screen.

---

## Step 9 — The UI

Two categories, and the split follows a rule in this project's `CLAUDE.md`:

- **Reusable across features** → `src/components/global/...`
- **Used by exactly one route** → `THE_ROUTE/_components/`

### Global: `src/components/global/linkedin/`

**`post-preview.tsx`** — the LinkedIn-styled card.

Why global? Because the same card appears in the composer today, and in drafts, the schedule queue, and post analytics tomorrow. It's purely presentational — it fetches nothing and mutates nothing — and takes slots:

```tsx
export interface LinkedInPostPreviewProps {
  authorName: string
  authorAvatarUrl?: string | null | undefined
  commentary: string
  imageUrl?: string | null | undefined
  timestamp?: string
  children?: React.ReactNode    // replaces the body — lets the composer put an editor there
  actions?: React.ReactNode     // extra controls below the body
  className?: string
}
```

The `children` slot is the clever bit. In a read-only list you pass nothing and get static text. In the composer you pass a `<Textarea>` and the user edits **inside the preview** — so what they type is literally what the post will look like. Same component, two behaviours, no duplication.

> **A TypeScript detail:** this project has `exactOptionalPropertyTypes: true` in `tsconfig.json`. That means `authorAvatarUrl?: string | null` allows *omitting* the prop but not *passing `undefined` explicitly*. Since the value comes from an API that may return `undefined`, the type must say `string | null | undefined`. If you hit `Type 'undefined' is not assignable`, this is why.

**`connect-button.tsx`** — renders four states from one query: not configured, not connected, expired, connected.

Why global and not inline? Because four states are easy to render inconsistently if every page reimplements them.

One thing to note:

```tsx
<Button onClick={() => { window.location.href = LINKEDIN_CONNECT_PATH }}>
```

A **full page navigation**, not a client-side route change and not a `fetch`. The connect route needs to set an httpOnly cookie and issue a 302 to LinkedIn's domain — neither survives a React transition.

### Route-local: `src/app/(dashboard)/dashboard/post-generation/`

**`page.tsx`** — deliberately three lines. Every page in this codebase is a thin shell that renders one client component. Keeps the server/client boundary obvious.

**`_components/generate-form.tsx`** — the left pane.

This is where the discriminated union from Step 5 pays off. Instead of one form fighting the union type, there are two forms, each typed to one branch:

```ts
type TopicValues = Extract<GeneratePostValues, { source: 'topic' }>
type BlogValues  = Extract<GeneratePostValues, { source: 'blog' }>

const topicForm = useForm<TopicValues>({
  resolver: zodResolver(generatePostSchema.options[0]),
  defaultValues: { source: 'topic', topic: '', tone, length },
})
```

`Extract<Union, Shape>` pulls one member out of a union type. No new types were declared — both come from the schema, so they can never drift from it.

Tone and length are lifted up to the parent component, so switching tabs doesn't silently reset the user's choices. Small thing; very annoying when it's missing.

**`_components/post-composer.tsx`** — orchestrates everything.

Reading the OAuth result:

```tsx
React.useEffect(() => {
  const connected = searchParams.get('connected')
  const error = searchParams.get('error')
  if (!connected && !error) return

  if (connected) {
    toast.success('LinkedIn connected.')
    void utils.integrations.linkedin.invalidate()   // refetch so the header updates
  } else if (error) {
    toast.error(CALLBACK_ERROR_MESSAGES[error] ?? 'Could not connect to LinkedIn.')
  }
  router.replace('/dashboard/post-generation')      // strip the params
}, [searchParams, router, utils])
```

The `router.replace` at the end strips the query params, so refreshing the page doesn't replay the same toast.

Handling the image:

```tsx
if (file.size > LINKEDIN_MAX_IMAGE_BYTES) {
  toast.error('Image must be 5 MB or smaller.')
  return
}
```

Checked **before** reading the file. Base64-encoding a 50 MB file just to reject it would freeze the browser tab for seconds.

And cleanup:

```tsx
setImagePreviewUrl((previous) => {
  if (previous) URL.revokeObjectURL(previous)
  return null
})
```

`URL.createObjectURL` holds the file in memory until you revoke it. Forget this and a user who swaps images ten times has leaked ten files. We revoke on replace, on remove, and on unmount.

---

## How one request flows end to end

Worth tracing once, because it shows how little code the feature actually contains.

**User clicks "Post to LinkedIn":**

```
1.  post-composer.tsx
    publish.mutate({ organizationId, commentary, image })

2.  tRPC ships it to the server, typed end to end

3.  protectedProcedure wrapper  ← ALL OF THIS IS AUTOMATIC
    ├─ Is the user logged in?                    → 401 if not
    ├─ Do they belong to this organization?      → 403 if not
    ├─ Do they have linkedinPosts:create?        → 403 if not
    ├─ Rate limit: 5 per minute?                 → 429 if exceeded
    ├─ Plan limit: under their post quota?       → 402 + upgrade message if not
    └─ Open a database transaction

4.  linkedin-posts.ts create handler   ← THE ONLY CODE WE WROTE
    ├─ getValidAccessToken()  → refresh if within 5 min of expiry
    ├─ publishPost()          → upload image, POST to LinkedIn, read x-restli-id
    └─ recordPublishedPost()  → INSERT into linkedin_post

5.  protectedProcedure wrapper again   ← AUTOMATIC
    ├─ Write the ActivityLog row ("Published a LinkedIn post")
    ├─ Increment the usage counter
    └─ Commit the transaction

6.  Response travels back, fully typed

7.  post-composer.tsx onSuccess
    ├─ toast.success('Published to LinkedIn.')
    ├─ clear the editor and the image
    └─ invalidate queries → recent posts and usage refresh
```

**Steps 3 and 5 are entirely free.** We got them by declaring the feature in the registry. That's roughly 150 lines of security and billing logic we didn't write, can't forget, and can't get subtly wrong.

---

## Testing it

Run these in order. If one fails, stop and fix it before moving on.

```bash
npx tsc --noEmit     # types. must print nothing
npm run lint         # style + project rules. must print nothing
npm run build        # the real test — catches server/client boundary violations
npm run dev
```

`npm run build` matters most. `tsc` won't notice if you accidentally import a `server-only` file into a client component; the build will fail loudly.

Then, in the browser:

| # | Do this | Expect |
|---|---|---|
| 1 | Open `/dashboard/post-generation` | "Create Post" is in the sidebar with a sparkle icon |
| 2 | Click **Connect LinkedIn** | LinkedIn consent screen appears |
| 3 | Click Allow | Back on the composer, toast says "LinkedIn connected", your name and avatar in the header |
| 4 | Type a topic, click **Generate Post** | Copy appears in the preview within a few seconds |
| 5 | Edit the text directly in the preview | Character counter updates live |
| 6 | Attach an image | Preview shows it |
| 7 | Click **Post to LinkedIn** | Toast confirms; **open LinkedIn and confirm the post is really on your feed** |

### The check that actually proves the wiring

Everything above could pass with hand-written code. This is the one that proves the registry did its job:

```sql
SELECT * FROM activity_log  ORDER BY "createdAt" DESC LIMIT 5;
SELECT * FROM usage_metrics WHERE "organizationId" = '<your org id>';
```

You should see a row saying *"Published a LinkedIn post"*, and a `linkedinPosts` counter at 1.

**We wrote no code to produce either of those.** They exist purely because of the `audit` and `limit` fields in Step 2. If they're there, the auto-wiring worked.

### And the quota

Set your plan to `free` and publish 11 times. The 11th should be blocked with *"Upgrade to Starter to publish more posts"* — the exact `upgradeMessage` string from the registry.

---

## Mistakes that are easy to make

| Mistake | What happens | Fix |
|---|---|---|
| Router key ≠ registry key | No quota, no audit, no counter. Or a loud error telling you to fix it. | Make `_app.ts` keys match `RESOURCES` keys exactly |
| Procedure named `generate` instead of `create` | Auto-wiring silently doesn't fire | Use the conventional verbs: `create`, `read`, `update`, `delete` |
| Forgetting `import 'server-only'` | Secrets can end up in the browser bundle | Every file in `src/services/` starts with it. Lint enforces this. |
| Returning the Prisma model from a connection query | Access tokens ship to the browser | Return `LinkedInConnectionStatus`, keep the explicit return-type annotation |
| Redirect URI mismatch | LinkedIn rejects the token exchange with an unhelpful error | Both places derive from `getLinkedInRedirectUri()`. Check the registered URL matches exactly, no trailing slash. |
| Looking for the post ID in the response body | It's `null`; you can't record what you published | Read the `x-restli-id` **header** |
| Missing `LinkedIn-Version` header | Request rejected outright | All three headers on every versioned call |
| Checking base64 string length for image size | Rejects valid images ~25% under the limit | Convert to bytes: `length * 3 / 4` |
| Forgetting `URL.revokeObjectURL` | Memory leak on every image swap | Revoke on replace, remove, and unmount |
| Adding an icon string without registering it | Sidebar shows a plain circle, no error | Add it to `NAV_ICONS` |

---

## What we deliberately did NOT build

Being explicit about scope is part of the design.

| Not built | Why | When |
|---|---|---|
| **Save Draft** | Needs a `status` column and a draft list. Deliberately deferred to keep feature 1 shippable. | Feature 2 — extend `LinkedInPost` with `status`, don't create a new table |
| **Scheduling** | Needs a cron or queue (Vercel Cron, QStash, or a DB-polled worker). That's an infrastructure decision, not a code decision. | Feature 2, after drafts |
| **AI image generation** | Needs an image model *and* a storage provider. | Later |
| **File storage** | Images go straight to LinkedIn at publish time, so nothing needs storing. Note the registry already has a `storage` quota declared with per-plan limits and no implementation behind it — that's the socket to plug into. | When drafts need to hold images |
| **Posting to company pages** | Needs the `w_organization_social` scope and page-admin role — different permissions, different author URN. | Separate feature |
| **Reading the LinkedIn feed** | Impossible without `r_member_social`, which LinkedIn restricts to approved partners. | Probably never |

### Known limitation you should plan for

LinkedIn access tokens last about **60 days**, and refresh tokens are only issued to specially approved apps. If yours isn't approved, users must reconnect every 60 days.

We handle this honestly rather than hiding it: the `refreshToken` column is nullable, `getValidAccessToken` detects the situation, and the UI shows **"Reconnect LinkedIn"** instead of failing at publish time with a confusing error.

---

## File map

Everything this feature touched, in build order.

**New files (11):**

```
src/lib/config/ai.ts                                        AI client + model constants
src/lib/config/linkedin.ts                                  LinkedIn credentials, scopes, endpoints
src/lib/types/ai.ts                                         Generation input/output schemas
src/lib/types/linkedin.ts                                   Publishing + connection schemas
src/services/ai.service.ts                                  Claude calls
src/services/linkedin.service.ts                            OAuth, tokens, upload, publish
src/trpc/routers/ai-generation.ts                           Generate endpoint
src/trpc/routers/linkedin-posts.ts                          Publish / list / delete
src/trpc/routers/integrations.ts                            Connection status / disconnect
src/app/api/linkedin/connect/route.ts                       Starts OAuth
src/app/api/linkedin/callback/route.ts                      Finishes OAuth
```

Plus the component and page files:

```
src/components/global/linkedin/post-preview.tsx
src/components/global/linkedin/connect-button.tsx
src/components/global/linkedin/index.ts
src/app/(dashboard)/dashboard/post-generation/page.tsx
src/app/(dashboard)/dashboard/post-generation/_components/generate-form.tsx
src/app/(dashboard)/dashboard/post-generation/_components/post-composer.tsx
```

**Edited files (7):**

```
src/lib/resources.ts                                        + linkedinPosts, aiGeneration; integrations gained 'disconnect'
prisma/schema.prisma                                        + LinkedInAccount, LinkedInPost, back-relations
src/lib/config/index.ts                                     + re-exports
src/lib/types/index.ts                                      + re-exports
src/trpc/routers/_app.ts                                    + 3 routers mounted
src/components/global/sidebar/nav-icons.tsx                 + Sparkles
.env.example                                                + documented env vars
```

**Bonus fix:** `src/services/membership.service.ts` and `src/services/usage.service.ts` were missing `import 'server-only'` — a pre-existing violation of this project's own security rule that was failing `npm run lint` before this feature started. Both fixed.

---

## The one thing to remember

If you take nothing else from this document:

> **Declare the feature in `src/lib/resources.ts`, then name your router and procedures to match. Everything else — quotas, counters, audit trails, rate limits, permissions, navigation — wires itself.**

Fighting that convention means reimplementing it by hand and getting it subtly wrong. Following it means the next feature is mostly typing.
