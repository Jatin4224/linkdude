/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: SlideEditor, SlideEditorProps, applyReorder,
 *   applyInsert, slideKeys, drag and drop reorder, normalizeCarouselSlideKinds,
 *   SlidePreview, SlideImageExport, aria-live
 *
 * WHAT:  The edit step between a generated draft and a rendered file — per-slide
 *        copy beside a live preview, plus the deck's structure, its look, and the
 *        Render / Download / Publish actions.
 * WHY:   Editing exists because the model drafts, it does not finish. Saving is
 *        explicit rather than per-keystroke: every save is a mutation inside a
 *        transaction, and autosaving a textarea would fire one per character.
 *
 *        The whole DRAFT is held by the parent and written as a whole object —
 *        slides, template and shape together — matching updateCarouselSchema.
 *        Reordering is a splice here and a single write there, rather than a patch
 *        protocol that would become a second source of truth about deck order.
 *
 *        THE PREVIEW IS NOT GATED ON A CLEAN BUFFER, unlike Render and Publish. It
 *        draws the buffer, so it is the only surface that shows unsaved work
 *        truthfully; the gated actions are the ones that produce a file.
 * WHERE: Rendered by carousel-workspace when a deck is selected, keyed by deck id so
 *        selection and drag state reset at the same boundary the buffer does.
 */

import * as React from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  GripVerticalIcon,
  LayoutGridIcon,
  Loader2Icon,
  PlusIcon,
  SendIcon,
  TrashIcon,
} from "lucide-react";

import {
  CAROUSEL_BODY_MAX,
  CAROUSEL_HEADING_MAX,
  CAROUSEL_MAX_BULLETS,
  CAROUSEL_MAX_SLIDES,
  CAROUSEL_MIN_SLIDES,
  CAROUSEL_PAGE_PRESETS,
  CAROUSEL_TEMPLATES,
  carouselPagePresetSchema,
  carouselSlideKindOptionsFor,
  expandCarouselBlueprint,
  normalizeCarouselSlideKinds,
  createEmptyCarouselSlide,
  DESIGN_MARK_DELIMITER,
  type CarouselBrandValues,
  type CarouselDraftValues,
  type CarouselPagePreset,
  type CarouselSlide,
  type CarouselSlideKind,
  type CarouselSlides,
  type CarouselTemplate,
} from "@/lib/types";
import {
  buildAttachmentUrl,
  CAROUSEL_SLIDE_KIND_LABELS,
  CAROUSEL_TEMPLATE_LABELS,
  getCarouselBlueprint,
} from "@/lib/config";
import { Badge } from "@/components/ui/badge";
import { TechButton, TechLabel, TechRule } from "@/components/global/tech";
import { UsageMeter } from "@/components/global/usage-meter";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SlidePreview } from "./slide-preview";
import { SlideImageExport } from "./slide-image-export";
import { SlideIllustration } from "./slide-illustration";
import { SlideRewrite } from "./slide-rewrite";
import { DeckReview } from "./deck-review";

export interface SlideEditorProps {
  /** The open deck's id. The rewrite endpoint reads its topic and template. */
  carouselId: string;
  draft: CarouselDraftValues;
  onChange: (draft: CarouselDraftValues) => void;
  onSave: () => void;
  onRender: () => void;
  isSaving: boolean;
  isRendering: boolean;
  isDirty: boolean;
  /** The stored row's status. `ready` is the only value with a current file. */
  status: string;
  /** Names the PNG archive — the deck public title, or its topic. */
  deckTitle: string;
  /** Wordmark and byline, drawn by templates that ask for them. */
  brand: CarouselBrandValues;
  /** Present once a render has succeeded. */
  documentUrl?: string | undefined;
  documentFileName?: string | undefined;
  /** The Document row id — what publishing needs. Present with documentUrl. */
  documentId?: string | undefined;
  lastError?: string | null | undefined;
  onPublish?: (() => void) | undefined;
}

