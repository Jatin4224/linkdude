/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: RESOURCES, ResourceDefinition, ResourceKey,
 *   LimitResourceKey, FlagResourceKey, PermissionedResourceKey, Permission,
 *   PermissionAction, ResourceLimit, ResourceFlag, ResourceNav, ResourceAudit,
 *   ResourceRateLimit, PLAN_KEYS, RESOURCE_ENTRIES, LIMIT_RESOURCE_KEYS,
 *   FLAG_RESOURCE_KEYS, getResourceLimitForPlan, getResourceFlagForPlan,
 *   getResourceFromPath, getMutationFeatureMap, isResourceKey,
 *   interpolateAuditDescribe, getOrganizationStatement, getRawResourceLimit,
 *   formatResourceLimit, formatResourceAllowance, getPricingMatrix,
 *   PricingCell, PricingMatrixRow
 *
 * WHAT:  Unified registry of every resource concept — permissions, limits, flags,
 *        sidebar nav, audit description templates, rate-limit overrides.
 * WHY:   Single source of truth — adding a verb to RESOURCES wires up the
 *        permission string, owner-role grant, role-builder UI metadata, sidebar
 *        item, optimistic-update mapping, and audit entity automatically.
 * WHERE: Consumed by procedureFactory (src/trpc/procedures/protected.ts),
 *        permission constants (src/lib/better-auth/permissions.ts), feature
 *        gates (src/lib/feature-gate.ts), and optimistic UI
 *        (src/trpc/react-provider.tsx); depends on src/lib/config/plans.ts.
 */

import {
  PLAN_KEYS,
  PLAN_ORDER,
  PLAN_PRICE_LOCALE,
  type PlanKey,
} from "@/lib/config/plans";

/* PLAN_KEYS / PlanKey are the single source of truth in plans.ts (RESOURCES only
 * consumes them for perPlan exhaustiveness). Re-exported here so existing
 * importers of `@/lib/resources` keep resolving without a second declaration. */
export { PLAN_KEYS };

type PerPlan<T> = Record<PlanKey, T>;

export interface ResourceLimit {
  perPlan: PerPlan<number | "unlimited">;
  upgradeMessage: string;
  availableOnFreeTrial: boolean;
  unit?: string;
}

export interface ResourceFlag {
  perPlan: PerPlan<boolean>;
  availableOnFreeTrial: boolean;
}

export interface ResourceNav {
  label: string;
  href: string;
  icon: string;
  section?: "create" | "workspace" | (string & {});
  /**
   * Position within the section, lowest first. Entries without one sort after
   * those that have one, in declaration order.
   *
   * Explicit because RESOURCES is ordered by ARCHITECTURE — Better Auth
   * surfaces, then billing, then the product — and letting that dictate the
   * sidebar put Team above every feature a user actually opens daily. Nav order
   * is a UI decision and deserves to be stated rather than inherited from where
   * a resource happened to be declared.
   */
  order?: number;
  /** Defaults to 'read' when omitted. */
  requirePermission?: string;
  requireFlag?: boolean;
}

export interface ResourceAudit {
  entity?: string;
  /** Templates support {input.field} and {output.field} interpolation. */
  describe?: Record<string, string>;
}

export interface ResourceRateLimit {
  [action: string]: {
    count: number;
    window: `${number} ${"s" | "m" | "h" | "d"}`;
  };
}

/**
 * A feature surface — any combination of fields below. Only `name` is required.
 *
 *   permissions only          → RBAC-gated action with no UI page
 *   flag only                 → plan-tier on/off toggle (e.g., bulk export button)
 *   limit only                → plan-tier quota with no dedicated page
 *   nav only                  → sidebar page with no quotas
 *   permissions + nav + audit → full CRUD entity (the typical case)
 *
 * `<FeatureGate resource="...">` and `useFeatureGate('...')` work on ANY entry
 * that declares `limit` or `flag`, regardless of whether `nav` is present.
 */
export interface ResourceDefinition {
  name: string;
  description?: string;
  permissions?: readonly string[];
  /** limit and flag are mutually exclusive — pick at most one. */
  limit?: ResourceLimit;
  flag?: ResourceFlag;
  nav?: ResourceNav;
  audit?: ResourceAudit;
  rateLimit?: ResourceRateLimit;
}

/**
 * SOURCE OF TRUTH KEYWORDS: RESOURCES
 *
 * WHAT:  The feature registry — every feature surface the app exposes is
 *        declared here. A surface can be a CRUD entity, a flag-only toggle,
 *        a quota with no page, or any combination (see ResourceDefinition).
 * WHY:   Single source of truth: permission constants, owner-role grants,
 *        sidebar items, limit/flag values, audit templates, rate-limit
 *        overrides, and optimistic update mappings all derive from this.
 * WHERE: Read everywhere via RESOURCE_ENTRIES / typed helpers below.
 *
 * Naming: Better-Auth-owned surfaces (member, invitation) use singular keys
 * so auto-derived permission strings line up with Better Auth's internal
 * checks. App-owned surfaces use plural.
 */
