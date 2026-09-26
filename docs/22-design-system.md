# 22. The design system — two languages, one set of components

> **Status: built and running.** Fifteen dashboard surfaces, both public
> surfaces, light and dark. No component was forked to get there, and that is
> the part worth understanding before you change anything.

This app renders two visual languages that share one component library:

| | **Paper** | **Technical-editorial** |
| --- | --- | --- |
| Where | the landing page and the auth screens | every signed-in surface |
| Scope class | `.paper-scope` | `.tech-scope`, plus `.tech-chrome` on the shell |
| Feel | cream, Archivo Black words in boxes, printed | near-black, Archivo Narrow condensed, Geist Mono labels, crop marks |
| Radius | 0 (one 4px exception) | 0 (avatars excepted) |

They look nothing alike. They are built from the same `components/ui`, the same
`data-slot` attributes and the same shadcn primitives.

> **The rule this document exists to protect: you style a surface by putting it
> in a scope, never by forking the component that lands in it.**

---

## 1. Why scopes rather than variants

The alternative — a `variant="tech"` on thirty components — fails twice. Every
new component has to remember to implement it, and every shared component grows
a second set of styles that the dashboard has to carry even where it never
renders. A scope inverts that: **the surface declares what it is, and anything
dropped into it is already correct.**

Both scopes work by remapping the tokens the components already read.

**Paper** rewrites the semantic layer outright, so shadcn resolves to the
printed palette without knowing it has:

```css
.paper-scope {
  --background: var(--paper);
  --foreground: var(--ink);
  --card: var(--paper-raised);
  /* … */
}
```

**Tech** goes the other way: it derives its own vocabulary *from* the app's
tokens, so a rebrand moves it without a second edit:

```css
.tech-scope {
  --ed-bg: var(--background);
  --ed-surface: color-mix(in oklab, var(--card) 70%, transparent);
  --ed-surface-deep: var(--card);
  --ed-hairline: color-mix(in oklab, var(--border) 75%, transparent);
  --ed-ink: var(--foreground);
  --ed-muted: var(--muted-foreground);
  --ed-accent: var(--brand);
}
```

A route converts by being **wrapped**, not rewritten:

```tsx
<TechSurface>…the page exactly as it was…</TechSurface>
```

Fifteen surfaces did exactly that: the dashboard home, post generation, posts,
carousel, calendar, content plan, ideas, voice, profile analysis, documents,
studio, team, and the three settings pages.

### The shell is a separate scope on purpose

`.tech-chrome` sits on `SidebarInset` in `src/app/(dashboard)/layout.tsx` and
converts **the chrome only**. Its rules use the child combinator —
`.tech-chrome > [data-slot="page-header"]` — so the conversion cannot leak down
into a route body that has not opted in. Without that, every page in the app
would have been converted the moment the layout changed, including the ones
nobody had looked at.

### `data-slot` is the hook for everything else

When a shared component needs correcting inside a scope, the correction is
written against its slot, in `globals.css`, next to every other correction.
Twelve exist today:

```
avatar   card   card-title   chat-wallpaper   linkedin-identity
month-agenda   month-calendar   month-calendar-day-number
post-status-badge   table-head   table-row   usage-meter-bar
```

If a component has no slot, **add one to the component** rather than forking it.
A slot is a hook that costs the other surfaces nothing.

---

## 2. The trap that will cost you an afternoon

**Layer order beats specificity.** A correction written in `@layer components`
loses to a utility written in `@layer utilities`, no matter how specific the
selector is — so a scope correction aimed at a class written inside
`components/ui` has to live in `@layer utilities` too, or it silently does
nothing.

Every scope-correction block in `globals.css` is in `@layer utilities` for this
reason, and each one carries the note. This is the single most common way an
"impossible" styling bug happens here: the rule is in the file, the selector
matches, and the browser is still ignoring it.

---

## 3. Radius

Both scopes set `--radius: 0px`, and the tech scope also zeroes `--radius-2xl`
and `--radius-3xl` — **Tailwind's larger radii are not derived from `--radius`**,
so setting one and not the others leaves rounded cards in a square system.

Two deliberate exceptions: avatars stay round, and the 28–30px brand mark in
`PaperLockup` takes a 4px radius. The lockup exception is owned inside
`paper-mascot.tsx` precisely so it cannot spread.

---

## 4. The theme

| Thing | Where |
| --- | --- |
| `THEME_PREFERENCES` (`dark` / `light` / `system`), `themePreferenceSchema`, `ThemePreference` | `src/lib/types/theme.ts` |
| `DEFAULT_THEME` (dark), `FORCED_THEME`, `THEME_STORAGE_KEY`, `isThemeablePath()` | `src/lib/config/theme.ts` |
| Per-route `forcedTheme` via `usePathname` | `src/components/theme-provider.tsx` |

**The toggle applies to the signed-in app only.** Public pages pass
`forcedTheme` rather than being wrapped in `.dark`, because a wrapper leaves
portalled UI — toasts, dialogs — rendering in the *chosen* theme: a light toast
over a dark landing page.

