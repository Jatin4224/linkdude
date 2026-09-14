# Building the job email writer — a complete walkthrough

This is the build log for **Job Assist: a member saves their details once, pastes a hiring post, and gets a short email with a match check, a real sign-off and a LinkedIn message, in their own voice, ready to open in Gmail.**

Read [07 — Adding a feature](./07-adding-a-feature.md) and [18 — Voice profile](./18-voice-profile.md) first. This feature reuses both.

---

## The 10-second version

```
schema → registry → types/config → services → ai.service → routers → UI
```

- **Three resource keys:**
  - `jobEmails`, metered per email (free 5 / starter 100 / pro 500)
  - `jobEmailRewrites`, metered per rewrite on its own allowance (free 20 / starter 500 / pro 2,000)
  - `candidateProfile`, permissions only, no quota
- **One table**, `candidate_profile`: the member's saved "About me" details. Drafts are still never stored.
- **No new API key or dependency.**
- **No Google approval.** Sending happens in the member's own mail client through a compose link.
- **One lifted component:** the "Drafts are written in your voice" line is global.

---

## Why it's shaped this way

The problem: a member sees a hiring post, opens Gmail, opens ChatGPT, and writes an email by hand.

- **Paste, not scrape.** LinkedIn gives apps no way to read posts, and job links are often behind a login. Pasting always works.
- **Facts from the member, never from the model.** An invented skill or metric that a recruiter checks costs the member the job. The prompt uses only the saved details and the job notes; anything missing becomes a marked `[placeholder]`.
- **The sign-off is built by the app, not the model.** Links and the phone number never reach the model, so they can never be misquoted.
- **Compose links, not sending from the app.** Sending through the Gmail API requires Google's app verification and may require a paid security assessment every year. A compose link needs none of that, and the email still comes from the member's real address. One-click send (for example through Corsair) can replace the buttons later without changing anything else.
- **Rewrites have their own allowance** so polishing a draft never uses up the email allowance.

---

## Step 1 — The schema

`CandidateProfile` in `prisma/schema.prisma`:

- **Keyed by `(organizationId, authorId)`**, like `VoiceProfile`. These are one person's facts; a shared row would put a teammate's experience into someone else's email.
- **`details Json`**, validated through `candidateProfileSchema` on every read. The field set will grow with resume tailoring, and the model reads every field as one block.
- **Back-relations** on `User` and `Organization`.

Run `npx prisma db push` after pulling. If your dev database still has the old lead tables from the rejected `feature/leads` branch, the push offers to drop them. That is expected.

---

## Step 2 — The registry

`src/lib/resources.ts`:

| Key | Permissions | Quota | Notes |
|---|---|---|---|
| `jobEmails` | `create` | 5 / 100 / 500 | Nav under **Create** as "Job Assist" at `/dashboard/jobs` |
| `jobEmailRewrites` | `create` | 20 / 500 / 2,000 | Audit line records which rewrite: `{input.instruction}` |
| `candidateProfile` | `read`, `update` | none | Saving details buys nothing |

`jobEmails` and `jobEmailRewrites` have only `create`, because drafts are not stored. The counter measures model spend.

**Custom roles:** both new keys need an explicit grant in the role editor. Owners have them already.

---

## Step 3 — Types and config

`src/lib/types/job-email.ts`:

| Schema | What it is |
|---|---|
| `candidateProfileSchema` | Saved details. Writing fields: name, headline, skills, experience, education, location, availability. Contact fields: LinkedIn, portfolio, GitHub (http/https only), phone, `includePhone` |
| `generateJobEmailSchema` | The request: `jobPost`, optional `company` and `role`, `highlights` (notes for this job), optional `recipientEmail` |
| `generatedJobEmailSchema` | The model's output: `company`, `role`, `contactName`, `recipientEmail`, `matchedRequirements`, `missingRequirements`, `subject`, `body`, `linkedinMessage` |
| `jobEmailDraftSchema` | The editable draft, including `signature`, validated again because the member edits it |
| `rewriteJobEmailDraftSchema` / `rewriteJobEmailSchema` | A rewrite: the instruction and current draft, plus the post and notes it was written for |

Every optional text field is an empty string, never `undefined`.

`src/lib/config/job-email.ts`:

- `buildJobEmailSignature(profile, fallbackName)`: a closing, the name, the phone only when `includePhone` is on, then the links.
- `composeEmailBody(body, signature)`: the text that is actually sent.
- `buildGmailComposeUrl` and `buildMailtoUrl`, both using `encodeURIComponent` and CRLF for mailto.
- `JOB_PLACEHOLDER_PATTERN` and `JOB_EMAIL_REWRITE_LABELS`.

---

## Step 4 — The services

- `src/services/candidate-profile.service.ts` provides `readCandidateProfile` and `saveCandidateProfile`. A stored shape that no longer parses reads as `null`, so an email is still written (with placeholders) instead of failing.
- In `src/services/ai.service.ts`, `JOB_EMAIL_WRITING_RULES` is shared by both system prompts, so a rewrite follows the same rules as the first draft:
  - 80–150 words
  - "Hi Priya," when the post names the person hiring, otherwise "Hello,"
  - the first sentence names the role, never "I hope this email finds you well"
  - only the given facts, with placeholders for anything missing
  - one low-effort ask
  - **no closing or signature**, because the app adds it
  - a LinkedIn message under 300 characters
