/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: PaperOrbit, PaperOrbitProps, PaperOrbitMark, sphere,
 *   spherical coordinates, latitude, longitude, 3D orbit, depth cue, occlusion,
 *   z-index sorting, gsap, ScrollTrigger, SCRUB, quickSetter, hero orbit
 *
 * WHAT:  Decorative marks placed on an invisible SPHERE centred on the mascot,
 *        spinning about its vertical axis as the reader scrolls — so marks pass
 *        behind the character, round the far side, and back into view in front
 *        of it.
 *
 * WHY:   Projected in JS rather than built from CSS 3D transforms, and that is
 *        the load-bearing decision. A `perspective` + `preserve-3d` sphere gets
 *        the geometry for free but gives up the two things this effect actually
 *        needs: the browser sorts a preserve-3d subtree against ITSELF, so a
 *        mark can never be painted behind the mascot (a sibling in a different
 *        stacking context), and every glyph on the far side renders mirrored.
 *        Projecting by hand means depth is a NUMBER, which buys three things
 *        CSS could not:
 *
 *          - occlusion — a mark whose z is behind the sphere's centre drops to a
 *            z-index below the mascot, so the character genuinely eclipses it;
 *          - the depth cues that sell a sphere at all — scale and opacity both
 *            ramp with z, because a mark that stays the same size as it rounds
 *            the back reads as a flat circle, not a globe;
 *          - upright glyphs, since nothing is ever rotated in 3D.
 *
 *        The projection runs inside ScrollTrigger's onUpdate against cached
 *        setters, so a frame costs one trig pair and one string write per mark —
 *        a handful of elements, all composited.
 *
 *        Marks are written with `translate3d` and a `scale`, never `left`/`top`:
 *        position changes then skip layout and paint entirely.
 * WHERE: src/app/(marketing)/_components/sticky-hero.tsx, centred on the mascot.
 */

import * as React from "react";

import type { PaperOrbitMark } from "@/lib/types";
import { SCRUB, gsap, useGSAP } from "@/lib/gsap";
import { PAPER_ICONS } from "./paper-icons";
import { cn } from "@/lib/utils";

const DEG_TO_RAD = Math.PI / 180;

/* Depth cues. A mark at the back is a bit over half size and mostly faded; at
 * the front it is full size and opaque. Both ramps are shallow on purpose —
 * pushed further the marks pop rather than recede. */
const SCALE_BACK = 0.52;
const SCALE_RANGE = 0.62;
const OPACITY_BACK = 0.16;
const OPACITY_RANGE = 0.84;

/* Painted behind the mascot below this depth, in front above it. The mascot
 * sits at z-index 1 in the hero stage. */
const OCCLUSION_DEPTH = 0.5;
const Z_BEHIND = 0;
const Z_IN_FRONT = 3;

export interface PaperOrbitProps {
  marks: readonly PaperOrbitMark[];
  /** The element the sphere is centred on — the mascot. */
  centerRef: React.RefObject<HTMLElement | null>;
  /** Id of the element whose scroll progress spins the sphere. */
  triggerId: string;
  /** Sphere radius as a fraction of the stage's smaller dimension. */
  radiusRatio?: number;
  /** Degrees the sphere turns across the full scroll of the trigger. */
  spinDegrees?: number;
  className?: string;
}

