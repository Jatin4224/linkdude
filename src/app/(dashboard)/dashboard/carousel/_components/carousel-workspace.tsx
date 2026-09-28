/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: CarouselWorkspace, CAROUSEL_STATUS_VARIANTS
 *
 * WHAT:  The /dashboard/carousel surface — the deck list, the new-carousel
 *        dialog, and the slide editor for whichever deck is open.
 * WHY:   One route with two views rather than a list page plus a detail route:
 *        a deck is edited immediately after it is generated, and a navigation in
 *        between would throw away the draft the user is looking at.
 *
 *        The list is the global DataTable rather than another bespoke table —
 *        see the note on that component about this being the point the
 *        globalization rule applies.
 * WHERE: Rendered by the carousel page. RESOURCES.carousel.nav.href.
 */

import * as React from "react";
import { LayersIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";

import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import {
  CAROUSEL_PAGE_PRESETS,
  carouselPagePresetSchema,
  carouselTemplateSchema,
  type CarouselDraftValues,
  type CarouselStatus,
  type GenerateCarouselValues,
} from "@/lib/types";
import { ContentLayout } from "@/components/global/page-header";
import { DataTable, type DataTableColumn } from "@/components/global/data-table";
import { TechButton, TechSurface } from "@/components/global/tech";
import { FeatureGate } from "@/components/feature-gate";
import { UsageMeter } from "@/components/global/usage-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CarouselForm } from "./carousel-form";
import { SlideEditor } from "./slide-editor";
import { PublishDialog } from "./publish-dialog";
import type { CarouselListRow } from "./carousel-types";

const PAGE_SIZE = 10;

/* Status is a bare String on the row; this map is what turns it into a chip
 * without a component branching on string literals inline. */
const CAROUSEL_STATUS_VARIANTS: Record<
  CarouselStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "secondary",
  rendering: "outline",
  ready: "default",
  failed: "destructive",
};


