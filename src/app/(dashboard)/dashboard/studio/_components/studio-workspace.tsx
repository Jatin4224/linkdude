"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: StudioWorkspace, studio gallery, studio editor,
 *   draft buffer, isDirty
 *
 * WHAT:  The /dashboard/studio route — pick a style, edit the words, preview,
 *        export, download.
 * WHY:   ONE route with two views switched by state, not a list route plus a
 *        detail route. That is the shape carousel-workspace proves: navigating
 *        away and back would throw out the unsaved draft the member is looking
 *        at, which on a design surface is the most expensive thing to lose.
 *
 *        The draft lives in THIS component, keyed by asset id, rather than inside
 *        the editor — so switching designs cannot carry one design's unsaved
 *        edits into another. `isDirty` is DERIVED from it rather than tracked as
 *        a flag, because a flag and the data it describes drift apart.
 * WHERE: Rendered by the studio page. RESOURCES.studio.nav.href.
 */

import * as React from "react";
import { LayoutTemplateIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";
import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import {
  buildAttachmentUrl,
  designContentIssues,
  getDesignPalette,
  getStudioTemplate,
  isLayoutOutdated,
  refreshDesignLayout,
  STUDIO_PREVIEW_PATH,
  STUDIO_TEMPLATE_ENTRIES,
} from "@/lib/config";
import {
  STUDIO_ASSET_KIND_LABELS,
  type DesignDoc,
  type DesignTextSlotKey,
  type StudioAssetKind,
} from "@/lib/types";
import { ContentLayout } from "@/components/global/page-header";
import { UsageMeter } from "@/components/global/usage-meter";
import {
  PaperSection,
  SketchAnnotation,
  SketchDefs,
  SketchHeading,
} from "@/components/global/sketch";
import { Reveal } from "@/components/global/reveal";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { BackdropControl } from "./backdrop-control";
import { BlockStylePanel } from "./block-style-panel";
import { ThemePanel } from "./theme-panel";
import { DesignContentForm } from "./design-content-form";
import { ExportPanel } from "./export-panel";
import { StyleCard } from "./style-card";
import { PhotoControl } from "./photo-control";
import { ProfileTextPanel } from "./profile-text-panel";
import { DesignPreview } from "./design-preview";

export function StudioWorkspace() {
  const organizationId = useActiveOrganizationId();
  const utils = trpc.useUtils();

  const [openId, setOpenId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<DesignDoc | null>(null);
  const [syncedAssetId, setSyncedAssetId] = React.useState<string | null>(null);
  /* A profile is several assets, so the editor has to know WHICH one is open.
   * Falls back to the first rather than to null — an editor with nothing
   * selected is a blank screen nobody asked for. */
  const [openAssetId, setOpenAssetId] = React.useState<string | null>(null);
  /* WHICH card is creating, not just THAT one is. A shared isPending greyed out
   * all four buttons at once, which read as "every style is selected". */
  const [pendingTemplate, setPendingTemplate] = React.useState<string | null>(null);

  const enabled = organizationId !== undefined;
  const orgInput = { organizationId: organizationId ?? "" };

  const listQuery = trpc.studio.list.useQuery(orgInput, { enabled });
  const openQuery = trpc.studio.get.useQuery(
    { ...orgInput, id: openId ?? "" },
    { enabled: enabled && openId !== null },
  );

  const project = openQuery.data;
  const asset =
    project?.assets.find((row) => row.id === openAssetId) ?? project?.assets[0];

  /* Seeded during render rather than in an effect — the project rule. An effect
   * would paint one frame of the previous design before correcting itself. */
  if (asset && asset.id !== syncedAssetId) {
    setSyncedAssetId(asset.id);
    setDraft(asset.doc);
  }

  /* What the server would reject, computed from the SAME function its schema
   * runs. Checking here rather than letting the save fail means a member is told
   * which field to shorten before pressing anything, instead of receiving the
   * validator's raw issue list in a toast after it. */
  const contentIssues = draft ? designContentIssues(draft.content) : [];

  /* Whether this design predates a change to its template. Designs are cloned on
   * create and deliberately never rewritten, so a fixed or improved layout can
   * only reach an existing design when its owner asks for it. */
  const archetypeId = project ? getStudioTemplate(project.templateId).archetype : null;
  const layoutOutdated =
    draft !== null && archetypeId !== null && isLayoutOutdated(draft, archetypeId);

  const isDirty =
    draft !== null && asset !== undefined && JSON.stringify(draft) !== JSON.stringify(asset.doc);

  /* Returns the promise so a mutation's onSuccess can AWAIT it. Without that,
   * `isPending` drops before fresh data lands and Download briefly points at the
   * file that was just superseded. */
  async function invalidate() {
    await Promise.all([
      utils.studio.list.invalidate(),
      openId ? utils.studio.get.invalidate({ ...orgInput, id: openId }) : Promise.resolve(),
    ]);
  }

  const createMutation = trpc.studio.create.useMutation({
    onSuccess: async (created) => {
      await invalidate();
      setPendingTemplate(null);
      setOpenId(created.id);
      toast.success("Profile started. Edit the words, then export.");
    },
    onError: (error) => {
      setPendingTemplate(null);
      toast.error(getErrorMessage(error));
    },
  });

  const updateMutation = trpc.studio.update.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Design saved.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  /* Reuses the existing signer rather than adding a studio-specific one: these
   * credentials are short-lived and scoped to the ImageKit account rather than
   * to a feature, so a second procedure would be the same code under a new
   * name.
   *
   * staleTime and gcTime are BOTH zero, copied from the composer and for the
   * reason stated there: ImageKit burns an upload token on first use, so a
   * cached credential would replay a spent token and fail at the vendor. */
  async function fetchUploadAuth() {
    return utils.linkedinPosts.uploadAuth.fetch(
      { organizationId: organizationId ?? "" },
      { staleTime: 0, gcTime: 0 },
    );
  }

  const backdropMutation = trpc.studioBackdrop.create.useMutation({
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const profileMutation = trpc.studio.updateProfile.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Text saved. Paste it straight into LinkedIn.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const renderMutation = trpc.studio.render.useMutation({
    onSuccess: async () => {
      await invalidate();
      toast.success("Exported. Download it and paste it into LinkedIn.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const discardMutation = trpc.studio.discard.useMutation({
    onSuccess: async () => {
      await invalidate();
      /* Clear the editor too: discarding the project you are looking at must not
       * leave its draft on screen pointing at a row that is gone. */
      setOpenId(null);
      setDraft(null);
      setSyncedAssetId(null);
      setOpenAssetId(null);
      toast.success("Profile discarded. Anything you already exported is still in Documents.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  /* Posts to a ROUTE HANDLER, not a tRPC procedure. Every tRPC mutation opens a
   * Prisma transaction, and a debounced render held a pooled connection long
   * enough to starve Better Auth of one — which signed the member out mid-edit.
   * See src/app/api/studio/preview/route.ts.
   *
   * Stable identity, so DesignPreview's debounce effect is not re-armed on every
   * parent render — which would mean it never actually fired. */
  const renderPreview = React.useCallback(
    async (doc: DesignDoc, signal: AbortSignal) => {
      const response = await fetch(STUDIO_PREVIEW_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
        /* Superseded renders are dropped at the network layer rather than
         * resolved and thrown away, so a burst of typing cannot queue up work
         * nobody will see. */
        signal,
      });

      if (!response.ok) {
        throw new Error(
          response.status === 401
            ? "Signed out — reload the page"
            : "That design could not be drawn",
        );
      }

      /* An object URL, not a base64 data URI: the bytes arrive as a blob, and
       * re-encoding them would add a third again to something rebuilt on every
       * keystroke. DesignPreview owns revoking it. */
      const blob = await response.blob();
      return { dataUrl: URL.createObjectURL(blob) };
    },
    [],
  );

  if (!organizationId) return null;

  // -------------------------------------------------------------------------
  // Editor
  // -------------------------------------------------------------------------
  if (openId && project && asset && draft) {
    const document = asset.document;

    return (
      <ContentLayout
        title={project.name}
        description="Edit the words, preview, then export a PNG to paste into LinkedIn."
        icon={<LayoutTemplateIcon className="size-5" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setOpenId(null);
              setDraft(null);
              setSyncedAssetId(null);
              setOpenAssetId(null);
            }}
          >
            Back to all
          </Button>
        }
      >
        {/* The editor is the same sheet of paper as the gallery. Two surfaces
            in one feature, one wearing the treatment and one not, reads as an
            unfinished port rather than as a design. */}
        <div className="paper-scope sketch-scope sketch-paper relative -m-4 flex flex-col gap-6 p-6 md:-m-6 md:p-10">
          <SketchDefs />

          {/* PREVIEW FIRST on narrow screens, controls first on wide. The design
              is what someone came to look at, and on a phone a column of form
              fields above it means scrolling past the work to reach the work. */}
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
          <div className="order-2 flex flex-col gap-4 lg:order-1">
              {/* One row per asset in the kit. A segmented control rather than a
                  wizard: the assets are independent, so imposing an order would
                  stop someone fixing their banner without first walking past a
                  headshot they already finished. */}
              {project.assets.length > 1 ? (
                <div className="flex flex-wrap gap-1.5">
                  {project.assets.map((row) => {
                    const isOpen = row.id === asset.id;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        aria-pressed={isOpen}
                        onClick={() => {
                          setOpenAssetId(row.id);
                        }}
                        className={cn(
                          "rounded-md border px-3 py-1 text-xs transition-colors",
                          isOpen
                            ? "border-brand-border bg-brand-soft text-brand-soft-foreground"
                            : "bg-muted/40 hover:bg-muted",
                        )}
                      >
                        {STUDIO_ASSET_KIND_LABELS[row.kind as StudioAssetKind] ?? row.kind}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {layoutOutdated && archetypeId ? (
                /* An OFFER, never an automatic migration: the refreshed layout
                   lands in the draft, the preview shows it, and nothing is saved
                   until they choose to. Declining costs nothing. */
                <div className="flex flex-col gap-2 rounded-md border border-dashed border-[color:var(--sketch-hair)] p-3">
                  <p className="text-xs text-muted-foreground">
                    This style has been improved since you made this design. Update
                    the layout and keep your words, colours and photos.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="self-start"
                    onClick={() => {
                      setDraft(refreshDesignLayout(draft, archetypeId));
                    }}
                  >
                    Update layout
                  </Button>
                </div>
              ) : null}

              {/* Three tabs rather than one long column: the reference editors
                  all split content from styling, and a member changing a colour
                  should not have to scroll past every text field to reach it. */}
              <Tabs defaultValue="content">
                <TabsList className="w-full">
                  <TabsTrigger value="content" className="flex-1">
                    Content
                  </TabsTrigger>
                  <TabsTrigger value="style" className="flex-1">
                    Style
                  </TabsTrigger>
                  <TabsTrigger value="theme" className="flex-1">
                    Theme
                  </TabsTrigger>
                  <TabsTrigger value="text" className="flex-1">
                    Text
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="content" className="pt-4">
                  <DesignContentForm
                    blocks={draft.blocks}
                    content={draft.content}
                    disabled={updateMutation.isPending || renderMutation.isPending}
                    onChange={(content: Partial<Record<DesignTextSlotKey, string>>) => {
                      setDraft({ ...draft, content });
                    }}
                  />

                  {/* Only where the layout actually reads a photo. Offering an
                      upload on a design that would ignore it is a promise the
                      renderer does not keep. */}
                  {draft.blocks.some(
                    (block) => block.type === "image" && block.slot === "photo",
                  ) ? (
                    <div className="pt-4">
                      <PhotoControl
                        doc={draft}
                        onChange={setDraft}
                        getAuthParams={fetchUploadAuth}
                        disabled={updateMutation.isPending || renderMutation.isPending}
                      />
                    </div>
                  ) : null}
                </TabsContent>

                <TabsContent value="style" className="pt-4">
                  <BlockStylePanel
                    doc={draft}
                    onChange={setDraft}
                    disabled={updateMutation.isPending || renderMutation.isPending}
                  />
                </TabsContent>

                <TabsContent value="theme" className="flex flex-col gap-4 pt-4">
                  <ThemePanel
                    doc={draft}
                    onChange={setDraft}
                    disabled={updateMutation.isPending || renderMutation.isPending}
                  />

                  <BackdropControl
                    doc={draft}
                    onChange={setDraft}
                    disabled={updateMutation.isPending || renderMutation.isPending}
                    onGenerate={async (brief) =>
                      backdropMutation.mutateAsync({ ...orgInput, brief })
                    }
                  />
                </TabsContent>

                <TabsContent value="text" className="pt-4">
                  {/* Not a design. These are the words pasted into LinkedIn
                      itself, so they save on their own mutation and leave the
                      exported images alone. */}
                  <ProfileTextPanel
                    headline={project.headline ?? ""}
                    about={project.about ?? ""}
                    isSaving={profileMutation.isPending}
                    disabled={renderMutation.isPending}
                    onSave={(values) => {
                      profileMutation.mutate({
                        ...orgInput,
                        id: project.id,
                        headline: values.headline,
                        about: values.about,
                      });
                    }}
                  />
                </TabsContent>
              </Tabs>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={
                    !isDirty || updateMutation.isPending || contentIssues.length > 0
                  }
                  onClick={() => {
                    updateMutation.mutate({
                      ...orgInput,
                      id: project.id,
                      assetId: asset.id,
                      doc: draft,
                      content: draft.content,
                    });
                  }}
                >
                  {updateMutation.isPending ? "Saving…" : "Save"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  /* Exporting an unsaved draft would produce a file that does not
                   * match the row — save first, deliberately. */
                  disabled={isDirty || renderMutation.isPending}
                  onClick={() => {
                    renderMutation.mutate({
                      ...orgInput,
                      id: project.id,
                      assetId: asset.id,
                    });
                  }}
                >
                  {renderMutation.isPending ? "Exporting…" : "Export PNG"}
                </Button>

                {/* Offered ONLY while the stored design and the exported file
                    still agree. `status` drops back to "draft" on every save and
                    returns to "ready" only on a successful export, so this is the
                    one honest signal that the file on ImageKit is the design the
                    member is looking at.
                    
                    Without this the button happily served the PREVIOUS export —
                    someone edited, saved, downloaded, and got their old banner
                    back with no indication anything was wrong. A download that
                    silently disagrees with the preview is the single worst thing
                    this tool can do, and it was doing it. */}
                {document && asset.status === "ready" ? (
                  <a
                    /* ik-attachment, because an `<a download>` attribute is
                     * IGNORED on a cross-origin link. buttonVariants rather than
                     * `<Button asChild>` — this Button has no asChild slot. */
                    href={buildAttachmentUrl(document.url)}
                    aria-label={`Download ${document.fileName}`}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                  >
                    Download
                  </a>
                ) : null}
              </div>

              {contentIssues.length > 0 ? (
                /* Named fields, in plain words — not the validator's issue list.
                   A member needs to know WHICH box to shorten and by how much. */
                <p className="text-xs text-destructive">
                  Shorten{" "}
                  {contentIssues
                    .map(
                      (issue) =>
                        `${issue.label} (${String(issue.length)}/${String(issue.maxChars)})`,
                    )
                    .join(", ")}{" "}
                  to save.
                </p>
              ) : null}

              {document && asset.status !== "ready" ? (
                <p className="text-xs text-muted-foreground">
                  This design has changed since it was last exported. Export again
                  to download the version you can see.
                </p>
              ) : null}

              {asset.lastError ? (
                <p className="text-xs text-destructive">{asset.lastError}</p>
              ) : null}

              <ExportPanel
                projectName={project.name}
                assets={project.assets}
                disabled={renderMutation.isPending}
              />
          </div>

          {/* Its own scope: the preview renders beside the panel rather than
              inside it, so the hand-drawn font and grain have to reach it here. */}
          <div className="order-1 flex flex-col gap-3 lg:order-2">
            <DesignPreview doc={draft} onRender={renderPreview} />
          </div>
          </div>
        </div>
      </ContentLayout>
    );
  }

  // -------------------------------------------------------------------------
  // Gallery + projects
  // -------------------------------------------------------------------------
  return (
    <ContentLayout
      title="Studio"
      description="Build the images your LinkedIn profile needs — pick a style, add your words, download."
      icon={<LayoutTemplateIcon className="size-5" />}
      actions={<UsageMeter resource="studio" className="w-48" />}
    >
      {/* The hand-drawn treatment lives under this one class, so it cannot leak
          into any other route. See .sketch-scope in globals.css. */}
      {/* paper-scope remaps every token to the warm ground; sketch-scope adds
          the handwriting, the marker accent and the drawn marks. Both are
          scoped here so neither can reach another route. */}
      <div className="paper-scope sketch-scope sketch-paper relative -m-4 flex flex-col gap-10 p-6 md:-m-6 md:p-10">
        {/* One filter definition for every drawn mark on the page. */}
        <SketchDefs />

        {/* ONE annotation for the page. The brief's ceiling is a couple of
            marks per section, and a note beside every heading stops guiding
            attention and starts competing for it. */}
        <SketchAnnotation direction="downLeft" className="absolute right-6 top-5 hidden lg:flex">
          small changes, big lift
        </SketchAnnotation>

        {/* The hero lives ON the paper. The app's own header sits above in dark
            chrome and says "Studio"; repeating it here would be two titles for
            one page. This one says what the page is FOR. */}
        <header className="flex max-w-xl flex-col gap-2">
          <SketchHeading as="h1" underline="profile" className="text-4xl sm:text-5xl">
            Design your profile
          </SketchHeading>
          <p className="text-sm text-muted-foreground">
            Pick a style, swap in your words, and export images that are already
            the right size for LinkedIn.
          </p>
        </header>
        <PaperSection
          title="Your profiles"
          description="Each one is a full kit — banner, headshot and featured cover."
        >

          {listQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : listQuery.data && listQuery.data.items.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listQuery.data.items.map((row) => (
                <Card
                  key={row.id}
                  className="sketch-sheet relative cursor-pointer border-0"
                  onClick={() => {
                    setOpenId(row.id);
                  }}
                >
                  <CardContent className="flex flex-col gap-2 pt-6">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-sketch text-xl leading-none">{row.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Discard ${row.name}`}
                        disabled={discardMutation.isPending}
                        onClick={(event) => {
                          /* The whole card is the open affordance, so the delete
                           * inside it must not also open what it is deleting. */
                          event.stopPropagation();
                          discardMutation.mutate({ ...orgInput, id: row.id });
                        }}
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {row.assets.map((item) => (
                        <Badge
                          key={item.id}
                          variant={item.status === "ready" ? "default" : "outline"}
                        >
                          {STUDIO_ASSET_KIND_LABELS[item.kind as StudioAssetKind] ??
                            item.kind}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            /* Dashed, matching the safe-zone language used throughout the
               editor — an empty slot rather than an error. */
            <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-[color:var(--sketch-hair)] px-4 py-12 text-center">
              <span className="font-sketch text-2xl leading-none">A blank page</span>
              <span className="text-xs text-muted-foreground">
                Pick a style below. You&apos;ll have a banner in about a minute.
              </span>
            </div>
          )}
        </PaperSection>

        <PaperSection
          title="Pick a style"
          underline="style"
          description="Every one is sized for LinkedIn and keeps your text clear of your profile photo. The dashed circle shows where your face lands."
        >

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {STUDIO_TEMPLATE_ENTRIES.map(([key, template], index) => (
              /* Staggered so twelve cards arrive as a wave rather than a slab.
                 Reveal degrades to visible on its own if the observer never
                 fires, so a card can't get stuck hidden. */
              <Reveal key={key} delay={index * 55}>
                <StyleCard
                  template={template}
                  palette={getDesignPalette(template.palette)}
                  isPending={pendingTemplate === key}
                  disabled={pendingTemplate !== null}
                  onUse={() => {
                    setPendingTemplate(key);
                    createMutation.mutate({
                      ...orgInput,
                      name: template.label,
                      templateId: key,
                    });
                  }}
                />
              </Reveal>
            ))}
          </div>
        </PaperSection>
      </div>
    </ContentLayout>
  );
}
