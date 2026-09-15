# Third-party notices

This project adapts material from the following open-source work.

## linkedin-skills

- **Source:** https://github.com/sergebulaev/linkedin-skills
- **Version adapted:** commit `a472ef4c58ead82cf7f99afc6e983ee19ad07b50` (15 September 2026)
- **Licence:** MIT

**What was adapted.** Writing rules for LinkedIn copy, condensed and rewritten as TypeScript configuration and prompt text:

- the AI-tell word, phrase, opener and closer lists (from `skills/linkedin-humanizer/references/audit-ai-tells.md` and `scrub-rules.md`)
- the hook, structure, close, link and hashtag rules for posts (from `skills/linkedin-post-writer/SKILL.md` and `references/algorithm-heuristics.md`)
- the pre-publish checks and their thresholds, reimplemented in TypeScript (from `skills/linkedin-humanizer/sub-skills/post-audit.md`, `references/audit-checklist.md`, `references/audit-ai-tells.md` and `references/emoji-patterns.md`)
- the edit-only-what-was-flagged approach of the humanizer's over-correction guard
- the hook formulas and their engagement-goal split, condensed into 16 shapes (from `references/hook-formulas.md`)

**Where it lives in this project:**

- `src/lib/config/post-writing.ts`
- `LINKEDIN_LANGUAGE_RULES`, `LINKEDIN_HOOK_RULES`, `LINKEDIN_POST_SYSTEM_PROMPT` and `LINKEDIN_POST_EDITOR_SYSTEM_PROMPT` in `src/services/ai.service.ts`
- `src/lib/post-check.ts`
- `src/lib/config/post-hooks.ts`

**What was not used:** no code, scripts or dependencies from that repository are included.

**Licence text:**

```
MIT License

Copyright (c) 2026 Sergey Bulaev

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
