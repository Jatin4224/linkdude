/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PostGenerationPage
 *
 * WHAT:  /dashboard/post-generation route — thin shell; PostComposer does the
 *        work.
 * WHERE: RESOURCES.linkedinPosts.nav.href.
 */

import type { Metadata } from "next";

import { PostComposer } from "./_components/post-composer";

export const metadata: Metadata = {
  title: "Create Post",
};

export default function PostGenerationPage() {
  return <PostComposer />;
}
