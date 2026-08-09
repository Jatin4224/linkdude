/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ContentPlanChat, ContentPlanTurn, buildTranscript
 *
 * WHAT:  The Personalized Content Plan screen — a guided chat that reads a
 *        LinkedIn profile, asks four questions, and generates a posting strategy.
 * WHY:   The transcript is DERIVED, never stored. `buildTranscript` replays the
 *        step registry against the answers on the session row, so resuming is the
 *        same code path as answering live, a session survives a device change,
 *        and rewording a question improves old sessions instead of leaving them
 *        quoting text that no longer exists.
 *
 *        Which step is current is derived the same way — from the first
 *        unanswered key — rather than kept as a cursor. A stored cursor is the
 *        thing that goes stale when the Refine bar edits an answer in the middle
 *        of a finished set.
 *
 *        Every spending action is gated client-side on the same permission the
 *        server enforces, so a member without it sees a disabled control and a
 *        reason rather than clicking into a FORBIDDEN toast.
 * WHERE: Rendered by the content-plan page. Calls the contentPlan router, plus
 *        profileLookup for the paid fetch that precedes contentPlan.brief.
 */

import * as React from "react";
import { CompassIcon } from "lucide-react";
import { toast } from "sonner";

import { playSound } from "@/lib/sound";

import { trpc } from "@/trpc/react-provider";
import {
  useActiveOrganization,
  useActiveOrganizationId,
} from "@/hooks/use-active-organization";
import { permissions } from "@/lib/better-auth/permissions";
import {
  CONTENT_PLAN_GOALS_MAX,
  contentPlanAnswersSchema,
  type ContentPlanDraftAnswers,
  type ContentPlanStepKey,
  type StartContentPlanValues,
} from "@/lib/types";
import {
  CONTENT_PLAN_STEPS,
  CONTENT_PLAN_STEP_ENTRIES,
  contentPlanAnswerText,
  firstUnansweredContentPlanStep,
  isContentPlanAnswered,
} from "@/lib/config";
import { ContentLayout } from "@/components/global/page-header";
import { UsageMeter } from "@/components/global/usage-meter";
import { ChatMessage, ChatOptions, ChatShell, ChatTyping } from "@/components/global/chat";
import { Button } from "@/components/ui/button";
import { ContentPlanUrlStep } from "./content-plan-url-step";
import { ContentPlanInsightsCard } from "./content-plan-insights";
import { ContentPlanResultView } from "./content-plan-result";
import { ContentPlanRefineBar } from "./content-plan-refine";

/**
 * SOURCE OF TRUTH KEYWORDS: ContentPlanTurn
 *
 * WHAT:  One rendered turn in the transcript.
 * WHY:   `node` rather than a string: half the assistant turns are cards, not
 *        text. Typed locally rather than in lib/types because it is a rendering
 *        detail of this screen — nothing is persisted or sent in this shape.
 */
interface ContentPlanTurn {
  id: string;
  role: "assistant" | "user";
  node: React.ReactNode;
  /** Cards bring their own surface, so they opt out of the bubble. */
  unstyled?: boolean;
}

