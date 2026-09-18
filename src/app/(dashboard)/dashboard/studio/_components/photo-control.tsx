"use client";

/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PhotoControl, PhotoControlProps, headshot upload,
 *   image slot
 *
 * WHAT:  Attaches a photo to the design's `photo` slot, and lets it be framed.
 * WHY:   Wraps the EXISTING global ImageUpload and ImageEditor rather than
 *         building an uploader. Both are deliberately generic — ImageUpload knows
 *         nothing about LinkedIn, and ImageEditor produces an ImageKit transform
 *         string without uploading anything — so a headshot needed no new
 *         infrastructure at all, only a different slot to write into.
 *
 *         The upload goes browser → ImageKit directly, which is what keeps a
 *         multi-megabyte photo away from the server's request body limit.
 * WHERE: The Content tab of the studio editor, when the open design has a photo
 *        slot — which today means the headshot.
 */

import * as React from "react";

import type { DesignDoc, PostImageValues } from "@/lib/types";
import {
  LINKEDIN_IMAGE_MIME_TYPES,
  type UploadAuthParams,
} from "@/lib/types";
import { IMAGEKIT_MAX_IMAGE_BYTES, IMAGEKIT_MAX_IMAGE_LABEL } from "@/lib/config";
import { ImageUpload } from "@/components/global/image-upload";
import { ImageEditor } from "@/components/global/image-editor";
import { Label } from "@/components/ui/label";

export interface PhotoControlProps {
  doc: DesignDoc;
  onChange: (doc: DesignDoc) => void;
  getAuthParams: () => Promise<UploadAuthParams>;
  disabled?: boolean;
}

export function PhotoControl({
  doc,
  onChange,
  getAuthParams,
  disabled = false,
}: PhotoControlProps) {
  const photo = doc.images.photo ?? null;

  function setPhoto(value: PostImageValues | null) {
    const images = { ...doc.images };
    if (value === null) {
      /* Removed, not set to null: the slot is a partial record, and a present
       * key holding nothing is a shape the renderer would have to defend against
       * everywhere it reads one. */
      delete images.photo;
    } else {
      images.photo = value;
    }
    onChange({ ...doc, images });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Photo</Label>
        <p className="text-xs text-muted-foreground">
          LinkedIn crops this to a circle, so leave a little room around your face.
        </p>
      </div>

      <ImageUpload
        value={photo}
        onChange={setPhoto}
        getAuthParams={getAuthParams}
        accept={LINKEDIN_IMAGE_MIME_TYPES}
        maxBytes={IMAGEKIT_MAX_IMAGE_BYTES}
        maxBytesLabel={IMAGEKIT_MAX_IMAGE_LABEL}
        disabled={disabled}
        addLabel="Upload a photo"
        replaceLabel="Replace photo"
      />

      {photo ? (
        /* Non-destructive: this writes an ImageKit transform string onto the
         * same reference, so reframing never re-uploads and the original is
         * always recoverable. */
        <ImageEditor
          value={photo}
          onChange={setPhoto}
          disabled={disabled}
          label="Adjust framing"
        />
      ) : null}
    </div>
  );
}
