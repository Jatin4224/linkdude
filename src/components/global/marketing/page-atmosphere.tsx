/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PageAtmosphere, bg-brand-halo, animate-halo,
 *   bg-grain, bg-scanlines, animate-scanline, decorative layers, grain,
 *   scanlines, halo, aria-hidden
 *
 * WHAT:  The three fixed decorative layers behind and over every public page —
 *        a breathing brand halo, film grain, and CRT scanlines.
 * WHY:   All three exist to stop large flat near-black areas from reading as
 *        dead screen, which is the failure mode of a dark editorial layout. They
 *        are FIXED rather than absolute so they cost one composited layer each
 *        instead of one that spans the whole scroll height, and they animate
 *        only opacity and transform so none of it touches layout. Grouped into
 *        one component because they are one decision — "what the page is made
 *        of" — and because three loose divs in a layout invite someone to delete
 *        the one they don't recognise.
 *
 *        Every layer is aria-hidden and pointer-events-none: none of it is
 *        content, and none of it may ever intercept a click.
 * WHERE: src/app/(marketing)/layout.tsx.
 */

export function PageAtmosphere() {
  return (
    <>
      {/* Sits behind everything, bleeding off the top of the page. The negative
          z-index is what keeps it under the content without needing a stacking
          context on every section. */}
      <div
        aria-hidden="true"
        className="animate-halo bg-brand-halo pointer-events-none fixed -top-140 left-1/2 -z-30 h-[1000px] w-[1500px] -translate-x-1/2"
      />

      {/* Above the content, at 4.5% and multiplied into it. Never seen
          directly — its only job is to give the flat areas a surface. */}
      <div
        aria-hidden="true"
        className="bg-grain pointer-events-none fixed inset-0 z-60 opacity-[0.045] mix-blend-overlay"
      />

      <div
        aria-hidden="true"
        className="bg-scanlines animate-scanline pointer-events-none fixed inset-0 z-59 opacity-35"
      />
    </>
  );
}
