/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: DocumentsPage
 *
 * WHAT:  /dashboard/documents route — thin shell; DocumentsLibrary does the work.
 * WHERE: RESOURCES.documents.nav.href.
 */

import type { Metadata } from "next";

import { DocumentsLibrary } from "./_components/documents-library";

export const metadata: Metadata = {
  title: "Documents",
};

export default function DocumentsPage() {
  return <DocumentsLibrary />;
}
