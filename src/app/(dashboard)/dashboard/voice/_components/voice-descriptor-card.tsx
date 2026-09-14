/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: VoiceDescriptorCard, VoiceDescriptorCardProps,
 *   extracted voice view, voice card, revert voice, discard voice
 *
 * WHAT:  The extracted voice as the member reads it (summary, traits, how they
 *        open and close, their phrases), plus switching it on or off, going back
 *        to the previous extraction, and discarding it.
 * WHY:   Shows what the MODEL concluded, not the merged voice, so the member can
 *        see what to correct in the overrides form beneath it. Low confidence and
 *        an outdated extractor are both stated outright: a thin voice presented
 *        as a finding is worse than no voice.
 * WHERE: Rendered by voice-workspace.tsx.
 */

import * as React from "react";
import { Loader2Icon, Undo2Icon } from "lucide-react";

import {
  VOICE_EMOJI_USE_LABELS,
  VOICE_JARGON_LABELS,
  VOICE_LIST_STYLE_LABELS,
  VOICE_LOW_CONFIDENCE_THRESHOLD,
  VOICE_REGISTER_LABELS,
  VOICE_RHYTHM_LABELS,
} from "@/lib/config";
import type { StoredVoiceProfile } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface VoiceDescriptorCardProps {
  profile: StoredVoiceProfile | null;
  onToggleActive: (isActive: boolean) => void;
  onRevert: () => void;
  /** Resolves once the discard lands; rejects after the workspace has shown why. */
  onDiscard: () => Promise<void>;
  isUpdating: boolean;
  isReverting: boolean;
  isDiscarding: boolean;
  canUpdate: boolean;
  canRevert: boolean;
  canDiscard: boolean;
}

export function VoiceDescriptorCard({
  profile,
  onToggleActive,
  onRevert,
  onDiscard,
  isUpdating,
  isReverting,
  isDiscarding,
  canUpdate,
  canRevert,
  canDiscard,
}: VoiceDescriptorCardProps) {
  const [isConfirmOpen, setIsConfirmOpen] = React.useState(false);
  const current = profile?.current ?? null;

  if (!profile || !current) {
    return (
      <Card className="surface-raised">
        <CardHeader>
          <CardTitle className="text-base">Your voice</CardTitle>
          <CardDescription>
            {profile
              ? "This voice was saved in a format this version can't read. Re-extract it to use it again."
              : "No voice yet. Until you extract one, drafts use the default style."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { descriptor } = current;
  const showRevert = canRevert && profile.canRevert;

  const traits = [
    {
      label: "Register",
      value: VOICE_REGISTER_LABELS[descriptor.vocabulary.register],
    },
    {
      label: "Vocabulary",
      value: VOICE_JARGON_LABELS[descriptor.vocabulary.jargonTolerance],
    },
    {
      label: "Rhythm",
      value: VOICE_RHYTHM_LABELS[descriptor.sentenceRhythm.variance],
    },
    {
      label: "Sentence length",
      value: `About ${descriptor.sentenceRhythm.averageSentenceWords} words`,
    },
    {
      label: "Paragraphs",
      value: `Up to ${descriptor.formatting.paragraphMaxLines} lines`,
    },
    {
      label: "Emoji",
      value: VOICE_EMOJI_USE_LABELS[descriptor.formatting.emojiUse],
    },
    {
      label: "Lists",
      value: VOICE_LIST_STYLE_LABELS[descriptor.formatting.listStyle],
    },
    {
      label: "Hashtags",
      value:
        descriptor.formatting.hashtagCount === 0
          ? "None"
          : `Up to ${descriptor.formatting.hashtagCount}`,
    },
  ];

  const patternGroups = [
    { title: "How you open", patterns: descriptor.openingPatterns },
    { title: "How you close", patterns: descriptor.closingPatterns },
  ];

  const phraseGroups = [
    {
      title: "Phrases that sound like you",
      phrases: descriptor.vocabulary.signaturePhrases,
      variant: "secondary",
    },
    {
      title: "Words you avoid",
      phrases: descriptor.vocabulary.avoidedWords,
      variant: "outline",
    },
  ] as const;

  return (
    <Card className="surface-raised">
      <CardHeader>
        <CardTitle className="text-base">Your voice</CardTitle>
        <CardDescription>
          Learned from {profile.sampleCount} posts on{" "}
          {new Date(current.extractedAt).toLocaleDateString()}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <Label
              htmlFor="voice-active"
              className="text-xs text-muted-foreground"
            >
              Use in drafts
            </Label>
            <Switch
              id="voice-active"
              checked={profile.isActive}
              disabled={!canUpdate || isUpdating}
              onCheckedChange={onToggleActive}
            />
          </div>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {profile.isOutdated ? (
          <Alert>
            <AlertTitle>Voice reading has improved</AlertTitle>
            <AlertDescription>
              This voice was read by an older version. Re-extract it for a
              sharper result.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <p className="text-sm leading-relaxed">{descriptor.summary}</p>
          <p className="text-xs text-muted-foreground">
            Confidence {Math.round(descriptor.confidence * 100)}%
            {descriptor.confidence < VOICE_LOW_CONFIDENCE_THRESHOLD
              ? ". Add more or longer posts and re-extract for a sharper read."
              : null}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {traits.map((trait) => (
            <div key={trait.label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-muted-foreground">{trait.label}</dt>
              <dd>{trait.value}</dd>
            </div>
          ))}
        </dl>

        {patternGroups.map((group) =>
          group.patterns.length > 0 ? (
            <div key={group.title} className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {group.title}
              </p>
              <ul className="flex flex-col gap-2">
                {group.patterns.map((entry, index) => (
                  <li
                    key={`${group.title}-${index}`}
                    className="rounded-md border p-3 text-sm"
                  >
                    <p>{entry.pattern}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      &ldquo;{entry.example}&rdquo;
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}

        {phraseGroups.map((group) =>
          group.phrases.length > 0 ? (
            <div key={group.title} className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                {group.title}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.phrases.map((phrase) => (
                  <Badge key={phrase} variant={group.variant}>
                    {phrase}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null,
        )}
      </CardContent>

      {showRevert || canDiscard ? (
        <CardFooter className="flex flex-wrap justify-end gap-2">
          {showRevert ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isReverting}
              onClick={onRevert}
            >
              {isReverting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <Undo2Icon className="size-4" />
              )}
              Switch to previous voice
            </Button>
          ) : null}
          {canDiscard ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={isDiscarding}
              onClick={() => setIsConfirmOpen(true)}
            >
              Discard
            </Button>
          ) : null}
        </CardFooter>
      ) : null}

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your voice?</AlertDialogTitle>
            <AlertDialogDescription>
              Drafts go back to the default style, and this voice and the
              previous one are both removed. This does not return the extraction
              to your plan&rsquo;s allowance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDiscarding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDiscarding}
              onClick={() => {
                /* Closed only once the discard lands, so a failure is not a
                 * dialog that vanished having done nothing. The workspace
                 * already toasts the reason, so a rejection needs no handling. */
                void onDiscard().then(
                  () => setIsConfirmOpen(false),
                  () => undefined,
                );
              }}
            >
              Discard voice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