- `generateJobEmail(input, profile, candidateName, voice)` also returns the match check. It is the same call, so it costs nothing extra. A requirement is marked matched only when the facts mention it.
- `rewriteJobEmail(input, profile, voice)` applies one directive: shorter (50–90 words), more formal, a different angle, or a new subject.
- `serializeCandidateProfile` sends the model the writing fields only.

---

## Step 5 — The routers

| Router | Procedure | What it does |
|---|---|---|
| `jobEmails` | `create` | Checks AI is configured, reads the voice and saved profile on the server, writes the email, keeps a model-read address only if it is real (a typed one always wins), and adds the sign-off |
| `jobEmailRewrites` | `create` | Same reads, then merges: **New subject** changes only the subject; every other rewrite keeps the member's subject. The sign-off is never sent |
| `candidateProfile` | `get`, `update` | `get` also returns the account name, which pre-fills the name on a first visit |

Nothing is ever taken from the input that the server can read itself. A failed generation throws, which rolls back the usage increment.

---

## Step 6 — The UI

`src/app/(dashboard)/dashboard/jobs/_components/`:

- **`candidate-profile-card.tsx`: About me.**
  - Collapsible. Open on a first visit, folded once saved.
  - The panel stays mounted while folded, so unsaved typing survives.
  - Hidden without `candidateProfile:read`.
- **`job-email-form.tsx`:** the post, optional role and company, notes for this job, and an optional address.
- **`job-email-result.tsx`:**
  - The match check (`job-match-check.tsx`).
  - Clickable placeholder chips that switch to the right tab and select the placeholder.
  - Rewrite buttons, each inside `<FeatureGate resource="jobEmailRewrites">`, with one step of **Undo**.
  - Email and LinkedIn tabs. The Email tab has an editable **Sign-off** field.
  - Rewrites send the draft as it is now, so filled-in placeholders survive.
- **`job-assist-workspace.tsx`:** owns both mutations. A rewrite uses the post and notes from the generate call that produced the draft, not whatever is in the form now.

---

## Testing it

1. `npm run typecheck` and `npm run lint` are clean.
2. First visit: **About me** is open with your account name filled in. Save a skill, a project, a LinkedIn URL and a phone number with **Add phone to sign-off** off. The card folds and shows your name.
3. Enter `linkedin.com/in/you` without `https://`. Saving refuses with "Enter a full link starting with https://".
4. Paste a post that names the hiring manager and lists requirements. The email opens "Hi <first name>,", the match check shows ✓ and ✗ requirements, and the sign-off has your name and LinkedIn URL but no phone.
5. Turn the phone on in About me, generate again. The sign-off now includes it.
6. Fill one placeholder, click **Shorter**. The body gets shorter, the filled text is still there, the sign-off is unchanged, and **Undo** brings the previous text back.
7. **New subject** changes only the subject.
8. Click a placeholder chip that only appears in the LinkedIn message. The tab switches and the placeholder is selected.
9. **Open in Gmail** shows the body followed by the sign-off.
10. On a free org, the 21st rewrite opens the upgrade modal while emails still work, and the sixth email opens it for emails.

---

## Known limitations

- **No job links yet.** Paste the post text.
- **No resume tailoring, attachments or application tracking.** The saved profile is the base those will build on.
- **The resume is attached by hand in Gmail.** Compose links cannot carry attachments.
- **Drafts are not saved.** Refreshing the page loses the draft; the About me details persist.
- **The app can't find a recruiter's email** that isn't in the post.
- **The match check is the model's reading** of the post, not a keyword match. Treat it as a guide.

---

## File map

**New**

- `src/lib/types/job-email.ts`
- `src/lib/config/job-email.ts`
- `src/services/candidate-profile.service.ts`
- `src/trpc/routers/job-emails.ts`, `job-email-rewrites.ts`, `candidate-profile.ts`
- `src/components/global/voice-status/`
- `src/app/(dashboard)/dashboard/jobs/page.tsx`
- `src/app/(dashboard)/dashboard/jobs/_components/`:
  - `job-assist-workspace.tsx`
  - `candidate-profile-card.tsx`
  - `job-email-form.tsx`
  - `job-email-result.tsx`
  - `job-match-check.tsx`
  - `job-types.ts`
- `docs/19-job-email.md`

**Edited**

- `prisma/schema.prisma`: `CandidateProfile` and back-relations
- `src/lib/resources.ts`: `jobEmails`, `jobEmailRewrites`, `candidateProfile`
- `src/components/global/sidebar/nav-icons.tsx`: `Briefcase`
- `src/lib/types/index.ts`, `src/lib/config/index.ts`: barrel exports
- `src/services/ai.service.ts`: `generateJobEmail`, `rewriteJobEmail`
- `src/trpc/routers/_app.ts`: mounts
- `src/app/(dashboard)/dashboard/post-generation/_components/generate-form.tsx`, `post-composer.tsx`: use the global `VoiceStatusLine`
- `docs/00-start-here.md`: index entry
