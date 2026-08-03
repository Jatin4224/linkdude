/*
 * Copyright (c) 2026 Web Prodigies LLC
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: PostComposer, CALLBACK_ERROR_MESSAGES,
 *   readImageAsBase64
 *
 * WHAT:  The Create Post screen — generation controls on the left, a live
 *        LinkedIn preview with an inline editor on the right, and Publish.
 * WHY:   The preview IS the editor: users judge a post by how it will look, so
 *        editing happens inside the same card rather than in a separate
 *        textarea. Publishing is gated on a live connection, which is why the
 *        connect state is read here and not just in the header. OAuth outcomes
 *        arrive as query params (the callback is a redirect, not a fetch), so
 *        they are translated to toasts on mount.
 * WHERE: Rendered by the post-generation page. Calls aiGeneration.create,
 *        linkedinPosts.create, and integrations.linkedin.
 */

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ImageIcon, Loader2Icon, SendIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'

import { trpc } from '@/trpc/react-provider'
import { useActiveOrganizationId } from '@/hooks/use-active-organization'
import {
  LINKEDIN_IMAGE_MIME_TYPES,
  LINKEDIN_MAX_IMAGE_BYTES,
  type GeneratePostValues,
  type PostImageValues,
  type PostLength,
  type PostTone,
} from '@/lib/types'
import { LINKEDIN_MAX_COMMENTARY } from '@/lib/config'
import { ContentLayout } from '@/components/global/page-header'
import { LinkedInConnectButton, LinkedInPostPreview } from '@/components/global/linkedin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { GenerateForm } from './generate-form'

/* The OAuth callback can only talk back through the URL, so each failure mode
 * gets a user-facing sentence here. */
const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'LinkedIn connection cancelled.',
  denied: 'LinkedIn denied the connection request.',
  invalid_state: 'That connection link expired. Please try connecting again.',
  exchange_failed: 'Could not complete the LinkedIn connection. Please try again.',
  not_configured: 'LinkedIn is not configured on this deployment.',
}

/* FileReader yields a `data:<mime>;base64,<payload>` URL; the API wants the
 * bare payload, so split on the first comma. */
function readImageAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read the selected image.'))
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.readAsDataURL(file)
  })
}

