# Repository Guidelines

## Project Structure & Module Organization

Microbots Arena is a browser game for learning programming. This checkout is an early scaffold:

- `frontend/client/`: React/Vite application; `src/App.jsx` contains the canvas layout, `src/components/` holds editor/renderer placeholders, `src/assets/` contains imported images, and `public/` contains static assets.
- `server/`: Node.js package with Express and Socket.IO dependencies. `game/` contains entity/simulation placeholders, `network/` holds room handling, and `scripting/` holds the interpreter and bot API. These modules and `index.js` are currently empty.
- `TODO.md`: Russian-language requirements, implementation stages, and acceptance criteria. Consult it before extending scope.

## Build, Test, and Development Commands

Run commands from the indicated package directory; there is no root package script.

- In both `frontend/client/` and `server/`, run `npm ci` to install locked dependencies.
- In `frontend/client/`, run `npm run dev` for the Vite development server.
- Run `npm run build` there to generate the production client in `dist/`.
- Run `npm run preview` there to serve the built client locally.
- Run `npm run lint` there for Oxlint checks.

The server has no start/dev script yet. `node index.js` currently exits without starting a service; `npm test` is a placeholder that fails.

## Coding Style & Naming Conventions

Follow existing client conventions: two-space indentation, single quotes, and omitted semicolons. Use ES modules in the client and CommonJS in the server, matching their package declarations. Use PascalCase for classes and React components, camelCase for functions/variables, and preserve existing filenames. Oxlint configuration lives in `frontend/client/.oxlintrc.json`; no formatter is configured.

## Testing Guidelines

No automated tests, testing framework, or coverage threshold exist yet. For client changes, run lint/build and manually inspect affected browser behavior. When implementing simulation logic, add focused tests for movement, collection, spawn costs, combat, vision, and winner detection, as required by `TODO.md`. Prefer descriptive `*.test.js` filenames and document the chosen runner.

## Commit & Pull Request Guidelines

No Git metadata is available in this checkout, so commit conventions cannot be verified. Use concise imperative subjects such as `Add bot movement simulation`. Keep changes focused. PRs should describe behavior, reference the relevant requirement or issue, record validation, and include screenshots for visible UI changes.

## Architecture & Scope

Keep game state authoritative on the server and simulation independent of Socket.IO. Follow small implementation stages in `TODO.md`; avoid speculative abstractions and unrequested features. Preserve the existing React scaffold while recognizing that the specification originally proposed a plain Canvas client.
