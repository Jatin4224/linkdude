/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CAROUSEL_BLUEPRINTS, getCarouselBlueprint,
 *   carousel blueprint, narrative arc, slide job, voice directive, templates as data
 *
 * WHAT:  What each template's deck ARGUES, slide by slide, and how it sounds.
 * WHY:   The look and the writing are one decision. A bold, high-contrast template
 *        whose copy is written like a quiet essay is not a bold deck — it is a
 *        quiet deck in loud clothes. Pairing an arc and a voice with every template
 *        is what makes choosing a template choose the whole artefact.
 *
 *        Authored as DATA, so adding a template is an entry here plus an entry in
 *        carousel-layouts — no prompt edit, no renderer branch. The same bet
 *        STUDIO_TEMPLATES makes, and for the same reason: the moment a style needs
 *        code, the vocabulary is missing a word and that is the thing to fix.
 *
 *        `job` is written as an instruction to a writer rather than a label,
 *        because it is pasted verbatim into the prompt. "Name the shift and who it
 *        affects" produces a slide; "Problem" produces a heading that says Problem.
 *
 *        `slots` is a REQUEST, not a guarantee. The model fills what it can, the
 *        layout draws what it has, and every slot defaults to empty — so a slide
 *        missing one is a quieter slide, never a broken one.
 * WHERE: buildCarouselBlueprintPrompt in ai.service; the layouts in
 *        lib/config/carousel-layouts read the same slot names.
 */

import {
  carouselTemplateSchema,
  type CarouselBlueprint,
  type CarouselTemplate,
} from "@/lib/types/carousel";

/* The arc every explainer deck walks: name the shift, show why the old answer
 * stopped working, give the mechanism, prove it, then ask. Shared because all
 * three current templates argue the same way and differ in VOICE — when one needs
 * a different arc, it gets its own array rather than a flag on this one. */
const EXPLAINER_MIDDLE: CarouselBlueprint["middle"] = [
  {
    job: "Name what changed and who it affects. One shift, stated plainly, with something concrete the reader can picture.",
    kind: "content",
    slots: ["heading", "body", "note"],
  },
  {
    job: "Show why the obvious answer stopped working. Be specific about the failure — a vague 'it doesn't scale' is a wasted slide.",
    kind: "content",
    slots: ["heading", "body", "callout"],
  },
  {
    job: "Give the mechanism: the actual steps or parts, in order. This is the slide people screenshot, so it carries the list.",
    kind: "content",
    slots: ["heading", "bullets"],
  },
  {
    job: "Prove it. A number, a named example, or a before/after from the topic. Never invent one that was not given.",
    kind: "content",
    slots: ["heading", "body", "callout"],
  },
  {
    job: "Handle the objection the reader is already forming. Say it out loud, then answer it in one line.",
    kind: "content",
    slots: ["heading", "body", "note"],
  },
];

export const CAROUSEL_BLUEPRINTS: Record<CarouselTemplate, CarouselBlueprint> = {
  minimal: {
    label: "Explainer",
    voice:
      "Calm and precise. Short declarative sentences. No hype words, no exclamation marks. The authority comes from specificity, not volume — prefer the exact number or the exact name over an adjective.",
    cover: {
      job: "One promise that makes someone stop scrolling. State the claim, not the subject. Mark the two or three words that carry the claim with == == so the design can emphasise them.",
      kind: "cover",
      slots: ["eyebrow", "heading", "body"],
    },
    middle: EXPLAINER_MIDDLE,
    cta: {
      job: "One concrete ask that costs the reader ten seconds. Never 'follow for more', never 'comment a word'.",
      kind: "cta",
      slots: ["heading", "body", "ctaLabel"],
    },
  },

  bold: {
    label: "Punchy",
    voice:
      "Direct and confrontational, in the way a good coach is. Very short lines. Address the reader as 'you'. One idea per slide, stated as a verdict rather than a discussion — but never manufacture outrage, and never insult the reader for not already knowing.",
    cover: {
      job: "A verdict or a contradiction the reader will want to argue with. Mark the sharpest two or three words with == == for emphasis.",
      kind: "cover",
      slots: ["eyebrow", "heading"],
    },
    middle: EXPLAINER_MIDDLE,
    cta: {
      job: "Tell the reader exactly what to do next, in the imperative. One action, no alternatives.",
      kind: "cta",
      slots: ["heading", "ctaLabel", "note"],
    },
  },

  editorial: {
    label: "Essay",
    voice:
      "Considered and first-person, like a practitioner writing up what they learned. Full sentences are allowed here where the other templates avoid them. Lead with the observation, then the reasoning — and keep one concrete detail per slide so it never floats into abstraction.",
    cover: {
      job: "Open on the observation that started the thinking, not on a conclusion. Mark the phrase that carries it with == ==.",
      kind: "cover",
      slots: ["eyebrow", "heading", "body"],
    },
    middle: EXPLAINER_MIDDLE,
    cta: {
      job: "Close by inviting a specific response — a question worth answering, or one concrete next step.",
      kind: "cta",
      slots: ["heading", "body", "ctaLabel"],
    },
  },
};

/**
 * SOURCE OF TRUTH KEYWORDS: getCarouselBlueprint
 *
 * WHAT:  The blueprint for a template id, falling back rather than throwing.
 * WHY:   templateId is a bare String on the row, so a deck written under an older
 *        vocabulary must still generate and render. Same never-throw contract
 *        getCarouselPalette and getCarouselTypeScale already document.
 *
 *        PARSED with a fallback rather than cast-and-coalesced. The two getters
 *        named above reach the same outcome through `templateId as CarouselTemplate`,
 *        which is an assertion the compiler cannot check; `.catch()` is the same
 *        contract expressed as a check, and matches resolveSlideRenderContext.
 */
export function getCarouselBlueprint(templateId: string): CarouselBlueprint {
  return CAROUSEL_BLUEPRINTS[
    carouselTemplateSchema.catch("minimal").parse(templateId)
  ];
}
