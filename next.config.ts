/*
 *   *
 *    * LICENSE file in the root directory of this source tree.
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  /* The carousel renderer reads these font files from disk at request time
   * (satori draws only with explicit font buffers — see lib/config/carousel).
   * Nothing imports them, so Next's dependency tracer cannot see them and would
   * leave them out of the server bundle; the render would then fall back to the
   * single bundled face and every weight would rasterise identically. */
  outputFileTracingIncludes: {
    "/api/trpc/[trpc]": ["./src/app/assets/fonts/**"],
  },
};

export default nextConfig;
