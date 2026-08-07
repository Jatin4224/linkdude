/*
 *   *
 *    * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: prismaConfig, DIRECT_URL, DATABASE_URL
 *
 * WHAT:  Prisma CLI configuration — the connection used for `migrate`,
 *        `db push`, and `generate`.
 * WHY:   Schema changes must NOT go through a connection pooler. Neon's pooled
 *        endpoint (the `-pooler` host) is PgBouncer in transaction mode, which
 *        closes the session partway through a long DDL batch and surfaces as
 *        `P1017: Server has closed the connection` — a failure that looks like
 *        a network fault but is really the wrong endpoint.
 *
 *        DIRECT_URL is therefore preferred here and ONLY here: the app's
 *        runtime client keeps using the pooled DATABASE_URL from
 *        schema.prisma, because serverless functions open and close
 *        connections constantly and the pooler is what stops that from
 *        exhausting Postgres' connection limit.
 *
 *        Falls back to DATABASE_URL when DIRECT_URL is unset, so an install on
 *        a non-pooled database (local Postgres, Supabase direct) needs no extra
 *        variable and nothing breaks by omission.
 * WHERE: Read by the Prisma CLI only — never bundled into the app.
 */

import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  engine: "classic",
  datasource: {
    /* Checked via process.env rather than a try/catch around env(), which
     * throws on a missing variable — the whole point is that DIRECT_URL is
     * optional. */
    url: process.env["DIRECT_URL"] ? env("DIRECT_URL") : env("DATABASE_URL"),
  },
});