export function SlideEditor({
  carouselId,
  draft,
  onChange,
  onSave,
  onRender,
  isSaving,
  isRendering,
  isDirty,
  status,
  deckTitle,
  brand,
  documentUrl,
  documentFileName,
  documentId,
  lastError,
  onPublish,
}: SlideEditorProps) {
  const slides = draft.slides;

  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const [isReviewOpen, setIsReviewOpen] = React.useState(false);

  /* Keys for the slide cards, held PARALLEL to the buffer rather than derived from
   * it. With `key={index}` a reorder makes React reuse position three's DOM node for
   * a different slide, so focus stays in the wrong input mid-typing; a content-derived
   * key is worse, remounting the card on every character. Slides are a bare Json
   * array and must NOT gain an id — that would change the stored shape and every
   * deck that has to survive carouselSlidesSchema. */
  const [slideKeys, setSlideKeys] = React.useState<readonly string[]>(() =>
    slides.map((_, index) => String(index)),
  );
  const nextKeyRef = React.useRef(slides.length);

  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [dropIndex, setDropIndex] = React.useState<number | null>(null);

  /* Announced rather than merely animated: a reorder is invisible to a screen
   * reader otherwise, and the kind auto-correction below has to be spoken or it
   * looks like the editor quietly overrode a choice. */
  const [announcement, setAnnouncement] = React.useState("");

  /* Clamped during render, not corrected in an effect — deleting the last slide
   * must not paint one frame against a stale index, and this project's lint rule
   * forbids setState in an effect for exactly that reason. */
  const activeIndex = Math.min(selectedIndex, slides.length - 1);
  const activeSlide = slides[activeIndex];

  /* The arc this deck was written against, stretched to its current length. Read
   * straight from config rather than fetched: the blueprint is data the client
   * already ships, so naming each slide's job costs nothing at runtime. */
  const blueprintSteps = expandCarouselBlueprint(
    getCarouselBlueprint(draft.templateId),
    slides.length,
  );

  const canDelete = slides.length > CAROUSEL_MIN_SLIDES;
  const canAdd = slides.length < CAROUSEL_MAX_SLIDES;

  /* Blocking Save with the slide NAMED, rather than letting the server reject the
   * whole array with a message that does not say which card is at fault. */
  const missingHeadings = slides
    .map((slide, index) => (slide.heading.trim().length === 0 ? index + 1 : null))
    .filter((position): position is number => position !== null);
  const canSave = isDirty && missingHeadings.length === 0;

  function keyFor(index: number) {
    /* noUncheckedIndexedAccess forces the fallback, and it is the right one: a
     * desync can only survive until the next deck switch, which remounts this
     * component entirely. */
    return slideKeys[index] ?? String(index);
  }

  function writeSlides(nextSlides: CarouselSlides, nextKeys: readonly string[]) {
    setSlideKeys(nextKeys);
    onChange({ ...draft, slides: nextSlides });
  }

  /**
   * SOURCE OF TRUTH KEYWORDS: applyReorder
   *
   * WHAT:  Moves a slide, keeping its card identity with it.
   * WHY:   The single path every reorder takes — drag, and the arrow buttons that
   *        remain the keyboard and touch route. Both arrays splice together here so
   *        they cannot drift apart, and the kind invariant is re-applied because
   *        moving the cover off position one is exactly what breaks the layout.
   */
  function applyReorder(from: number, to: number) {
    if (from === to || to < 0 || to >= slides.length) return;

    const nextSlides = [...slides];
    const [movedSlide] = nextSlides.splice(from, 1);
    if (!movedSlide) return;
    nextSlides.splice(to, 0, movedSlide);

    const nextKeys = [...slideKeys];
    const [movedKey] = nextKeys.splice(from, 1);
    if (movedKey) nextKeys.splice(to, 0, movedKey);

    const normalized = normalizeCarouselSlideKinds(nextSlides);
    writeSlides(normalized, nextKeys);
    setSelectedIndex(to);

    const corrected = normalized[to]?.kind !== movedSlide.kind;
    setAnnouncement(
      `Moved slide ${String(from + 1)} to position ${String(to + 1)}.` +
        (corrected
          ? ` It is now the ${String(
              CAROUSEL_SLIDE_KIND_LABELS[
                normalized[to]?.kind ?? movedSlide.kind
              ],
            ).toLowerCase()}.`
          : ""),
    );
  }

  /**
   * SOURCE OF TRUTH KEYWORDS: applyInsert
   *
   * WHAT:  Adds a slide at a position, with a fresh card key.
   * WHY:   New slides land between the focused slide and the cta — you add a slide
   *        because the argument needs a step THERE, and appending would force a drag
   *        every time. Never after the last card, so the closing ask is not
   *        displaced and nothing needs correcting.
   */
  function applyInsert(at: number, slide: CarouselSlide) {
    if (!canAdd) return;

    const nextSlides = [...slides];
    nextSlides.splice(at, 0, slide);

    const nextKeys = [...slideKeys];
    nextKeys.splice(at, 0, `new-${String(nextKeyRef.current)}`);
    nextKeyRef.current += 1;

    writeSlides(normalizeCarouselSlideKinds(nextSlides), nextKeys);
    setSelectedIndex(at);
  }

  function addSlide() {
    /* Clamped below the last index so the cta keeps the closing position. */
    const at = Math.min(activeIndex + 1, slides.length - 1);
    /* An EMPTY heading, not a placeholder. carouselSlideSchema requires one, so
     * Save stays blocked until it is written — which is correct. Seeding "New slide"
     * would make the deck saveable, renderable and publishable with a slide
     * literally titled that. */
    applyInsert(at, createEmptyCarouselSlide("content"));
    setAnnouncement(`Added a slide at position ${String(at + 1)}.`);
  }

  function duplicateSlide(index: number) {
    const source = slides[index];
    if (!source) return;
    const at = Math.min(index + 1, slides.length - 1);
    /* Verbatim, with no "Copy of" prefix — you duplicate in order to edit, and a
     * prefix is something you then have to delete. */
    applyInsert(at, { ...source });
    setAnnouncement(
      `Duplicated slide ${String(index + 1)} to position ${String(at + 1)}.`,
    );
  }

  function removeSlide(index: number) {
    const nextSlides = slides.filter((_, i) => i !== index);
    const nextKeys = slideKeys.filter((_, i) => i !== index);
    writeSlides(normalizeCarouselSlideKinds(nextSlides), nextKeys);
    setAnnouncement(`Deleted slide ${String(index + 1)}.`);
  }

  function updateSlide(index: number, patch: Partial<CarouselSlide>) {
    onChange({
      ...draft,
      slides: slides.map((slide, i) =>
        i === index ? { ...slide, ...patch } : slide,
      ),
    });
  }

  function changeKind(index: number, kind: CarouselSlideKind) {
    onChange({
      ...draft,
      slides: normalizeCarouselSlideKinds(
        slides.map((slide, i) => (i === index ? { ...slide, kind } : slide)),
      ),
    });
  }

  /* Changing either makes an existing render stale, which the row's status already
   * records — updateCarouselRecord resets it to draft on every save. Nothing extra
   * to track here. */
  function changeTemplate(templateId: CarouselTemplate) {
    onChange({ ...draft, templateId });
  }

  function changePage(page: CarouselPagePreset) {
    onChange({ ...draft, page });
  }

  const hasCurrentFile = status === "ready" && documentUrl !== undefined;

  return (
    <div className="flex flex-col gap-4">
      {/* One live region for the whole editor. Reorders, inserts, deletions and kind
          corrections all speak through it. */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Mounted unconditionally but only RENDERS its slides while open — the
          dialog's own content is unmounted when closed, so the twelve preview
          requests inside it do not fire until someone asks for them. */}
      <DeckReview
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        slides={slides}
        templateId={draft.templateId}
        page={draft.page}
        brand={brand}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {slides.length} / {CAROUSEL_MAX_SLIDES} slides
          {isDirty ? " · unsaved changes" : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSave}
            disabled={!canSave || isSaving || isRendering}
          >
            {isSaving ? <Loader2Icon className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
          {/* Deliberately NOT gated on a clean buffer, unlike Render and Publish:
              reviewing is how you decide whether the deck is worth saving, so
              requiring a save first would invert the order people work in. */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsReviewOpen(true)}
          >
            <LayoutGridIcon className="size-4" />
            Review deck
          </Button>
          <Button
            variant="brand"
            size="sm"
            onClick={onRender}
            /* Rendering unsaved slides would produce a PDF of the stored deck, not
             * the one on screen — the file would silently disagree with the editor.
             * Saving first is required, not merely advised. */
            disabled={isDirty || isRendering || isSaving}
          >
            {isRendering ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : null}
            {isRendering ? "Rendering…" : "Render PDF"}
          </Button>
          {hasCurrentFile ? (
            /* buttonVariants rather than <Button asChild> — this Button is a base-ui
               primitive with no asChild slot, so a link that looks like a button
               borrows the classes. */
            <a
              href={buildAttachmentUrl(documentUrl)}
              aria-label={`Download ${documentFileName ?? "carousel PDF"}`}
              /* No `download` attribute: it is ignored on cross-origin links, so the
               * save is driven by ImageKit's Content-Disposition instead — see
               * buildAttachmentUrl. No target="_blank" either, because an attachment
               * response never navigates the page away. */
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <DownloadIcon className="size-4" />
              Download
            </a>
          ) : null}
          <SlideImageExport
            slides={slides}
            templateId={draft.templateId}
            page={draft.page}
            deckTitle={deckTitle}
            disabled={isDirty || isRendering || isSaving}
          />
          {documentId && onPublish ? (
            <TechButton
              size="sm"
              onClick={onPublish}
              /* Gated on isDirty for the same reason Render is, and on status for a
               * second: publishing while either differs would post the PDF of the
               * OLD slides, which is the one mistake here that reaches an audience
               * and cannot be taken back. */
              disabled={isDirty || isRendering || isSaving || status !== "ready"}
            >
              <SendIcon className="size-4" />
              Publish
            </TechButton>
          ) : null}
        </div>
      </div>

      {missingHeadings.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {missingHeadings.length === 1
            ? `Slide ${String(missingHeadings[0])} needs a heading to save.`
            : `Slides ${missingHeadings.join(", ")} need headings to save.`}
        </p>
      ) : null}

      {/* The stored file predates what is on screen. Studio says the same thing on
          its own export for the same reason: offering a download that disagrees with
          the editor is the worst thing this tool can do. */}
      {documentUrl && status !== "ready" ? (
        <p className="text-sm text-muted-foreground">
          This deck has changed since it was last rendered. Render again to
          download the version you can see.
        </p>
      ) : null}

      {lastError ? (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">
            {lastError}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
        {/* Cards second on desktop, second on mobile too — but the preview is
            ordered FIRST on small screens, where a column of inputs above the
            picture would bury it entirely. */}
        <div className="order-2 flex flex-col gap-3 lg:order-1">
          {slides.map((slide, index) => {
            const headingOver = slide.heading.length > CAROUSEL_HEADING_MAX;
            const bodyOver = slide.body.length > CAROUSEL_BODY_MAX;
            /* How many optional slots carry something, so a filled extra is never
             * hidden behind a collapsed section with no sign it is there. */
            const extrasFilled = [
              slide.eyebrow,
              slide.callout,
              slide.ctaLabel,
              slide.note,
            ].filter((value) => value.trim().length > 0).length +
              (slide.bullets.length > 0 ? 1 : 0);
            const kindOptions = carouselSlideKindOptionsFor(
              index,
              slides.length,
            );
            const kindLocked = kindOptions.length === 1;

            return (
              <Card
                key={keyFor(index)}
                onClick={() => setSelectedIndex(index)}
                onDragOver={(event) => {
                  if (dragIndex === null) return;
                  /* Without preventDefault the browser refuses the drop outright. */
                  event.preventDefault();
                  setDropIndex(index);
                }}
                onDragLeave={() =>
                  setDropIndex((current) =>
                    current === index ? null : current,
                  )
                }
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragIndex === null) return;
                  applyReorder(dragIndex, index);
                  setDragIndex(null);
                  setDropIndex(null);
                }}
                className={cn(
                  "transition-colors",
                  index === activeIndex && "border-primary/50",
                  dropIndex === index &&
                    dragIndex !== index &&
                    "border-primary border-dashed",
                  dragIndex === index && "opacity-50",
                )}
              >
                <CardContent className="flex flex-col gap-3 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* The HANDLE is draggable, never the card: a draggable card
                          swallows text selection inside its own input and textarea
                          in Firefox and Safari. */}
                      <span
                        draggable
                        onDragStart={(event) => {
                          /* Firefox will not start a drag without payload data. */
                          event.dataTransfer.setData("text/plain", String(index));
                          event.dataTransfer.effectAllowed = "move";
                          setDragIndex(index);
                        }}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setDropIndex(null);
                        }}
                        aria-hidden
                        className="cursor-grab text-muted-foreground active:cursor-grabbing"
                      >
                        <GripVerticalIcon className="size-4" />
                      </span>
                      <Badge variant="secondary">
                        {String(index + 1).padStart(2, "0")}
                      </Badge>
                      {kindLocked ? (
                        <Badge
                          variant="outline"
                          title={
                            index === 0
                              ? "The first slide is the cover — it is what people see in the feed"
                              : "The last slide carries the ask"
                          }
                        >
                          {CAROUSEL_SLIDE_KIND_LABELS[slide.kind]}
                        </Badge>
                      ) : (
                        <Select
                          value={slide.kind}
                          /* Narrowed by lookup rather than cast — the same shape
                             the global image editor uses to turn a Select's value
                             back into a union member. */
                          onValueChange={(value) => {
                            changeKind(
                              index,
                              kindOptions.find(
                                (kind) => kind === String(value),
                              ) ?? slide.kind,
                            );
                          }}
                        >
                          <SelectTrigger size="sm" className="w-auto">
                            <SelectValue>
                              {CAROUSEL_SLIDE_KIND_LABELS[slide.kind]}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {kindOptions.map((kind) => (
                              <SelectItem key={kind} value={kind}>
                                {CAROUSEL_SLIDE_KIND_LABELS[kind]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {/* Kept beside the drag handle, not replaced by it: HTML5 drag
                          has no touch support and no keyboard path, so these are the
                          only way to reorder on a phone or without a mouse. */}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => applyReorder(index, index - 1)}
                        disabled={index === 0}
                        aria-label="Move slide up"
                      >
                        <ArrowUpIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => applyReorder(index, index + 1)}
                        disabled={index === slides.length - 1}
                        aria-label="Move slide down"
                      >
                        <ArrowDownIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => duplicateSlide(index)}
                        disabled={!canAdd}
                        aria-label="Duplicate slide"
                      >
                        <CopyIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSlide(index)}
                        disabled={!canDelete}
                        aria-label="Delete slide"
                      >
                        <TrashIcon className="size-4" />
                      </Button>
                    </div>
                  </div>

                  {/* What this slide is FOR, taken from the template's blueprint —
                      the same sentence the model was given when it wrote the deck.
                      Shown because a member rewriting slide four otherwise has no
                      idea it is the mechanism slide, and the editor was asking them
                      to improve copy whose job was invisible. */}
                  {blueprintSteps[index] ? (
                    <p className="text-xs text-muted-foreground">
                      {blueprintSteps[index].job}
                    </p>
                  ) : null}

                  <div className="flex flex-col gap-1">
                    <Input
                      value={slide.heading}
                      onChange={(event) =>
                        updateSlide(index, { heading: event.target.value })
                      }
                      onFocus={() => setSelectedIndex(index)}
                      placeholder="Heading"
                      className={cn(headingOver && "border-destructive")}
                    />
                    <span
                      className={cn(
                        "text-xs text-muted-foreground",
                        headingOver && "text-destructive",
                      )}
                    >
                      {slide.heading.length} / {CAROUSEL_HEADING_MAX}
                      {/* Shown only on the focused card, and only while the
                          heading has no mark yet: the syntax is worth teaching
                          once, but repeating it on twelve cards is noise. */}
                      {index === activeIndex &&
                      !slide.heading.includes(DESIGN_MARK_DELIMITER) ? (
                        <span className="ml-2">
                          Wrap words in {DESIGN_MARK_DELIMITER}like this
                          {DESIGN_MARK_DELIMITER} to highlight them
                        </span>
                      ) : null}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Textarea
                      value={slide.body}
                      onChange={(event) =>
                        updateSlide(index, { body: event.target.value })
                      }
                      onFocus={() => setSelectedIndex(index)}
                      rows={3}
                      placeholder="Body (optional)"
                      className={cn(bodyOver && "border-destructive")}
                    />
                    <span
                      className={cn(
                        "text-xs text-muted-foreground",
                        bodyOver && "text-destructive",
                      )}
                    >
                      {slide.body.length} / {CAROUSEL_BODY_MAX}
                    </span>
                  </div>

                  {/* The slots the blueprint asks the model to fill. Collapsed by
                      default because most slides use two or three of them, and five
                      always-open fields per card would bury the heading that
                      actually matters. The count on the trigger is what stops a
                      filled extra from hiding silently. */}
                  <Collapsible>
                    <CollapsibleTrigger
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "sm" }),
                        "self-start px-2 text-xs text-muted-foreground",
                      )}
                    >
                      <ChevronDownIcon className="size-3.5" />
                      Extras
                      {extrasFilled > 0 ? ` (${String(extrasFilled)})` : null}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="flex flex-col gap-3 pt-3">
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`eyebrow-${keyFor(index)}`}>
                          Eyebrow
                        </Label>
                        <Input
                          id={`eyebrow-${keyFor(index)}`}
                          value={slide.eyebrow}
                          onChange={(event) =>
                            updateSlide(index, { eyebrow: event.target.value })
                          }
                          onFocus={() => setSelectedIndex(index)}
                          placeholder="Small label above the heading"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`bullets-${keyFor(index)}`}>
                          Points — one per line
                        </Label>
                        <Textarea
                          id={`bullets-${keyFor(index)}`}
                          /* Joined and re-split rather than held as an array of
                             inputs: a flow list is reordered and reworded far more
                             often than it is appended to, and a textarea makes both
                             a single edit instead of five controls. */
                          value={slide.bullets.join("\n")}
                          onChange={(event) =>
                            updateSlide(index, {
                              bullets: event.target.value
                                .split("\n")
                                .map((line) => line.trim())
                                .filter((line) => line.length > 0)
                                .slice(0, CAROUSEL_MAX_BULLETS),
                            })
                          }
                          onFocus={() => setSelectedIndex(index)}
                          rows={3}
                          placeholder={`Up to ${String(CAROUSEL_MAX_BULLETS)} short steps`}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`callout-${keyFor(index)}`}>
                          Callout
                        </Label>
                        <Textarea
                          id={`callout-${keyFor(index)}`}
                          value={slide.callout}
                          onChange={(event) =>
                            updateSlide(index, { callout: event.target.value })
                          }
                          onFocus={() => setSelectedIndex(index)}
                          rows={2}
                          placeholder="The one line worth quoting"
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`cta-${keyFor(index)}`}>
                            Button label
                          </Label>
                          <Input
                            id={`cta-${keyFor(index)}`}
                            value={slide.ctaLabel}
                            onChange={(event) =>
                              updateSlide(index, {
                                ctaLabel: event.target.value,
                              })
                            }
                            onFocus={() => setSelectedIndex(index)}
                            placeholder="Save this"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label htmlFor={`note-${keyFor(index)}`}>Note</Label>
                          <Input
                            id={`note-${keyFor(index)}`}
                            value={slide.note}
                            onChange={(event) =>
                              updateSlide(index, { note: event.target.value })
                            }
                            onFocus={() => setSelectedIndex(index)}
                            placeholder="A short aside"
                          />
                        </div>
                      </div>

                      <SlideRewrite
                        carouselId={carouselId}
                        index={index}
                        slides={slides}
                        /* Replaces the whole slide, because the server merged the
                           new copy onto the old one — kind and illustration
                           included. Patching only the text here would duplicate
                           that merge in a second place. */
                        onRewritten={(rewritten) =>
                          onChange({
                            ...draft,
                            slides: slides.map((existing, i) =>
                              i === index ? rewritten : existing,
                            ),
                          })
                        }
                        fieldId={`rewrite-${keyFor(index)}`}
                        /* Gated like every other action in this editor. Both AI
                           controls change the DRAFT, and firing one while a save
                           is in flight leaves the request writing slides the
                           buffer has already moved past — the deck is not
                           corrupted, but it silently goes dirty again the moment
                           the save reports success. */
                        disabled={isSaving || isRendering}
                      />

                      <SlideIllustration
                        value={slide.illustration}
                        onChange={(illustration) =>
                          updateSlide(index, { illustration })
                        }
                        suggestedBrief={slide.heading}
                        fieldId={`illustration-${keyFor(index)}`}
                        disabled={isSaving || isRendering}
                      />
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            onClick={addSlide}
            disabled={!canAdd}
            className="self-start"
          >
            <PlusIcon className="size-4" />
            Add slide
          </Button>
          {!canAdd ? (
            <p className="text-xs text-muted-foreground">
              Twelve is the most LinkedIn swipes comfortably.
            </p>
          ) : null}
        </div>

        {/* Sticky because it sits beside a stack of up to twelve cards — unlike the
            studio's short form, scrolling here would otherwise leave the preview
            behind on the first slide. */}
        <div className="order-1 flex flex-col gap-4 lg:order-2 lg:sticky lg:top-6 lg:self-start">
          {activeSlide ? (
            <SlidePreview
              slide={activeSlide}
              index={activeIndex}
              total={slides.length}
              templateId={draft.templateId}
              page={draft.page}
              brand={brand}
            />
          ) : null}

          {/* The filmstrip is numbers, not thumbnails. Twelve rendered thumbnails
              would be twelve satori passes per debounce tick, and while you write a
              heading you are looking at one slide. */}
          <div className="flex flex-wrap gap-1">
            {slides.map((slide, index) => (
              <button
                key={keyFor(index)}
                type="button"
                onClick={() => setSelectedIndex(index)}
                aria-pressed={index === activeIndex}
                aria-label={`Preview slide ${String(index + 1)}`}
                className={cn(
                  buttonVariants({
                    variant: index === activeIndex ? "secondary" : "ghost",
                    size: "icon",
                  }),
                  "size-8 font-mono text-xs",
                )}
              >
                {index + 1}
              </button>
            ))}
          </div>

          <TechRule />

          <div className="flex flex-col gap-3">
            <TechLabel>Look</TechLabel>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="carousel-template">Template</Label>
              <Select
                value={draft.templateId}
                onValueChange={(value) => {
                  changeTemplate(
                    CAROUSEL_TEMPLATES.find(
                      (template) => template === String(value),
                    ) ?? draft.templateId,
                  );
                }}
              >
                <SelectTrigger id="carousel-template">
                  {/* Base UI's Select.Value renders the raw VALUE unless given
                      children — see the note in image-editor.tsx. */}
                  <SelectValue>
                    {CAROUSEL_TEMPLATE_LABELS[draft.templateId]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CAROUSEL_TEMPLATES.map((template) => (
                    <SelectItem key={template} value={template}>
                      {CAROUSEL_TEMPLATE_LABELS[template]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="carousel-shape">Shape</Label>
              <Select
                value={draft.page}
                onValueChange={(value) => {
                  changePage(
                    carouselPagePresetSchema.options.find(
                      (preset) => preset === String(value),
                    ) ?? draft.page,
                  );
                }}
              >
                <SelectTrigger id="carousel-shape">
                  <SelectValue>
                    {CAROUSEL_PAGE_PRESETS[draft.page].label}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {carouselPagePresetSchema.options.map((preset) => (
                    <SelectItem key={preset} value={preset}>
                      {CAROUSEL_PAGE_PRESETS[preset].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Changing either makes the last render stale — save, then render
                again.
              </p>
            </div>
          </div>

          {/* The two AI actions on a slide spend a slot per click, and both live
              inside a collapsed disclosure on whichever card is open. Their caps
              belong somewhere permanently visible, not next to twelve separate
              buttons — the rule the dashboard's usage panel states: a cap should
              be visible BEFORE the action, not discovered as a rejection. */}
          <TechRule />

          <div className="flex flex-col gap-3">
            <TechLabel>Remaining this period</TechLabel>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Rewrites</span>
              <UsageMeter resource="carouselSlideRewrite" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                Illustrations
              </span>
              <UsageMeter resource="carouselIllustration" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