export function CarouselWorkspace() {
  const organizationId = useActiveOrganizationId();
  const utils = trpc.useUtils();

  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [isPublishOpen, setIsPublishOpen] = React.useState(false);

  /* The editing buffer. Held here rather than inside SlideEditor so switching decks
   * cannot carry one deck's unsaved edits into another.
   *
   * It carries the LOOK as well as the slides. When it was the slide array alone,
   * `isDirty` could not see a template change: Save stayed disabled while Render
   * stayed enabled, so one click produced a PDF of the old template. */
  const [draft, setDraft] = React.useState<CarouselDraftValues | null>(null);

  const enabled = organizationId !== undefined;
  const orgInput = { organizationId: organizationId ?? "" };

  const listQuery = trpc.carousel.list.useQuery(
    {
      ...orgInput,
      page,
      pageSize: PAGE_SIZE,
      /* Conditional spread: exactOptionalPropertyTypes rejects an explicit
         undefined against the schema's optional `search`. */
      ...(search.trim() ? { search: search.trim() } : {}),
    },
    { enabled, retry: false },
  );

  const openQuery = trpc.carousel.get.useQuery(
    { ...orgInput, id: openId ?? "" },
    { enabled: enabled && openId !== null, retry: false },
  );

  /* Reset the buffer when a DIFFERENT deck loads. Adjusted during render rather
   * than in an effect: an effect would paint one frame of the previous deck's
   * slides under the new deck's header, and React's own guidance (and this
   * project's lint rule) is to derive from a previous-value marker instead.
   *
   * Comparing ids, not data identity, is what makes re-fetching the SAME deck
   * after a save leave the buffer alone — otherwise every save would discard
   * edits made while the request was in flight. */
  const [syncedId, setSyncedId] = React.useState<string | null>(null);
  if (openQuery.data && openQuery.data.id !== syncedId) {
    setSyncedId(openQuery.data.id);
    setDraft({
      /* No cast: carousel.get returns slides already parsed into CarouselSlides. */
      slides: openQuery.data.slides,
      /* templateId and pagePreset ARE bare Prisma Strings, so they are parsed with a
       * fallback rather than asserted. This is the client-side twin of the
       * never-throw contract getCarouselPalette documents: a row written by an older
       * vocabulary opens in the default look, where a cast would put an unknown
       * string into a <Select value> and render an empty trigger. */
      templateId: carouselTemplateSchema
        .catch("minimal")
        .parse(openQuery.data.templateId),
      page: carouselPagePresetSchema
        .catch("portrait")
        .parse(openQuery.data.pagePreset),
    });
  }

  /* Returns the promise rather than firing and forgetting. A mutation's onSuccess
   * that AWAITS this keeps `isPending` true until fresh data has landed, which is
   * what closes the window where the Download button still points at the file the
   * render just superseded — that URL is already deleted from ImageKit, so a
   * click in that window 404s. */
  async function invalidate() {
    await Promise.all([
      utils.carousel.list.invalidate(),
      openId
        ? utils.carousel.get.invalidate({ ...orgInput, id: openId })
        : Promise.resolve(),
    ]);
  }

  const createMutation = trpc.carousel.create.useMutation({
    onSuccess: async (carousel) => {
      setIsCreateOpen(false);
      setOpenId(carousel.id);
      await invalidate();
      toast.success("Carousel drafted. Edit the slides, then render.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const updateMutation = trpc.carousel.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Slides saved.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const renderMutation = trpc.carousel.render.useMutation({
    /* Awaited, not fired-and-forgotten: the previous PDF has already been deleted
     * from ImageKit by the time this resolves, so showing "rendered" before the
     * refetch lands would leave a Download button pointing at a dead file. */
    onSuccess: async () => {
      await invalidate();
      toast.success("PDF rendered.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const discardMutation = trpc.carousel.discard.useMutation({
    onSuccess: async (result) => {
      if (openId === result.id) setOpenId(null);
      await invalidate();
      toast.success("Carousel discarded. Its PDF is still in Documents.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!organizationId) return null;

  const rows = listQuery.data?.items ?? [];

  const columns: ReadonlyArray<DataTableColumn<CarouselListRow>> = [
    {
      id: "topic",
      header: "Deck",
      /* The document's title first, the topic only as a fallback. A topic is the
       * PROMPT the author typed, so a list of topics reads like a list of
       * instructions; once a deck has rendered it has a real public name. */
      render: (row) => (
        <div className="flex flex-col">
          <span className="line-clamp-1 font-medium">
            {row.document?.title ?? row.topic}
          </span>
          {row.document?.title ? (
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {row.topic}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "shape",
      header: "Shape",
      render: (row) =>
        CAROUSEL_PAGE_PRESETS[
          row.pagePreset as keyof typeof CAROUSEL_PAGE_PRESETS
        ]?.label ?? row.pagePreset,
      className: "text-muted-foreground",
    },
    {
      id: "status",
      header: "Status",
      render: (row) => (
        <Badge
          variant={
            CAROUSEL_STATUS_VARIANTS[row.status as CarouselStatus] ?? "secondary"
          }
          className="capitalize"
        >
          {row.status}
        </Badge>
      ),
    },
    {
      id: "updated",
      header: "Updated",
      align: "end",
      render: (row) => new Date(row.updatedAt).toLocaleDateString(),
      className: "text-muted-foreground",
    },
  ];

  const openCarousel = openQuery.data;

  /* Compared against the loaded row, not tracked with a flag: a flag drifts the
   * moment a save resolves, and "dirty" must mean the buffer differs from what is
   * stored — that is what makes Render safe to gate on.
   *
   * ONE comparison over the whole draft, so a template or shape change is dirty
   * too. Comparing only slides is what previously left Save disabled and Render
   * enabled after switching template. */
  const isDirty =
    draft !== null &&
    openCarousel !== undefined &&
    JSON.stringify(draft) !==
      JSON.stringify({
        slides: openCarousel.slides,
        templateId: openCarousel.templateId,
        page: openCarousel.pagePreset,
      });

  return (
    <ContentLayout
      title="Carousel"
      description="Draft a multi-slide deck, edit it, render it to PDF"
      icon={<LayersIcon className="size-4" />}
      actions={
        openId ? (
          <Button variant="outline" size="sm" onClick={() => setOpenId(null)}>
            Back to all
          </Button>
        ) : (
          /* The meter sits beside the button that spends it, which is the whole
             point of the component: a cap should be visible BEFORE the action
             rather than discovered as a rejection. Studio does the same. */
          <div className="flex items-center gap-4">
            <UsageMeter resource="carousel" className="w-40" />
            <FeatureGate resource="carousel">
              <TechButton size="sm" onClick={() => setIsCreateOpen(true)}>
                <PlusIcon className="size-4" />
                New carousel
              </TechButton>
            </FeatureGate>
          </div>
        )
      }
    >
      {/* The editor and the list are the SAME sheet of paper. Two views of one
          feature, one wearing the treatment and one not, reads as an unfinished
          port rather than as a design — the same reason studio scopes both. */}
      <TechSurface>
      {openId && openCarousel && draft ? (
        <SlideEditor
          /* Keyed by deck: one attribute resets selection, drag state, card keys and
             the live region at exactly the boundary where syncedId resets the
             buffer. Without it those survive a deck switch. */
          key={openId}
          carouselId={openId}
          draft={draft}
          onChange={setDraft}
          onSave={() =>
            updateMutation.mutate({
              ...orgInput,
              id: openId,
              slides: draft.slides,
              /* The look travels with the save. updateCarouselSchema and
                 updateCarouselRecord already accepted both — nothing was sending
                 them, which is why the editor could not change either. */
              templateId: draft.templateId,
              page: draft.page,
            })
          }
          onRender={() => renderMutation.mutate({ ...orgInput, id: openId })}
          isSaving={updateMutation.isPending}
          isRendering={renderMutation.isPending}
          isDirty={isDirty}
          status={openCarousel.status}
          deckTitle={openCarousel.document?.title ?? openCarousel.topic}
          documentUrl={openCarousel.document?.url}
          documentFileName={openCarousel.document?.fileName}
          documentId={openCarousel.document?.id}
          lastError={openCarousel.lastError}
          onPublish={() => setIsPublishOpen(true)}
        />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          isLoading={listQuery.isLoading}
          error={
            listQuery.error ? "Carousels couldn’t be loaded." : undefined
          }
          empty="No carousels yet. Generate your first one."
          search={{
            value: search,
            /* Page 1 on every new term: staying on page three of a result set that
               now has one page renders an empty table. Same reason the post library
               resets here. */
            onChange: (value) => {
              setSearch(value);
              setPage(1);
            },
            placeholder: "Search by topic…",
          }}
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total: listQuery.data?.total ?? 0,
            onPageChange: setPage,
          }}
          onRowClick={(row) => setOpenId(row.id)}
          rowActions={(row) => (
            <Button
              variant="ghost"
              size="sm"
              disabled={discardMutation.isPending}
              onClick={() =>
                discardMutation.mutate({ ...orgInput, id: row.id })
              }
            >
              Discard
            </Button>
          )}
        />
      )}
      </TechSurface>

      {openCarousel?.document ? (
        <PublishDialog
          open={isPublishOpen}
          onOpenChange={setIsPublishOpen}
          documentId={openCarousel.document.id}
          /* Seeded from the cover slide's heading — the deck's own promise is a
           * better starting point for the commentary than a blank box. */
          defaultCommentary={openCarousel.slides[0]?.heading}
          onPublished={() => void invalidate()}
        />
      ) : null}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        {/* Scoped at its own root: a dialog is PORTALED to the body, so it is
            not a descendant of the surface above and would otherwise open as a
            rounded panel over a square page. */}
        <DialogContent className="tech-scope sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New carousel</DialogTitle>
            <DialogDescription>
              Describe the idea. You’ll be able to edit every slide before
              rendering.
            </DialogDescription>
          </DialogHeader>
          <CarouselForm
            onGenerate={(values: GenerateCarouselValues) =>
              createMutation.mutate({ ...values, ...orgInput })
            }
            isGenerating={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>
    </ContentLayout>
  );
}
