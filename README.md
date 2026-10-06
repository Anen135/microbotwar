# Microbots Arena

A browser-based multiplayer game for learning programming: gather resources, create microbots, and control an army using a simple programming language. The full MVP cycle is implemented: rooms, lobby, server simulation, editor, combat, victory, and restart.

## Quick Start

Tested environment: Node.js 24, npm, and a desktop browser. From the project root:

```powershell
npm --prefix server ci
npm --prefix frontend/client ci
npm --prefix frontend/client run build
npm --prefix server start
```

Open **http://127.0.0.1:3001**. To test the game, use two tabs with different names. The state is stored in the server's memory.

## Documentation

Full documentation index: [docs/README.md](docs/README.md).

- [Getting Started and Configuration](docs/getting-started.md).
- [Project Overview](docs/overview.md) and [Player Guide](docs/game-guide.md).
- [Bot Language](docs/bot-language.md), [Architecture](docs/architecture.md), and [Network Protocol](docs/network-protocol.md).
- [Testing](docs/testing.md) and [Release Preparation](docs/release.md).
- [Documents for AI Agents](docs/agents/README.md).

The root `AGENTS.md` is preserved per the user's original request. It describes the early scaffold; current commands and conventions are located in [docs/agents/contributor-guide.md](docs/agents/contributor-guide.md).