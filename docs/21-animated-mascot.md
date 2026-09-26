# 21. The animated mascot — measuring a bitmap, then driving it

> **Status: built and running** on the landing hero. The mascot leans toward
> your cursor and its eyes follow it. Everything below is the method, the
> measurements, and the four ways it went wrong first.

This is not a feature doc. It is a **procedure** for making a flat character
illustration track a pointer, written so the next person can repeat it on a
different mascot — or on this one after the artwork is redrawn.

The thesis, and the only rule that matters:

> **The artwork decides the numbers. You measure it. You do not guess, and you
> do not judge it by looking at the rendered page.**

Every mistake in this doc came from breaking that rule.

---

## 1. What it does

Two independent layers, both driven by one pointer handler:

| Layer | What moves | Amount | Catch-up |
| --- | --- | --- | --- |
| **Lean** | the whole figure | 5px drift, 4px rise, **1.2° sway** pivoting at the feet | 0.6s |
| **Gaze** | the pupils only | **12 artwork units** (≈5.5px at a 468px render) | 0.35s |

The eyes are faster than the body on purpose. The body is a lean the reader
should feel without noticing; the eyes are the part that is supposed to read as
*looking*, and an eye that drifts at the body's pace looks sleepy.

Both layers stop entirely under `prefers-reduced-motion: reduce` — not damped,
not slowed. The listener is never attached.

---

## 2. Why this is harder than it looks

The mascot is **`/public/linkdin-dude.png`** — a 1024×1024 bitmap. You cannot
animate a pupil that is baked into a PNG.

So the eyes are an **overlay**: an SVG sharing the artwork's coordinate box that
hides each drawn pupil under a white disc and redraws it on top as something a
tween can move.

That gives you the test the whole feature is held to:

> **At rest the overlay must be indistinguishable from the artwork.** A visitor
> with no pointer, no JS, or reduced motion sees the character exactly as drawn.

Which in turn gives you the failure mode to hunt: the overlay painting over
line art that is supposed to stay visible.

---

## 3. The method

### Step 1 — Decide whether it should track at all

It should if the character is **large, central, and idle** — a hero figure the
reader looks at while deciding something. It should not if it is small (a
favicon-sized lockup has no room to move), already animated by something else,
or positioned where the movement competes with text.

### Step 2 — Read the artwork

Work from the PNG's raw pixels. `sharp` is already a dependency (Next.js pulls
it in), so a scratchpad script is enough — **do not commit these scripts**, they
are measuring instruments, not product code:

```js
const sharp = require("sharp");
const { data, info } = await sharp("public/linkdin-dude.png")
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const at = (x, y) => { const i = (y * info.width + x) * info.channels;
  return [data[i], data[i+1], data[i+2], data[i+3]]; };
const white = (x, y) => { const p = at(x, y);
  return p[3] > 200 && p[0] > 230 && p[1] > 230 && p[2] > 230; };
```

You need four things per eye. **Flood-fill the dark pupil** from a seed point
inside it to get its bounding box — centre and radius come straight off that.
Then find the **glint**: this artwork draws each pupil as a disc with a crescent
bitten out of its upper left by a white circle, and reproducing that is the
difference between "new pupil" and "wrong pupil".

What the sweep produced here, in artwork units on the 1024 box:

| | centre | radius | glint |
| --- | --- | --- | --- |
| left pupil | (509, 318.5) | 42.3 | offset (−0.30r, −0.46r), radius 0.56r |
| right pupil | (585, 363.5) | 40.3 | same |

Sampled colours: eye white `#fffeff`, pupil ink `#0a152e`.

> These are **artwork colours, not theme tokens**, and that is a deliberate
> exception to the no-hardcoded-colours rule. The overlay has to match a bitmap
> that does not change with the theme; a token would drift from the drawing the
> first time the palette moved.

### Step 3 — Find the travel budget

This is the step that decides everything, and the one that is tempting to skip.

The cover disc that hides a drawn pupil has radius `r + travel + pad`. So
**travel is bounded by whatever line art is nearest to the pupil's centre.**
Sweep for it — every non-white pixel within reach of either pupil, clustered so
you can see what they belong to:

