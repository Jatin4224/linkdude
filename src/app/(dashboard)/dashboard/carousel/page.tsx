/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: CarouselPage
 *
 * WHAT:  /dashboard/carousel route — thin shell; CarouselWorkspace does the work.
 * WHERE: RESOURCES.carousel.nav.href.
 */

import type { Metadata } from "next";

import { CarouselWorkspace } from "./_components/carousel-workspace";

export const metadata: Metadata = {
  title: "Carousel",
};

export default function CarouselPage() {
  return <CarouselWorkspace />;
}