export const RESOURCES = {
  member: {
    name: "Team Members",
    description: "Add, remove, and modify organization members",
    permissions: ["create", "read", "update", "delete"],
    limit: {
      perPlan: {
        free: 1,
        starter: 3,
        pro: 10,
        enterprise: "unlimited",
        portal: "unlimited",
      },
      upgradeMessage: "Upgrade to {nextPlan} to invite more teammates",
      availableOnFreeTrial: true,
      unit: "seats",
    },
    nav: {
      label: "Team",
      href: "/dashboard/team",
      icon: "Users",
      section: "workspace",
      order: 1,
    },
  },

  invitation: {
    name: "Invitations",
    description: "Send invites and cancel pending invitations",
    permissions: ["create", "cancel"],
  },

  organizationRoles: {
    name: "Organization Roles",
    description: "Create and manage custom roles and their permissions",
    permissions: ["create", "read", "update", "delete"],
  },

  /* REMOVED: storage, apiCalls, customDomain, customBranding.
   *
   * They were starter-kit placeholders — priced rows with no router, no
   * enforcement call site, and no UI. Because getPricingMatrix() walks every
   * RESOURCE_ENTRIES member with a limit or flag, their only real effect was
   * advertising four features on the public pricing table that the app does not
   * implement, which becomes a refund conversation the moment money changes
   * hands. `storage` could not have been enforced anyway: incrementUsage takes
   * no amount, so a byte limit has nothing to count.
   *
   * Re-add an entry here (with its enforcement) when the feature actually
   * exists — the pricing table picks it up automatically. */

  auditLogs: {
    name: "Audit Logs",
    description: "Access full audit log history with forensic detail",
    permissions: ["read"],
    flag: {
      perPlan: {
        free: false,
        starter: false,
        pro: true,
        enterprise: true,
        portal: true,
      },
      availableOnFreeTrial: false,
    },
    nav: {
      /* Lives under settings/ because the page is a settings tab, not a
       * top-level surface — the href must match the real route or the sidebar
       * link 404s. */
      label: "Audit Logs",
      href: "/dashboard/settings/audit-logs",
      icon: "ScrollText",
      section: "workspace",
      order: 4,
      requireFlag: true,
    },
  },

  billing: {
    name: "Billing & Payments",
    description: "Manage subscriptions, invoices, and payment methods",
    permissions: ["create", "read", "update", "delete"],
    nav: {
      label: "Billing",
      href: "/dashboard/settings/billing",
      icon: "CreditCard",
      section: "workspace",
      order: 2,
    },
  },

  organizationSettings: {
    name: "Organization Settings",
    description: "Update organization name, logo, and other org-wide settings",
    permissions: ["read", "update"],
    audit: { entity: "organization" },
    nav: {
      label: "Organization",
      href: "/dashboard/settings/organization",
      icon: "Settings",
      section: "workspace",
      order: 3,
    },
  },

  integrations: {
    name: "Integrations",
    description: "Connect or disconnect third-party services",
    permissions: ["read", "update", "disconnect"],
    audit: {
      entity: "integration",
      describe: { disconnect: "Disconnected the {input.provider} account" },
    },
  },

  aiGeneration: {
    name: "AI Generation",
    description: "Generate post copy with AI",
    permissions: ["create"],
    /* Metered separately from publishing: a user burns generations while
     * iterating on copy without ever hitting Post, so charging those against
     * the publish quota would price the drafting loop out of the free tier. */
    limit: {
      perPlan: {
        free: 25,
        starter: 300,
        pro: 2_000,
        enterprise: "unlimited",
        portal: "unlimited",
      },
      upgradeMessage: "Upgrade to {nextPlan} to generate more posts with AI",
      availableOnFreeTrial: true,
      unit: "generations",
    },
    rateLimit: {
      /* Each generation is a paid model call — cap bursts well under the
       * global API limiter so a stuck client can't drain the AI budget. */
      create: { count: 10, window: "1 m" },
    },
  },

  aiImageEdit: {
    name: "AI Image Edit",
    description: "Rewrite a post image from a text instruction",
    /* No `delete` verb, deliberately, for the reason profileAnalysis documents
     * below: the counter-bump wiring decrements on `<resource>.delete`, which is
     * right for a quota counting THINGS HELD and wrong for one counting MODEL
     * SPEND. Reverting to the original does not un-spend the generation, so
     * there is no verb here that could refund it. */
    permissions: ["create"],
    /* Its own budget, an order of magnitude tighter than aiGeneration: an image
     * generation costs far more than a few hundred tokens of post copy, and it
     * is the one action here that can be repeated indefinitely on a whim
     * ("make it warmer", "now bluer") without ever publishing. */
    limit: {
      perPlan: {
        /* 2, and the tightest free allowance in the app for a reason: every
         * edit is ~$0.039 of vendor spend billed to us the moment it returns,
         * and image generation has NO free tier at Google — the whole feature
         * runs on a paid key. Same reasoning profileAnalysis applies at 3, one
         * step further because an image costs more than a critique and the
         * dialog's Try-again makes iterating a single click. */
        free: 2,
        starter: 50,
        pro: 300,
        enterprise: "unlimited",
        portal: "unlimited",
      },
      upgradeMessage: "Upgrade to {nextPlan} to edit more images with AI",
      availableOnFreeTrial: true,
      unit: "image edits",
    },
    rateLimit: {
      /* Tighter than text generation: each call is an image round trip through
       * this server, so a burst costs bandwidth and function time as well as
       * vendor spend. */
      create: { count: 3, window: "1 m" },
    },
  },

  profileAnalysis: {
    name: "Profile Analysis",
    description: "Analyze a LinkedIn profile and suggest improvements",
    /* `discard` rather than `delete` is LOAD-BEARING. The counter-bump wiring in
     * protectedProcedure keys off the path verb: `<resource>.delete` decrements
     * the usage counter. That is correct for a quota counting THINGS HELD, and
     * wrong for this one, which counts MODEL SPEND — the API call is already
     * paid for, and removing the saved row does not un-spend it. Naming the verb
     * `delete` would make analyze → delete → analyze an unlimited free tier.
     * Renaming the verb is the documented way out (see getMutationFeatureMap). */
    permissions: ["create", "read", "discard"],
    /* Metered on its own budget rather than sharing aiGeneration's: an analysis
     * sends a whole profile and asks for structured output, so it costs several
     * times what a post draft does. Sharing a counter would let one analysis
     * silently eat a handful of drafts. */
    limit: {
      perPlan: {
        /* 3, not 5: a free analysis costs a model call, and the URL path that
         * usually precedes it costs a paid vendor lookup on top. Free users
         * generate no revenue against either. */
        free: 3,
        starter: 50,
        pro: 300,
        enterprise: "unlimited",
        portal: "unlimited",
      },
      upgradeMessage: "Upgrade to {nextPlan} to run more profile analyses",
      availableOnFreeTrial: true,
      unit: "analyses",
    },
    rateLimit: {
      /* Larger prompt than post generation, so a tighter burst cap. */
      create: { count: 5, window: "1 m" },
    },
    audit: {
      entity: "profileAnalysis",
      describe: {
        create: "Analyzed a LinkedIn profile (score {output.score})",
        discard: "Discarded a saved profile analysis",
      },
    },
    nav: {
      label: "Profile Analysis",
      href: "/dashboard/profile-analysis",
      icon: "UserSearch",
      section: "create",
      order: 5,
      /* REQUIRED, and deliberately 'create' rather than the more natural 'read'.
       *
       * Custom roles store one OrganizationRole row per literal
       * `resource:permission` string, and nothing backfills them when a new
       * permission is added to this registry. `profileAnalysis:read` did not
       * exist when any current role was created, so gating the nav on it would
       * remove this page from every existing custom-role member — silently,
       * exactly like the `as Permission` trap this comment used to describe.
       *
       * Switch this to 'read' only alongside a backfill that grants
       * profileAnalysis:read to the roles that already hold :create. */
      requirePermission: "create",
    },
  },

  profileLookup: {
    name: "Profile Lookups",
    description: "Fetch a LinkedIn profile by URL through a data vendor",
    /* Its OWN resource rather than a verb on profileAnalysis, because fetching a
     * profile is a capability several features want (analysis today, outreach
     * drafting next) and none of them should need `profileAnalysis:create` to
     * use it. */
    permissions: ["create", "read"],
    /* The only real control on vendor spend. Each lookup is a billed call to
     * Apify/Bright Data, and a rate limit cannot express "3 for free users, 300
     * for pro" — ResourceRateLimit has no perPlan. A quota can, which is why the
     * cap lives here and the limiter below is only burst protection. */
    limit: {
      perPlan: {
        free: 3,
        starter: 50,
        pro: 300,
        enterprise: "unlimited",
        portal: "unlimited",
      },
      upgradeMessage: "Upgrade to {nextPlan} for more profile lookups",
      availableOnFreeTrial: true,
      unit: "lookups",
    },
    rateLimit: {
      /* Burst protection on top of the quota: a stuck client should not be able
       * to spend a month's lookups in a minute. */
      create: { count: 5, window: "1 m" },
    },
    audit: {
      entity: "profileLookup",
      describe: { create: "Looked up a LinkedIn profile" },
    },
  },

  profileDeepInsights: {
    name: "Deep Profile Insights",
    description:
      "Per-role and per-project rewrites in a profile analysis, on top of the headline and About critique",
    /* FLAG, not a limit, and deliberately its OWN resource rather than a verb on
     * profileAnalysis. A flag on profileAnalysis would be enforced by
     * protectedProcedure on EVERY verb of that resource (see the flag gate in
     * protected.ts), which would lock the whole feature — analysis, history and
     * all — for free plans. This entry has no router and no procedures, so
     * nothing auto-fires: the analysis router reads it with checkBooleanFeature
     * to decide what to ASK the model for, and the result view reads the same
     * gate to decide what to SHOW.
     *
     * That split is the point of gating here rather than in the component. The
     * locked sections are never generated for a plan that cannot see them, so a
     * free analysis costs materially fewer output tokens instead of paying for
     * text nobody is allowed to read. The cost of that choice is honest and
     * stated in the UI: unlocking requires re-running the analysis.
     *
     * No `permissions` key: this is a plan entitlement, not an RBAC verb. The
     * member permission that governs running an analysis is
     * profileAnalysis:create and is unchanged. */
    flag: {
      perPlan: {
        free: false,
        starter: true,
        pro: true,
        enterprise: true,
        portal: true,
      },
      /* Trials get it: the deep sections are the thing worth converting on, and
       * hiding them during the trial hides the reason to upgrade. */
      availableOnFreeTrial: true,
    },
  },

  contentPlan: {
    name: "Content Plans",
    description:
      "Turn a LinkedIn profile plus a few answers into a posting strategy",
    /* `discard` rather than `delete`, for exactly the reason spelled out on
     * profileAnalysis above: this counter measures MODEL SPEND, and throwing the
     * session away does not un-spend it. Under the name `delete`, generate →
     * New → generate would be an unlimited free tier.
     *
     * `update` covers the two mutations that change a session without buying
     * anything — saving progress as the user answers, and keeping a finished
     * plan. Neither should require permission to spend a quota unit, which is
     * what folding them into `create` would mean. */
    permissions: ["create", "read", "update", "discard"],
    /* Its own budget rather than sharing aiGeneration's. A plan asks for ten
     * structured sections over a whole profile — the largest single generation
     * in the app — so one plan is worth many post drafts and a shared counter
     * would hide that.
     *
     * The counter is spent by GENERATION, not by starting a session: a refine
     * that regenerates the strategy is a fresh model call and costs another
     * unit, which is why the numbers are lower than the analysis quota. */
    limit: {
      perPlan: {
        /* One. A free plan gets a complete strategy — enough to see the value —
         * and every regeneration after it is a paid feature. */
        free: 1,
        starter: 15,
        pro: 100,
        enterprise: "unlimited",
        portal: "unlimited",
      },
      upgradeMessage: "Upgrade to {nextPlan} to generate more content plans",
      availableOnFreeTrial: true,
      unit: "plans",
    },
    rateLimit: {
      /* The heaviest prompt in the app; a tight burst cap. */
      create: { count: 3, window: "1 m" },
      /* `brief` is the profile read-back at the start of a session. It is a
       * model call, so it is limited — but it is NOT quota-metered, because it
       * can only run against a profile the org has already paid profileLookup
       * for, and that quota is the real ceiling on how many distinct profiles a
       * plan session can be started from. */
      brief: { count: 5, window: "1 m" },
    },
    audit: {
      entity: "contentPlan",
      describe: {
        create: "Generated a personalized content plan",
        brief: "Started a content plan from a LinkedIn profile",
        update: "Updated a content plan session",
        discard: "Discarded a content plan",
      },
    },
    nav: {
      label: "Content Plan",
      href: "/dashboard/content-plan",
      icon: "Compass",
      section: "create",
      order: 4,
      /* 'create', not 'read' — same backfill trap documented on profileAnalysis
       * above. `contentPlan:read` exists nowhere in any current OrganizationRole
       * row, so gating the nav on it would hide this page from every existing
       * custom-role member the moment it ships. */
      requirePermission: "create",
    },
  },

  linkedinPosts: {
    name: "LinkedIn Posts",
    description: "Generate, schedule, publish, and review LinkedIn posts",
    /* `draft` and `discard` exist because the factory meters ONLY
     * `<resource>.create` (increment) and `<resource>.delete` (decrement).
     *
     *   - Saving a draft under `create` would spend a post slot on writing that
     *     may never be published.
     *   - Removing a draft under `delete` would REFUND a slot the draft never
     *     spent, so save → discard on repeat mints free posts.
     *
     * Both verbs are therefore counter-free by construction, and publishing a
     * draft goes back through `create` with a `draftId` — see the note below. */
    permissions: ["create", "read", "draft", "discard", "delete"],
    /* Scheduling deliberately has NO resource key of its own. A `scheduledPosts`
     * entry with its own limit would double every plan — an org could schedule
     * its quota and then publish it again immediately — because only
     * `<resource>.create` spends a slot. Scheduling is therefore
     * `linkedinPosts.create` with a date attached, so the slot is spent once,
     * when the user commits to the post, and refunded by `delete` whether that
     * cancels a future post or forgets a past one.
     *
     * Drafts ride the same rule from the other end: `create` accepts a
     * `draftId` and PROMOTES that row in place rather than inserting a second
     * one, so a draft costs nothing until it goes out and exactly one slot when
     * it does. A `publishDraft` verb would have spent none at all. */
    limit: {
      perPlan: {
        free: 10,
        starter: 100,
        pro: 500,
        enterprise: "unlimited",
        portal: "unlimited",
      },
      upgradeMessage: "Upgrade to {nextPlan} to publish more posts",
      availableOnFreeTrial: true,
      unit: "posts",
    },
    audit: {
      entity: "linkedinPost",
      describe: {
        create: "Published a LinkedIn post",
        /* Written by the scheduled-post worker, not by a procedure — the org
         * needs "your post went live" as an event distinct from scheduling it. */
        publish: "Published a scheduled LinkedIn post",
        draft: "Saved a LinkedIn post draft",
        discard: "Discarded a LinkedIn post draft",
        delete: "Removed a LinkedIn post record",
      },
    },
    rateLimit: {
      /* LinkedIn throttles member posting; staying under it here turns a
       * remote 429 into a local, explainable error. */
      create: { count: 5, window: "1 m" },
      /* Saving costs nothing but a write, so the ceiling is high — it exists to
       * stop a stuck client looping on the Save button, not to pace the user. */
      draft: { count: 30, window: "1 m" },
    },
    nav: {
      label: "Create Post",
      href: "/dashboard/post-generation",
      icon: "Sparkles",
      section: "create",
      order: 1,
    },
  },

  /**
   * SOURCE OF TRUTH KEYWORDS: carousels, carousel generation, slide deck,
   *   document post, PDF carousel, swipeable document
   *
   * WHAT:  Turning a topic into a multi-slide deck that publishes to LinkedIn as
   *        a swipeable document.
   * WHY:   A quota of its own rather than riding on linkedinPosts, because a
   *        deck costs materially more to produce than a text post — it is an AI
   *        pass per slide plus a render — so the two cannot share a meter
   *        without one subsidising the other.
   *
   *        Declared limit-only: no `permissions` and no `nav`. That is the
   *        documented "plan-tier quota with no dedicated page" shape, and it is
   *        deliberate here — this checkout has no carousel router, service or
   *        route, so a `nav` entry would put a 404 in the sidebar and a
   *        permission string would grant access to nothing. The quota exists so
   *        the pricing surfaces can state the allowance; the ENFORCEMENT lands
   *        with the feature, at which point adding `permissions`, `nav` and
   *        `audit` here wires the rest up automatically.
   * WHERE: The pricing matrix, the free-tier counters and the capability ticker
   *        pick this up from RESOURCE_ENTRIES with no further wiring.
   */
  carousels: {
    name: "Carousels",
    description: "Turn a topic into a slide deck published as a document",
    limit: {
      perPlan: {
        free: 2,
        starter: 30,
        pro: 200,
        enterprise: "unlimited",
        portal: "unlimited",
      },
      upgradeMessage: "Upgrade to {nextPlan} to build more carousels",
      availableOnFreeTrial: true,
      unit: "carousels",
    },
  },

  /* The content calendar is its own KEY purely because `nav` is one entry per
   * resource and linkedinPosts already spends its on the composer — the sidebar
   * permission is derived as `<key>:<action>`, so a second page needs a second
   * key. It carries no `limit`: scheduling spends a linkedinPosts slot, and a
   * quota here would charge twice for one post. Read-only by design; every
   * mutation the calendar triggers belongs to linkedinPosts. */
  contentCalendar: {
    name: "Content Calendar",
    description: "See scheduled and published posts on a calendar",
    permissions: ["read"],
    nav: {
      label: "Calendar",
      href: "/dashboard/calendar",
      icon: "CalendarDays",
      section: "create",
      order: 2,
    },
  },

  /* The post library is its own KEY for the same reason contentCalendar is: one
   * `nav` per resource, and linkedinPosts already spends its on the composer.
   *
   * No `limit` — every row it lists was already metered by linkedinPosts.create,
   * except drafts, which are deliberately free. Read-only by design: editing a
   * draft happens in the composer, and discard/delete belong to linkedinPosts. */
  postLibrary: {
    name: "Post Library",
    description: "Every draft, scheduled, published and failed post in one list",
    permissions: ["read"],
    nav: {
      label: "Posts",
      href: "/dashboard/posts",
      icon: "FileStack",
      section: "create",
      order: 3,
      /* Same new-resource caveat as carousel below: no live OrganizationRole row
       * holds this permission, so owners see the page at once and a custom role
       * needs an explicit grant in the role editor. */
      requirePermission: "read",
    },
  },

  carousel: {
    name: "Carousels",
    description:
      "Turn a topic into a multi-slide LinkedIn carousel and render it to PDF",
    /* `discard` rather than `delete`, for the same reason spelled out on
     * profileAnalysis and contentPlan: this counter measures MODEL AND RENDER
     * SPEND, and throwing the deck away does not un-spend either. Under the name
     * `delete`, generate → remove → generate would be an unlimited free tier.
     *
     * `render` is its own verb, not folded into `create`, because the two have
     * completely different cost and failure modes — the model call can succeed
     * and the render still fail. Separating them means a failed render never
     * burns the generation the user already paid for, and re-rendering an edited
     * deck costs nothing. `update` covers slide edits, which buy nothing. */
    permissions: ["create", "read", "update", "render", "discard"],
    /* Its own budget rather than sharing aiGeneration's. A deck is one structured
     * generation plus N image rasterisations plus a stored file — materially
     * heavier than a post draft, and a shared counter would hide that.
     *
     * Spent by GENERATION, not by rendering: `create` is the only verb the
     * factory bumps, so editing and re-rendering a deck the org already paid for
     * stays free. That is deliberate — charging per render would push people to
     * accept a worse first draft. */
    limit: {
      perPlan: {
        /* Two. Enough to produce a real deck and see it published, with the
         * second one covering the near-certain "I want to try another topic". */
        free: 2,
        starter: 30,
        pro: 200,
        enterprise: "unlimited",
        portal: "unlimited",
      },
      upgradeMessage: "Upgrade to {nextPlan} to create more carousels",
      availableOnFreeTrial: true,
      unit: "carousels",
    },
    rateLimit: {
      /* A multi-slide structured generation — comparable weight to a content
       * plan, so the same tight burst cap. */
      create: { count: 3, window: "1 m" },
      /* Looser than create: rendering is local CPU, not a model call, and
       * iterating on slide copy is the expected workflow. Still capped, because
       * each render rasterises N slides and uploads a file. */
      render: { count: 5, window: "1 m" },
    },
    audit: {
      entity: "carousel",
      describe: {
        create: "Generated a carousel",
        update: "Edited carousel slides",
        render: "Rendered a carousel to PDF",
        discard: "Discarded a carousel",
      },
    },
    nav: {
      label: "Carousel",
      href: "/dashboard/carousel",
      icon: "Layers",
      section: "create",
      order: 6,
      /* NOTE the backfill rule documented on profileAnalysis and contentPlan
       * applies here differently. Those are OLD resources, where the fix was to
       * gate on a verb that already existed in live OrganizationRole rows.
       * `carousel` is BRAND NEW: no role row holds any of its permissions, so no
       * choice of verb makes this visible to an existing custom-role member.
       *
       * That is correct, not a bug. Owners bypass the permission gate and see it
       * immediately; granting it to a custom role is a deliberate act in the
       * existing role editor. 'create' is chosen because it is the verb that
       * matches what the page is FOR — opening it to compose a deck. */
      requirePermission: "create",
    },
  },

  /* Documents is its own KEY because generated files outlive the deck that made
   * them and need a page of their own — `nav` is one entry per resource and
   * carousel already spends its on the editor.
   *
   * It carries NO `limit` on purpose. Documents are created by `carousel.render`,
   * and the factory only bumps a counter on `<resource>.create` — so a limit here
   * would never fire and would sit in the pricing table as a number that means
   * nothing. Storage volume is already bounded by the carousel quota, which is
   * the thing actually being metered. */
  documents: {
    name: "Documents",
    description: "Files this workspace has generated, such as carousel PDFs",
    /* No `create`: nothing creates a Document directly. Rendering a carousel
     * does, and that is gated by carousel:render. */
    permissions: ["read", "delete"],
    audit: {
      entity: "documents",
      describe: {
        delete: "Deleted a generated document",
      },
    },
    nav: {
      label: "Documents",
      href: "/dashboard/documents",
      icon: "FileText",
      section: "workspace",
      order: 5,
      /* 'read' is the only sensible verb here — this resource has no `create`,
       * and the page is a library whose sole mutation is delete. Same new-resource
       * caveat as carousel above: owners see it at once, custom roles need an
       * explicit grant. */
      requirePermission: "read",
    },
  },
  /* A member's persisted writing voice, read by every generator so drafts stop
   * sounding like the model's house style. Scoped per member, like contentPlan. */
  voiceProfile: {
    name: "Voice Profile",
    description: "A writing voice extracted from your own posts",
    /* `discard`, NOT `delete`: this counter measures MODEL SPEND, and the factory
     * refunds a slot on `<resource>.delete`. Under that name, extract → remove →
     * extract would be an unlimited free tier. Same rule as contentPlan.
     *
     * `create` IS the extraction, so a re-extraction spends another unit.
     * `update` saves overrides and toggles the voice on or off, which buy nothing.
     * `revert` is its own verb because it changes what the generators read
     * without a model call, and that deserves its own audit line. */
    permissions: ["create", "read", "update", "revert", "discard"],
    limit: {
      perPlan: {
        /* One. A complete voice is enough to hear the difference in a draft;
         * every re-extraction after it is paid. */
        free: 1,
        starter: 10,
        pro: 50,
        enterprise: "unlimited",
        portal: "unlimited",
      },
      upgradeMessage: "Upgrade to {nextPlan} to re-extract your voice",
      availableOnFreeTrial: true,
      unit: "voice extractions",
    },
    rateLimit: {
      /* Up to twenty posts in one prompt: a heavy input, so a tight burst cap. */
      create: { count: 3, window: "1 m" },
    },
    audit: {
      entity: "voiceProfile",
      describe: {
        create: "Extracted a writing voice from {output.sampleCount} posts",
        update: "Updated the voice profile ({input.field})",
        revert: "Reverted to the previous writing voice",
        discard: "Discarded the voice profile",
      },
    },
    nav: {
      label: "Voice",
      href: "/dashboard/voice",
      icon: "AudioLines",
      section: "create",
      order: 7,
      /* Brand-new key, same caveat as carousel: owners see it at once, and a
       * custom role needs an explicit grant in the role editor. */
      requirePermission: "create",
    },
  },
  /* A member's saved post ideas: capture a thought in seconds, turn it into a
   * post later. Nothing here calls a model.
   *
   * The limit counts ideas HELD, not model spend, so `delete` is the right verb
   * and the factory's refund on delete is wanted: deleting an idea frees a slot.
   * Same reasoning as linkedinPosts, the opposite of voiceProfile. */
  postIdeas: {
    name: "Post Ideas",
    description: "Saved ideas to turn into posts later",
    permissions: ["create", "read", "update", "delete"],
    limit: {
      perPlan: {
        free: 100,
        starter: 1_000,
        pro: 10_000,
        enterprise: "unlimited",
        portal: "unlimited",
      },
      upgradeMessage: "Upgrade to {nextPlan} to save more ideas",
      availableOnFreeTrial: true,
      unit: "ideas",
    },
    rateLimit: {
      create: { count: 30, window: "1 m" },
    },
    audit: {
      entity: "postIdea",
      describe: {
        create: "Saved a post idea",
        update: "Updated a post idea ({input.field})",
        delete: "Deleted a post idea",
      },
    },
    nav: {
      label: "Ideas",
      href: "/dashboard/ideas",
      icon: "Lightbulb",
      section: "create",
      order: 8,
      /* Brand-new key, same caveat as carousel: owners see it at once, and a
       * custom role needs an explicit grant in the role editor. */
      requirePermission: "read",
    },
  },
} as const satisfies Record<string, ResourceDefinition>;

