"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: ExportPanel, ExportPanelProps, download all, zip,
 *   where to paste it
 *
 * WHAT:  The last step — every finished asset in one zip, and instructions for
 *        where each file goes on LinkedIn.
 * WHY:   The zip is built IN THE BROWSER. Each file already sits on ImageKit
 *        behind a public delivery URL, so fetching and zipping client-side costs
 *        the server nothing and keeps multi-megabyte payloads off it entirely.
 *
 *        Only assets whose status is "ready" are included, for the same reason
 *        the per-asset Download button is gated: an exported file that predates
 *        the current design is a file that disagrees with what the member
 *        approved, and bundling one into a zip hides the disagreement instead of
 *        surfacing it.
 *
 *        "Where to paste it" is not filler. A folder of correctly-sized PNGs is
 *        only useful if someone knows which LinkedIn field each belongs in, and
 *        that is the step where a profile kit usually dies.
 * WHERE: The studio editor, below the asset switcher.
 */

import * as React from "react";
import { toast } from "sonner";

import { STUDIO_ASSET_KIND_LABELS, type StudioAssetKind } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { TechButton, TechLabel, TechRule } from "@/components/global/tech";

export interface ExportPanelAsset {
  id: string;
  kind: string;
  status: string;
  document: { url: string; fileName: string } | null;
}

export interface ExportPanelProps {
  projectName: string;
  assets: readonly ExportPanelAsset[];
  disabled?: boolean;
}

/* Where each file goes, keyed by the asset kind so a new kind cannot be added
 * without someone deciding what to tell the member about it. */
const PASTE_STEPS: Record<StudioAssetKind, string> = {
  banner: "Profile → pencil icon on the cover → Upload a new image",
  headshot: "Profile → click your photo → Add photo",
  featuredCover: "Profile → Add section → Featured → Add a link or media",
  companyBanner: "Company page → Edit page → Cover image",
};

export function ExportPanel({
  projectName,
  assets,
  disabled = false,
}: ExportPanelProps) {
  const [isZipping, setIsZipping] = React.useState(false);

  const ready = assets.filter(
    (asset): asset is ExportPanelAsset & { document: { url: string; fileName: string } } =>
      asset.status === "ready" && asset.document !== null,
  );

  async function downloadAll() {
    if (ready.length === 0) return;
    setIsZipping(true);

    try {
      /* Imported on demand, not at module scope: jszip is the largest dependency
       * this route has and nobody who never presses this button should pay for
       * it on first paint. */
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();

      /* Sequential rather than Promise.all — three small fetches, and a burst of
       * parallel CDN requests is a worse neighbour for no measurable gain. */
      for (const asset of ready) {
        const response = await fetch(asset.document.url);
        if (!response.ok) {
          throw new Error(`Could not fetch ${asset.document.fileName}`);
        }
        zip.file(asset.document.fileName, await response.blob());
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);

      const link = window.document.createElement("a");
      link.href = url;
      link.download = `${projectName.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "profile"}-kit.zip`;
      link.click();

      /* Released immediately: the click has already handed the blob to the
       * browser's download manager, and holding the URL only keeps the bytes in
       * memory. */
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "That download could not be built",
      );
    } finally {
      setIsZipping(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <TechRule />

      <div className="flex items-center justify-between">
        <Label>Export</Label>
        <span className="text-xs text-muted-foreground">
          {ready.length} of {assets.length} ready
        </span>
      </div>

      <TechButton
        size="sm"
        className="self-start"
        disabled={disabled || isZipping || ready.length === 0}
        onClick={() => {
          void downloadAll();
        }}
      >
        {isZipping ? "Building zip…" : `Download all (${String(ready.length)})`}
      </TechButton>

      {ready.length < assets.length ? (
        <p className="text-xs text-muted-foreground">
          Only exported designs are included. Export the rest to add them.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 pt-1">
        <TechLabel>Where to paste it</TechLabel>
        <ol className="flex flex-col gap-1.5">
          {assets.map((asset) => (
            <li key={asset.id} className="text-xs text-muted-foreground">
              <span className="text-foreground">
                {STUDIO_ASSET_KIND_LABELS[asset.kind as StudioAssetKind] ?? asset.kind}
              </span>
              {" — "}
              {PASTE_STEPS[asset.kind as StudioAssetKind] ?? "Upload to your profile"}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