export function ContentPlanChat() {
  const organizationId = useActiveOrganizationId();
  const { hasPermission } = useActiveOrganization();
  const utils = trpc.useUtils();

  const enabled = organizationId !== undefined;
  const orgId = organizationId ?? "";

  const canGenerate = hasPermission(permissions.CONTENT_PLAN_CREATE);
  const canRead = hasPermission(permissions.CONTENT_PLAN_READ);
  const canUpdate = hasPermission(permissions.CONTENT_PLAN_UPDATE);
  const canDiscard = hasPermission(permissions.CONTENT_PLAN_DISCARD);
  /* A lookup is its own metered resource with its own permission — a member may
     be allowed to build a plan without being allowed to spend vendor budget. */
  const canLookUp = hasPermission(permissions.PROFILE_LOOKUP_CREATE);

  const { data: user } = trpc.user.getProfile.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const session = trpc.contentPlan.get.useQuery(
    { organizationId: orgId },
    { enabled: enabled && canRead },
  );

  /**
   * Which question is on screen. Normally derived from the answers, but the
   * Refine bar needs to force an EARLIER step that is already answered — so this
   * override exists purely for that, and is cleared as soon as it is used.
   */
  const [editing, setEditing] = React.useState<ContentPlanStepKey | null>(null);
  /* Named so the typing bubble can say what it is waiting on rather than spin. */
  const [busyLabel, setBusyLabel] = React.useState<string | null>(null);

  const plan = session.data ?? null;
  const answers: ContentPlanDraftAnswers = plan?.answers ?? {};

  const currentStep = editing ?? firstUnansweredContentPlanStep(answers);

  /**
   * SOURCE OF TRUTH KEYWORDS: startedHere, isResumed
   *
   * WHAT:  Whether the session on screen was opened during this visit.
   * WHY:   "Welcome back!" is only true for a session the user is RETURNING to.
   *        Deriving the greeting from `plan !== null` alone would show it the
   *        instant someone pasted a URL in this very sitting, which reads as the
   *        app losing track of a conversation two seconds old.
   *
   *        Set from the event that actually starts a plan rather than latched off
   *        the first query result — the fetch tells you a row exists, not who put
   *        it there, and reading that distinction out of a ref during render is
   *        exactly the impurity the React compiler rejects.
   */
  const [startedHere, setStartedHere] = React.useState(false);
  const isResumed = plan !== null && !startedHere;

  /* Both queries and mutations write to the same row, so every mutation
     invalidates the session; `usage` moves only when quota is actually spent. */
  async function refreshSession() {
    await utils.contentPlan.get.invalidate();
  }

  const lookup = trpc.profileLookup.create.useMutation();
  const brief = trpc.contentPlan.brief.useMutation();
  const saveProgress = trpc.contentPlan.saveProgress.useMutation();
  const generate = trpc.contentPlan.create.useMutation();
  const savePlan = trpc.contentPlan.save.useMutation();
  const discard = trpc.contentPlan.discard.useMutation();

  const isBusy =
    lookup.isPending ||
    brief.isPending ||
    generate.isPending ||
    discard.isPending;

  /**
   * SOURCE OF TRUTH KEYWORDS: handleStart
   *
   * WHAT:  Loads the profile and opens a session against it.
   * WHY:   Two calls in sequence, deliberately. `profileLookup.create` owns the
   *        paid vendor fetch — and its own quota, counter and cache — so this
   *        screen never fetches a profile itself; `contentPlan.brief` then reads
   *        that cache server-side. Running the lookup first is what makes the
   *        brief's cache read always hit.
   */
  async function handleStart(values: StartContentPlanValues) {
    if (!enabled || !canGenerate) return;

    try {
      if (canLookUp) {
        setBusyLabel("Reading your LinkedIn profile");
        await lookup.mutateAsync({
          profileUrl: values.profileUrl,
          organizationId: orgId,
        });
        /* A lookup is metered on its own quota, so the meter has to move even
           though nothing about the plan has changed yet. */
        await utils.usage.invalidate();
      }

      setBusyLabel("Working out what stands out");
      await brief.mutateAsync({
        profileUrl: values.profileUrl,
        organizationId: orgId,
      });
      /* This visit owns the session now, so it is not a "welcome back". */
      setStartedHere(true);
      await refreshSession();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not read that profile. Please try again.",
      );
    } finally {
      setBusyLabel(null);
    }
  }

  /**
   * SOURCE OF TRUTH KEYWORDS: handleAnswer
   *
   * WHAT:  Records an answer and, when it completes the set, generates the plan.
   * WHY:   Progress is saved on EVERY answer rather than once at the end — that
   *        single call is the whole of the "Welcome back" promise, and batching it
   *        would mean an interrupted session loses exactly the answers the user
   *        already gave.
   *
   *        The completed answer set is validated here before generating so a
   *        malformed value fails locally instead of spending a quota unit to
   *        learn the same thing from the server.
   */
  async function handleAnswer(step: ContentPlanStepKey, values: string[]) {
    if (!enabled || !canUpdate) return;

    const answer =
      step === "goals" ? values : (values[0] ?? "");
    const nextAnswers: ContentPlanDraftAnswers = {
      ...answers,
      [step]: answer,
    };

    setEditing(null);

    try {
      await saveProgress.mutateAsync({
        answers: nextAnswers,
        organizationId: orgId,
      });
      await refreshSession();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save your answer.",
      );
      return;
    }

    const complete = contentPlanAnswersSchema.safeParse(nextAnswers);
    if (!complete.success) return;

    await runGeneration(complete.data);
  }

  async function runGeneration(
    validated: ReturnType<typeof contentPlanAnswersSchema.parse>,
  ) {
    if (!canGenerate) {
      toast.error("You don't have permission to generate content plans.");
      return;
    }

    setBusyLabel("Building your 30-day plan");
    try {
      await generate.mutateAsync({
        answers: validated,
        organizationId: orgId,
      });
      /* The plan quota just moved, and the row changed — both are server facts. */
      await Promise.all([refreshSession(), utils.usage.invalidate()]);
      toast.success("Your content plan is ready.");
      /* Silent unless the user opted in. This is the longest job in the app —
         long enough that people switch tabs — which is the whole reason a cue
         earns its place here and nowhere else. */
      playSound("jobComplete");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Content plan generation failed. Please try again.",
      );
    } finally {
      setBusyLabel(null);
    }
  }

  async function handleSave() {
    if (!enabled || !canUpdate) return;
    try {
      await savePlan.mutateAsync({ organizationId: orgId });
      await refreshSession();
      toast.success("Plan saved.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the plan.",
      );
    }
  }

  async function handleStartNew() {
    if (!enabled || !canDiscard) return;
    try {
      await discard.mutateAsync({ organizationId: orgId });
      setEditing(null);
      /* Back to an empty slate: whatever comes next is started here, not resumed. */
      setStartedHere(false);
      await refreshSession();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not start a new plan.",
      );
    }
  }

  /**
   * SOURCE OF TRUTH KEYWORDS: buildTranscript
   *
   * WHAT:  Rebuilds the conversation from the stored session.
   * WHY:   The single reason there is no message table. Each answered step
   *        contributes the question the registry declares plus the answer the row
   *        holds, so a resumed session and a live one produce byte-identical
   *        transcripts and nothing below has to branch on which it is looking at.
   */
  const transcript = React.useMemo<ContentPlanTurn[]>(() => {
    const turns: ContentPlanTurn[] = [];

    if (!plan) {
      turns.push({
        id: "intro",
        role: "assistant",
        node: CONTENT_PLAN_STEPS.profileUrl.prompt,
      });
      return turns;
    }

    /* Only for a session this visit did not create — see resumedRef. */
    if (isResumed) {
      turns.push({
        id: "welcome",
        role: "assistant",
        node:
          plan.result === null
            ? "Welcome back! Your content plan progress was saved."
            : "Welcome back! Here's the plan we built together.",
      });
    }

    for (const step of CONTENT_PLAN_STEP_ENTRIES) {
      if (!isContentPlanAnswered(answers, step.key)) break;

      /* The URL step is not replayed as a question — the profile insights below
         are its answer, and re-showing "paste your URL" above them reads as if
         the app is asking again. */
      if (step.kind !== "url") {
        turns.push({
          id: `q-${step.key}`,
          role: "assistant",
          node: step.prompt,
        });
      }

      turns.push({
        id: `a-${step.key}`,
        role: "user",
        node: contentPlanAnswerText(answers, step.key),
      });

      /* Insights land immediately after the URL answer, which is where the
         conversation actually produced them. */
      if (step.kind === "url" && plan.insights) {
        turns.push({
          id: "insights",
          role: "assistant",
          unstyled: true,
          node: (
            <ContentPlanInsightsCard
              insights={plan.insights}
              profileName={plan.profile?.name ?? null}
            />
          ),
        });
      }
    }

    if (plan.result) {
      turns.push({
        id: "result",
        role: "assistant",
        unstyled: true,
        node: (
          <ContentPlanResultView
            result={plan.result}
            status={plan.status}
            onSave={handleSave}
            onStartNew={handleStartNew}
            isSaving={savePlan.isPending}
            canSave={canUpdate}
            canStartNew={canDiscard}
          />
        ),
      });
      turns.push({
        id: "refine",
        role: "assistant",
        unstyled: true,
        node: (
          <ContentPlanRefineBar
            onEdit={setEditing}
            disabled={isBusy || !canGenerate}
          />
        ),
      });

      /* Refining re-asks the question below the plan, so the chips in the
         composer have something to belong to — otherwise the user taps "Edit
         Goal" and the options appear with no prompt attached to them. */
      if (editing) {
        turns.push({
          id: `edit-${editing}`,
          role: "assistant",
          node: CONTENT_PLAN_STEPS[editing].prompt,
        });
      }
    } else if (currentStep) {
      turns.push({
        id: `ask-${currentStep}`,
        role: "assistant",
        node: CONTENT_PLAN_STEPS[currentStep].prompt,
      });
    }

    return turns;
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [
    plan,
    currentStep,
    editing,
    isResumed,
    isBusy,
    savePlan.isPending,
    canUpdate,
    canDiscard,
    canGenerate,
  ]);

  const activeStep = currentStep ? CONTENT_PLAN_STEPS[currentStep] : null;

  /**
   * The composer. Which control shows is decided by the current step's `kind`,
   * not by a chain of state flags — so a step added to the registry gets the
   * right input with nothing changed here.
   */
  function renderComposer(): React.ReactNode {
    if (!enabled || !canRead) return null;

    if (!canGenerate) {
      return (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to build content plans. Ask an
          organization owner for access.
        </p>
      );
    }

    if (isBusy) return null;

    /* A finished plan's only composer action is starting over — refining runs
       from the bar in the transcript, next to the plan it is refining. */
    if (plan?.result && !editing) {
      return (
        <Button
          type="button"
          variant="outline"
          onClick={handleStartNew}
          disabled={!canDiscard}
        >
          Start New
        </Button>
      );
    }

    if (!activeStep || !currentStep) return null;

    if (activeStep.kind === "url") {
      return (
        <ContentPlanUrlStep
          onSubmit={handleStart}
          isBusy={Boolean(busyLabel)}
          busyLabel={busyLabel ?? undefined}
          disabled={!canGenerate}
        />
      );
    }

    const existing = answers[currentStep];
    return (
      <ChatOptions
        /* Remounts per question, which is what resets the chips — see the note
           in ChatOptions about why this is a key rather than a syncing effect. */
        key={currentStep}
        options={activeStep.options}
        selected={
          existing === undefined
            ? []
            : Array.isArray(existing)
              ? existing
              : [existing]
        }
        multiSelect={activeStep.multiSelect}
        max={activeStep.multiSelect ? CONTENT_PLAN_GOALS_MAX : undefined}
        allowFreeText={activeStep.allowFreeText}
        placeholder={activeStep.placeholder}
        disabled={!canUpdate}
        onSubmit={(values) => void handleAnswer(currentStep, values)}
      />
    );
  }

  return (
    <ContentLayout
      title="Personalized Content Plan"
      description="Your guided LinkedIn strategy"
      icon={<CompassIcon className="size-4" />}
      actions={<UsageMeter resource="contentPlan" />}
      bare
    >
      <ChatShell
        scrollKey={`${transcript.length}-${busyLabel ?? ""}`}
        footer={renderComposer()}
      >
        {transcript.map((turn) => (
          <ChatMessage
            key={turn.id}
            role={turn.role}
            name={user?.name ?? user?.email ?? null}
            avatarUrl={turn.role === "user" ? (user?.image ?? null) : null}
            unstyled={turn.unstyled ?? false}
          >
            {turn.node}
          </ChatMessage>
        ))}

        {busyLabel ? <ChatTyping label={busyLabel} /> : null}
      </ChatShell>
    </ContentLayout>
  );
}
