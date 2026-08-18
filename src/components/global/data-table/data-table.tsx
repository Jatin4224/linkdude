/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: DataTable, DataTableProps, DataTableColumn,
 *   DataTablePagination, dataTableRowKey, filters slot, actions slot,
 *   rowActions slot
 *
 * WHAT:  The app's one list surface — columns, search, pagination, loading,
 *        empty and error states, with slots for whatever a feature adds on top.
 * WHY:   Three hand-rolled tables already exist (audit logs, portal users, portal
 *        organizations), each re-implementing the same page/skeleton/empty
 *        scaffolding with slightly different behaviour. This is the fourth and
 *        fifth use, which is the point the project's globalization rule says to
 *        stop copying and generalize.
 *
 *        Generic over the row type rather than over `unknown`: a column's
 *        `render` receives the real row, so a typo in a field name is a compile
 *        error instead of `undefined` in a cell. Nothing here knows what a
 *        carousel or a document is — features supply columns and slots.
 *
 *        Search and pagination are CONTROLLED, not internal. The server owns
 *        both (the procedure factory clamps page size, and filtering a single
 *        page client-side would lie about the result set), so this component
 *        renders the controls and reports intent rather than holding the state.
 * WHERE: Used by the carousel, documents and post-library dashboard routes. Any
 *        future list should use it rather than growing a sixth bespoke table.
 */

import * as React from "react";
import { SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/**
 * SOURCE OF TRUTH KEYWORDS: DataTableColumn
 *
 * WHAT:  One column definition.
 * WHY:   `render` takes the row rather than a pre-extracted value so a column can
 *        compose several fields (a name over a timestamp, a size beside a page
 *        count) without the table needing to know about it. `width` is a class
 *        rather than a number because the layout is Tailwind's, not ours.
 */
export interface DataTableColumn<TRow> {
  /** Stable identity for React keys. Not a field path — columns may be derived. */
  id: string;
  header: React.ReactNode;
  render: (row: TRow) => React.ReactNode;
  /** Optional Tailwind classes for the cell and its header. */
  className?: string;
  /** Right-aligns numeric columns without every caller restating the classes. */
  align?: "start" | "end";
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<TRow> {
  rows: readonly TRow[];
  columns: ReadonlyArray<DataTableColumn<TRow>>;
  /** Row identity. Required — index keys break as soon as a page changes. */
  rowKey: (row: TRow) => string;

  isLoading?: boolean;
  /** Rendered instead of the table when the query failed. */
  error?: React.ReactNode;
  /** Rendered instead of the table when there are no rows and no search term. */
  empty?: React.ReactNode;

  /** Omit entirely to hide the search box. */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };

  /** Omit to hide the pager — useful for short, complete lists. */
  pagination?: DataTablePagination;

  /**
   * Toolbar slot BESIDE the search box, for controls that narrow the list —
   * status pickers, date ranges, owner filters.
   *
   * Separate from `actions` because the two sit on opposite sides of the toolbar
   * and mean opposite things: a filter changes what you are looking at, an action
   * changes the data. Putting a status picker in `actions` would file it next to
   * Delete.
   */
  filters?: React.ReactNode;

  /** Toolbar slot, right of the search box. The "New…" button lives here. */
  actions?: React.ReactNode;

  /** Per-row trailing slot — menus, download links, destructive buttons. */
  rowActions?: (row: TRow) => React.ReactNode;

  onRowClick?: (row: TRow) => void;
}

const SKELETON_ROWS = 5;

export function DataTable<TRow>({
  rows,
  columns,
  rowKey,
  isLoading = false,
  error,
  empty,
  search,
  pagination,
  filters,
  actions,
  rowActions,
  onRowClick,
}: DataTableProps<TRow>) {
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  /* The toolbar renders in every state — including error and empty. Hiding it
   * would strip the user's only way back (clearing a search that matched
   * nothing) at exactly the moment they need it. */
  const toolbar = (search || filters || actions) && (
    /* flex-wrap: search, filters and actions on one row on a desktop, stacked
       rather than crushed on a phone. */
    <div className="flex flex-wrap items-center justify-between gap-2">
      {search || filters ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {search ? (
            <div className="relative min-w-48 max-w-sm flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder={search.placeholder ?? "Search…"}
                className="pl-8"
              />
            </div>
          ) : null}
          {filters ? (
            <div className="flex shrink-0 items-center gap-2">{filters}</div>
          ) : null}
        </div>
      ) : (
        <div />
      )}
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </div>
  );

  function body() {
    if (error) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {error}
          </CardContent>
        </Card>
      );
    }

    if (isLoading) {
      return (
        <div className="flex flex-col gap-2">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (rows.length === 0) {
      return (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {/* A search that matched nothing is a different situation from an
                empty workspace, and the copy has to say which — otherwise a
                filtered list reads as "you have nothing". */}
            {search?.value
              ? `Nothing matches “${search.value}”.`
              : (empty ?? "Nothing here yet.")}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="p-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead
                    key={column.id}
                    className={cn(
                      column.align === "end" && "text-right",
                      column.className,
                    )}
                  >
                    {column.header}
                  </TableHead>
                ))}
                {rowActions ? (
                  <TableHead className="w-px">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(onRowClick && "cursor-pointer")}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        column.align === "end" && "text-right",
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </TableCell>
                  ))}
                  {rowActions ? (
                    <TableCell
                      className="text-right"
                      /* Row actions must not trigger the row's own click —
                       * opening an editor because someone pressed Delete is the
                       * kind of bug that only shows up in anger. */
                      onClick={(event) => event.stopPropagation()}
                    >
                      {rowActions(row)}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {toolbar}
      {body()}
      {pagination && rows.length > 0 && !isLoading && !error ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {pagination.page} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() =>
                pagination.onPageChange(Math.max(1, pagination.page - 1))
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
