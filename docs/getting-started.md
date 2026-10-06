# Запуск и конфигурация

Все команды выполняются из корня репозитория.

## Быстрый запуск

Проверенное окружение: Node.js 24, npm, настольный браузер. Выполните из корня проекта:

```powershell
npm --prefix server ci
npm --prefix frontend/client ci
npm --prefix frontend/client run build
npm --prefix server start
```

Откройте **http://127.0.0.1:3001**. Сервер сам раздаёт собранный клиент. Для остановки нажмите Ctrl+C.

Для разработки запустите в двух терминалах:

```powershell
npm --prefix server run dev
```

```powershell
npm --prefix frontend/client run dev
```

Откройте адрес Vite из терминала (обычно http://localhost:5173). Vite проксирует Socket.IO и HTTP API на `127.0.0.1:3001`.

Для игры в локальной сети запустите собранную версию с `HOST=0.0.0.0`; игроки открывают адрес компьютера хоста. В PowerShell:

```powershell
$env:HOST = '0.0.0.0'
npm --prefix server start
```

`PORT` меняет порт сервера (по умолчанию 3001). При изменении порта в режиме разработки обновите также proxy в `frontend/client/vite.config.js`.


## Диагностика

Откройте `/health`: ответ должен быть `{"ok":true}`. `/api/config` возвращает игровые параметры. Если сервер просит собрать клиент, выполните `npm --prefix frontend/client run build`.

Игровые параметры находятся в [config.js](../server/game/config.js). `HOST` и `PORT` задаются окружением; загрузка `.env` не реализована. После изменения конфигурации перезапустите сервер. SIGINT и SIGTERM закрывают подключения и останавливают таймеры. Все комнаты хранятся в памяти и удаляются при остановке процесса.
