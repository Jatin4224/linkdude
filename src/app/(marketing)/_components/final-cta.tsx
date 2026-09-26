/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: FinalCta, MARKETING_CLOSING, PaperDisplay,
 *   PaperButton, PaperMascot, PaperLabel, closing band, last CTA, AUTH_ROUTES
 *
 * WHAT:  The closing band — the mascot, the page's largest display line, the two
 *        calls to action and the last reassurance.
 * WHY:   The only place on the page where an ink box and a blue box appear in
 *        the same line, and it still spends exactly one blue (rule 4): "One
 *        CONVERSATION away", with conversation in ink and away in blue. That
 *        escalation is what makes the last headline read as the biggest, rather
 *        than merely the largest.
 *
 *        Two CTAs rather than one, and the second is the outline variant on
 *        purpose: someone who already has an account should not have to find
 *        sign-in in the footer, but they must not be offered a second blue
 *        button competing with the primary ask.
 * WHERE: src/app/(marketing)/page.tsx, last before the footer.
 */


import {
  AUTH_ROUTES,
  GET_STARTED_HREF,
  GET_STARTED_LABEL,
  MARKETING_CLOSING,
  MARKETING_SECTION_IDS,
} from "@/lib/config";
import {
  PaperLabel,
  PaperButton,
  PaperDisplay,
  PaperMascot,
  PaperReveal,
} from "@/components/global/paper";

export function FinalCta() {
  return (
    <section
      id={MARKETING_SECTION_IDS.start}
      className="relative z-6 bg-paper px-[clamp(16px,3vw,34px)] py-[clamp(72px,11vw,150px)] text-ink"
    >
      <PaperReveal
        distance={30}
        className="flex flex-col items-center gap-6 text-center"
      >
      <PaperMascot
        width={240}
        height={240}
        className="h-auto w-[clamp(140px,17vw,240px)]"
      />

      <p className="m-0 text-[clamp(18px,2.2vw,30px)] tracking-[-0.02em] text-grey">
        {MARKETING_CLOSING.lead}
      </p>

      {/* The clamp FLOOR is the load-bearing number here, not the ceiling.
          "Conversation" is twelve characters of Archivo Black in one unbreakable
          span, so at the old 46px floor it measured ~392px inside a 358px column
          on a 390px phone — three pixels of horizontal page scroll, traced to
          exactly this word. The floor has to be small enough for the LONGEST
          word in the line at the narrowest supported screen; 30px clears it with
          room, and the 10vw term still takes over above ~300px so nothing about
          the desktop composition changes. */}
      <PaperDisplay
        as="h2"
        words={MARKETING_CLOSING.heading}
        className="max-w-[14em] justify-center text-center text-[clamp(30px,10vw,150px)]"
      />

      <div className="flex flex-wrap items-center justify-center gap-3 pt-1.5">
        <PaperButton href={GET_STARTED_HREF} size="lg" arrow>
          {GET_STARTED_LABEL}
        </PaperButton>
        <PaperButton href={AUTH_ROUTES.signIn} variant="outline" size="lg">
          {MARKETING_CLOSING.secondaryLabel}
        </PaperButton>
      </div>

      <PaperLabel size="band" tone="grey" className="tracking-[0.08em]">
        {MARKETING_CLOSING.reassurance}
      </PaperLabel>
      </PaperReveal>
    </section>
  );
}
