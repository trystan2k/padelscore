## What
The migration from Zepp OS v1.0 to Zepp OS API Level 3+ will be a full replacement rather than a dual-support strategy.

## Why
The user explicitly chose Option 1: move the current Zepp OS 1.0 code to a `v1` maintenance branch and migrate the main app line forward for modern devices only.

## Where
Project-wide migration planning decision affecting `app.json`, device support strategy, release/versioning approach, and all platform-facing files.

## Learned
This removes the need to preserve runtime compatibility with GTR 3 / GTS 3 in the mainline codebase, but it makes distribution identity (`appId` / listing continuity) a high-impact follow-up decision.