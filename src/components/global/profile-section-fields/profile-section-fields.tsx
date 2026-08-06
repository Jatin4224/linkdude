/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ProfileSectionFields, ProfileSectionFieldsProps
 *
 * WHAT:  The add/remove editor for one structured profile section — roles,
 *        projects, certifications or education.
 * WHY:   ONE component for all four sections. Every section shares the same
 *        `{ label, meta, detail }` item shape (profileSectionItemSchema) and
 *        differs only in what those three slots are CALLED, which is declared
 *        once per section in PROFILE_SECTIONS. Four bespoke editors would be
 *        four places to fix a bug and four places to forget when a fifth section
 *        is added — the registry means a new section renders here with no change
 *        to this file.
 *
 *        Global rather than route-local because the profile sections are a
 *        shared capability, not part of the analyzer: anything that edits a
 *        profile (outreach drafting next) needs exactly this editor.
 *
 *        Resolves against the same analyzeProfileSchema the router validates, so
 *        an over-long role or a 26th entry is caught in the field rather than as
 *        a server error after the user has written it.
 * WHERE: Rendered once per section by the profile-analysis form.
 */

import { useFieldArray, type Control } from "react-hook-form";
import { PlusIcon, Trash2Icon } from "lucide-react";

import {
  PROFILE_SECTIONS,
  type ProfileSectionDefinition,
} from "@/lib/config/profile-sections";
import type { AnalyzeProfileValues, ProfileSectionKey } from "@/lib/types";
import { PROFILE_SECTION_MAX_ITEMS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface ProfileSectionFieldsProps {
  control: Control<AnalyzeProfileValues>;
  section: ProfileSectionKey;
  disabled?: boolean;
}

/* A fresh entry is fully-formed rather than partial: the schema requires all
 * three keys, and appending a partial object makes the first keystroke in any
 * field produce a validation error for the two the user has not reached yet. */
function emptyItem() {
  return { label: "", meta: "", detail: "" };
}

export function ProfileSectionFields({
  control,
  section,
  disabled = false,
}: ProfileSectionFieldsProps) {
  const definition: ProfileSectionDefinition = PROFILE_SECTIONS[section];
  const { fields, append, remove } = useFieldArray({
    control,
    name: `sections.${section}`,
  });

  const atMax = fields.length >= PROFILE_SECTION_MAX_ITEMS;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <FormLabel className="text-sm font-medium">
          {definition.label}{" "}
          <span className="text-muted-foreground">
            {fields.length > 0 ? `(${fields.length})` : "(optional)"}
          </span>
        </FormLabel>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || atMax}
          onClick={() => append(emptyItem())}
        >
          <PlusIcon className="size-4" />
          {definition.addLabel}
        </Button>
      </div>

      {fields.length === 0 ? (
        /* Says what the section is FOR rather than "no items" — this is the only
           prompt the user gets, and an empty section costs them analysis depth. */
        <p className="text-sm text-muted-foreground">
          Nothing added yet. {definition.fields.label.placeholder}, for example.
        </p>
      ) : null}

      {fields.map((field, index) => (
        <div key={field.id} className="flex flex-col gap-3 rounded-md border p-3">
          <div className="flex items-start gap-2">
            <div className="flex flex-1 flex-col gap-3">
              <FormField
                control={control}
                name={`sections.${section}.${index}.label`}
                render={({ field: labelField }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">
                      {definition.fields.label.label}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...labelField}
                        placeholder={definition.fields.label.placeholder}
                        disabled={disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name={`sections.${section}.${index}.meta`}
                render={({ field: metaField }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">
                      {definition.fields.meta.label}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...metaField}
                        placeholder={definition.fields.meta.placeholder}
                        disabled={disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Certifications and education carry no prose worth critiquing,
                  so the registry turns the detail field off for them rather than
                  showing an input nobody should fill. */}
              {definition.fields.detail.enabled ? (
                <FormField
                  control={control}
                  name={`sections.${section}.${index}.detail`}
                  render={({ field: detailField }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">
                        {definition.fields.detail.label}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          {...detailField}
                          rows={3}
                          placeholder={definition.fields.detail.placeholder}
                          disabled={disabled}
                          className="resize-none"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={() => remove(index)}
              aria-label={`Remove ${definition.label} entry ${index + 1}`}
            >
              <Trash2Icon className="size-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
