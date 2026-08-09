/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: SOUND_NAMES, SoundName, SOUND_SPECS, playSound,
 *   isSoundEnabled, setSoundEnabled, subscribeToSoundPreference,
 *   SOUND_STORAGE_KEY, AudioContext, OscillatorNode, interface sounds
 *
 * WHAT:  The app's entire sound surface — the named cues, their synthesis, and
 *        the on/off preference they all read.
 * WHY:   Synthesised with OscillatorNode rather than shipped as audio files:
 *        a two-note cue is a few lines of maths, so there is nothing to license,
 *        nothing to download, and the pitch and length are tunable here instead
 *        of in a binary. There is deliberately ONE cue. Feedback that fires on
 *        everything trains people to stop hearing any of it, so this is reserved
 *        for the case that genuinely earns it: a job that ran long enough for
 *        the user to switch tabs, telling them it is worth coming back.
 *
 *        OFF unless explicitly enabled. This is a work tool opened in offices
 *        and on calls; a dashboard that makes noise nobody asked for gets muted
 *        at the OS level, which also kills the cue for the people who wanted it.
 *        The preference is per-device (localStorage), because whether sound is
 *        welcome is a property of where you are sitting, not of your account.
 * WHERE: Preference UI in src/components/global/sidebar/nav-user.tsx via
 *        src/hooks/use-sound-preference.ts; played on long-job completion in the
 *        post composer, content-plan chat and profile analyzer.
 */

export const SOUND_NAMES = ["jobComplete"] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

interface SoundSpec {
  /** Frequencies in Hz, played in sequence. Two notes read as "done". */
  notes: readonly number[];
  /** Length of each note in seconds. */
  noteSeconds: number;
  /** Peak gain. Low on purpose — a cue, not an alert. */
  gain: number;
}

/* A rising major third (C6 → E6). Rising reads as completion; falling reads as
 * failure, which is why the one cue here goes up. */
const SOUND_SPECS: Record<SoundName, SoundSpec> = {
  jobComplete: { notes: [1046.5, 1318.5], noteSeconds: 0.12, gain: 0.05 },
};

export const SOUND_STORAGE_KEY = "linkdude:sound-enabled";

/* One shared context. Browsers cap how many a page may create, and a new one
 * per cue would eventually throw. */
let audioContext: AudioContext | null = null;

/* In-memory mirror of the stored preference so a read costs nothing, plus the
 * listener set that keeps every mounted toggle in agreement. */
let enabled = false;
let hydrated = false;
const listeners = new Set<() => void>();

function readStoredPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SOUND_STORAGE_KEY) === "true";
  } catch {
    /* Private mode and blocked storage both throw on access. Silence is the
     * safe fallback — the feature is opt-in, so failing closed is correct. */
    return false;
  }
}

/**
 * SOURCE OF TRUTH KEYWORDS: isSoundEnabled
 *
 * WHAT:  Whether cues should play on this device.
 * WHY:   Hydrates from storage on first call rather than at module load, so
 *        importing this file on the server never touches `window`.
 */
export function isSoundEnabled(): boolean {
  if (!hydrated && typeof window !== "undefined") {
    enabled = readStoredPreference();
    hydrated = true;
  }
  return enabled;
}

/**
 * SOURCE OF TRUTH KEYWORDS: setSoundEnabled
 *
 * WHAT:  Turns cues on or off and persists the choice.
 * WHY:   Enabling happens inside the click that flips the switch, which is the
 *        one moment a browser will allow an AudioContext to start — so the
 *        context is created here, not on the first cue. A cue fired from a
 *        network response has no user gesture behind it and would be blocked if
 *        the context did not already exist.
 */
export function setSoundEnabled(next: boolean): void {
  enabled = next;
  hydrated = true;

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SOUND_STORAGE_KEY, String(next));
    } catch {
      /* Preference simply will not persist; the session still honours it. */
    }
    if (next) ensureContext();
  }

  for (const listener of listeners) listener();
}

/**
 * SOURCE OF TRUTH KEYWORDS: subscribeToSoundPreference
 *
 * WHAT:  Notifies a caller when the preference changes.
 * WHERE: Backs useSyncExternalStore in use-sound-preference.ts.
 */
export function subscribeToSoundPreference(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  /* Unprefixed only: every browser this app targets has shipped it for years,
   * and reaching for webkitAudioContext would mean asserting a type onto
   * `window` that TypeScript has no reason to believe. */
  if (typeof window.AudioContext === "undefined") return null;
  audioContext ??= new window.AudioContext();
  return audioContext;
}

/**
 * SOURCE OF TRUTH KEYWORDS: playSound
 *
 * WHAT:  Plays a named cue, or does nothing at all.
 * WHY:   Every failure path here is silent by design — no sound support, a
 *        suspended context, the preference off. A cue is a nicety, and nothing
 *        about it is worth surfacing an error over.
 * WHERE: Called on long-job completion.
 */
export function playSound(name: SoundName): void {
  if (!isSoundEnabled()) return;

  const context = ensureContext();
  if (!context) return;

  /* A tab restored from the background resumes suspended; without this the
   * first cue after coming back is swallowed. */
  if (context.state === "suspended") void context.resume();

  const spec = SOUND_SPECS[name];

  spec.notes.forEach((frequency, index) => {
    const startAt = context.currentTime + index * spec.noteSeconds;
    const endAt = startAt + spec.noteSeconds;

    const oscillator = context.createOscillator();
    const amplifier = context.createGain();

    /* A sine has no harmonics, so it reads as a soft chime rather than the
     * buzz a square or sawtooth would give at this volume. */
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startAt);

    /* Ramped, never switched: a gain that jumps to or from zero produces an
     * audible click at the discontinuity, which is the single most common way
     * synthesised UI audio ends up sounding cheap. */
    amplifier.gain.setValueAtTime(0, startAt);
    amplifier.gain.linearRampToValueAtTime(spec.gain, startAt + 0.015);
    amplifier.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(amplifier);
    amplifier.connect(context.destination);

    oscillator.start(startAt);
    oscillator.stop(endAt);
  });
}