```
non-white pixels within 95px: 779 in 2 clusters
  nearest=58.5px  n=703  box=[573,259 -> 616,306]   ← the brow wedge between the eyes
  nearest=83.4px  n=76   box=[499,402 -> 511,416]   ← a wedge tip below
```

Two features, and the brow fixes the ceiling:

```
r + travel + pad ≤ 58.5   →   travel + pad ≤ 18.2   →   travel 12, pad 5
```

Note how little of that budget is yours: the pupil's own radius is 40 of the
58.5. **A big pupil in a tight eye barely moves, and no amount of taste changes
that.**

Two traps live in this measurement:

- A distance transform of the white region gives a number that is **polluted by
  the pupil's own anti-aliasing** — the soft ring between ink and white is
  neither, so it reads as "line art" a few pixels from the pupil edge. Fill each
  pupil disc generously (`r + 18` or so) before measuring, or you will measure
  the pupil against itself.
- Both eye whites here are **one connected region** — the two ovals overlap and
  no outline separates them. No flood fill will split them, and a flood that
  treats dark pixels as interior escapes along the outlines and swallows the
  shirt and the mug.

### Step 4 — Build the overlay

```tsx
<svg viewBox="0 0 1024 1024" aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
  {pupils.map((p) => <circle key={p.name} cx={p.cx} cy={p.cy} r={p.r + travel + coverPad} fill={EYE_WHITE} />)}
  <g data-mascot-pupils="">
    {pupils.map((p) => (
      <React.Fragment key={p.name}>
        <circle cx={p.cx} cy={p.cy} r={p.r} fill={EYE_INK} />
        <circle cx={p.cx + p.r * glint.dx} cy={p.cy + p.r * glint.dy} r={p.r * glint.r} fill={EYE_WHITE} />
      </React.Fragment>
    ))}
  </g>
</svg>
```

Three things are load-bearing:

1. **The shared `viewBox`.** Every measurement is in artwork units, so the
   overlay stays registered with the drawing at any rendered size, with no
   percentage maths and nothing to re-tune per breakpoint.
2. **All covers before any pupil.** Drawn eye-by-eye, the second cover erases
   the first pupil the moment the two come close — and here their centres are
   only 88 units apart. This bug looks exactly like "the left eye stopped
   working".
3. **One group for both pupils.** Eyes tracking one point do not diverge, and
   one transform is one tween instead of four.

### Step 5 — Decide who owns the transform

Read the element's computed style before you write a line of animation code.
Here it said:

```
translate: none    transform: matrix(1, 0, 0, 1, -234, 0)
```

GSAP had claimed the element: it writes `transform` **and zeroes the CSS
`translate` / `rotate` / `scale` properties** so its own matrix is
authoritative. Any CSS transform written alongside it is silently discarded.

So the lean goes through GSAP too, and the mascot gets a **wrapper** that owns
the positioning classes and the ref, with the image and the overlay inside it —
otherwise the overlay does not travel with the figure through the swell and
slides off its face.

Two GSAP details worth stating plainly:

- **Never tween `transform` as a string** if anything else will touch the same
  element. `transform: "translateX(-50%) scale(1.06)"` hands GSAP one opaque
  value and overwrites the whole matrix every scroll tick, erasing the lean 60
  times a second. Use its own channels (`xPercent`, `scale`, `x`, `rotation`)
  and they compose.
- **In a `fromTo`, a property with a start but no end tweens back to the
  element's current value.** `{ xPercent: -50 }` in the from-vars alone walks
  the figure off centre as the section scrolls. Centring is a `gsap.set`, not
  part of the tween.

`gsap.quickTo` is the right tool for pointer work: it keeps one interpolator per
property alive and re-aims it, instead of allocating a tween per event.

### Step 6 — Drive it from the pointer

```js
const gazeX = gsap.quickTo(pupils, "x", { duration: 0.35, ease: PAPER_EASE });

const applyLean = () => {                       // runs at most once per frame
  frame = 0;
  const rect = mascotEl.getBoundingClientRect();
  const fromCentreX = clampUnit((pointer.x - (rect.left + rect.width / 2)) / (window.innerWidth / 2));
  gazeX(fromCentreX * MASCOT_LEAN.gaze);
};

const handleMove = (event) => {
  if (event.pointerType !== "mouse") return;    // a finger is not a cursor
  pointer = { x: event.clientX, y: event.clientY };
  if (!frame) frame = requestAnimationFrame(applyLean);
};
```