**Light is cream, not white.** The neutrals sit at hue 85 with low chroma
(`--background: oklch(0.972 0.014 85)`, `--card: oklch(0.988 0.009 85)`,
`--border: oklch(0.895 0.018 85)`), against a pure-black dark theme.

That forced one genuine override. The tech scope builds `--ed-surface` by
mixing *toward transparent* from `--card`, which reads correctly on black and
disappears on cream — so light redefines three tokens to mix toward the
foreground instead:

```css
.light .tech-scope,
.light .tech-chrome > [data-slot="page-header"] {
  --ed-surface: color-mix(in oklab, var(--background), var(--foreground) 4%);
  --ed-surface-deep: color-mix(in oklab, var(--background), var(--foreground) 7%);
  --ed-hairline: var(--border);
}
```

---

## 5. Motion is one vocabulary too

The same argument as the scopes: one entrance, one curve, one reduced-motion
contract, so the page never feels like six people animated it.

| Primitive | What it is | Where |
| --- | --- | --- |
| `PAPER_EASE`, `SCRUB` | the app's curve as a gsap ease (same control points as `--ease-out`) and the one scrub value | `src/lib/gsap.ts` |
| `PaperReveal` | every landing section's entrance — `stagger` by default, `wipe` rationed to full-bleed colour bands | `components/global/paper/paper-reveal.tsx` |
| `Reveal` | the CSS-only reveal for app surfaces, with four independent ways out of the hidden state | `components/global/reveal/reveal.tsx` |
| `useDemoStep` | in-view-once + hover-advance, driving the seven panels that demonstrate themselves | `src/hooks/use-demo-step.ts` |
| `CountUp` | a number that counts up the first time it is seen | `components/global/count-up/count-up.tsx` |
| `MASCOT_LEAN` / `PAPER_MASCOT_EYES` | the cursor-tracking mascot — see `21-animated-mascot.md` | `sticky-hero.tsx`, `paper-mascot.tsx` |
| `.paper-underline`, `.paper-ticker` | the link underline wipe, and the ticker's hover/focus pause | `globals.css` |

Three conventions hold across all of them:

1. **The pre-JS state is the finished state.** `PaperReveal` animates with
   `gsap.from()`, so the server HTML is a complete page that gsap moves
   *backwards* to animate in. A blocked bundle shows content, not a blank.
2. **Reduced motion keeps the meaning, drops the travel.** `PaperReveal` keeps
   a fade; the demo panels still change state with `transition: none`; the
   mascot's pointer listener is never attached. Nobody is left staring at a
   before-state.
3. **Hover is never the only trigger.** There is no hover on a phone, so
   anything that explains something fires on scroll-into-view and merely
   *advances* on hover.

---

## 6. Files

| Path | What it owns |
| --- | --- |
| `src/app/globals.css` | both scopes, every token, all twelve slot corrections, the light overrides, `.brackets`, `.tech-chrome`, `.paper-underline` |
| `src/components/global/tech/tech.tsx` | `TechSurface`, `TechSection`, `TechPanel`, `TechStat`, `TechBadge`, `TechButton`, `TechLabel`, `TechRule`, `TechMeta`, `TechEmpty`, `TechAsciiPanel`, `Bracketed` |
| `src/components/global/paper/` | `PaperButton`, `PaperDisplay`, `PaperLabel`, `PaperScatter`, `PaperMascot`, `PaperReveal`, `PaperOrbit`, `PAPER_ICONS` |
| `src/lib/types/theme.ts`, `src/lib/config/theme.ts`, `src/components/theme-provider.tsx` | the theme contract, its config, and the per-route forcing |
| `src/lib/gsap.ts` | plugin registration, `PAPER_EASE`, `SCRUB` |

---

## 7. Converting a new route

1. Wrap the route body in `<TechSurface>`. Change nothing else yet.
2. Look at it at **1440px and 390px**, in both themes.
3. Anything still wrong is a *correction*, not a fork: find the component's
   `data-slot`, add a rule in `globals.css` beside the others, in
   `@layer utilities`.
4. No `data-slot`? Add one to the component. It costs the other surfaces
   nothing.
5. Never hardcode a colour. `bg-background`, `text-foreground`,
   `text-muted-foreground`, `bg-card`, `bg-primary`, `border` — or an `--ed-*`
   token inside the tech scope.
6. New motion composes the primitives in §5. If you need a new one, it belongs
   beside them, not inside your route.

---

## 8. What breaks it

- **Forking a shared component** to make one surface look right. The next
  surface gets the un-fixed one, and the two drift.
- **A correction in the wrong layer.** See §2.
- **`overflow-hidden` on a bracketed module** — the crop marks are drawn
  outside the box and get clipped away.
- **Hardcoded colours**, including `text-white` and a forced `dark` class. Both
  survive review by looking fine in exactly one theme.
- **A radius that sneaks back in** via a Tailwind scale that does not derive
  from `--radius`.
- **Motion added locally** rather than through the primitives — the failure is
  not that it looks bad on its own, it is that the page stops feeling like one
  thing.
