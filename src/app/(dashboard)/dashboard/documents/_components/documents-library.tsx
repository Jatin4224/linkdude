/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: DocumentsLibrary, formatBytes
 *
 * WHAT:  The /dashboard/documents surface — every file this workspace has
 *        generated, with download and delete.
 * WHY:   Read-only apart from delete, because nothing creates a Document here:
 *        files arrive from carousel.render. That is why the registry entry has no
 *        `create` verb and no quota — see the note on the documents router.
 *
 *        Uses the global DataTable, the same component the carousel list uses, so
 *        the two pages cannot drift into different pagination or empty-state
 *        behaviour.
 * WHERE: Rendered by the documents page. RESOURCES.documents.nav.href.
 */

import * as React from "react";
import { DownloadIcon, FileTextIcon } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";

import { trpc } from "@/trpc/react-provider";
import { useActiveOrganizationId } from "@/hooks/use-active-organization";
import { ContentLayout } from "@/components/global/page-header";
import { DataTable, type DataTableColumn } from "@/components/global/data-table";
import { buildAttachmentUrl } from "@/lib/config";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DocumentListRow } from "./document-types";

const PAGE_SIZE = 20;

/**
 * SOURCE OF TRUTH KEYWORDS: formatBytes
 *
 * WHAT:  Byte count as a human size.
 * WHY:   Base 1024 with one decimal — the convention a file manager uses, so the
 *        number matches what the user sees after downloading.
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function DocumentsLibrary() {
  const organizationId = useActiveOrganizationId();
  const utils = trpc.useUtils();

  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");

  const enabled = organizationId !== undefined;
  const orgInput = { organizationId: organizationId ?? "" };

  const listQuery = trpc.documents.list.useQuery(
    { ...orgInput, page, pageSize: PAGE_SIZE },
    { enabled, retry: false },
  );

  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      void utils.documents.list.invalidate();
      /* Deleting a file can orphan a deck's download button, so the carousel
       * list is refreshed too rather than left showing a stale Ready state. */
      void utils.carousel.list.invalidate();
      toast.success("Document deleted.");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!organizationId) return null;

  const rows = listQuery.data?.items ?? [];
  const visibleRows = search
    ? rows.filter((row) =>
        row.fileName.toLowerCase().includes(search.toLowerCase()),
      )
    : rows;

  const columns: ReadonlyArray<DataTableColumn<DocumentListRow>> = [
    {
      id: "name",
      header: "File",
      render: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
          {/* The human title, falling back to the slug for rows written before
              the column existed — the same name LinkedIn shows on the post. */}
          <span className="truncate font-medium">
            {row.title ?? row.fileName}
          </span>
        </div>
      ),
    },
    {
      id: "source",
      header: "From",
      render: (row) => (
        <span className="line-clamp-1 text-muted-foreground">
          {/* The backlink is nulled when a deck is discarded — the file
              deliberately outlives it, so this has to read as normal rather
              than as missing data. */}
          {row.carousel?.topic ?? "—"}
        </span>
      ),
    },
    {
      id: "pages",
      header: "Pages",
      align: "end",
      render: (row) => row.pageCount,
      className: "text-muted-foreground",
    },
    {
      id: "size",
      header: "Size",
      align: "end",
      render: (row) => formatBytes(row.byteSize),
      className: "text-muted-foreground",
    },
    {
      id: "created",
      header: "Created",
      align: "end",
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
      className: "text-muted-foreground",
    },
  ];

  return (
    <ContentLayout
      title="Documents"
      description="Files this workspace has generated"
      icon={<FileTextIcon className="size-4" />}
    >
      <DataTable
        rows={visibleRows}
        columns={columns}
        rowKey={(row) => row.id}
        isLoading={listQuery.isLoading}
        error={listQuery.error ? "Documents couldn’t be loaded." : undefined}
        empty="No documents yet. Render a carousel to create one."
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search by file name…",
        }}
        pagination={{
          page,
          pageSize: PAGE_SIZE,
          total: listQuery.data?.total ?? 0,
          onPageChange: setPage,
        }}
        rowActions={(row) => (
          <div className="flex justify-end gap-1">
            {/* buttonVariants rather than <Button asChild> — this Button is a
                base-ui primitive with no asChild slot, so a link that looks like
                a button borrows the classes. */}
            <a
              href={buildAttachmentUrl(row.url)}
              /* No `download` attribute and no target="_blank" — the attribute is
               * ignored cross-origin, and ImageKit's Content-Disposition is what
               * actually saves the file. See buildAttachmentUrl. */
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              <DownloadIcon className="size-4" />
              <span className="sr-only">Download {row.fileName}</span>
            </a>
            <Button
              variant="ghost"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate({ ...orgInput, id: row.id })}
            >
              Delete
            </Button>
          </div>
        )}
      />
    </ContentLayout>
  );
}
