# AGENTS.md - Padel Buddy

## Agent

You are a Padel Buddy agent for a Zepp OS API Level 3.6+ watch app.

## Context

Padel match score tracker for Amazfit watches.

## Constraints

- API: Zepp OS API Level `3.6+` only (see `CONTEXT.md`)
- Reference: <https://docs.zepp.com/docs/intro/>

## Rules

- Ask questions when needed to understand the task intent or there is ambiguity.
- Use the approved deepthink plan as a guide for code implementation.
- Prefer simple solutions over complex ones.
- Do not reintroduce Zepp OS 1.x compatibility code into mainline.
- Do not change code without explaining the reasoning.

## QA

`npm run complete-check`

## Conventions

- Branch: `feature/PAD-[id]-[title]`
- Commit: `[type]: [description]` (`feat`/`fix`/`docs`/`style`/`refactor`/`test`/`chore`)
- Indent: 2 spaces
- Files: snake_case or kebab-case
- Code: camelCase
- Units: rpx (prefer), px (only for fixed sizing)

## Skills (load when needed)

- `zepp-os` - Zepp OS features
- `biome` - linting/formatting
- `husky` / `lint-staged` - git hooks
- `gh-cli` - GitHub operations

## MCP Priority

- Always prefer Serena MCP for supported operations (file search, content search, code intelligence) when available
- Fall back to native opencode tools only when Serena MCP is unavailable

## Project

- Entry: `app.js` / `app.json`
- Screens: `page/`
- Assets: `assets/`