export function PaperOrbit({
  marks,
  centerRef,
  triggerId,
  radiusRatio = 0.62,
  spinDegrees = 300,
  className,
}: PaperOrbitProps) {
  const root = React.useRef<HTMLDivElement | null>(null);

  useGSAP(
    () => {
      const rootEl = root.current;
      if (!rootEl) return;

      const nodes = gsap.utils.toArray<HTMLElement>("[data-orbit-mark]", rootEl);
      if (nodes.length === 0) return;

      const spin = { value: 0 };

      /* Geometry is read, not assumed: the mascot is sized in svh, so the
         sphere's centre and radius move on every resize and on mobile
         browser-chrome show/hide. ScrollTrigger re-runs this on refresh. */
      const project = () => {
        const rootBox = rootEl.getBoundingClientRect();
        const centerEl = centerRef.current;
        const centerBox = centerEl?.getBoundingClientRect();

        const cx = centerBox
          ? centerBox.left + centerBox.width / 2 - rootBox.left
          : rootBox.width / 2;
        const cy = centerBox
          ? centerBox.top + centerBox.height / 2 - rootBox.top
          : rootBox.height / 2;
        const radius =
          Math.min(rootBox.width, rootBox.height) * radiusRatio;

        nodes.forEach((node, index) => {
          const mark = marks[index];
          if (!mark) return;

          const lat = mark.latitude * DEG_TO_RAD;
          const lon = (mark.longitude + spin.value) * DEG_TO_RAD;
          const r = radius * mark.radius;

          const x = r * Math.cos(lat) * Math.sin(lon);
          /* Screen y grows downward, so a positive latitude has to subtract. */
          const y = -r * Math.sin(lat);
          const z = r * Math.cos(lat) * Math.cos(lon);

          /* 0 at the far side, 1 at the near side. */
          const depth = (z / (r || 1) + 1) / 2;
          const scale = SCALE_BACK + depth * SCALE_RANGE;

          /* Written straight to style rather than through gsap. `gsap.set` and
             `quickSetter` both intercept `transform`: they decompose it into
             gsap's own x/y/rotation/scale channels and rebuild the string, so a
             raw `translate3d(...) scale(...)` handed to them is discarded. A
             direct write is also the cheapest path there is — one string
             assignment per mark per frame, and the browser composites it. */
          node.style.transform = `translate3d(${cx + x - mark.size / 2}px, ${
            cy + y - mark.size / 2
          }px, 0) scale(${scale})`;
          /* This is also what REVEALS the mark. The markup ships it at
             `opacity-0` so a pile of doodles cannot sit in the page's corner
             before this function has placed them, and an inline opacity beats
             that class — so the depth cue below doubles as the reveal and no
             separate "show it" line is needed. */
          node.style.opacity = String(OPACITY_BACK + depth * OPACITY_RANGE);
          node.style.zIndex = String(
            depth < OCCLUSION_DEPTH ? Z_BEHIND : Z_IN_FRONT,
          );
        });
      };

      const mm = gsap.matchMedia();

      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const { reduce } = context.conditions as {
            motion: boolean;
            reduce: boolean;
          };

          /* Reduced motion gets the sphere STILL, not gone: the marks keep their
             places and their depth cues, so the composition is intact and
             nothing moves. */
          if (reduce) {
            project();
            const onResize = () => project();
            window.addEventListener("resize", onResize, { passive: true });
            return () => window.removeEventListener("resize", onResize);
          }

          const tween = gsap.to(spin, {
            value: spinDegrees,
            ease: "none",
            scrollTrigger: {
              trigger: `#${triggerId}`,
              start: "top top",
              end: "bottom bottom",
              scrub: SCRUB,
              /* Fires on resize and on font/image load, which is exactly when
                 the mascot's centre has moved under us. */
              onRefresh: project,
            },
            onUpdate: project,
          });

          project();
          return () => tween.kill();
        },
      );

      return () => mm.revert();
    },
    { scope: root, dependencies: [marks, triggerId, radiusRatio, spinDegrees] },
  );

  return (
    <div
      ref={root}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      {marks.map((mark, index) => {
        const Icon = PAPER_ICONS[mark.icon];
        return (
          <span
            key={`${mark.icon}-${index}`}
            data-orbit-mark
            /* left/top stay at 0 and the whole position lives in the transform,
               so a frame never touches layout. `will-change` is set because
               these elements move on every scroll frame — the one case it is
               not a premature optimisation. */
            /* HIDDEN UNTIL IT HAS BEEN PLACED. Every mark's position lives in
               a transform this component writes from JS, so between the server
               paint and the first projection they are all sitting at 0,0 — a
               pile of doodles in the page's top-left corner, over the logo.
               `project()` clears this the moment it has a real position, and
               it runs on mount, on resize and on every ScrollTrigger refresh,
               so a mark is never left invisible once it has one. */
            className="absolute top-0 left-0 opacity-0 will-change-transform"
            style={{ width: mark.size, height: mark.size }}
          >
            <Icon className="block size-full text-blue" />
          </span>
        );
      })}
    </div>
  );
}
