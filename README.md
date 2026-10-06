# Microbots Arena

Браузерная многопользовательская игра для обучения программированию: собирайте ресурсы, создавайте микроботов и управляйте армией через небольшой язык программирования. Реализован полный цикл MVP: комнаты, лобби, серверная симуляция, редактор, бой, победа и перезапуск.

## Быстрый запуск

Проверенное окружение — Node.js 24, npm и настольный браузер. Из корня проекта:

```powershell
npm --prefix server ci
npm --prefix frontend/client ci
npm --prefix frontend/client run build
npm --prefix server start
```

Откройте **http://127.0.0.1:3001**. Для проверки игры используйте две вкладки с разными именами. Состояние хранится в памяти сервера.

## Документация

Полный каталог: [docs/README.md](docs/README.md).

- [Запуск и конфигурация](docs/getting-started.md).
- [Обзор проекта](docs/overview.md) и [руководство игрока](docs/game-guide.md).
- [Язык ботов](docs/bot-language.md), [архитектура](docs/architecture.md) и [сетевой протокол](docs/network-protocol.md).
- [Проверки](docs/testing.md) и [подготовка релиза](docs/release.md).
- [Документы для ИИ-агентов](docs/agents/README.md).

Корневой `AGENTS.md` сохранён по исходному требованию пользователя. Он описывает ранний scaffold; актуальные команды и соглашения находятся в [docs/agents/contributor-guide.md](docs/agents/contributor-guide.md).
