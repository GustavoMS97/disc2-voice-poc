# Project

Technical POC for validating LiveKit voice and screen sharing.

This repository is disposable and is not the production application.

## Principles

- Keep implementation minimal.
- Do not introduce production architecture unless explicitly requested.
- Prefer direct, readable TypeScript.
- Avoid `any`.
- Avoid unnecessary abstractions.
- Do not add NestJS, databases or authentication unless explicitly requested.
- Never expose LiveKit API secrets to client-side code.
- Run lint/checks after changes.

## Git

- Never create commits.
- The agent may stage changes if useful.
- Always propose a conventional commit message after completing a task.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
