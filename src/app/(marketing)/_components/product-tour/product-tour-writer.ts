/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: createTourWriter, TourWriter, write cache, skip
 *   unchanged, transform opacity, per-frame DOM write, WeakMap cache, inert
 *
 * WHAT:  The only thing in the tour that touches the DOM — a small set of typed
 *        writers that each remember what they last wrote and do nothing when the
 *        value has not changed.
 *
 * WHY:   THE CACHE IS THE PERFORMANCE STORY. One frame of the tour computes
 *        roughly two hundred values, and at any given scroll position almost all
 *        of them are identical to the frame before: a caption that is fully
 *        faded stays faded, forty calendar cells hold still while one changes,
 *        and the typed topic gains a character every fifteenth frame at most.
 *        Writing them anyway means the browser re-resolves style for the whole
 *        mock sixty times a second for no visible change. Comparing a string
 *        first costs nothing and removes nearly all of it.
 *
 *        TYPED METHODS RATHER THAN THE PROTOTYPE'S ONE `put(el, key, value)`.
 *        That function keyed off the first character of a string — `.` meant a
 *        class, `-` meant a custom property — which is compact and completely
 *        unchecked: a typo'd key wrote a style property that does not exist and
 *        failed silently. One method per kind of write means the compiler
 *        catches it, and `rise` can bundle the transform-plus-opacity pair that
 *        six different places in the renderer were spelling out by hand.
 *
 *        EVERY WRITE IS COMPOSITED. `opacity`, `transform`, a custom property
 *        read only by a colour, `display` on an already-absolute element, a
 *        class that changes nothing but paint. Nothing here can trigger layout,
 *        which is the rule that keeps the camera smooth under a mouse wheel.
 *
 *        The cache is a WeakMap, so a handle that leaves the document is
 *        collectable without the writer having to be told.
 * WHERE: src/app/(marketing)/_components/product-tour/product-tour.tsx.
 */

/** Rounds to three places — the precision at which a repeated value repeats. */
function round(value: number): string {
  return value.toFixed(3);
}

/*
 * Every writer takes `null | undefined` as well as an element, and does nothing
 * with either. The renderer indexes into lists of handles — the four draft
 * lines, the three verdict rows, the eight calendar marks — and under this
 * project's `noUncheckedIndexedAccess` every one of those is possibly
 * undefined. Absorbing it here keeps the renderer a list of what each frame
 * MEANS rather than a list of null checks.
 */
type Target = Element | null | undefined;
type StyleTarget = HTMLElement | null | undefined;

export interface TourWriter {
  /** Element text. Used by the typing topic, the counters and the labels. */
  text(target: Target, value: string): void;
  opacity(target: StyleTarget, value: number): void;
  transform(target: StyleTarget, value: string): void;
  /** `display`, for the caret and the placeholder that swap in the topic box. */
  display(target: StyleTarget, value: string): void;
  /** A custom property — the one channel a colour can be driven through. */
  custom(target: StyleTarget, property: string, value: string): void;
  toggle(target: Target, className: string, on: boolean): void;
  /** Fade up with a small travel — the tour's one compound move. */
  rise(target: StyleTarget, value: number, distance: number): void;
  /** Takes a faded caption or the hidden rail out of the tab order entirely. */
  inert(target: StyleTarget, on: boolean): void;
  /* The score ring grows by dash offset rather than by a width, so the one
   * circle in the mock animates without a layout write like everything else. */
  dashOffset(target: Element | null | undefined, value: number): void;
}

export function createTourWriter(): TourWriter {
  const cache = new WeakMap<Element, Map<string, string>>();

  /** True when this is a new value for this element, and records it. */
  const changed = (target: Element, key: string, value: string): boolean => {
    let entry = cache.get(target);
    if (!entry) {
      entry = new Map<string, string>();
      cache.set(target, entry);
    }
    if (entry.get(key) === value) return false;
    entry.set(key, value);
    return true;
  };

  return {
    text(target, value) {
      if (target && changed(target, "text", value)) target.textContent = value;
    },

    opacity(target, value) {
      const next = round(value);
      if (target && changed(target, "opacity", next)) target.style.opacity = next;
    },

    transform(target, value) {
      if (target && changed(target, "transform", value)) {
        target.style.transform = value;
      }
    },

    display(target, value) {
      if (target && changed(target, "display", value)) {
        target.style.display = value;
      }
    },

    custom(target, property, value) {
      if (target && changed(target, property, value)) {
        target.style.setProperty(property, value);
      }
    },

    toggle(target, className, on) {
      if (target && changed(target, `.${className}`, String(on))) {
        target.classList.toggle(className, on);
      }
    },

    rise(target, value, distance) {
      this.opacity(target, value);
      this.transform(
        target,
        `translateY(${((1 - value) * distance).toFixed(1)}px)`,
      );
    },

    inert(target, on) {
      if (target && changed(target, "inert", String(on))) {
        target.toggleAttribute("inert", on);
      }
    },

    dashOffset(target, value) {
      const next = value.toFixed(2);
      if (target && changed(target, "dashoffset", next)) {
        target.setAttribute("stroke-dashoffset", next);
      }
    },
  };
}
