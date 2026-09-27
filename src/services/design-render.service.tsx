/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "server-only";

/**
 * SOURCE OF TRUTH KEYWORDS: resolveDesignImages, backdrop data URI
 *
 * WHAT:  Turns the image references on a document into inline data URIs.
 * WHY:   satori CAN fetch a remote URL itself, and letting it is the wrong call
 *        twice over. It would fetch mid-render with no timeout this code
 *        controls, so a slow CDN surfaces as a render that silently produced a
 *        blank box rather than an error anyone can act on — and it would refetch
 *        the same bytes on every keystroke of a debounced preview.
 *
 *        Resolving up front means a broken image fails HERE, with a message, on
 *        a line that names the slot.
 *
 *        Each image is requested through `buildTransformedUrl` at the size it
 *        will actually occupy, never at source resolution. A 4000px upload
 *        composited into a 1584px canvas is several megabytes of decode for
 *        pixels nobody sees, and on a per-keystroke preview that is the whole
 *        latency budget.
 * WHERE: Called by renderDesignPng when the caller has not already supplied
 *        resolved images.
 */
async function resolveDesignImages(
  doc: DesignDoc,
  canvasWidth: number,
): Promise<Partial<Record<DesignImageSlotKey, string>>> {
  const entries = Object.entries(doc.images) as [
    DesignImageSlotKey,
    { url: string } | undefined,
  ][];

  const resolved: Partial<Record<DesignImageSlotKey, string>> = {};

  /* Sequential, matching the rest of this pipeline: satori is CPU-bound on one
   * thread anyway, and a design carries at most three images. */
  for (const [slot, image] of entries) {
    if (!image) continue;

    const sized = buildTransformedUrl(image.url, `w-${String(canvasWidth)}`);
    const binary = await imagekitService.fetchFileBinary(sized, "image/png");
    resolved[slot] = `data:${binary.mimeType};base64,${Buffer.from(
      binary.bytes,
    ).toString("base64")}`;
  }

  return resolved;
}

/**
 * SOURCE OF TRUTH KEYWORDS: renderDesignPng, RenderedDesign, DesignCanvasView,
 *   renderDesignBlock, DesignRenderContext, resolveTextRef, designFlex,
 *   studio renderer, satori element tree, block language renderer
 *
 * WHAT:  The one generic renderer. Walks a DesignDoc's block list and emits the
 *        element tree satori rasterises into a PNG.
 * WHY:   This file is why a template is a config object. `CarouselSlideView`
 *        hardcodes one layout and branches on `slide.kind`, so a second design
 *        means a second view — the cost that made twenty templates unaffordable
 *        (see the note on CAROUSEL_TEMPLATES in lib/types/carousel). Here the
 *        layout arrives as DATA and the branching is per BLOCK TYPE, of which
 *        there are nine and will stay nine. Template twenty-one costs nothing.
 *
 *        `server-only` and `.tsx`, for the reasons carousel.service states: this
 *        JSX never mounts, never hydrates and never reaches a browser. It is
 *        render input, not UI, and putting it under components/ would invite
 *        exactly the client import `server-only` exists to prevent.
 *
 *        NO PRISMA HERE. This module renders; studio.service talks to the
 *        database. That is why the `db: DbClient` first-parameter rule does not
 *        apply to it.
 *
 *        THE RULE THAT BREAKS THIS RENDERER: satori implements a flexbox subset
 *        and THROWS on a container with more than one child that has no `display`
 *        set. Every node emitted below therefore carries an explicit
 *        `display: "flex"`, applied centrally through `designFlex` so no future
 *        block type can forget it. There is exactly one documented exception —
 *        see the clamp branch in the `text` case.
 * WHERE: Called by the studio router's `preview` and `render` procedures.
 *        Phase 5 of docs/20-studio.md points renderCarouselPdf at it too.
 */

import { ImageResponse } from "next/og";

