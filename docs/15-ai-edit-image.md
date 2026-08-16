# Building AI image editing — a complete walkthrough

This is the full build log for the newest feature in the composer: **the user attaches an image, types "remove the background", and the model hands back new pixels — which are staged, previewed side by side with the current image, and only replace the attachment once the user accepts.**

It is written so someone who has never touched this codebase can follow along. Every step says *what* we did and *why*. If you already know the codebase, skip to [The 10-second version](#the-10-second-version) or [How one edit flows end to end](#how-one-edit-flows-end-to-end).

This feature builds directly on two earlier ones. Read [09 — LinkedIn post generation](./09-linkedin-post-generation.md) for the registry and the AI provider layer, and [12 — Calendar and scheduled posts](./12-calendar-and-scheduled-posts.md) for ImageKit and the non-destructive image editor. This document assumes both.

---

## Table of contents

1. [The 10-second version](#the-10-second-version)
2. [Why this feature is different from every image feature before it](#why-this-feature-is-different-from-every-image-feature-before-it)
3. [Words you need to know](#words-you-need-to-know)
4. [What you need before you start](#what-you-need-before-you-start)
5. [Step 1 — The registry](#step-1--the-registry)
6. [Step 2 — Database columns](#step-2--database-columns)
7. [Step 3 — Config: teaching the provider registry about images](#step-3--config-teaching-the-provider-registry-about-images)
8. [Step 4 — Types](#step-4--types)
9. [Step 5 — Services](#step-5--services)
10. [Step 6 — The router: three network legs in one transaction](#step-6--the-router-three-network-legs-in-one-transaction)
11. [Step 7 — The UI](#step-7--the-ui)
12. [How one edit flows end to end](#how-one-edit-flows-end-to-end)
13. [The three-image model](#the-three-image-model)
14. [Testing it](#testing-it)
15. [Mistakes that are easy to make](#mistakes-that-are-easy-to-make)
16. [Known limitations](#known-limitations)
17. [What we deliberately did NOT build](#what-we-deliberately-did-not-build)
18. [File map](#file-map)

---

## The 10-second version

We added **2 new files** and edited **8 existing ones**. No new dependency — the AI SDK and the ImageKit SDK were both already here.

```
registry → database → config → types → services → router → UI
```

The single most important idea in this feature: **an AI image edit is destructive, and everything else about images in this app is not.** The transform editor changes a string. This changes bytes. That one difference explains the extra database columns, the staging step in the dialog, the Revert button, and the "first original wins" rule in the router.

---

## Why this feature is different from every image feature before it

Up to now, every image operation in this app was a **URL transform**. The image editor's crop, rotate, grayscale and sharpen all serialize into an ImageKit `tr:` string like `w-1200,h-627,cm-pad_resize`, stored in `LinkedInPost.imageTransform`. ImageKit renders it on demand from the URL. The uploaded asset is never touched, so *every edit is already reversible* — delete the string and you have your photo back.

An AI edit cannot work that way. The model returns **new bytes**, which become a **new ImageKit asset with a new fileId and a new URL**. There is no string to delete. Without deliberate design, the moment a user accepts a generation their original photo is unreachable forever.

Three design consequences follow, and they are the whole feature:

| Consequence | Where it lives |
|---|---|
| The pre-edit asset must be remembered | `originalFileId` / `originalUrl` columns, `PostImageValues.original` |
| A result must be previewed before it replaces anything | The dialog stages `result` in local state and only calls `onChange` on Accept |
| Reverting must reach the *user's real upload*, not the previous generation | `input.image.original ?? { current }` in the router — "first original wins" |

Everything else is plumbing.

---

## Words you need to know

| Term | What it actually means |
|---|---|
| **Destructive edit** | An edit that produces new bytes. The original is a separate file that must be kept deliberately. |
| **Non-destructive edit** | An edit expressed as instructions layered over an untouched file. ImageKit's `tr:` transforms. |
| **`tr:` transform** | ImageKit's URL syntax for on-the-fly rendering, e.g. `?tr=w-1200,h-627,cm-pad_resize`. |
| **fileId** | ImageKit's handle for a stored asset. Needed to delete it; a URL alone will not do. |
| **Staging** | Holding a result in component state and showing it, without committing it to the parent. |
| **Image model** | A model that outputs pixels. Distinct from a language model — Anthropic has the latter and not the former. |
| **`GeneratedFile`** | The AI SDK's return shape for `generateImage`. Carries `base64` and `mediaType`. |

---

## What you need before you start

### A paid Google AI key

This is the one hard prerequisite, and it is worth being blunt about it:

> **Image generation has no free tier at Google.** The text side of this app runs happily on Gemini's free allowance — that is why `gemini-flash-latest` is the default model. Image generation is not included in it. With a free key, every single edit fails.

Enable billing at [aistudio.google.com](https://aistudio.google.com). The feature costs roughly **$0.039 per edit**, billed the moment the call returns — whether or not the user keeps the result. That number is why the free-plan quota is 2, the tightest allowance in the app.

The router detects this specific failure and rewrites it into an actionable sentence, because Google's own message ("you have exceeded your current quota") reads as *you ran out* when the truth is *you never had any*. See [Step 6](#the-error-that-had-to-be-rewritten).

### ImageKit, already configured

From [doc 12](./12-calendar-and-scheduled-posts.md). This feature needs three keys that should already be in `.env`:

```bash
IMAGEKIT_PUBLIC_KEY="public_..."
IMAGEKIT_PRIVATE_KEY="private_..."
IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/your_id"
```

### No new npm packages

```
ai                  ^7.0.48     already here — generateImage ships in the same package
@ai-sdk/google      ^4.0.31     already here — google.image() is on the same provider
@imagekit/nodejs    ^7.10.0     already here — files.upload() was unused until now
```

Every capability this feature needs was already installed. That is not luck — it is what the provider registry from doc 09 was built for.

---

## Step 1 — The registry

**File: `src/lib/resources.ts`**

One new entry. Everything it buys is described in [doc 02](./02-the-registry.md); what matters here is *why the numbers are what they are*.

```ts
aiImageEdit: {
  name: 'AI Image Edit',
  description: 'Rewrite a post image from a text instruction',
  permissions: ['create'],
  limit: {
    perPlan: { free: 2, starter: 50, pro: 300, enterprise: 'unlimited', portal: 'unlimited' },
    upgradeMessage: 'Upgrade to {nextPlan} to edit more images with AI',
    availableOnFreeTrial: true,
    unit: 'image edits',
  },
  rateLimit: {
    create: { count: 3, window: '1 m' },
  },
},
```

### `permissions: ['create']` — and nothing else

No `delete`, and no `discard` either. This is the counter-bump rule that `profileAnalysis` and `contentPlan` both document at length:

> The auto-wiring in `protectedProcedure` decrements the usage counter on `<resource>.delete`. That is correct for a quota counting **things held** and wrong for one counting **model spend**.

Here there is not even a verb that *could* refund it. Reverting to the original does not un-spend the generation — the money left the account the moment the model answered. So the resource has exactly one verb, and there is nothing to get wrong.

### Why its own quota, and why 2 on free

It would have been easy to fold this into `aiGeneration`. That would have been wrong twice over:

- **Cost asymmetry.** A post draft is a few hundred output tokens. An image edit is ~$0.039. Sharing a counter means one image edit silently eats a handful of drafts, and the user has no way to see that.
- **The Try-again button.** The dialog deliberately keeps Generate available after a result, so "not quite" is one reworded prompt away. That makes iterating a single click — which is exactly the behaviour you want from a product and exactly the behaviour that needs a tight cap behind it.

Free gets **2**, one step tighter than `profileAnalysis`'s 3, because an image costs more than a critique.

### The rate limit is tighter than text generation

`3 / minute`, against `aiGeneration`'s 10. Each call is an image round trip *through this server* — down from ImageKit, up to the model, back down, up to ImageKit again. A burst costs bandwidth and serverless function time on top of vendor spend.

### What we did NOT add

No `nav` entry. This feature has no page of its own — it is a button inside the composer. A registry entry without `nav` is completely normal; `aiGeneration` is the same.

**Mount the router** in `src/trpc/routers/_app.ts` under the key `aiImageEdit`, matching the registry key exactly:

```ts
aiImageEdit: aiImageEditRouter,
```

---

## Step 2 — Database columns

**File: `prisma/schema.prisma`**

No new model. Two nullable columns on `LinkedInPost`:

```prisma
// The image BEFORE any AI edit, kept so an AI edit stays revertible.
//
// A `tr:` transform is non-destructive by nature — it is a string layered over
// an untouched asset. An AI edit is not: it returns NEW BYTES that become a
// new ImageKit asset, so without these columns the user's source photo would
// be unrecoverable the moment they accepted a generation.
//
// Null when no AI edit has been applied, which is every post until then. Not a
// second attachment: nothing reads these at publish time.
originalFileId String?
originalUrl    String?
```

Three things to notice:

**Two columns, not one.** The `fileId` is what ImageKit's delete API takes; the `url` is what the browser renders. A row holding only one of the two cannot be reverted to, which is why the read path treats a partial row as no original at all (see below).

**Nullable, and null for almost every row.** A `tr:` transform never populates these — it changes no bytes, so there is nothing to keep a copy of.

**Nothing reads them at publish time.** These are not a second attachment. The publish path reads `imageFileId` / `imageUrl` / `imageTransform` and ignores these entirely. They exist purely so a draft loaded back from the database still offers Revert.

### Reading and writing them

**File: `src/services/linkedin.service.ts`**

One writer, one reader, both private to the service so the immediate and scheduled paths cannot drift:

```ts
/* Flattens an ImageKit reference onto the columns. */
function imageColumns(image: PostImageValues | undefined) {
  return {
    imageFileId: image?.fileId ?? null,
    imageUrl: image?.url ?? null,
    imageTransform: image?.transform ?? null,
    /* Null unless an AI edit replaced the bytes. */
    originalFileId: image?.original?.fileId ?? null,
    originalUrl: image?.original?.url ?? null,
  }
}

/* Rebuilds the ImageKit reference from its stored columns. */
function toPostImage(post: LinkedInPost): PostImageValues | undefined {
  if (!post.imageFileId || !post.imageUrl) return undefined
  return {
    fileId: post.imageFileId,
    url: post.imageUrl,
    ...(post.imageTransform ? { transform: post.imageTransform } : {}),
    /* Both halves required: a reference with only one of the two cannot be
     * reverted to, so a partial row reads as no original at all. */
    ...(post.originalFileId && post.originalUrl
      ? { original: { fileId: post.originalFileId, url: post.originalUrl } }
      : {}),
  }
}
```

The `post.originalFileId && post.originalUrl` guard is the interesting line. A half-populated row is not a half-usable original — it is an unusable one. Treating it as absent means the Revert button simply doesn't appear, rather than appearing and then failing.

### Push it

```bash
npx prisma validate
npx prisma db push
npx prisma generate
```

> **Windows gotcha, same as doc 09:** `prisma generate` may fail with `EPERM ... query_engine-windows.dll.node`. That's the dev server holding a file lock. Stop it and re-run.

---

## Step 3 — Config: teaching the provider registry about images

**File: `src/lib/config/ai.ts`**

This is the step that shows why doc 09's provider registry was worth building. Adding a whole new *modality* touches one file.

### The model id, and why it is pinned

```ts
/* Pinned, unlike GOOGLE_MODEL_ID above: the image aliases Google ships are all
 * `-preview` today, and a preview id that shifts under us changes what users'
 * pictures come back looking like. A stable id is worth more here than the
 * freshest one — an image edit is judged by eye, not by a benchmark. */
const GOOGLE_IMAGE_MODEL_ID = 'gemini-2.5-flash-image'
```

Note the deliberate *inconsistency* with the text model, which uses the moving alias `gemini-flash-latest`. The reasoning is stated in the file: the text model was moved to an alias because the pinned id kept answering 503 on the free tier, and an alias that works beats a pin that doesn't. Images are the opposite case — nobody notices a text model shifting under them, and everybody notices their photo coming back looking different.

Two constants, two opposite decisions, both written down. That is the pattern to copy.

### The registry gains one field

```ts
export interface AiProviderDefinition {
  // ...existing
  /**
   * Image model for edit-an-image-from-a-prompt, or `null` when this vendor has
   * none. NOT every provider does — Anthropic generates no images — and a null
   * here is what hides the AI-edit control on such a deployment instead of
   * offering a button that always errors.
   */
  readonly createImageModel: (() => ImageModel) | null
}
```

And the two entries:

```ts
google: {
  // ...
  createImageModel: () => google.image(GOOGLE_IMAGE_MODEL_ID),
},
anthropic: {
  // ...
  /* Claude produces text, never images. Null rather than a throwing stub so
   * the capability is answerable BEFORE a call is made — that is what lets the
   * UI hide the control instead of surfacing a vendor error on click. */
  createImageModel: null,
},
```

**`null` rather than a stub that throws** is the whole design. A throwing stub answers the question "can this deployment edit images?" only by *trying*, which means spending a click, a round trip, and possibly a quota unit to find out. A null answers it synchronously, at render time, and the button never appears.

### Two accessors, and why there are two conditions

```ts
export function isAiImageConfigured(): boolean {
  const provider = getAiProvider()
  return Boolean(provider.createImageModel && process.env[provider.apiKeyEnvVar])
}
```

> **TWO conditions, not one.** A configured key is not enough — Anthropic has a key and no image model — so this is the only honest answer to "can this deployment do an AI image edit".

And the getter, which exists to name *which* of the two failed:

```ts
export function getAiImageModel(): ImageModel {
  const provider = getAiProvider()
  if (!provider.createImageModel) {
    throw new Error(
      `[ai] ${provider.label} has no image model. Set AI_PROVIDER to a vendor that supports image generation to enable AI image edits.`,
    )
  }
  if (!process.env[provider.apiKeyEnvVar]) {
    throw new Error(
      `[ai] ${provider.apiKeyEnvVar} is not set. AI image editing is unavailable until it is configured. Get a key at ${provider.consoleUrl}.`,
    )
  }
  return provider.createImageModel()
}
```

The two branches exist because **the fixes are completely different**: one is an `AI_PROVIDER` change, the other is an env var. A single combined message would send half the operators down the wrong path.

---

## Step 4 — Types

**File: `src/lib/types/ai.ts`**

The input contract:

```ts
export const AI_IMAGE_PROMPT_MAX = 500

export const aiImageEditSchema = z.object({
  image: postImageSchema,
  prompt: z.string().trim()
    .min(3, 'Describe the change you want')
    .max(AI_IMAGE_PROMPT_MAX, `Keep the instruction under ${AI_IMAGE_PROMPT_MAX} characters`),
})
export type AiImageEditValues = z.infer<typeof aiImageEditSchema>
```

Two decisions recorded in the file's comment:

> The image rides as a **REFERENCE, never as bytes**: the server already knows how to fetch from ImageKit, and putting bytes in the tRPC payload is the exact mistake the direct-upload path was built to undo.

> The prompt is bounded and trimmed like every other model input here — **an unbounded string is spend, not a description.**

**File: `src/lib/types/imagekit.ts`**

`PostImageValues` gains one optional key, and a small schema of its own:

```ts
/* The pre-AI-edit asset. Same shape as the attachment minus the transform,
 * because a transform belongs to the CURRENT framing decision, not to the
 * source — reverting restores the bytes and lets the framing be re-chosen. */
export const originalImageSchema = z.object({
  fileId: z.string().min(1),
  url: z.url(),
})

export const postImageSchema = z.object({
  fileId: z.string().min(1),
  url: z.url(),
  transform: imageTransformSchema.optional(),
  /* Present ONLY after an AI edit, pointing at what was replaced. A `tr:`
   * transform never sets this: it changes no bytes, so there is nothing to
   * keep a copy of. */
  original: originalImageSchema.optional(),
})
```

**Why `original` carries no `transform`.** A crop is a decision about *the current image*. If you revert to your source photo, the crop you chose for the AI version is not obviously the crop you want for the source — so reverting restores the bytes and hands the framing decision back to the user rather than reinstating a stale one.

Because `original` is part of `postImageSchema`, and `postImageSchema` is already inside `publishPostSchema`, **the whole publish path type-checks the new field with no changes at all.** That is the payoff of having one shared image type.

---

## Step 5 — Services

Two services touched. Both start with `import 'server-only'`.

### `src/services/ai.service.ts` — the model call

A local timeout first, and it is longer than everything else in the file:

```ts
/* Longer than AI_TIMEOUT_MS because an image round trip is slower than post
 * copy, and expressed as an abort signal rather than a `timeout` option:
 * generateImage takes no timeout, unlike generateText. The caller's txTimeout
 * must exceed this. */
const AI_IMAGE_TIMEOUT_MS = 90_000
```

That parenthetical is a real API asymmetry in the AI SDK worth knowing: `generateText` accepts `timeout`, `generateImage` does not. You get the same effect with `abortSignal: AbortSignal.timeout(...)`.

The function:

```ts
export interface EditedImage {
  /** Base64 payload, ready to hand to ImageKit without re-encoding. */
  base64: string
  mediaType: string
}

export async function editImage(
  source: LinkedInImageBinary,
  instruction: string,
): Promise<EditedImage> {
  const { image, warnings } = await generateImage({
    model: getAiImageModel(),
    /* The object form is what makes this an EDIT — a bare string prompt would
     * generate an unrelated picture from the words alone. */
    prompt: {
      images: [new Uint8Array(source.bytes)],
      text: instruction,
    },
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(AI_IMAGE_TIMEOUT_MS),
  })

  /* Surfaced rather than swallowed: a provider that silently ignored the source
   * image would return a plausible-looking picture that is not an edit at all,
   * and the user would only notice by eye. */
  if (warnings.length > 0) {
    console.warn('[ai] image edit returned warnings', { warnings })
  }

  return { base64: image.base64, mediaType: image.mediaType }
}
```

Four things here are load-bearing:

**1. The object-form prompt is the entire difference between editing and generating.**

```ts
prompt: 'make the lighting warmer'                    // generates a NEW picture
prompt: { images: [bytes], text: 'make it warmer' }   // EDITS the one you gave it
```

Get this wrong and the feature still "works" — it returns an image every time — but that image has nothing to do with the user's photo. This is the single easiest mistake to make in the whole feature, and the hardest to spot in code review, because both forms compile.

**2. `maxRetries: 0`** — zero, where every text call in this file retries once.

> The dominant failure here is a quota refusal, and **quota does not clear between attempts**. The retry only makes the user wait through a second doomed round trip — the vendor's own "retry in 24s" hint is what the SDK sleeps for — while the caller's transaction stays open.

Retrying is the right default for a transient 503. It is the wrong default for a billing error.

**3. Warnings are logged, not swallowed.** The failure mode being guarded is nasty: a provider that ignores the source image returns a *plausible* picture. Nothing errors, nothing validates as wrong, and only a human comparing the before and after would notice. A warning in the logs is the only signal that exists.

**4. It returns BYTES, not a stored file.**

> Returns bytes rather than uploading them, so this file keeps its single responsibility — talking to models — and the caller decides where the result is stored.

`ai.service.ts` is the only file in the app that talks to a model provider. Letting it also talk to ImageKit would be the first crack in that.

### `src/services/imagekit.service.ts` — the upload back

One new function, and it is a genuine exception to a rule this app otherwise holds firmly:

```ts
export async function uploadImageBytes(
  base64: string,
  fileName: string,
): Promise<PostImageValues> {
  const response = await getImageKitClient().files.upload({
    file: base64,
    fileName,
    folder: IMAGEKIT_POST_FOLDER,
    /* Never overwrite an existing asset. A collision here would silently
     * rewrite an image another post is using. */
    useUniqueFileName: true,
  })

  /* Parsed, not cast — the same vendor boundary the browser upload validates. */
  const parsed = imageKitUploadResponseSchema.parse(response)
  return { fileId: parsed.fileId, url: parsed.url }
}
```

> Every other upload in this app goes browser→ImageKit directly, which is why this did not exist until now. An AI-generated image **has no browser to come from**: the bytes are produced by a model call on this server, so this is the one upload that legitimately originates here.

**Why base64 and not a Buffer.** That is what the AI SDK's `GeneratedFile` hands back. Converting it to a buffer only to have the ImageKit SDK re-encode it would be work for nothing.

**Why the same folder as browser uploads.** Post media stays lifecycled as one set regardless of how it got there — so a future cleanup job needs to know about one folder, not two.

**Why the response is parsed.** Same vendor-boundary rule the browser upload follows. A changed API shape fails here with a clear message instead of becoming an `undefined` that surfaces three layers later.

---

## Step 6 — The router: three network legs in one transaction

**File: `src/trpc/routers/ai-image-edit.ts`**

This is the shortest file in the feature and the one with the most decisions in it.

### The transaction budget

```ts
create: protectedProcedure({
  requirePermission: permissions.AI_IMAGE_EDIT_CREATE,
  /* Three network legs inside the factory's mutation tx — fetch from ImageKit,
   * the model call, then the upload back. Sized above ai.service's own 90s
   * image timeout so the vendor call fails on its own terms with a legible
   * message, rather than the tx expiring underneath it and the usage bump
   * then failing on a closed transaction. */
  txTimeout: 120_000,
})
```

The relationship `txTimeout (120s) > AI_IMAGE_TIMEOUT_MS (90s)` is deliberate and must be preserved. Invert it and the user waits two minutes to receive a Prisma transaction error that says nothing about images.

Worth internalising: **this handler holds a Postgres connection for up to two minutes.** That is the cost of running a model call inside the factory's transaction, and it is why the rate limit is 3/min.

### Fail before spending

```ts
if (!isAiImageConfigured()) {
  const provider = getAiProvider()
  throw new TRPCError({
    code: 'PRECONDITION_FAILED',
    message: provider.createImageModel
      ? `AI image editing is not configured. Add ${provider.apiKeyEnvVar} to enable it.`
      : `${provider.label} cannot generate images. Set AI_PROVIDER to a vendor that supports them.`,
  })
}
```

The guard runs before any work, so an operator's misconfiguration never costs the user a quota unit. The ternary is the same two-causes distinction from `getAiImageModel`, surfaced at the API boundary this time.

### The three legs

```ts
/* The CURRENT pixels, not the raw upload: the user is editing what they can
 * see, so the model must receive the framing they already chose. Feeding it
 * the untransformed original would silently discard their crop and hand back
 * an image framed differently from the preview. */
const source = await imagekitService.fetchImageBinary(
  imagekitService.buildTransformedUrl(
    input.image.url,
    input.image.transform ?? LINKEDIN_IMAGE_TRANSFORM,
  ),
)

const edited = await aiService.editImage(source, input.prompt)

const uploaded = await imagekitService.uploadImageBytes(edited.base64, 'ai-edit.png')
```

**Leg 1 is the subtle one.** `input.image.url` is the raw ImageKit asset. `buildTransformedUrl(url, transform)` is the *rendered* version — the one the composer preview shows and the one the publish path sends to LinkedIn. Sending the raw asset to the model would mean the user crops to square, asks for a warmer light, and gets back a landscape image. The `?? LINKEDIN_IMAGE_TRANSFORM` fallback covers an image that has never been through the transform editor, and matches what the preview does for the same case.

### The return value, and the two rules encoded in it

```ts
return {
  ...uploaded,
  /* The FIRST original wins. Chaining edits must keep pointing at the user's
   * real upload — carrying the previous AI result forward instead would make
   * Revert undo one step and strand the true source, which is the one thing
   * these columns exist to protect. */
  original: input.image.original ?? {
    fileId: input.image.fileId,
    url: input.image.url,
  },
  /* Transform deliberately dropped: the model returned pixels that already
   * have the requested framing baked in, so re-applying the old crop on top
   * would frame an already-framed image a second time. */
}
```

**Rule 1 — first original wins.** Trace three chained edits:

| Edit | `image.original` coming in | `original` going out |
|---|---|---|
| 1st | `undefined` | the user's upload `A` |
| 2nd | `A` | `A` |
| 3rd | `A` | `A` |

The `??` is what makes rows 2 and 3 keep pointing at `A`. Write `original: { fileId: input.image.fileId, ... }` unconditionally and Revert becomes an undo-one-step button — after three edits it returns you to generation #2, and the user's actual photo is unreachable. Nothing would error. The columns would be populated. The feature would simply not do the one thing it exists to do.

**Rule 2 — the transform is dropped.** The returned object has no `transform` key, so the new attachment starts clean. The model was handed already-framed pixels and returned already-framed pixels; re-applying `w-1200,h-627,cm-pad_resize` on top would pad an image that is already padded. The user can of course open the transform editor again and re-crop the result.

### The error that had to be rewritten

```ts
} catch (error) {
  const raw = error instanceof Error ? error.message : 'The image edit failed. Please try again.'

  /* Quota is the ONE failure worth rewriting, because the vendor's own message
   * is actively misleading here: it reads as "you ran out" when the free-tier
   * limit for image generation is zero — the feature has never been available
   * without billing. Left as a substring match rather than an error-code check
   * because the SDK wraps the provider error and the code does not survive the
   * round trip. */
  const isQuota = /quota|exceeded your current quota|rate.?limit/i.test(raw)

  throw new TRPCError({
    code: isQuota ? 'TOO_MANY_REQUESTS' : 'INTERNAL_SERVER_ERROR',
    message: isQuota
      ? 'AI image editing needs a paid Google AI plan — image generation is not available on Gemini\'s free tier. Enable billing at aistudio.google.com, then try again.'
      : raw,
  })
}
```

Two things are being admitted honestly here.

**String-matching an error message is normally a bug.** [Doc 12](./12-calendar-and-scheduled-posts.md) says so explicitly about the worker's terminal-failure detection: *"Message matching breaks the first time a vendor rewords an error."* This file does it anyway, and says why: the SDK wraps the provider error and the structured code does not survive the round trip, so there is nothing else to branch on. Note the containment — **one** failure mode is matched, everything else passes through untouched.

**Every other error passes through verbatim.** `message: raw`. No generic "something went wrong". If the model refuses a prompt, the user sees why.

---

## Step 7 — The UI

### The global component

**File: `src/components/global/ai-image-edit/ai-image-edit.tsx`** (+ an `index.ts` barrel, matching its `image-upload` and `image-editor` siblings)

Global rather than route-local, and generic in the same way its siblings are:

```ts
export interface AiImageEditProps {
  value: PostImageValues
  onChange: (value: PostImageValues) => void
  /** Runs the edit. Returns the new reference, carrying `original` along. */
  onGenerate: (prompt: string) => Promise<PostImageValues>
  disabled?: boolean
  className?: string
  label?: string
}
```

**It takes `onGenerate` rather than calling tRPC itself.** So the component knows nothing about LinkedIn, posts, routers, or organizations. Drop it into a future avatar editor and it works unchanged. The composer supplies the mutation.

#### Staging — the part that makes it non-destructive from the user's side

```tsx
/* Staged, not applied: a result the user rejects must leave the attachment
 * exactly as it was. */
const [result, setResult] = React.useState<PostImageValues | null>(null)

async function handleGenerate({ prompt }: PromptValues) {
  setIsGenerating(true)
  try {
    setResult(await onGenerate(prompt))
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Could not edit the image.')
  } finally {
    setIsGenerating(false)
  }
}

function handleAccept() {
  if (!result) return
  onChange(result)      // ← the ONLY call that touches the parent
  setOpen(false)
}
```

`onChange` is called in exactly two places: `handleAccept` and `handleRevert`. A generation the user doesn't want never reaches the composer.

#### Revert drops `original` with it

```tsx
function handleRevert() {
  if (!value.original) return
  /* Drops `original` with it: once reverted there is nothing left to revert
   * TO, and keeping the key would offer the button forever. */
  onChange({ fileId: value.original.fileId, url: value.original.url })
  setOpen(false)
}
```

Note also that the returned object has no `transform` — reverting restores the bytes and hands the framing decision back, per the type's own comment.

#### Clearing on close, and why it is not an effect

```tsx
/* Cleared on CLOSE so reopening starts fresh rather than showing a stale
 * result against an image that may since have been replaced. Done in the
 * handler rather than an effect: closing is an event, and clearing state from
 * an effect body triggers the cascading render the lint rule guards against. */
function handleOpenChange(next: boolean) {
  setOpen(next)
  if (!next) {
    setResult(null)
    form.reset({ prompt: '' })
  }
}
```

This is the React-compiler-era version of the rule [doc 11](./11-personalized-content-plan.md) documents: **state changes belong in event handlers, not effect bodies.**

#### Both previews go through the same function

```tsx
/* The pixels as delivered, so before/after are compared on equal terms rather
 * than one showing the raw upload and the other the framed result. */
function previewUrl(image: PostImageValues): string {
  return buildTransformedUrl(image.url, image.transform ?? LINKEDIN_IMAGE_TRANSFORM)
}
```

Used for **both** the Current and Result panes. A before/after where one side is raw and the other is framed is a comparison that lies.

#### Form validation reuses exactly the field it owns

```tsx
/* Only the prompt is typed here — the image half of the contract is supplied by
 * the caller, so the form resolves against exactly the field it owns. */
const promptSchema = aiImageEditSchema.pick({ prompt: true })
```

`.pick()` rather than a second schema. The 500-char bound and both error messages come from the same declaration the router validates against, so they cannot drift.

#### The four buttons

| Button | Variant | Shown when | Notes |
|---|---|---|---|
| Revert to original | `ghost` | `value.original` exists | Available even before generating — a previously accepted edit is still revertible |
| Cancel | `outline` | always | |
| Generate / **Try again** | `outline` | always | *Submit stays available after a result, so "not quite" is one reworded prompt away rather than a close-and-reopen* |
| Use this image | `brand` | always, disabled until `result` | The only path to `onChange` |

And the trigger button:

```tsx
{/* The one filled button in the row, and the only orange one: AI editing is
    the differentiating action here, so it breaks away from the channel blue
    that the mechanical actions (replace / crop) share. */}
<Button variant="ai" size="sm" ...>
```

`variant="ai"` reads from theme tokens (`bg-ai`, `text-ai-foreground`, `bg-ai-hover`) — no hex, per the project's theming rule.

### Composer wiring

**File: `src/app/(dashboard)/dashboard/post-generation/_components/post-composer.tsx`**

```tsx
const editImage = trpc.aiImageEdit.create.useMutation()

/* Passed to the dialog rather than the dialog calling tRPC itself, so that
 * component stays as generic as its image-upload sibling. Usage is
 * invalidated because an edit spends a metered generation. */
async function generateImageEdit(prompt: string): Promise<PostImageValues> {
  if (!image) throw new Error('Attach an image first.')
  const edited = await editImage.mutateAsync({ organizationId: orgId, image, prompt })
  await utils.usage.invalidate()
  return edited
}
```

`mutateAsync`, not `mutate`, because the dialog needs the resolved value to stage it. The `usage.invalidate()` makes the meter elsewhere on the page tick down immediately.

And the render, inside the preview's `actions` slot:

```tsx
{image && aiImageEditsEnabled ? (
  <AiImageEdit
    value={image}
    onChange={setImage}
    onGenerate={generateImageEdit}
    disabled={publish.isPending || !enabled}
  />
) : null}
```

**Two conditions.** `image` because an editor over nothing has no subject. `aiImageEditsEnabled` because not every deployment can do this at all.

### The flag has to be read in a server component

**File: `src/app/(dashboard)/dashboard/post-generation/page.tsx`**

```tsx
export default async function PostGenerationPage({ searchParams }) {
  // ...
  return (
    <PostComposer
      imageUploadsEnabled={isImageKitConfigured()}
      aiImageEditsEnabled={isAiImageConfigured()}
      schedulingEnabled={isSchedulerConfigured()}
      {...(initial ? { initialScheduledFor: initial } : {})}
    />
  )
}
```

The page's own comment says why:

> Reads the config **HERE** and passes it down, because those checks read server-only env vars and would silently evaluate to **false** inside the client composer — hiding both features on a correctly configured install.

This is a genuinely easy bug to ship: `process.env.GOOGLE_GENERATIVE_AI_API_KEY` in a client component is not an error, it is `undefined`. The feature just quietly never appears, on every install, and nothing in the logs mentions it.

---

## How one edit flows end to end

**User has a photo attached, clicks "Edit with AI", types "remove the background", clicks Generate:**

```
1.  ai-image-edit.tsx
    form.handleSubmit(handleGenerate)  →  onGenerate('remove the background')

2.  post-composer.tsx
    editImage.mutateAsync({ organizationId, image, prompt })

3.  tRPC ships it to the server, typed end to end

4.  protectedProcedure wrapper          ← ALL OF THIS IS AUTOMATIC
    ├─ Logged in?                                  → 401
    ├─ Belongs to this organization?               → 403
    ├─ Has aiImageEdit:create?                     → 403
    ├─ Rate limit: 3 per minute?                   → 429
    ├─ Plan limit: under the image-edit quota?     → 402 + upgrade message
    └─ Open a database transaction (txTimeout 120s)

5.  ai-image-edit.ts create handler     ← THE ONLY CODE WE WROTE
    ├─ isAiImageConfigured()?           → 412 before anything is spent
    ├─ buildTransformedUrl(url, transform ?? LINKEDIN_IMAGE_TRANSFORM)
    ├─ fetchImageBinary(...)            → LEG 1: current pixels, down from ImageKit
    ├─ aiService.editImage(...)         → LEG 2: the model call (≤90s, 0 retries)
    ├─ uploadImageBytes(base64)         → LEG 3: new asset, up to ImageKit
    └─ return { fileId, url, original: image.original ?? {current} }

6.  protectedProcedure wrapper again    ← AUTOMATIC
    ├─ Increment the aiImageEdit usage counter
    └─ Commit the transaction

7.  post-composer.tsx
    utils.usage.invalidate()  →  the meter updates

8.  ai-image-edit.tsx
    setResult(edited)         →  the Result pane renders it
                                 NOTHING has changed in the composer yet

9.  User clicks "Use this image"
    handleAccept()  →  onChange(result)  →  setImage(result)

10. The composer preview now renders the new asset, and
    "Revert to original" is offered from here on

11. User clicks "Post to LinkedIn"
    publish.mutate({ ..., image })
      →  imageColumns(image) writes originalFileId / originalUrl alongside
         imageFileId / imageUrl
```

**Steps 4 and 6 are entirely free.** They exist because of the `aiImageEdit` entry in the registry. Roughly 150 lines of security and billing logic we didn't write and can't forget.

**Between step 8 and step 9 nothing is committed.** If the user closes the dialog there, the composer is byte-for-byte where it was — although the generated asset does now exist in ImageKit and the quota unit is spent. See [Known limitations](#known-limitations).

---

## The three-image model

The clearest way to hold this feature in your head is that after an AI edit there are **three** images in play, and each one answers a different question:

| Image | Where it lives | Question it answers |
|---|---|---|
| **The original** | `original.fileId` / `original.url` → `originalFileId` / `originalUrl` | "Undo everything" |
| **The current asset** | `fileId` / `url` → `imageFileId` / `imageUrl` | "What bytes are we publishing" |
| **The rendered delivery** | `buildTransformedUrl(url, transform)` — computed, never stored | "What does the reader actually see" |

Every bug in this feature is a confusion between two of these three:

- Sending **the current asset** to the model where **the rendered delivery** was meant → the user's crop is silently discarded.
- Setting **the current asset** as **the original** on a chained edit → Revert undoes one step instead of all of them.
- Keeping the **transform** on the result → an already-framed image is framed a second time.
- Showing **the current asset** in one preview pane and **the rendered delivery** in the other → a before/after that lies.

All four are in the code as comments, right where each decision is made. That is not decoration — it is what makes the next agent to touch this file not re-introduce them.

---

## Testing it

Run these in order. If one fails, stop and fix it before moving on.

```bash
npx tsc --noEmit     # types. must print nothing
npm run lint         # style + project rules. must print nothing
npm run build        # the real test — catches server/client boundary violations
npm run dev
```

`npm run build` matters most here: `imagekit.service.ts` and `ai.service.ts` are both `server-only`, and only the build catches one of them being pulled into the client bundle.

Then, in the browser:

| # | Do this | Expect |
|---|---|---|
| 1 | Open `/dashboard/post-generation` with `AI_PROVIDER=anthropic` | **No** "Edit with AI" button, even with a valid Anthropic key |
| 2 | Set `AI_PROVIDER=google` with a paid key, restart, reload | The orange "Edit with AI" button appears once an image is attached |
| 3 | Attach an image, open the transform editor, crop to Square, save | Composer preview shows a square image |
| 4 | Open "Edit with AI" | The **Current** pane shows the *square* crop, not the original landscape upload |
| 5 | Type "make the lighting warmer", Generate | Spinner, then the Result pane fills. **The composer behind the dialog is unchanged** |
| 6 | Close the dialog with Cancel | Attachment is exactly as it was |
| 7 | Reopen, generate again, click "Use this image" | Composer preview updates to the new image |
| 8 | Reopen the dialog | "Revert to original" is now offered |
| 9 | Generate again, accept — then Revert | You land on your **original upload**, not on the previous generation. **This is the check that proves the `??`** |
| 10 | Publish the post | Opens on LinkedIn with the edited image |

### The checks that prove the wiring

```sql
SELECT "imageFileId", "imageUrl", "originalFileId", "originalUrl", "imageTransform"
FROM linkedin_post ORDER BY "createdAt" DESC LIMIT 1;

SELECT * FROM usage_metrics WHERE "organizationId" = '<your org id>';
```

- After an accepted AI edit, all four image columns are populated and `imageFileId ≠ originalFileId`.
- After a transform-only edit, `originalFileId` is **NULL** and `imageTransform` is set. A transform must never populate the original columns.
- `aiImageEdit` counter equals the number of **generations**, not the number of accepts. Generate three times and accept one — the counter reads 3. That is correct: you paid for three.

### And the quota

Set your plan to `free` and generate three times. The third is blocked with *"Upgrade to Starter to edit more images with AI"* — the exact `upgradeMessage` from the registry. Note the block happens on **Generate**, not on Accept.

### Testing the misconfiguration paths

| Setup | Expect |
|---|---|
| `AI_PROVIDER=anthropic` + valid key | Button absent. If you force the mutation: *"Anthropic Claude cannot generate images…"* |
| `AI_PROVIDER=google`, key unset | Button absent. Forced: *"Add GOOGLE_GENERATIVE_AI_API_KEY to enable it."* |
| `AI_PROVIDER=google`, **free** key | Button present, generation fails with the paid-plan message — not Google's misleading "exceeded your quota" |

That third row is the one worth checking by hand, because it is what every developer following this doc will hit first.

---

## Mistakes that are easy to make

| Mistake | What happens | Fix |
|---|---|---|
| `prompt: 'make it warmer'` instead of `prompt: { images, text }` | An unrelated picture comes back every time. **Compiles fine, looks like it works** | The object form is what makes it an edit |
| Sending `input.image.url` to the model | The user's crop is silently discarded; the result is framed differently from the preview | Send `buildTransformedUrl(url, transform ?? LINKEDIN_IMAGE_TRANSFORM)` |
| `original: { fileId: input.image.fileId }` without the `??` | Revert becomes undo-one-step; the true source is unreachable after two edits | `input.image.original ?? { current }` |
| Keeping `transform` on the returned image | An already-framed image is framed again — padding inside padding | Drop it; the model baked the framing in |
| `txTimeout` below `AI_IMAGE_TIMEOUT_MS` | The tx dies underneath a live vendor call; the usage bump then fails on a closed tx | 120s > 90s. Preserve the ordering |
| Leaving `maxRetries` at the default | A quota refusal is retried after the vendor's own ~24s backoff, doubling the wait for a guaranteed failure | `maxRetries: 0` |
| Reading `isAiImageConfigured()` in the client composer | Always false. The button never appears, on every install, with no error | Read it in `page.tsx` and pass it down |
| Returning the Prisma row's `originalFileId` without `originalUrl` | Revert offered but unusable | Both halves or neither, per `toPostImage` |
| Adding a `delete` verb to `aiImageEdit` | edit → delete → edit becomes an unlimited free tier | The resource has exactly one verb |
| Calling `onChange` when the result arrives | A generation the user hasn't accepted replaces their photo | Stage it; `onChange` only from Accept and Revert |
| `useUniqueFileName: false` on the upload | A name collision silently rewrites an image another post is using | Leave it true |

---

## Known limitations

Being honest about what this feature does not handle:

**Rejected generations orphan an ImageKit asset.** The upload to ImageKit happens in the router, *before* the result is staged in the dialog. If the user hits Cancel, the asset stays in ImageKit with nothing referencing it. Same for every intermediate step of a chained edit. This is a deliberate trade — the alternative is returning raw base64 through the tRPC payload, which is exactly the transport problem the direct-upload path was built to eliminate. The cost is a few kilobytes per rejected generation. A cleanup job over `IMAGEKIT_POST_FOLDER` comparing against `linkedin_post` rows is the eventual fix; `deleteImage` already exists and is used by the scheduled-post cancel path.

**Revert is one level deep.** `original` always points at the user's real upload, which is the right behaviour, but there is no history of intermediate generations. Accept three edits and you can go back to the source or stay where you are — nothing in between.

**Revert is only available while composing.** Once published, the post is on LinkedIn. The columns survive, so a future drafts feature could re-offer it, but nothing reads them today.

**The prompt is not validated for content.** The vendor's own safety layer is the only filter. Unlike `generateText`, which converts a `content-filter` finish reason into a specific message, a refused image edit falls through the generic `message: raw` path and shows the provider's wording.

---

## What we deliberately did NOT build

| Not built | Why | When |
|---|---|---|
| **Image generation from scratch** | The composer's job is to post about your work, not to invent stock photography. The object-form prompt is what constrains this to *editing what is already there* | Probably never |
| **Multiple result candidates** | `generateImage` supports `n`. Each candidate is another ~$0.039 against a free quota of 2 | If the quota model changes |
| **Editing images on already-published posts** | The post is on LinkedIn; changing our copy would make the record disagree with reality | With drafts |
| **A generation history / gallery** | Needs a table, a storage policy, and a cleanup story for assets nobody kept | Later |
| **Retrying on failure** | Deliberate: the dominant failure is quota, which does not clear on retry | Never |
| **A second image vendor** | `createImageModel` is already on `AiProviderDefinition`, so adding OpenAI is one entry — the socket exists | When a vendor is worth adding |

---

## File map

**New files (2):**

```
src/trpc/routers/ai-image-edit.ts                       The endpoint: fetch → model → upload
src/components/global/ai-image-edit/ai-image-edit.tsx   The dialog
src/components/global/ai-image-edit/index.ts            Barrel
```

**Edited files (8):**

```
src/lib/resources.ts                        + aiImageEdit resource (quota, rate limit, permission)
prisma/schema.prisma                        + LinkedInPost.originalFileId / originalUrl
src/lib/config/ai.ts                        + GOOGLE_IMAGE_MODEL_ID, createImageModel on both
                                              providers, isAiImageConfigured, getAiImageModel
src/lib/types/ai.ts                         + AI_IMAGE_PROMPT_MAX, aiImageEditSchema
src/lib/types/imagekit.ts                   + originalImageSchema, postImageSchema.original
src/services/ai.service.ts                  + AI_IMAGE_TIMEOUT_MS, EditedImage, editImage
src/services/imagekit.service.ts            + uploadImageBytes
src/services/linkedin.service.ts            imageColumns / toPostImage handle the original
src/trpc/routers/_app.ts                    + aiImageEdit mounted
.../post-generation/page.tsx                + aiImageEditsEnabled from isAiImageConfigured()
.../post-generation/_components/post-composer.tsx
                                            + editImage mutation, generateImageEdit, <AiImageEdit>
```

---

## The one thing to remember

> **An AI edit replaces bytes; every other image edit in this app replaces a string. Keep the first original, stage the result before it lands, and always hand the model the pixels the user can actually see.**

Those three sentences are the feature. The registry entry, the two columns, the `??`, and the staged `result` state are just where each one is enforced.
