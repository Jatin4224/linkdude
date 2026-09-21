/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: PageHeader, ContentLayout
 *
 * WHAT:  The dashboard page chrome — a sticky header (sidebar trigger, title,
 *        action slot) and a ContentLayout wrapper that pairs the header with a
 *        padded content region.
 * WHY:   Every dashboard page renders the same header treatment; centralizing
 *        it here means a page is just `<ContentLayout title=... actions=...>`.
 *        The theme toggle lives in the sidebar user menu (NavUser), not here,
 *        so the header stays title-and-actions only.
 * WHERE: Used by pages under src/app/(dashboard)/** and (portal)/**. Pairs with
 *        the sidebar from src/components/global/sidebar.
 */

import * as React from "react";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export interface PageHeaderProps {
  title: string;
  /**
   * One-line subtitle beside the title. Optional because most pages are named
   * well enough by their title alone — this is for surfaces whose title says
   * WHAT but not what it does for you ("Content Plan" / "Your guided LinkedIn
   * strategy").
   */
  description?: string | undefined;
  /**
   * Leading glyph, rendered in a tinted square. A node rather than an icon name
   * so a caller passes whichever lucide icon it already imports, without this
   * component owning a second icon registry alongside NAV_ICONS.
   */
  icon?: React.ReactNode | undefined;
  actions?: React.ReactNode | undefined;
}

export function PageHeader({
  title,
  description,
  icon,
  actions,
}: PageHeaderProps) {
  return (
    /* `data-slot` is a styling HOOK, not a fork: it lets the dashboard shell
       convert this header by descendant selector while /portal, which renders
       the same component, keeps its current treatment. Nothing here knows which
       of the two it is in. */
    <header
      data-slot="page-header"
      className="flex h-16 shrink-0 items-center gap-2 border-b px-4"
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      {icon ? (
        <span
          data-slot="page-header-icon"
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand-soft-foreground"
        >
          {icon}
        </span>
      ) : null}
      {/* min-w-0 so a long description truncates instead of pushing the actions
          off the end of the header. */}
      {/* Untouched by the dashboard treatment — the title picks up the condensed
          face from the shell's own selector, so this markup stays identical for
          /portal, which renders the same component and keeps its look. The
          subtitle is deliberately NOT promoted to mono: a subtitle is a
          sentence, and the system reserves mono for labels and numbers. */}
      <div className="min-w-0">
        <h1 className="truncate text-base font-medium leading-tight">{title}</h1>
        {description ? (
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="ml-auto flex items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

export interface ContentLayoutProps extends PageHeaderProps {
  children: React.ReactNode;
  /**
   * Drops the padded content wrapper and hands the child a BOUNDED region
   * instead. For pages that scroll internally — the content-plan chat pins a
   * composer below a scrolling transcript, which only works if something above
   * it has a definite height.
   *
   * The height has to be computed rather than inherited: the sidebar wrapper is
   * `min-h-svh`, so `flex-1` there means "at least the viewport" and grows with
   * content — under it a chat would push its own composer off the bottom of the
   * page instead of scrolling. This subtracts the header (h-16) and, from md up,
   * the `m-2` the inset sidebar variant adds above and below.
   */
  bare?: boolean | undefined;
}

export function ContentLayout({
  children,
  bare = false,
  ...header
}: ContentLayoutProps) {
  return (
    <>
      <PageHeader {...header} />
      {bare ? (
        <div className="flex min-h-0 flex-col h-[calc(100svh-4rem)] md:h-[calc(100svh-5rem)]">
          {children}
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      )}
    </>
  );
}