export type ResourceKey = keyof typeof RESOURCES;

export type LimitResourceKey = {
  [K in ResourceKey]: (typeof RESOURCES)[K] extends { limit: ResourceLimit }
    ? K
    : never;
}[ResourceKey];

export type FlagResourceKey = {
  [K in ResourceKey]: (typeof RESOURCES)[K] extends { flag: ResourceFlag }
    ? K
    : never;
}[ResourceKey];

export type PermissionedResourceKey = {
  [K in ResourceKey]: (typeof RESOURCES)[K] extends {
    permissions: readonly string[];
  }
    ? K
    : never;
}[ResourceKey];

export type PermissionAction<R extends PermissionedResourceKey> =
  (typeof RESOURCES)[R] extends { permissions: infer A }
    ? A extends readonly (infer T)[]
      ? T
      : never
    : never;

/**
 * SOURCE OF TRUTH KEYWORDS: Permission
 *
 * WHAT:  Template-literal union of every legal `resource:action` string plus
 *        the Better Auth owner wildcard `*:*`.
 * WHY:   Compile-time guarantee that permission strings exist in RESOURCES;
 *        prevents typos at every callsite of permission() and requirePermission.
 * WHERE: Re-exported from src/lib/better-auth/permissions.ts.
 */
export type Permission =
  | {
      [
        R in PermissionedResourceKey
      ]: `${R & string}:${PermissionAction<R> & string}`;
    }[PermissionedResourceKey]
  | "*:*";

