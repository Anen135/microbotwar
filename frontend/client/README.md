# Клиент Microbots Arena

React/Vite-клиент с Canvas-ареной, лобби, редактором и отдельными страницами справки.

Из корня репозитория:

```powershell
npm --prefix frontend/client ci
npm --prefix frontend/client run dev
npm --prefix frontend/client run lint
npm --prefix frontend/client run build
```

В режиме разработки нужен также сервер: `npm --prefix server run dev`. Vite проксирует Socket.IO и HTTP API на `127.0.0.1:3001`. Для игры используйте сервер или Vite с proxy; `npm run preview` предназначен для предпросмотра сборки.

[Запуск](../../docs/getting-started.md) · [Архитектура](../../docs/architecture.md) · [Проверки](../../docs/testing.md).
