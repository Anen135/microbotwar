# Repository Guidelines

## Project Structure & Module Organization

`server/game/` owns the authoritative simulation. `server/scripting/` implements the bot DSL; `server/network/rooms.js` handles rooms. Server tests live beside modules as `*.test.js`. `frontend/client/` is the React/Vite client; components live in `src/components/`, static assets in `public/`. Project documents live in `docs/`, agent materials in `docs/agents/`.

## Build, Test, and Development Commands

Run from the repository root:

- `npm --prefix server ci` and `npm --prefix frontend/client ci`: install locked dependencies.
- `npm --prefix server run dev`: run the server with file watching.
- `npm --prefix frontend/client run dev`: run Vite with the server proxy.
- `npm --prefix frontend/client run build`: produce `dist/` for Express.
- `npm --prefix server start`: serve at `127.0.0.1:3001` by default.
- `npm --prefix frontend/client run lint`: run Oxlint.
- `npm --prefix server test`: run `node:test`.
- `npm --prefix server run test:browser`: verify two clients after building; uses installed Edge by default.

## Coding Style & Testing

Use two spaces, single quotes and omitted semicolons. Use ES modules in the client, CommonJS in the server, PascalCase for components/classes and camelCase for variables/functions. Preserve existing filenames. Oxlint is configured; no formatter or coverage threshold is configured. Add focused behavior tests. See [testing.md](../testing.md).

## Commit & Pull Request Guidelines

Recent history uses subjects such as `feat: add matte gold theme, CRT arena and dedicated help pages`. Keep commits focused; describe behavior, requirements and validation in PRs. Include screenshots for visible changes. Prepare releases on `release`; record outstanding checks in [release.md](../release.md).

## Documentation Update Policy

Update documentation at milestones: completion of a task/session, before merging a feature branch, handoff, or release preparation. Collect concise notes during implementation and batch the final documentation changes to save tokens. Avoid repeatedly rewriting documents after intermediate edits.

At the end of an AI-agent session, prepare concrete drafts or a diff, list the existing documents to change, summarize the updates, and ask the user for permission to overwrite them. Wait for explicit approval before modifying existing documentation, including partial edits, replacement, moves and deletions. Silence is not approval. If this session already includes explicit approval for the same files and updates, apply it without asking again.

New documents may be created within the authorized task. Keep pending replacements in ignored `artifacts/` and report their paths. Never present an unapplied draft as completed. The root `AGENTS.md` remains protected by the user's original instruction; changing it needs explicit authorization naming that file.

## Agent Instructions

Keep gameplay authoritative on the server and preserve room/draft state during navigation. Record confirmed remaining work in [handoff.md](handoff.md). User instructions take precedence over repository guidance.