/**
 * SOURCE OF TRUTH KEYWORDS: isResourceKey
 *
 * WHAT:  Type guard narrowing an arbitrary string to ResourceKey.
 * WHY:   hasOwnProperty so prototype-chain keys ('toString' etc.) do NOT pass.
 * WHERE: Used by getResourceFromPath and the RESOURCE_ENTRIES builder below.
 */
export function isResourceKey(value: string): value is ResourceKey {
  return Object.prototype.hasOwnProperty.call(RESOURCES, value);
}

/* Single widening point for iterating RESOURCES as [key, def] tuples — the
 * `as const satisfies` literal types refuse to see optional fields on the
 * union when iterated directly, so we widen here once. */
export const RESOURCE_ENTRIES: ReadonlyArray<
  readonly [ResourceKey, ResourceDefinition]
> = (() => {
  const out: Array<readonly [ResourceKey, ResourceDefinition]> = [];
  for (const key of Object.keys(RESOURCES)) {
    if (isResourceKey(key)) {
      out.push([key, RESOURCES[key]]);
    }
  }
  return out;
})();

/**
 * SOURCE OF TRUTH KEYWORDS: getResourceDefinition
 *
 * WHAT:  Reads one RESOURCES entry as the widened ResourceDefinition.
 * WHY:   Indexing RESOURCES with a variable ResourceKey yields a union of the
 *        `as const` literal shapes, on which optional fields like `nav` and
 *        `description` are unreachable — the same problem RESOURCE_ENTRIES
 *        solves for iteration. This is that widening point for a single lookup,
 *        so callers read `def.nav?.icon` instead of narrowing by hand.
 * WHERE: Any surface that resolves a resource by key at runtime — e.g. the
 *        marketing feature cards, which take their title and icon from the
 *        registry so the landing page and the sidebar can never disagree.
 */
