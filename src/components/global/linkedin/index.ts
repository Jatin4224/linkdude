/*
 * Copyright (c) 2026 Web Prodigies LLC
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: LinkedInPostPreview, LinkedInConnectButton,
 *   LINKEDIN_CONNECT_PATH, LinkedInPostPreviewProps
 *
 * WHAT:  Barrel for the global LinkedIn components.
 * WHY:   One import surface (`@/components/global/linkedin`) so the internal
 *        file split can change without ripple edits at callsites.
 * WHERE: Imported by the composer and any future LinkedIn surface.
 */

export { LinkedInPostPreview } from './post-preview'
export type { LinkedInPostPreviewProps } from './post-preview'
export { LinkedInConnectButton, LINKEDIN_CONNECT_PATH } from './connect-button'
