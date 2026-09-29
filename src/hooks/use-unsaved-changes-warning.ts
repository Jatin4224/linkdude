"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: useUnsavedChangesWarning, beforeunload, unsaved,
 *   isDirty, draft loss, navigation guard
 *
 * WHAT:  Asks the browser to confirm before a reload, a tab close or a navigation
 *        away from the page while an editor holds unsaved work.
 * WHY:   An editor that computes `isDirty` and never acts on it loses work
 *        silently. Twenty minutes of edits disappear on a stray click, with no
 *        prompt and nothing to recover from — the worst outcome any editing
 *        surface can have, and the cheapest to prevent.
 *
 *        WHAT THIS DOES NOT COVER, stated plainly so nobody assumes otherwise:
 *        `beforeunload` fires for reloads, tab closes and navigations that leave
 *        the app. It does NOT fire for Next's client-side routing, so clicking a
 *        sidebar link still discards the draft. App Router exposes no supported
 *        hook to intercept that, and the workarounds all reach into internals that
 *        break on upgrade. In-app transitions the editor itself owns — switching
 *        decks, backing out to the list — are guarded at those call sites instead,
 *        where a real dialog can be shown rather than the browser's generic one.
 *
 *        The listener is only attached WHILE dirty. A permanently registered
 *        handler makes every reload of a clean page prompt, which teaches people
 *        to dismiss the dialog without reading it.
 * WHERE: The carousel editor. Any surface with a dirty buffer wants this.
 */

import * as React from "react";

export function useUnsavedChangesWarning(isDirty: boolean): void {
  React.useEffect(() => {
    if (!isDirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      /* Both lines are required across browsers: preventDefault is the modern
       * signal, and assigning returnValue is what older engines read. Neither
       * shows custom text any more — the browser writes its own copy. */
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
