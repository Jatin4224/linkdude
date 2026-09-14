# Building the voice profile — a complete walkthrough

This is the build log for **the voice profile: a member pastes posts they wrote, the model reads how they write, and every generator in the app drafts in that voice from then on.**

Read [07 — Adding a feature](./07-adding-a-feature.md) for the registry procedure, [09 — LinkedIn post generation](./09-linkedin-post-generation.md) for the AI provider layer, and [11 — Personalized content plan](./11-personalized-content-plan.md) for the strict-for-model, lenient-for-storage schema split. This document assumes all three.

---

## Table of contents

1. [The 10-second version](#the-10-second-version)
2. [Why a voice and not more tones](#why-a-voice-and-not-more-tones)
3. [Words you need to know](#words-you-need-to-know)
4. [Step 1 — The registry](#step-1--the-registry)
5. [Step 2 — The database](#step-2--the-database)
6. [Step 3 — Types and config](#step-3--types-and-config)
7. [Step 4 — The shared AI guard](#step-4--the-shared-ai-guard)
8. [Step 5 — Services](#step-5--services)
9. [Step 6 — Routers](#step-6--routers)
10. [Step 7 — The UI](#step-7--the-ui)
11. [How one extraction flows end to end](#how-one-extraction-flows-end-to-end)
12. [The precedence rule](#the-precedence-rule)
13. [Testing it](#testing-it)
14. [Mistakes that are easy to make](#mistakes-that-are-easy-to-make)
15. [Known limitations](#known-limitations)
16. [File map](#file-map)

---

## The 10-second version

```
registry → database → types/config → shared guard → services → routers → UI
```

- **One new resource key**, `voiceProfile`, metered on extraction.
- **One new table**, `voice_profile`, one row per member per organization.
- **Three generators changed** (posts, carousels, content plans), each by one optional parameter.
- **No new dependency.**
- The "AI is not configured" check that was copy-pasted into five routers now lives in one place.

---

## Why a voice and not more tones

Before this, style was five hardcoded `PostTone` values, re-picked on every generation and stored nowhere. Every draft sounded like the model's house style, whichever tone was chosen.

A tone is a **per-post choice** ("make this one contrarian"). A voice is a **standing fact about a person** (short sentences, one-line paragraphs, never uses emoji, always closes with a question). They answer different questions, so a voice was added **alongside** tone, not in place of it. `PostTone`, `generatePostSchema` and every existing input are unchanged.

---

## Words you need to know

| Term | Meaning |
|---|---|
| **Sample** | One post the voice is learned from. `{ text, source }`. |
| **Descriptor** | What the model concludes: rhythm, vocabulary, opening/closing patterns, formatting. `VoiceDescriptor`. |
| **Extraction** | One run of the model over the samples, stored as `{ samples, descriptor, extractorVersion, extractedAt }`. `VoiceExtraction`. |
| **Overrides** | The member's corrections layered on top: register, emoji use, banned phrases, free-text guidance. `VoiceOverrides`. |
| **Resolved voice** | Descriptor with overrides applied. The only shape a generator ever sees. `ResolvedVoice`. |

---

## Step 1 — The registry

`src/lib/resources.ts` gains `voiceProfile`:

- `permissions: ["create", "read", "update", "revert", "discard"]`
- `limit` on the plan, free 1 / starter 10 / pro 50 / enterprise unlimited.
- `nav` under `create`, order 7, gated on `create`.

Three verb decisions carry the whole feature:

1. **`create` is the extraction.** It is the only verb the factory meters, so a re-extraction costs another unit, exactly like `contentPlan.create`.
2. **`discard`, never `delete`.** The factory refunds a quota slot on `<resource>.delete`. This counter measures model spend, so a refunding verb would make extract → remove → extract free.
3. **`revert` is its own verb.** It changes what generators read without a model call, and "Reverted" deserves its own audit line.

`update` covers the two free edits (saving overrides, switching the voice on or off) through one discriminated-union input. The audit template interpolates `{input.field}`, so the log still says which edit happened.

Also edit `src/components/global/sidebar/nav-icons.tsx`: the registry stores icons as strings, and an unmapped name silently renders a neutral circle. `AudioLines` was added there.

---

## Step 2 — The database

```prisma
model VoiceProfile {
  id             String @id @default(cuid())
  organizationId String
  authorId       String
  current        Json      // VoiceExtraction
  previous       Json?     // the extraction `current` displaced
  overrides      Json      // VoiceOverrides
  version        Int       @default(1)
  isActive       Boolean   @default(true)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  @@unique([organizationId, authorId])
}
```

Ask the developer to run `npx prisma db push`. Never `migrate dev` in this repo (see docs/07).

**Why samples and descriptor share one column.** A voice is only as good as the posts it came from. Stored separately, reverting would show a descriptor next to posts that never produced it.

**Why `current` + `previous` instead of a history table.** This is a third storage shape for a paid AI result in this schema:

| Model | Shape | Why |
|---|---|---|
| `ProfileAnalysis` | Append every result | Each critique is worth keeping |
| `ContentPlan` | Overwrite one session | There is exactly one in flight |
| `VoiceProfile` | Current plus one undo | Generators must read ONE voice, but each extraction is paid, so a bad one must be recoverable |

Revert **swaps** the two columns, so reverting a revert restores the newer voice instead of losing it.

**Why there is no `status` column.** A row is only ever created by a successful extraction inside the metered transaction. A row that exists has a voice.

---

## Step 3 — Types and config

`src/lib/types/voice-profile.ts` holds every schema. Two rules matter:

- **`voiceDescriptorSchema` is both the model contract and the storage boundary.** Its arrays are `.default([])` so stored voices keep parsing as fields are added. `extractVoiceProfile` re-requires them on the copy it sends to the model, because a model reads an optional array as permission to skip it.
- **Overrides are a named subset, not `.partial()` of the descriptor.** The form can only write fields a member can meaningfully control. "Keep what was extracted" is the stored sentinel `"inherit"`, because `undefined` cannot round-trip through a select or a Json column.

`src/lib/config/voice-profile.ts` holds `VOICE_EXTRACTOR_VERSION`, the model budget, the suggestion limit, the low-confidence threshold, and the label for every vocabulary value (`Record<…>` over the tuples, so a new value without a label fails to compile).

**`VOICE_EXTRACTOR_VERSION`** is the `PROFILE_MAPPER_VERSION` pattern. A voice read by an older extractor still parses perfectly, so only a version number can tell the member it is worth re-extracting. Bump it whenever the extraction prompt or descriptor schema changes what a voice captures.

---

## Step 4 — The shared AI guard

Every metered AI procedure must fail **before** it spends quota when no model key is set. That check existed five times: a private function in `content-plan.ts`, inline copies in `ai-generation.ts`, `carousel.ts` and `profile-analysis.ts`, and an image variant in `ai-image-edit.ts`. The voice profile would have been the sixth.

It now lives in `src/trpc/init.ts`, beside `toProcedureError`:

```ts
assertAiConfigured(capability = "AI generation", enables = "it")
assertAiImageConfigured()
```

The parameters keep every existing message word for word. It is in `init.ts` rather than `lib/config/ai.ts` because it throws a `TRPCError`, and the config barrel is imported by client components.

---

## Step 5 — Services

**`src/services/voice-profile.service.ts`** is shaped like `content-plan.service.ts`, because both tables share the `(organizationId, authorId)` key: `db` first, one named select, one `toStored…` function that `safeParse`s every Json column with a fallback.

The function that matters is **`readResolvedVoice`**. It is the only place overrides are merged, so the three generators can never read different versions of the same voice. It returns `null` (never throws) when there is no profile, the voice is switched off, or the stored extraction no longer parses. A broken voice therefore degrades a draft to the default style instead of failing a generation the member is paying for.

**`src/services/ai.service.ts`** gains:

- `extractVoiceProfile(samples)`: the extraction, with its own system prompt, token budget and timeout.
- `buildVoiceDirective(voice)`: the prompt block, or `""` when there is no voice.

`generateLinkedInPost`, `generateCarouselSlides` and `generateContentPlan` each take an optional `voice` parameter and append the block to the **prompt**. For content plans the block is scoped to the wording of hooks, ideas and CTAs, not the strategy itself.

**`listPublishedPosts`** in `linkedin.service.ts` gained an optional `authorId`, rather than adding a second post query for sample suggestions.

---

## Step 6 — Routers

`src/trpc/routers/voice-profile.ts`, mounted as `voiceProfile` in `_app.ts`:

| Procedure | Kind | Notes |
|---|---|---|
| `get` | query | Gated on `read` |
| `suggestSamples` | query | The member's own published posts that are long enough. A query, so nothing is spent. Gated on `create`. |
| `create` | mutation | The extraction. `txTimeout` exceeds the model timeout. |
| `update` | mutation | Overrides or on/off. `NOT_FOUND` when there is no profile. |
| `revert` | mutation | Throws when there is nothing to go back to, which also rolls back the audit row. |
| `discard` | mutation | Succeeds on a no-op. |

The three generating routers (`aiGeneration.create`, `carousel.create`, `contentPlan.create`) each call `readResolvedVoice(ctx.db, input.organizationId, ctx.user.id)` and pass the result down. **The voice is never an input field**, so a caller cannot hand the model a voice the member never extracted. This is the same rule `contentPlan.brief` follows for profiles.

---

## Step 7 — The UI

`src/app/(dashboard)/dashboard/voice/`:

- `voice-workspace.tsx` owns every query and mutation and checks each permission before offering an action.
- `voice-samples-form.tsx` is a field array resolved against `extractVoiceProfileSchema`, with character counters, "Add my published posts", and the extract button inside `<FeatureGate resource="voiceProfile">`.
- `voice-descriptor-card.tsx` shows what the model concluded, the on/off switch, revert, and discard (behind a confirm dialog).
- `voice-overrides-form.tsx` holds the member's corrections.

The composer (`post-generation`) shows one line under tone and length: "Drafts are written in your voice. Manage", or a link to set one up. It is hidden for members who cannot read voice profiles.

No new global component was needed.

---

## How one extraction flows end to end

```
Member pastes 3+ posts → Extract
  └─ voiceProfile.create
       ├─ protectedProcedure: membership, permission, rate limit, quota check
       ├─ assertAiConfigured()                      ← before any spend
       ├─ aiService.extractVoiceProfile(samples)    ← strict schema to the model
       ├─ voiceProfileService.recordVoiceExtraction ← old current → previous
       ├─ usage counter +1, audit row               ← same transaction
       └─ returns StoredVoiceProfile

Member generates a post
  └─ aiGeneration.create
       ├─ readResolvedVoice → descriptor + overrides, or null
       └─ generateLinkedInPost(input, voice)       ← block appended to prompt
```

If the model call or the write fails, the transaction rolls back the usage increment. The org is never billed for a voice it cannot see.

---

## The precedence rule

This is the first text in any prompt here that differs per organization, so it needs a written rule for which instruction wins. It lives inside `buildVoiceDirective`:

1. **The task's hard rules win.** They exist to stop known failures, such as markdown that LinkedIn renders as literal asterisks. A voice that "uses em dashes" must not bring one back.
2. **A tone chosen for this piece wins over the standing voice.**
3. **Banned phrases are absolute.**

That is also why the voice goes in the prompt, not the system prompt. The system prompts are constants shared by every organization, and keeping tenant text out of them keeps their authority intact.

---

## Testing it

1. `npm run typecheck` is clean.
2. The sidebar shows **Voice** for an owner.
3. Three posts under 1,200 characters total are rejected in the form, before any request is sent.
4. On a free org the first extraction succeeds and the second shows the upgrade modal. `UsageMetrics` for `voiceProfile` reads 1.
5. Discard, then try to extract again: still blocked. Discarding does not refund.
6. With the voice on, generate a post, a carousel and a content plan. Switch it off and generate again. The drafts should read differently.
7. Add a banned phrase and confirm it never appears.
8. Re-extract, then **Switch to previous voice**, then switch again. Both voices come back.
9. The audit log shows "Extracted a writing voice from 3 posts", with a number rather than a literal `{output.sampleCount}`.

---

## Mistakes that are easy to make

- **Naming the removal verb `delete`.** The factory would refund the extraction and make it free.
- **Accepting the voice as generator input.** Always resolve it server-side from `ctx.user.id`.
- **Merging overrides anywhere except `readResolvedVoice`.** Two merges will eventually disagree.
- **Splicing the voice into a system prompt.** It would outrank the hard rules.
- **Forgetting `nav-icons.tsx`.** The sidebar shows a neutral circle and nothing errors.
- **Changing the extraction prompt without bumping `VOICE_EXTRACTOR_VERSION`.** Existing voices would never be flagged as worth re-extracting.
- **Adding a fourth copy of the AI guard.** Use `assertAiConfigured` from `src/trpc/init.ts`.

---

## Known limitations

- **Posts published through the app are a weak source.** They were drafted by the model, so a voice learned from them drifts toward the app's own style. The form says so, and pasted posts are the main path.
- **No record of which voice wrote a post.** `LinkedInPost` has no voice version column, so "why does this sound different from last month" cannot be answered yet. It is a one-column fix once something needs to read it.
- **No per-generation opt-out.** The switch on the voice page is the only control, so a single off-voice post means switching the voice off and back on.
- **One step of undo.** Only the immediately previous extraction is kept.
- **Custom roles need a grant.** `voiceProfile` is a new resource, so no existing `OrganizationRole` row holds its permissions. Owners see it immediately; other roles need it granted in the role editor.

---

## File map

**New**

- `src/lib/types/voice-profile.ts`
- `src/lib/config/voice-profile.ts`
- `src/services/voice-profile.service.ts`
- `src/trpc/routers/voice-profile.ts`
- `src/app/(dashboard)/dashboard/voice/page.tsx`
- `src/app/(dashboard)/dashboard/voice/_components/voice-workspace.tsx`
- `src/app/(dashboard)/dashboard/voice/_components/voice-samples-form.tsx`
- `src/app/(dashboard)/dashboard/voice/_components/voice-descriptor-card.tsx`
- `src/app/(dashboard)/dashboard/voice/_components/voice-overrides-form.tsx`
- `docs/18-voice-profile.md`

**Edited**

- `prisma/schema.prisma`: `VoiceProfile`, back-relations on `User` and `Organization`
- `src/lib/resources.ts`: `voiceProfile` entry
- `src/components/global/sidebar/nav-icons.tsx`: `AudioLines`
- `src/lib/types/index.ts`, `src/lib/config/index.ts`: barrel exports
- `src/trpc/init.ts`: `assertAiConfigured`, `assertAiImageConfigured`
- `src/trpc/routers/_app.ts`: mount
- `src/trpc/routers/ai-generation.ts`, `carousel.ts`, `content-plan.ts`: shared guard + resolved voice
- `src/trpc/routers/profile-analysis.ts`, `ai-image-edit.ts`: shared guard
- `src/services/ai.service.ts`: extraction, directive, optional `voice` parameters
- `src/services/linkedin.service.ts`: optional `authorId` on `listPublishedPosts`
- `src/app/(dashboard)/dashboard/post-generation/_components/generate-form.tsx`, `post-composer.tsx`: voice line
- `docs/00-start-here.md`: index entry
