/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: PostsPage
 *
 * WHAT:  /dashboard/posts route — thin shell; PostsLibrary does the work.
 * WHERE: RESOURCES.postLibrary.nav.href.
 */

import type { Metadata } from "next";

import { PostsLibrary } from "./_components/posts-library";

export const metadata: Metadata = {
  title: "Posts",
};

export default function PostsPage() {
  return <PostsLibrary />;
}
