/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use client";

/**
 * SOURCE OF TRUTH KEYWORDS: ImageUpload, ImageUploadProps, uploadToImageKit
 *
 * WHAT:  A file picker that uploads directly to ImageKit and hands back the
 *        stored reference ({ fileId, url }).
 * WHY:   The bytes go browser→ImageKit and never touch this app. That is what
 *        removed the old 3 MB attachment cap: base64 rode inside the tRPC
 *        payload, and Vercel rejects request bodies over 4.5 MB, so no constant
 *        could have raised it — only changing the transport could.
 *
 *        Deliberately GENERIC: it knows nothing about LinkedIn or posts. The
 *        caller supplies the auth-param fetcher and the accepted types, so the
 *        next feature that needs an upload reuses this instead of copying it.
 *        `transform` is passed straight through untouched — it is the seam the
 *        image editor will write to.
 * WHERE: Used by the post composer. Auth params come from
 *        linkedinPosts.uploadAuth.
 */

import * as React from "react";
import { ImageIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/errors";

import {
  imageKitUploadResponseSchema,
  type PostImageValues,
  type UploadAuthParams,
} from "@/lib/types";
/* A bare string constant — the module's env reads all live inside functions
 * that only the server calls, so nothing secret enters the client bundle. */
import { IMAGEKIT_UPLOAD_ENDPOINT } from "@/lib/config/imagekit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ImageUploadProps {
  /** Current value, or null when nothing is attached. */
  value: PostImageValues | null;
  onChange: (value: PostImageValues | null) => void;
  /** Mints short-lived signed credentials. Called once per upload, never cached. */
  getAuthParams: () => Promise<UploadAuthParams>;
  /** MIME types the CONSUMER accepts — ImageKit itself takes almost anything. */
  accept: readonly string[];
  /** Hard ceiling in bytes, checked before the file leaves the browser. */
  maxBytes: number;
  maxBytesLabel: string;
  disabled?: boolean;
  className?: string;
  /** Copy for the empty state; defaults suit an image attachment. */
  addLabel?: string;
  replaceLabel?: string;
}

/* Uploads one file with a signed token. ImageKit's V1 upload endpoint takes
 * multipart form data — not JSON — and answers with the stored asset. */
async function uploadToImageKit(
  file: File,
  auth: UploadAuthParams,
): Promise<PostImageValues> {
  const form = new FormData();
  form.append("file", file);
  form.append("fileName", file.name);
  form.append("publicKey", auth.publicKey);
  form.append("signature", auth.signature);
  form.append("expire", String(auth.expire));
  form.append("token", auth.token);
  form.append("folder", auth.folder);
  /* Never collide with an existing asset: two users uploading `image.png` must
   * not overwrite each other, and an overwrite would silently change a post
   * that was already scheduled. */
  form.append("useUniqueFileName", "true");

  const response = await fetch(IMAGEKIT_UPLOAD_ENDPOINT, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      body.slice(0, 200) || `Upload failed (${response.status}).`,
    );
  }

  /* Parsed, not cast — this crosses a vendor boundary, so a changed response
   * shape should fail here with a clear message rather than as an undefined
   * three layers away. */
  const parsed = imageKitUploadResponseSchema.parse(await response.json());
  return { fileId: parsed.fileId, url: parsed.url };
}

export function ImageUpload({
  value,
  onChange,
  getAuthParams,
  accept,
  maxBytes,
  maxBytesLabel,
  disabled = false,
  className,
  addLabel = "Add image",
  replaceLabel = "Replace image",
}: ImageUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  async function handleSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    /* Reset immediately so picking the SAME file again still fires onChange. */
    event.target.value = "";
    if (!file) return;

    /* Both checks run before the upload starts — rejecting after sending
     * megabytes across the wire wastes the user's bandwidth to learn nothing. */
    if (file.size > maxBytes) {
      toast.error(`Image must be ${maxBytesLabel} or smaller.`);
      return;
    }
    if (!accept.includes(file.type)) {
      toast.error("That file type isn't supported.");
      return;
    }

    setIsUploading(true);
    try {
      onChange(await uploadToImageKit(file, await getAuthParams()));
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not upload the image."));
    } finally {
      setIsUploading(false);
    }
  }

  const busy = disabled || isUploading;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept.join(",")}
        className="hidden"
        onChange={handleSelected}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {isUploading ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <ImageIcon className="size-4" />
        )}
        {isUploading ? "Uploading…" : value ? replaceLabel : addLabel}
      </Button>
      {value ? (
        /* Muted until hovered, then destructive-tinted: removal is the one
         * irreversible action in this row, so it stays quiet but warns on
         * approach instead of sitting there as loud as the safe actions. */
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onChange(null)}
          disabled={busy}
        >
          <XIcon className="size-4" />
          Remove
        </Button>
      ) : null}
    </div>
  );
}