export function PostComposer() {
  const organizationId = useActiveOrganizationId()
  const router = useRouter()
  const searchParams = useSearchParams()
  const utils = trpc.useUtils()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [commentary, setCommentary] = React.useState('')
  const [tone, setTone] = React.useState<PostTone>('professional')
  const [length, setLength] = React.useState<PostLength>('medium')
  const [image, setImage] = React.useState<PostImageValues | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null)

  const enabled = organizationId !== undefined
  const orgId = organizationId ?? ''

  const connection = trpc.integrations.linkedin.useQuery({ organizationId: orgId }, { enabled })
  const recentPosts = trpc.linkedinPosts.list.useQuery(
    { organizationId: orgId, limit: 5 },
    { enabled }
  )

  /* The callback route redirects here with a result — surface it once, then
   * strip the params so a refresh doesn't replay the toast. */
  React.useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (!connected && !error) return

    if (connected) {
      toast.success('LinkedIn connected.')
      void utils.integrations.linkedin.invalidate()
    } else if (error) {
      toast.error(CALLBACK_ERROR_MESSAGES[error] ?? 'Could not connect to LinkedIn.')
    }
    router.replace('/dashboard/post-generation')
  }, [searchParams, router, utils])

  const generate = trpc.aiGeneration.create.useMutation({
    onSuccess: (result) => {
      setCommentary(result.commentary)
      toast.success('Post generated.')
    },
    onError: (error) => toast.error(error.message),
  })

  const publish = trpc.linkedinPosts.create.useMutation({
    onSuccess: async () => {
      toast.success('Published to LinkedIn.')
      setCommentary('')
      clearImage()
      await Promise.all([
        utils.linkedinPosts.list.invalidate(),
        utils.usage.invalidate(),
      ])
    },
    onError: (error) => toast.error(error.message),
  })

  function clearImage() {
    setImage(null)
    setImagePreviewUrl((previous) => {
      /* Object URLs leak until revoked. */
      if (previous) URL.revokeObjectURL(previous)
      return null
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  /* Revoke on unmount too — clearImage only covers the interactive paths. */
  React.useEffect(
    () => () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl)
    },
    [imagePreviewUrl]
  )

  async function handleImageSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    /* Checked before reading: base64-encoding a huge file just to reject it
     * would block the main thread for no reason. */
    if (file.size > LINKEDIN_MAX_IMAGE_BYTES) {
      toast.error('Image must be 5 MB or smaller.')
      event.target.value = ''
      return
    }

    const mimeType = LINKEDIN_IMAGE_MIME_TYPES.find((type) => type === file.type)
    if (!mimeType) {
      toast.error('LinkedIn accepts PNG, JPEG, or GIF images.')
      event.target.value = ''
      return
    }

    try {
      const data = await readImageAsBase64(file)
      setImage({ mimeType, data })
      setImagePreviewUrl(URL.createObjectURL(file))
    } catch {
      toast.error('Could not read the selected image.')
    }
  }

  function handleGenerate(values: GeneratePostValues) {
    if (!enabled) return
    generate.mutate({ ...values, organizationId: orgId })
  }

  function handlePublish() {
    if (!enabled) return
    publish.mutate({
      organizationId: orgId,
      commentary,
      ...(image ? { image } : {}),
    })
  }

  const isConnected = Boolean(connection.data?.connected) && !connection.data?.needsReconnect
  const canPublish =
    isConnected && commentary.trim().length > 0 && commentary.length <= LINKEDIN_MAX_COMMENTARY

  return (
    <ContentLayout title="Generate LinkedIn Post" actions={<LinkedInConnectButton />}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">What should we write about?</CardTitle>
          </CardHeader>
          <CardContent>
            <GenerateForm
              tone={tone}
              length={length}
              onToneChange={setTone}
              onLengthChange={setLength}
              onGenerate={handleGenerate}
              isGenerating={generate.isPending}
              disabled={!enabled}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <LinkedInPostPreview
            authorName={connection.data?.name ?? 'Your name'}
            authorAvatarUrl={connection.data?.avatarUrl}
            commentary={commentary}
            imageUrl={imagePreviewUrl}
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={LINKEDIN_IMAGE_MIME_TYPES.join(',')}
                  className="hidden"
                  onChange={handleImageSelected}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={publish.isPending}
                >
                  <ImageIcon className="size-4" />
                  {image ? 'Replace image' : 'Add image'}
                </Button>
                {image ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearImage}
                    disabled={publish.isPending}
                  >
                    <XIcon className="size-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
            }
          >
            {/* The editor replaces the preview body so what you type is
                literally what the post will look like. */}
            <Textarea
              value={commentary}
              onChange={(event) => setCommentary(event.target.value)}
              placeholder="Your AI generated post will be shown here..."
              rows={10}
              disabled={generate.isPending}
              className="resize-none border-0 p-0 text-sm leading-relaxed shadow-none focus-visible:ring-0"
            />
          </LinkedInPostPreview>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              className={
                commentary.length > LINKEDIN_MAX_COMMENTARY
                  ? 'text-sm text-destructive'
                  : 'text-sm text-muted-foreground'
              }
            >
              {commentary.length} / {LINKEDIN_MAX_COMMENTARY} characters
            </p>
            <Button onClick={handlePublish} disabled={!canPublish || publish.isPending}>
              {publish.isPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <SendIcon className="size-4" />
              )}
              Post to LinkedIn
            </Button>
          </div>

          {!isConnected ? (
            <p className="text-sm text-muted-foreground">
              Connect your LinkedIn account to publish. You can still generate and edit copy
              without one.
            </p>
          ) : null}

          {recentPosts.data && recentPosts.data.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent posts</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {recentPosts.data.map((post, index) => (
                  <React.Fragment key={post.id}>
                    {index > 0 ? <Separator /> : null}
                    <div className="flex flex-col gap-1">
                      <p className="line-clamp-2 text-sm">{post.commentary}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.publishedAt.toLocaleString()}
                      </p>
                    </div>
                  </React.Fragment>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </ContentLayout>
  )
}