export function getResourceDefinition(
  resource: ResourceKey,
): ResourceDefinition {
  return RESOURCES[resource];
}

/**
 * SOURCE OF TRUTH KEYWORDS: getOrganizationStatement
 *
 * WHAT:  Builds the resource→actions statement record consumed by Better Auth.
 * WHY:   Filters RESOURCES down to entries with permissions so non-permissioned
 *        resources (limits/flags only) do not pollute the access-control schema.
 * WHERE: Used by src/lib/better-auth/permissions.ts to build organizationStatement.
 */
export function getOrganizationStatement(): Record<string, readonly string[]> {
  const statement: Record<string, readonly string[]> = {};
  for (const [key, def] of RESOURCE_ENTRIES) {
    if (def.permissions && def.permissions.length > 0) {
      statement[key] = def.permissions;
    }
  }
  return statement;
}

/**
 * SOURCE OF TRUTH KEYWORDS: SidebarNavItem, SidebarNavSection, getSidebarNav
 *
 * WHAT:  Sidebar item shape (one per RESOURCES entry that declares `nav`) and
 *        the per-section grouping the sidebar renders.
 * WHY:   The sidebar is derived from the SAME registry that drives permissions
 *        and gates — adding `nav` to a resource is the ONLY step needed to make
 *        it appear in the sidebar, with its permission/flag gating already
 *        wired. No second nav source-of-truth file.
 * WHERE: Produced by getSidebarNav(); consumed by
 *        src/components/global/sidebar/app-sidebar.tsx.
 */
