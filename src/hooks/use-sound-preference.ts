/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: useSoundPreference, isSoundEnabled, setSoundEnabled,
 *   subscribeToSoundPreference, useSyncExternalStore, interface sounds
 *
 * WHAT:  Reads and writes the interface-sound preference, re-rendering whatever
 *        is showing it whenever it changes.
 * WHY:   useSyncExternalStore rather than useState so every mounted toggle
 *        agrees: the preference lives in a module, not in a component, and a
 *        second switch rendered anywhere would otherwise keep showing the stale
 *        value. Its server snapshot is a hard `false` — the real value lives in
 *        localStorage, which the server cannot read, and guessing `true` there
 *        would produce a hydration mismatch on every render.
 * WHERE: The sound toggle in src/components/global/sidebar/nav-user.tsx.
 */

import * as React from "react";

import {
  isSoundEnabled,
  setSoundEnabled,
  subscribeToSoundPreference,
} from "@/lib/sound";

export function useSoundPreference(): {
  soundEnabled: boolean;
  setSoundEnabled: (next: boolean) => void;
} {
  const soundEnabled = React.useSyncExternalStore(
    subscribeToSoundPreference,
    isSoundEnabled,
    /* Server snapshot — see the WHY above. */
    () => false,
  );

  return { soundEnabled, setSoundEnabled };
}