import {
  buildTransformedUrl,
  CAROUSEL_FONT_FAMILY,
  getDesignTypeScale,
  resolveDesignColor,
  resolveDesignPalette,
  type DesignPalette,
  type DesignTypeScale,
} from "@/lib/config";
import {
  DESIGN_CANVAS_PRESETS,
  type DesignBlock,
  type DesignColorRef,
  type DesignDoc,
  type DesignImageSlotKey,
  type DesignPattern,
  type DesignLeafBlock,
  type DesignTextRef,
  parseDesignMarkedRuns,
  type DesignFontKey,
} from "@/lib/types";

import * as imagekitService from "./imagekit.service";
import { loadAllRenderFonts, RENDER_FONT_FAMILIES } from "./render-fonts.service";
import {
  decorationDataUri,
  loadDecorationSvgs,
  type DecorationMarkup,
} from "./render-decorations.service";

/**
 * SOURCE OF TRUTH KEYWORDS: DesignRenderContext
 *
 * WHAT:  Everything the renderer needs that is not in the document.
 * WHY:   `index`/`total` exist so a computed text ref can resolve. A profile
 *        asset has neither and passes nothing; a carousel slide will pass both,
 *        which is how phase 5 reuses this renderer without a second entry point.
 *
 *        `images` is a map of ALREADY-RESOLVED data URIs, never remote URLs.
 *        satori would otherwise fetch them itself, mid-render, with no timeout
 *        and no error this code could classify — a slow CDN would surface as a
 *        render that silently produced a blank box. Resolving up front means a
 *        broken image fails through classifyError with a legible message.
 */
export interface DesignRenderContext {
  readonly index?: number;
  readonly total?: number;
  readonly images?: Partial<Record<DesignImageSlotKey, string>>;
}

export interface RenderedDesign {
  /** base64 because imagekit.service's uploadFileBytes takes base64. */
  base64: string;
  byteSize: number;
  width: number;
  height: number;
}

/* Everything a block needs to draw itself, assembled once per render rather than
 * threaded through nine signatures. */
interface BlockContext {
  readonly doc: DesignDoc;
  readonly palette: DesignPalette;
  readonly scale: DesignTypeScale;
  readonly width: number;
  readonly height: number;
  readonly ctx: DesignRenderContext;
  /* Raw decoration markup, read once and tinted per block. Resolved up front for
   * the same reason images are: a render must not touch the filesystem midway
   * through building an element tree. */
  readonly decorations: DecorationMarkup;
}

/* The one line that keeps this renderer alive. Every style object below spreads
 * it, so `display: flex` cannot be forgotten on a new block type. */
const designFlex = { display: "flex" } as const;

/**
 * SOURCE OF TRUTH KEYWORDS: resolveTextRef
 *
 * WHAT:  Turns a text reference into the string to draw, or null to draw nothing.
 * WHY:   Null rather than an empty string, because the two mean different things
 *        to the caller: an empty slot with `hideWhenEmpty` must remove its whole
 *        block — an empty badge pill still draws a pill, a border and padding,
 *        which reads as a bug. Returning null lets the caller collapse the node
 *        entirely.
 */