export interface SidebarNavItem {
  key: ResourceKey;
  label: string;
  href: string;
  icon: string;
  /** Resolved position within the section; see ResourceNav.order. */
  order: number;
  /** Full `resource:action` the member must hold; owners always pass. */
  requirePermission: Permission;
  /** When true, the item is hidden unless the resource's plan flag is on. */
  requireFlag: boolean;
}

export interface SidebarNavSection {
  section: string;
  items: SidebarNavItem[];
}

/* Render order for the known sections; unknown sections append after. */
const NAV_SECTION_ORDER: readonly string[] = ["create", "workspace"];

/* Sorts after every explicitly ordered item without tripping the
 * noUncheckedIndexedAccess-style guards a `??` on each comparison would need. */
const NAV_ORDER_LAST = Number.MAX_SAFE_INTEGER;

/**
 * SOURCE OF TRUTH KEYWORDS: getSidebarNav
 *
 * WHAT:  Builds the grouped sidebar nav from every RESOURCES entry with `nav`.
 * WHY:   Single registry pass — the item's permission defaults to
 *        `<resource>:read` unless the nav entry overrides the action, and
 *        `requireFlag` carries through so the sidebar can hide plan-locked
 *        items. Keeps the sidebar in lockstep with the registry.
 * WHERE: Called by app-sidebar.tsx (client) to render sections.
 */