- **One rect read per frame, not per event.** Pointer events outrun the display,
  and `getBoundingClientRect` forces layout. It cannot be cached at mount
  either — on a sticky stage the box moves with the scroll.
- **`pointerType !== "mouse"`.** A touch fires `pointermove` too, and nothing
  follows a tap to undo it, so a phone would leave the character leaning at
  whatever angle the last thumb landed at.
- **Stand back up on `pointerleave`** of the document, or it holds a lean toward
  a cursor that is no longer on the page.
- **Register inside the reduced-motion branch.** Putting the listener inside
  `gsap.matchMedia("(prefers-reduced-motion: no-preference)")` means those
  readers never get it at all, and `mm.revert()` carries the cleanup.

### Step 7 — Prove it

**This is the step that caught the real bug.** Composite the overlay onto the
artwork server-side, then count the *line-art* pixels it changed — original
pixels that are neither white nor pupil — across every extreme of the gaze:

```
travel=26 pad=8: worst-case line-art pixels overwritten = 150
travel=12 pad=5: worst-case line-art pixels overwritten = 0
```

The 26 version had **bitten the tip off the brow wedge**, and it looked fine in
every screenshot of the rendered hero. It was only visible diffed against the
untouched PNG at 3× zoom. A screenshot of the page will not tell you this;
count the pixels.

---

## 4. The traps, in the order they bite

| Symptom | Cause |
| --- | --- |
| Flood fill swallows the shirt, the mug, everything | The "inside the eye" test accepted dark pixels, so the fill escaped along the outline strokes |
| Two eyes come back as one region | The whites genuinely are one region — overlapping ovals with no outline between them |
| Cover leaves a crescent of the old pupil | An ellipse inscribed in a partly occluded eye, rather than the pupil's own clearance |
| One eye's new pupil vanishes | The other eye's cover disc was painted after it |
| Clearance looks impossibly small (~8px) | The pupil's own anti-aliased ring is being measured as line art |
| Lean has no effect at all | GSAP owns the element and zeroed the CSS `translate`/`rotate` |
| Figure drifts off centre as you scroll | `xPercent` in `fromTo`'s from-vars with no matching end value |
| Looks perfect, still wrong | You checked a screenshot instead of diffing against the PNG |

---

## 5. Applying it to a different mascot

1. Flood-fill each pupil, record centre + radius. Record the glint if there is one.
2. Sample the eye white and the pupil ink.
3. Sweep for non-white pixels within ~95 units of each pupil centre; the nearest
   cluster sets `travel + pad ≤ nearest − r`.
4. Fill the numbers into `PAPER_MASCOT_EYES`.
5. Run the damage count at every gaze extreme. **It must be zero.**
6. Check the rest state against the untouched artwork at 3× zoom.

If step 3 leaves you less than about 8 units of travel, the eyes are too small
or too crowded for this technique — lean the body only.

---

## 6. Files

| Path | What it owns |
| --- | --- |
| `src/components/global/paper/paper-mascot.tsx` | `PAPER_MASCOT_EYES` (all measured geometry), `PaperMascotEyes` (the overlay), `PAPER_MASCOT_PUPILS` (the selector the hero aims at) |
| `src/app/(marketing)/_components/sticky-hero.tsx` | `MASCOT_LEAN` (amplitudes and durations), the wrapper that GSAP transforms, the pointer handler |
| `src/lib/gsap.ts` | `PAPER_EASE`, the shared curve both layers use |
| `public/linkdin-dude.png` | the artwork every number above was measured from |

The geometry lives beside the artwork rather than in the hero on purpose: the
coordinates are meaningless without the PNG, and `paper-mascot.tsx` is already
the source of truth for it. The hero only supplies amplitudes and a pointer.

---

## 7. When not to do this

- **A mascot that already carries a scroll animation.** Two motion systems on
  one element is how you get the string-transform bug above.
- **Small renders.** Below roughly 200px the pupil travel rounds to nothing.
- **Any artwork you cannot measure**, such as a photo or a gradient-heavy
  illustration where the cover disc will not blend invisibly.
- **Anywhere the movement competes for attention with a decision the reader is
  trying to make.** The hero is the right place precisely because there is
  nothing to read there but the pitch.
