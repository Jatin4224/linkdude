/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ChatOptions, ChatOptionsProps
 *
 * WHAT:  Tap-able quick replies — the chips a user answers a scripted question
 *        with, in single- or multi-select form, with an optional free-text way out.
 * WHY:   Built from `<button aria-pressed>` rather than a radio group, matching
 *        the pattern already used for headline choices in the analyzer: there is
 *        no radio-group or toggle-group in components/ui, and adding one to
 *        express a control that is really "a row of buttons" would be a
 *        dependency bought for styling.
 *
 *        Multi-select confirms explicitly rather than advancing on each tap.
 *        With single-select, the tap IS the answer and a Continue button would be
 *        a second click for nothing; with multi-select there is no way to know
 *        the user is finished, so the button is what says so.
 * WHERE: The content-plan chat's question steps.
 */

import * as React from "react";
import { CheckIcon, PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ChatOptionsProps {
  /** The suggested answers. */
  options: readonly string[];
  /**
   * Values to open with. Read ONCE as the initial state — see the note in the
   * body about why this component is reset with a `key` rather than an effect.
   */
  selected?: readonly string[] | undefined;
  multiSelect?: boolean | undefined;
  /** Ceiling on picks when multiSelect. Extra chips disable at the limit. */
  max?: number | undefined;
  /** Shows the "Something else" escape hatch. */
  allowFreeText?: boolean | undefined;
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  /** Fires with the final answer — one entry for single-select. */
  onSubmit: (values: string[]) => void;
}

export function ChatOptions({
  options,
  selected = [],
  multiSelect = false,
  max,
  allowFreeText = false,
  placeholder = "Type your answer",
  disabled = false,
  onSubmit,
}: ChatOptionsProps) {
  /* Seeded from `selected` once, then owned locally. Re-seeding for a DIFFERENT
   * question is the CALLER's job: it passes a `key` that changes per step, and
   * React remounts this with fresh initial state.
   *
   * Deliberately not a syncing effect. An effect would also run on unrelated
   * re-renders — a sibling mutation settling, a query refetching — and wipe
   * picks the user had just made but not yet confirmed. Resetting state with a
   * key is the supported way to say "this is a different instance". */
  const [picked, setPicked] = React.useState<string[]>([...selected]);
  const [freeText, setFreeText] = React.useState("");
  const [writing, setWriting] = React.useState(false);

  const atLimit = multiSelect && max !== undefined && picked.length >= max;

  function handleChip(option: string) {
    if (disabled) return;

    if (!multiSelect) {
      /* The tap is the answer. */
      onSubmit([option]);
      return;
    }

    setPicked((current) =>
      current.includes(option)
        ? current.filter((value) => value !== option)
        : current.length >= (max ?? Infinity)
          ? current
          : [...current, option],
    );
  }

  function handleFreeTextSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = freeText.trim();
    if (!value || disabled) return;
    onSubmit(multiSelect ? [...picked, value] : [value]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isActive = picked.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isActive}
              disabled={disabled || (!isActive && atLimit)}
              onClick={() => handleChip(option)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50",
                isActive
                  ? "border-brand-border bg-brand-soft text-brand-soft-foreground"
                  : "bg-muted/40 hover:bg-muted",
              )}
            >
              <span className="flex items-center gap-1.5">
                {isActive ? <CheckIcon className="size-3.5" /> : null}
                {option}
              </span>
            </button>
          );
        })}

        {allowFreeText && !writing ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setWriting(true)}
            className={cn(
              "rounded-full border border-dashed px-3.5 py-1.5 text-sm text-muted-foreground transition-colors",
              "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <span className="flex items-center gap-1.5">
              <PencilIcon className="size-3.5" />
              Something else
            </span>
          </button>
        ) : null}
      </div>

      {allowFreeText && writing ? (
        <form onSubmit={handleFreeTextSubmit} className="flex gap-2">
          <Input
            autoFocus
            value={freeText}
            onChange={(event) => setFreeText(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            aria-label={placeholder}
          />
          <Button
            type="submit"
            variant="brand"
            disabled={disabled || freeText.trim().length === 0}
          >
            Send
          </Button>
        </form>
      ) : null}

      {multiSelect ? (
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="brand"
            disabled={disabled || picked.length === 0}
            onClick={() => onSubmit(picked)}
          >
            Continue
          </Button>
          {max !== undefined ? (
            <span className="text-xs text-muted-foreground">
              {picked.length} of {max} selected
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