export function getSidebarNav(): SidebarNavSection[] {
  const bySection = new Map<string, SidebarNavItem[]>();

  for (const [key, def] of RESOURCE_ENTRIES) {
    if (!def.nav) continue;
    const action = def.nav.requirePermission ?? "read";
    /* `${key}:${action}` is a Permission by construction, but RESOURCE_ENTRIES
     * is typed against the widened ResourceDefinition so TS sees `string`. This
     * is the same documented boundary the permission-constants builder uses. */
    const requirePermission = `${key}:${action}` as Permission;
    const section = def.nav.section ?? "create";
    const item: SidebarNavItem = {
      key,
      label: def.nav.label,
      href: def.nav.href,
      icon: def.nav.icon,
      order: def.nav.order ?? NAV_ORDER_LAST,
      requirePermission,
      requireFlag: def.nav.requireFlag ?? false,
    };
    const existing = bySection.get(section);
    if (existing) existing.push(item);
    else bySection.set(section, [item]);
  }

  const orderedKeys = [
    ...NAV_SECTION_ORDER.filter((s) => bySection.has(s)),
    ...[...bySection.keys()].filter((s) => !NAV_SECTION_ORDER.includes(s)),
  ];
  return orderedKeys.map((section) => ({
    section,
    /* Array#sort is stable in every engine this targets, so equal `order`
     * values keep their declaration order rather than shuffling per render. */
    items: (bySection.get(section) ?? []).sort((a, b) => a.order - b.order),
  }));
}

/**
 * SOURCE OF TRUTH KEYWORDS: getResourceFromPath
 *
 * WHAT:  Extracts the resource key from a tRPC procedure path like
 *        `projects.create` -> `projects`.
 * WHY:   Convention-driven auto-wiring (audit entity, limit checks, counter
 *        bumps) keys off the first path segment matching a RESOURCES entry.
 * WHERE: Used by protectedProcedure (src/trpc/procedures/protected.ts).
 */
export function getResourceFromPath(path: string): ResourceKey | null {
  if (!path) return null;
  const first = path.split(".")[0];
  if (first === undefined) return null;
  return isResourceKey(first) ? first : null;
}

function isLimitEntry(
  entry: readonly [ResourceKey, ResourceDefinition],
): entry is readonly [
  LimitResourceKey,
  ResourceDefinition & { limit: ResourceLimit },
] {
  return entry[1].limit !== undefined;
}

function isFlagEntry(
  entry: readonly [ResourceKey, ResourceDefinition],
): entry is readonly [
  FlagResourceKey,
  ResourceDefinition & { flag: ResourceFlag },
] {
  return entry[1].flag !== undefined;
}

/**
 * SOURCE OF TRUTH KEYWORDS: getMutationFeatureMap, AUTO_DERIVED_FROM_RESOURCES
 *
 * WHAT:  Builds the client-side `procedure.path -> { resource, operation }` map
 *        used to optimistically bump usage counters on success.
 * WHY:   Rigid by design — if a procedure should bump a counter but doesn't
 *        fit `<resource>.create` / `<resource>.delete`, rename the procedure
 *        rather than special-casing here. The server-side counter bump is
 *        AUTO_DERIVED_FROM_RESOURCES in protectedProcedure off the same path
 *        shape, so client and server stay in lockstep without a second
 *        registry.
 * WHERE: Consumed by src/trpc/react-provider.tsx for optimistic UI.
 */
export function getMutationFeatureMap(): Record<
  string,
  { resource: LimitResourceKey; operation: "increment" | "decrement" }