function resolveTextRef(ref: DesignTextRef, context: BlockContext): string | null {
  switch (ref.source) {
    case "fixed":
      return ref.text.length > 0 ? ref.text : null;

    case "slot": {
      const value = context.doc.content[ref.slot]?.trim() ?? "";
      if (value.length > 0) return value;
      /* Without hideWhenEmpty an unfilled slot still reserves its space, which
       * is what a template wants when the gap is part of the composition. */
      return ref.hideWhenEmpty ? null : "";
    }

    case "computed": {
      const { index, total } = context.ctx;
      if (index === undefined || total === undefined) return null;
      switch (ref.value) {
        case "slideCounter":
          return `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
        case "deckProgress":
          return `${Math.round(((index + 1) / total) * 100)}%`;
        default:
          return null;
      }
    }

    default:
      return null;
  }
}

/* A computed width resolves to a percentage string; a number is a fraction of
 * the canvas. Shared by `shape`, which is how a carousel progress bar becomes
 * data rather than a branch. */
function resolveSpan(
  span: number | "slideCounter" | "deckProgress",
  ctx: DesignRenderContext,
): string {
  if (typeof span === "number") return `${Math.round(span * 100)}%`;
  const { index, total } = ctx;
  if (index === undefined || total === undefined) return "0%";
  return `${Math.round(((index + 1) / total) * 100)}%`;
}

function color(ref: DesignColorRef, context: BlockContext): string {
  return resolveDesignColor(context.palette, ref);
}

function fontSizeFor(role: keyof DesignTypeScale, scale: DesignTypeScale): number {
  return scale[role];
}

/**
 * SOURCE OF TRUTH KEYWORDS: renderDesignBlock
 *
 * WHAT:  One block, as a satori node — or null when it has nothing to draw.
 * WHY:   The exhaustive switch is deliberate: the `never` assignment at the
 *        bottom makes adding a block type to the union a COMPILE ERROR here
 *        until it is drawn. A new block type that silently rendered nothing
 *        would be found by a user, not by the compiler.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: fontFamilyFor, DesignFontKey, RENDER_FONT_FAMILIES
 *
 * WHAT:  The family NAME satori matches against, for a block's font role.
 * WHY:   Every family is handed to the renderer at once, so choosing a typeface is
 *        a matter of naming it on the element. This is the one place a role
 *        ("marker") becomes a name ("Permanent Marker"), so swapping the face is
 *        an entry in RENDER_FONT_FAMILIES and nothing else moves.
 */
function fontFamilyFor(font: DesignFontKey): string {
  return RENDER_FONT_FAMILIES[font === "sans" ? "geist" : font].family;
}

function renderDesignBlock(
  block: DesignBlock,
  context: BlockContext,
  key: string,
): React.ReactElement | null {
  if (block.hidden) return null;

  const { scale } = context;

  switch (block.type) {
    case "text": {
      const value = resolveTextRef(block.text, context);
      if (value === null) return null;

      const base = {
        fontFamily: fontFamilyFor(block.font),
        /* The member's override wins; otherwise the geometry decides. That is
         * what keeps one archetype legible on a 396px banner and a 1350px slide
         * without the override having to be restated per canvas. */
        fontSize: block.fontSize ?? fontSizeFor(block.role, scale),
        fontWeight: block.weight,
        color: color(block.color, context),
        letterSpacing: block.letterSpacing,
        lineHeight:
          block.lineHeight ?? (block.role === "display" ? 1.05 : 1.35),
        textAlign: block.align,
        textTransform: block.transform,
      } as const;

      /* THE ONE EXCEPTION to display:flex in this renderer. satori supports
       * -webkit-line-clamp, but only on a -webkit-box — setting `display: flex`
       * here would silently disable the clamp and let a long headline overflow
       * the canvas instead of ellipsing. Single-line text takes the flex path
       * like everything else. */
      if (block.maxLines > 1) {
        return (
          <div
            key={key}
            style={{
              ...base,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: block.maxLines,
              overflow: "hidden",
            }}
          >
            {value}
          </div>
        );
      }

      return (
        <div key={key} style={{ ...designFlex, ...base }}>
          {value}
        </div>
      );
    }

    /**
     * SOURCE OF TRUTH KEYWORDS: markedText, parseDesignMarkedRuns, highlight swash
     *
     * WHAT:  A heading whose ==marked== words sit on a coloured swash.
     * WHY:   ONE BOX PER WORD, in a wrapping flex row. satori lays flex children
     *        out as boxes and will not break one across lines, so a run holding a
     *        whole phrase would either overflow or take a line of its own — per
     *        word, the swash follows the text through a natural wrap.
     *
     *        No line clamp here: clamping needs a -webkit-box, which cannot
     *        contain the flex row this builds. A marked heading is bounded by its
     *        slot's character ceiling instead, which is where that bound belongs.
     */
    case "markedText": {
      const value = resolveTextRef(block.text, context);
      if (value === null) return null;

      const fontSize = block.fontSize ?? fontSizeFor(block.role, scale);
      const runs = parseDesignMarkedRuns(value);

      /* Word boxes carry the vertical rhythm, so the row's own line-height would
       * double-count it. The gap does that job instead. */
      const lineHeight = block.lineHeight ?? 1.05;

      return (
        <div
          key={key}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent:
              block.align === "center"
                ? "center"
                : block.align === "right"
                  ? "flex-end"
                  : "flex-start",
            columnGap: Math.round(fontSize * 0.26),
            rowGap: Math.round(fontSize * (lineHeight - 1)) + block.highlightPaddingY * 2,
          }}
        >
          {runs.flatMap((run, runIndex) =>
            run.text
              .split(/\s+/)
              .filter((word) => word.length > 0)
              .map((word, wordIndex) => (
                <div
                  key={`${key}-${String(runIndex)}-${String(wordIndex)}`}
                  style={{
                    display: "flex",
                    fontFamily: fontFamilyFor(block.font),
                    fontSize,
                    fontWeight: block.weight,
                    letterSpacing: block.letterSpacing,
                    textTransform: block.transform,
                    color: run.marked
                      ? color(block.highlightColor, context)
                      : color(block.color, context),
                    ...(run.marked
                      ? {
                          backgroundColor: color(block.highlight, context),
                          paddingLeft: block.highlightPaddingX,
                          paddingRight: block.highlightPaddingX,
                          paddingTop: block.highlightPaddingY,
                          paddingBottom: block.highlightPaddingY,
                          borderRadius: block.highlightRadius,
                        }
                      : {}),
                  }}
                >
                  {word}
                </div>
              )),
          )}
        </div>
      );
    }

    /**
     * SOURCE OF TRUTH KEYWORDS: decoration, decorationDataUri, doodle
     *
     * WHAT:  A named hand-drawn mark, tinted and drawn as an SVG image.
     * WHY:   Width is a fraction of the canvas so one layout holds across every
     *        geometry; `height: auto` lets the artwork's own aspect decide the
     *        rest rather than stating it twice and letting the two disagree.
     *
     *        aria-hidden has no meaning in a PNG, but the mark is decoration and
     *        saying so in the tree keeps that intent attached to it.
     */
    case "decoration": {
      const markup = context.decorations[block.art];
      const src = decorationDataUri(markup, color(block.color, context));

      return (
        <div key={key} style={{ ...designFlex }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data URI
              built in this process; next/image cannot reach it and satori draws
              the img element directly. */}
          <img
            src={src}
            alt=""
            style={{
              width: `${String(Math.round(block.width * context.width))}px`,
              ...(block.rotate !== 0
                ? { transform: `rotate(${String(block.rotate)}deg)` }
                : {}),
            }}
          />
        </div>
      );
    }

    case "badgeRow": {
      /* Resolve first, then decide. A row of three slots where the member filled
       * one must render one badge, not one badge and two empty pills. */
      const labels = block.items
        .map((item) => resolveTextRef(item, context))
        .filter((label): label is string => label !== null && label.length > 0);
      if (labels.length === 0) return null;

      return (
        <div key={key} style={{ ...designFlex, flexDirection: "row", gap: block.gap }}>
          {labels.map((label, itemIndex) => (
            <div
              key={`${key}-${String(itemIndex)}`}
              style={{
                ...designFlex,
                alignItems: "center",
                backgroundColor: color(block.fill, context),
                color: color(block.label, context),
                fontSize: fontSizeFor(block.role, scale),
                borderRadius: block.radius,
                paddingLeft: 16,
                paddingRight: 16,
                paddingTop: 7,
                paddingBottom: 7,
                ...(block.border
                  ? { border: `1px solid ${color(block.border, context)}` }
                  : {}),
              }}
            >
              {label}
            </div>
          ))}
        </div>
      );
    }

    case "buttonPill": {
      const label = resolveTextRef(block.label, context);
      if (label === null || label.length === 0) return null;

      return (
        <div
          key={key}
          style={{
            ...designFlex,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: color(block.fill, context),
            color: color(block.labelColor, context),
            fontSize: fontSizeFor(block.role, scale),
            fontWeight: 700,
            borderRadius: block.radius,
            paddingLeft: block.paddingX,
            paddingRight: block.paddingX,
            paddingTop: block.paddingY,
            paddingBottom: block.paddingY,
          }}
        >
          {label}
        </div>
      );
    }

    case "logoText": {
      const label = resolveTextRef(block.text, context);
      if (label === null || label.length === 0) return null;

      const markSize = Math.round(fontSizeFor(block.role, scale) * 1.1);

      return (
        <div
          key={key}
          style={{ ...designFlex, flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          {block.mark === "none" ? null : (
            <div
              style={{
                ...designFlex,
                width: markSize,
                height: markSize,
                backgroundColor: color(block.markFill, context),
                borderRadius: block.mark === "circle" ? markSize : 4,
              }}
            />
          )}
          <div
            style={{
              ...designFlex,
              color: color(block.color, context),
              fontSize: fontSizeFor(block.role, scale),
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            {label}
          </div>
        </div>
      );
    }

    case "image": {
      /* Pre-resolved data URI or nothing — never a remote URL. See the note on
       * DesignRenderContext.images. Phase 1 passes an empty map, so image blocks
       * self-collapse until the upload step lands in phase 2. */
      const source = context.ctx.images?.[block.slot];
      if (!source) return null;

      const width = Math.round(block.width * context.width);
      const height = Math.round(block.height * context.height);

      return (
        <div
          key={key}
          style={{
            ...designFlex,
            width,
            height,
            borderRadius: block.radius,
            overflow: "hidden",
            ...(block.ringWidth > 0 && block.ringColor
              ? { border: `${String(block.ringWidth)}px solid ${color(block.ringColor, context)}` }
              : {}),
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- satori renders
              to a raster; there is no DOM here and next/image cannot run. */}
          <img
            src={source}
            alt=""
            width={width}
            height={height}
            style={{ objectFit: block.fit }}
          />
        </div>
      );
    }

    case "shape": {
      const width = resolveSpan(block.width, context.ctx);
      const height = Math.round(block.height * context.height);

      return (
        <div
          key={key}
          style={{
            ...designFlex,
            width,
            height: block.shape === "circle" ? width : height,
            backgroundColor: color(block.fill, context),
            borderRadius: block.shape === "circle" ? 9999 : block.radius,
          }}
        />
      );
    }

    case "divider":
      return (
        <div
          key={key}
          style={{
            ...designFlex,
            width: `${String(Math.round(block.length * 100))}%`,
            height: block.thickness,
            backgroundColor: color(block.color, context),
          }}
        />
      );

    case "spacer":
      return <div key={key} style={{ ...designFlex, height: block.size }} />;

    case "group": {
      /* Children are LEAVES by type, so this recursion is bounded at one level —
       * see the note on designLeafBlockSchema. No depth guard is needed because
       * the schema makes deeper nesting unrepresentable. */
      const children = block.children
        .map((child: DesignLeafBlock, childIndex) =>
          renderDesignBlock(child, context, `${key}-${String(childIndex)}`),
        )
        .filter((node): node is React.ReactElement => node !== null);

      /* A group whose children all collapsed must collapse too, or it leaves its
       * own gap behind in the stack. */
      if (children.length === 0) return null;

      return (
        <div
          key={key}
          style={{
            ...designFlex,
            flexDirection: block.direction,
            gap: block.gap,
            alignItems: block.align === "start" ? "flex-start" : block.align === "end" ? "flex-end" : "center",
          }}
        >
          {children}
        </div>
      );
    }

    default: {
      /* Exhaustiveness guard — see the WHY above. */
      const unreachable: never = block;
      return unreachable;
    }
  }
}

/**
 * SOURCE OF TRUTH KEYWORDS: patternStyle, patternNodes, DESIGN_PATTERNS
 *
 * WHAT:  A drawn background pattern — as CSS where satori renders it reliably,
 *        and as real nodes where it does not.
 * WHY:   THE PATTERN SET IS CHOSEN BY WHAT ACTUALLY RASTERISES, not by what the
 *        docs list. satori documents `repeating-linear-gradient` as supported,
 *        but vercel/satori#554 reports it silently failing when the output is
 *        PNG — which is every render this app performs. A pattern that comes out
 *        as a flat colour is worse than one that was never offered, because the
 *        member cannot tell whether it is broken or just subtle.
 *
 *        So: `glow` and `fade` are plain radial and linear gradients, which are
 *        the two best-supported values in satori. `grid` is drawn as positioned
 *        divs, because there is no non-repeating gradient that produces one.
 *
 *        Dots and diagonal stripes were dropped rather than faked. Both need
 *        repetition, and drawing a dot field as nodes costs hundreds of elements
 *        on a canvas that re-renders on every keystroke.
 */
function patternStyle(
  pattern: DesignPattern,
  field: string,
  ink: string,
): Record<string, string> {
  switch (pattern) {
    case "glow":
      return {
        backgroundColor: field,
        /* Off-centre to the RIGHT, matching where every reference banner puts
         * its visual weight — and away from where the avatar lands. */
        backgroundImage: `radial-gradient(circle at 72% 40%, ${ink}, ${field} 62%)`,
      };

    case "fade":
      return {
        backgroundColor: field,
        backgroundImage: `linear-gradient(120deg, ${field} 35%, ${ink} 100%)`,
      };

    case "grid":
      /* Drawn by patternNodes below; the field is all this contributes. */
      return { backgroundColor: field };

    default: {
      const unreachable: never = pattern;
      return { backgroundColor: field, ...(unreachable as object) };
    }
  }
}

/**
 * SOURCE OF TRUTH KEYWORDS: patternNodes
 *
 * WHAT:  The pattern layer that has to be elements rather than CSS.
 * WHY:   Absolutely positioned behind the content, so it never joins the flex
 *        stack and cannot push the composition around.
 *
 *        Spacing is deliberately coarse. A 48px grid across 1584px would be
 *        thirty-three lines; at 132px it is twelve verticals and three
 *        horizontals, which reads as the same texture at banner scale for a
 *        quarter of the nodes — and this tree is rebuilt on every keystroke of a
 *        debounced preview.
 */
function patternNodes(
  context: BlockContext,
): React.ReactElement | null {
  const { background } = context.doc;
  if (background.kind !== "pattern" || background.pattern !== "grid") return null;

  const ink = color(background.ink, context);
  const step = 132;
  const columns = Math.floor(context.width / step);
  const rows = Math.floor(context.height / step);

  return (
    <div
      style={{
        ...designFlex,
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
      }}
    >
      {Array.from({ length: columns }, (_, index) => (
        <div
          key={`v-${String(index)}`}
          style={{
            ...designFlex,
            position: "absolute",
            top: 0,
            left: (index + 1) * step,
            width: 1,
            height: "100%",
            backgroundColor: ink,
          }}
        />
      ))}
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={`h-${String(index)}`}
          style={{
            ...designFlex,
            position: "absolute",
            left: 0,
            top: (index + 1) * step,
            width: "100%",
            height: 1,
            backgroundColor: ink,
          }}
        />
      ))}
    </div>
  );
}

/* The full-bleed field. Gradients go through `linear-gradient`, which satori
 * supports on backgroundImage but NOT on backgroundColor. */
function backgroundStyle(context: BlockContext): Record<string, string> {
  const { background } = context.doc;

  switch (background.kind) {
    case "solid":
      return { backgroundColor: color(background.color, context) };

    case "gradient":
      return {
        backgroundImage: `linear-gradient(${String(background.angle)}deg, ${color(background.from, context)}, ${color(background.to, context)})`,
      };

    case "pattern":
      return patternStyle(
        background.pattern,
        color(background.color, context),
        color(background.ink, context),
      );

    case "image": {
      const source = context.ctx.images?.[background.slot];
      if (!source) {
        /* Fall back to the palette's own field rather than rendering a
         * transparent canvas — a PNG with no background is not a usable export. */
        return { backgroundColor: context.palette.background };
      }
      return { backgroundImage: `url(${source})`, backgroundSize: "cover" };
    }

    default:
      return { backgroundColor: context.palette.background };
  }
}

/**
 * SOURCE OF TRUTH KEYWORDS: DesignCanvasView
 *
 * WHAT:  One design, as the element tree satori rasterises.
 * WHY:   A single flex column (or row) of blocks. The document owns direction,
 *        alignment and justification, so the same renderer draws a left-aligned
 *        banner and a centred featured cover without knowing which is which.
 */
function DesignCanvasView({ context }: { context: BlockContext }): React.ReactElement {
  const { doc, scale } = context;

  const nodes = doc.blocks
    .map((block, blockIndex) =>
      renderDesignBlock(block, context, `block-${String(blockIndex)}`),
    )
    .filter((node): node is React.ReactElement => node !== null);

  return (
    <div
      style={{
        ...designFlex,
        width: "100%",
        height: "100%",
        /* The pattern layer positions against this. */
        position: "relative",
        /* A stack taller than its canvas is CLIPPED, not bled. With justify:center
         * an over-tall column overflows symmetrically, which slices the top off
         * the headline and pushes the footer past the bottom edge — it looks like
         * a broken render rather than a full one. Clipping at least fails inside
         * the frame. The real defence is the type scale: see the vertical budget
         * note on DESIGN_TYPE_SCALE.linkedinBanner. */
        overflow: "hidden",
        flexDirection: doc.direction,
        /* `padding` is optional rather than defaulted on the document: unset
         * means "use this geometry's own padding", which is a different
         * statement from a number the user chose. */
        padding: doc.padding ?? scale.padding,
        /* Reserves the avatar zone. Applied on top of padding rather than instead
         * of it, so a template states "clear the left third" without also having
         * to restate its own breathing room. */
        ...(doc.insetLeft === undefined
          ? {}
          : { paddingLeft: Math.round(doc.insetLeft * context.width) }),
        gap: scale.gap,
        fontFamily: CAROUSEL_FONT_FAMILY,
        alignItems:
          doc.align === "center" ? "center" : doc.align === "right" ? "flex-end" : "flex-start",
        justifyContent:
          doc.justify === "start"
            ? "flex-start"
            : doc.justify === "end"
              ? "flex-end"
              : doc.justify === "between"
                ? "space-between"
                : "center",
        ...backgroundStyle(context),
      }}
    >
      {patternNodes(context)}
      {nodes}
    </div>
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: renderDesignPng, RenderedDesign
 *
 * WHAT:  Rasterises one design to a PNG.
 * WHY:   `ImageResponse` is normally RETURNED from a route handler; here it is
 *        constructed directly and drained with `.arrayBuffer()`, the same trick
 *        renderSlidePng uses. That is what makes this callable from a tRPC
 *        procedure rather than needing a route of its own.
 *
 *        No pdf-lib: a profile asset is one image, so the pipeline stops at the
 *        PNG buffer rather than stapling pages.
 * WHERE: The studio router's preview (to a data URI) and render (to ImageKit).
 */
export async function renderDesignPng(
  doc: DesignDoc,
  ctx: DesignRenderContext = {},
): Promise<RenderedDesign> {
  /* Indexed directly, with no fallback: `canvas` is a z.enum on the document, so
   * an unknown value fails at parse time and never reaches this function. That
   * is NOT true of getDesignTypeScale below, which takes a widened string and
   * keeps its never-throw contract for callers that have one. */
  const preset = DESIGN_CANVAS_PRESETS[doc.canvas];

  /* Resolved here unless the caller already did it — phase 5 will pass a shared
   * map once per deck rather than refetching the same logo for twelve slides. */
  const images = ctx.images ?? (await resolveDesignImages(doc, preset.width));

  const context: BlockContext = {
    doc,
    palette: resolveDesignPalette(doc.paletteId, doc.paletteOverrides),
    scale: getDesignTypeScale(doc.canvas),
    width: preset.width,
    height: preset.height,
    ctx: { ...ctx, images },
    decorations: await loadDecorationSvgs(),
  };

  const response = new ImageResponse(<DesignCanvasView context={context} />, {
    width: preset.width,
    height: preset.height,
    fonts: await loadAllRenderFonts(),
  });

  const buffer = Buffer.from(await response.arrayBuffer());

  return {
    base64: buffer.toString("base64"),
    byteSize: buffer.byteLength,
    width: preset.width,
    height: preset.height,
  };
}
