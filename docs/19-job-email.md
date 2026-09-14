# Building the job email writer — a complete walkthrough

This is the build log for **Job Assist, v1: a member pastes a hiring post and a few true facts about themselves, and gets a short email and a LinkedIn message in their own voice, ready to open in Gmail.**

Read [07 — Adding a feature](./07-adding-a-feature.md) and [18 — Voice profile](./18-voice-profile.md) first. This feature is deliberately small and reuses both.

---

## The 10-second version

```
registry → types/config → ai.service → router → UI
```

- **One resource key**, `jobEmails`, metered per email (free 5 / starter 100 / pro 500).
- **No database table.** Nothing is stored, the same as post generation.
- **No new service, API key or dependency.**
- **No Google approval.** Sending happens in the member's own mail client through a compose link.
- **One lifted component:** the "Drafts are written in your voice" line is now global.

---

## Why it's shaped this way

The problem: a member sees a hiring post, opens Gmail, opens ChatGPT, and writes an email by hand.

- **Paste, not scrape.** LinkedIn gives apps no way to read posts, and job links are often behind a login. Pasting always works.
- **Facts from the member, never from the model.** An invented skill or metric that a recruiter checks costs the member the job. The prompt uses only the facts given; anything missing becomes a marked `[placeholder]`, and the editor lists any left before sending.
- **Compose links, not sending from the app.** Sending through the Gmail API requires Google's app verification and may require a paid security assessment every year. A compose link needs none of that, and the email still comes from the member's real address. One-click send (for example through Corsair) can replace the buttons later without changing anything else.

---

## Step 1 — The registry

`src/lib/resources.ts` gains `jobEmails`: `permissions: ["create"]`, a `limit`, a 10-per-minute rate limit, an audit template, and nav under **Create** as "Job Assist" at `/dashboard/jobs`.

Only `create` exists, because nothing is stored: there is nothing to read, edit or remove. The counter measures model spend.

Also edit `src/components/global/sidebar/nav-icons.tsx` (`Briefcase`), or the sidebar shows a neutral circle.

---

## Step 2 — Types and config

`src/lib/types/job-email.ts` defines three schemas, because the three shapes differ:

| Schema | What it is |
|---|---|
| `generateJobEmailSchema` | The request: `jobPost`, `highlights` (the member's facts), optional `recipientEmail` |
| `generatedJobEmailSchema` | The model's output: `company`, `role`, `recipientEmail`, `subject`, `body`, `linkedinMessage` |
| `jobEmailDraftSchema` | The editable draft that goes to a mail client, validated again because the member edits it |

`jobEmailRecipientSchema` accepts an empty string or a real address, trimmed, and nothing in between.

`src/lib/config/job-email.ts` holds the model budget and three helpers:

- `buildGmailComposeUrl` opens Gmail's compose window with the draft filled in.
- `buildMailtoUrl` opens any other email app, with CRLF line breaks as the mailto standard requires.
- `JOB_PLACEHOLDER_PATTERN` finds `[placeholders]` left in a draft.

Both link builders use `encodeURIComponent`, not `URLSearchParams`, which writes spaces as `+` and can leave literal plus signs in a draft.

---

## Step 3 — The AI

`src/services/ai.service.ts` gains `generateJobEmail(input, candidateName, voice)`.

`JOB_EMAIL_SYSTEM_PROMPT` enforces what gets a recruiter's reply:

- a body of 80–150 words
- an opening that names the role, never "I hope this email finds you well"
- one or two of the member's facts matched to named requirements from the post
- **only the facts given**, with a marked placeholder for anything missing
- one low-effort ask
- a LinkedIn message under 300 characters
- company, role and address copied from the post or left empty, never guessed

The prompt labels the post and the facts separately, so the model can't mistake a line of the post for something the member claimed. The member's voice is appended below the hard rules, exactly as for every other generator.

---

## Step 4 — The router

`src/trpc/routers/job-emails.ts`, mounted as `jobEmails`, has one procedure, `create`:

1. `assertAiConfigured` runs before any quota is spent.
2. The voice is read on the server, never taken from the input.
3. The model writes the email.
4. The recipient is decided: **an address the member typed always wins**. An address the model read off the post is kept only if it passes `jobEmailRecipientSchema`, because a model can return something that only looks like an address.
5. The draft is returned without being stored. A failure throws, which rolls back the usage increment.

---

## Step 5 — The UI

`src/app/(dashboard)/dashboard/jobs/`:

- `job-assist-workspace.tsx` has two columns and owns the mutation. A version counter remounts the editor for each new draft.
- `job-email-form.tsx` is the post, the facts and the optional address, with the generate button inside `<FeatureGate resource="jobEmails">`.
- `job-email-result.tsx` is the editable draft: an Email tab (To, Subject, body) and a LinkedIn message tab. It lists any placeholders, and offers **Open in Gmail**, **Open in email app** and **Copy**.

**Lifted to global:** `src/components/global/voice-status/VoiceStatusLine`. It was inline in the post composer. It checks the permission and reads the voice profile itself, and both the composer and Job Assist render it.

---

## Testing it

1. `npm run typecheck` and `npm run lint` are clean.
2. **Job Assist** appears in the sidebar for an owner.
3. Paste a post containing an email address, leave the address field empty, and generate. The To field comes back filled.
4. Generate with no facts. The email contains `[placeholders]`, and the warning above the send buttons lists them.
5. **Open in Gmail** opens a compose window with the subject and body filled in and line breaks intact.
6. Clear the subject, then click **Open in Gmail**. It refuses and shows "Add a subject".
7. On a free org, the sixth email opens the upgrade modal.
8. With a voice profile active, the line under the button reads "Drafts are written in your voice."

---

## Known limitations

- **No job links yet.** Paste the post text.
- **No resume tailoring, attachments or application tracking.** These are later Job Assist steps.
- **The resume is attached by hand in Gmail.** Compose links cannot carry attachments.
- **Nothing is saved.** Refreshing the page loses the draft, the same as the post composer before a draft is saved.
- **The app can't find a recruiter's email** that isn't in the post.

---

## File map

**New**

- `src/lib/types/job-email.ts`
- `src/lib/config/job-email.ts`
- `src/trpc/routers/job-emails.ts`
- `src/components/global/voice-status/`
- `src/app/(dashboard)/dashboard/jobs/page.tsx`
- `src/app/(dashboard)/dashboard/jobs/_components/`: `job-assist-workspace.tsx`, `job-email-form.tsx`, `job-email-result.tsx`, `job-types.ts`
- `docs/19-job-email.md`

**Edited**

- `src/lib/resources.ts`: `jobEmails`
- `src/components/global/sidebar/nav-icons.tsx`: `Briefcase`
- `src/lib/types/index.ts`, `src/lib/config/index.ts`: barrel exports
- `src/services/ai.service.ts`: `generateJobEmail`
- `src/trpc/routers/_app.ts`: mount
- `src/app/(dashboard)/dashboard/post-generation/_components/generate-form.tsx`, `post-composer.tsx`: now use the global `VoiceStatusLine`
- `docs/00-start-here.md`: index entry