> {
  const map: Record<
    string,
    { resource: LimitResourceKey; operation: "increment" | "decrement" }
  > = {};
  for (const entry of RESOURCE_ENTRIES) {
    if (!isLimitEntry(entry)) continue;
    const [key] = entry;
    map[`${key}.create`] = { resource: key, operation: "increment" };
    map[`${key}.delete`] = { resource: key, operation: "decrement" };
  }
  return map;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * SOURCE OF TRUTH KEYWORDS: interpolateAuditDescribe
 *
 * WHAT:  Interpolates `{input.field}` / `{output.field}` placeholders in audit
 *        description templates against the procedure's input and output.
 * WHY:   Missing keys render as the literal placeholder so audit rows stay
 *        inspectable instead of crashing.
 * WHERE: Called by protectedProcedure's auto-audit path
 *        (src/trpc/procedures/protected.ts).
 */
export function interpolateAuditDescribe(
  template: string,
  params: { input: unknown; output: unknown },
): string {
  return template.replace(
    /\{(input|output)\.([a-zA-Z0-9_]+)\}/g,
    (_, source, field) => {
      const obj = source === "input" ? params.input : params.output;
      if (!isJsonObject(obj) || !(field in obj)) {
        return `{${source}.${field}}`;
      }
      const value = obj[field];
      if (value === null || value === undefined) return `{${source}.${field}}`;
      return String(value);
    },
  );
}

/**
 * SOURCE OF TRUTH KEYWORDS: getResourceLimitForPlan
 *
 * WHAT:  Resolves a numeric cap for a (resource, plan) pair, mapping
 *        'unlimited' to Infinity.
 * WHY:   Centralises the 'unlimited' sentinel so comparisons are simple
 *        `current >= cap` everywhere downstream.
 * WHERE: Used by src/lib/feature-gate.ts and the usage-counter logic.
 */
export function getResourceLimitForPlan(
  resource: LimitResourceKey,
  plan: PlanKey,
): number {
  const value = RESOURCES[resource].limit.perPlan[plan];
  return value === "unlimited" ? Infinity : value;
}

/**
 * SOURCE OF TRUTH KEYWORDS: getResourceFlagForPlan
 *
 * WHAT:  Returns the boolean availability of a flag resource for a given plan.
 * WHY:   Single read-point for feature-flag gating so requireFlag and the UI
 *        agree on availability.
 * WHERE: Used by src/lib/feature-gate.ts and nav rendering.
 */
export function getResourceFlagForPlan(
  resource: FlagResourceKey,
  plan: PlanKey,
): boolean {
  return RESOURCES[resource].flag.perPlan[plan];
}

/* `satisfies` is load-bearing: if a new limit/flag resource gets added and
 * the tuple isn't updated, TS fails to compile. */
export const LIMIT_RESOURCE_KEYS = RESOURCE_ENTRIES.filter(isLimitEntry).map(
  ([k]) => k,
) satisfies readonly LimitResourceKey[];

export const FLAG_RESOURCE_KEYS = RESOURCE_ENTRIES.filter(isFlagEntry).map(
  ([k]) => k,
) satisfies readonly FlagResourceKey[];

/* ---------- Pricing presentation ----------
 *
 * Everything below turns the registry above into human-readable copy. It is
 * deliberately separate from getResourceLimitForPlan: that helper maps
 * 'unlimited' to Infinity because the GATE layer needs a number to compare,
 * and printing "Infinity" on a pricing page would be a bug. These read the
 * perPlan value RAW instead.
 */

/* REMOVED: BYTE_UNITS / formatBytesLimit. They existed only to render the
 * `bytes` unit, which `storage` was the sole author of — with that placeholder
 * gone no limit is measured in bytes, so the formatter was unreachable and its
 * `unit === "bytes"` branches were provably-dead comparisons. Reinstate both
 * alongside a storage resource that is actually enforced. */

/**
 * SOURCE OF TRUTH KEYWORDS: formatResourceLimit
 *
 * WHAT:  The bare cap for a (resource, plan) as display text — "500",
 *        "Unlimited", "5 GB", "50,000".
 * WHY:   Reads RESOURCES[...].limit.perPlan[plan] RAW rather than going through
 *        getResourceLimitForPlan, which would hand back Infinity for the
 *        enterprise tier. Digit grouping uses the same pinned locale as prices
 *        so the whole pricing page formats numbers one way.
 * WHERE: The comparison table cells and the free-tier stat band.
 */
/**
 * SOURCE OF TRUTH KEYWORDS: getRawResourceLimit
 *
 * WHAT:  The authored cap for a (resource, plan) — a number, or the literal
 *        'unlimited' sentinel.
 * WHY:   Sits between the two existing readers: getResourceLimitForPlan maps the
 *        sentinel to Infinity for comparisons, formatResourceLimit renders it as
 *        text. A UI that has to ANIMATE the number needs it as a number while
 *        still knowing when there isn't one.
 * WHERE: The count-up stat band on the landing page.
 */
export function getRawResourceLimit(
  resource: LimitResourceKey,
  plan: PlanKey,
): number | "unlimited" {
  return RESOURCES[resource].limit.perPlan[plan];
}

export function formatResourceLimit(
  resource: LimitResourceKey,
  plan: PlanKey,
): string {
  const value = RESOURCES[resource].limit.perPlan[plan];
  if (value === "unlimited") return "Unlimited";
  return value.toLocaleString(PLAN_PRICE_LOCALE);
}

/**
 * SOURCE OF TRUTH KEYWORDS: formatResourceAllowance
 *
 * WHAT:  The cap WITH its unit, as a pricing-card bullet — "500 posts",
 *        "Unlimited posts", "100 MB storage".
 * WHY:   Pricing bullets are generated from the registry rather than typed by
 *        hand, so editing a cap in RESOURCES updates the marketing claim in the
 *        same commit and the two can never contradict each other.
 * WHERE: Pricing card bullet lists and the hero's free-tier trust line.
 */
/* Units are authored plural in RESOURCES because that is how they read in a
 * usage meter ("3 of 50 analyses"). Only the irregular ones need listing —
 * everything else loses its trailing "s". */
const SINGULAR_UNITS: Record<string, string> = {
  analyses: "analysis",
};

function singularizeUnit(unit: string): string {
  return SINGULAR_UNITS[unit] ?? unit.replace(/s$/, "");
}

export function formatResourceAllowance(
  resource: LimitResourceKey,
  plan: PlanKey,
): string {
  const limit = RESOURCES[resource].limit;
  const { unit } = limit;
  const amount = formatResourceLimit(resource, plan);
  if (!unit) return amount;
  /* A cap of exactly 1 is common on the free tier, and "1 plans" on the hero
   * is the kind of detail that makes a landing page look unfinished. */
  const label = limit.perPlan[plan] === 1 ? singularizeUnit(unit) : unit;
  return `${amount} ${label}`;
}

/**
 * SOURCE OF TRUTH KEYWORDS: PricingCell, PricingMatrixRow, getPricingMatrix
 *
 * WHAT:  One row per plan-gated resource, with a pre-formatted cell per
 *        purchasable plan — quantities carry their label plus an `unlimited`
 *        marker, flags carry a boolean.
 * WHY:   A discriminated union rather than a bare string so the table can render
 *        a check/dash icon for flags and emphasise "Unlimited" for quantities,
 *        without re-deriving what kind of resource it is looking at. Columns come
 *        from PLAN_ORDER, so the hidden `portal` tier is excluded structurally
 *        rather than by a filter every caller has to remember.
 * WHERE: src/app/(marketing)/_components/plan-comparison-table.tsx.
 */
export type PricingCell =
  | { kind: "quantity"; label: string; unlimited: boolean }
  | { kind: "boolean"; included: boolean };

export interface PricingMatrixRow {
  key: ResourceKey;
  name: string;
  description?: string | undefined;
  /* Partial on purpose: only PLAN_ORDER members get a cell, so the hidden
   * `portal` tier is genuinely absent rather than filled with a placeholder.
   * The renderer treats a missing cell as "not offered". */
  cells: Readonly<Partial<Record<PlanKey, PricingCell>>>;
}

export function getPricingMatrix(): readonly PricingMatrixRow[] {
  const rows: PricingMatrixRow[] = [];

  for (const entry of RESOURCE_ENTRIES) {
    const [key, def] = entry;
    const cells: Partial<Record<PlanKey, PricingCell>> = {};

    if (isLimitEntry(entry)) {
      const [limitKey, limitDef] = entry;
      for (const plan of PLAN_ORDER) {
        cells[plan] = {
          kind: "quantity",
          label: formatResourceLimit(limitKey, plan),
          unlimited: limitDef.limit.perPlan[plan] === "unlimited",
        };
      }
    } else if (isFlagEntry(entry)) {
      const [flagKey] = entry;
      for (const plan of PLAN_ORDER) {
        cells[plan] = {
          kind: "boolean",
          included: getResourceFlagForPlan(flagKey, plan),
        };
      }
    } else {
      /* Neither a limit nor a flag — nothing a buyer can compare. */
      continue;
    }

    rows.push({ key, name: def.name, description: def.description, cells });
  }

  return rows;
}
