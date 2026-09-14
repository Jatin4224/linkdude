/*
 *   *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: VoicePage
 *
 * WHAT:  /dashboard/voice route — thin shell; VoiceWorkspace does the work.
 * WHERE: RESOURCES.voiceProfile.nav.href.
 */

import type { Metadata } from "next";

import { VoiceWorkspace } from "./_components/voice-workspace";

export const metadata: Metadata = {
  title: "Voice",
};

export default function VoicePage() {
  return <VoiceWorkspace />;
}
