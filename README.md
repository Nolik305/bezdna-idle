# БЕЗДНА — Idle RPG

Рогалик-поход за лутом в VK Mini Apps (idle RPG). Бой, крафт, гильдии, дуэли по MMR, сезоны, чат.

## Стек
- **Клиент:** React + TypeScript + Vite (VK Mini Apps)
- **Сервер:** Node.js (http) + PostgreSQL
- **Хостинг:** VK Mini Apps Hosting, API на выделенном сервере за nginx

## Структура
```
src/            — клиент (React/TS)
  game/         — игровая логика, состояние, данные, баланс
  ui/           — экраны и компоненты
  platform/     — интеграция VK (bridge, auth, API)
public/sprites/ — PNG-спрайты мобов (108) и предметов (112)
server/         — бэкенд (index.mjs, schema.sql)
```

## Запуск клиента
```bash
npm install
npm run dev       # дев-сервер Vite
npm run build     # продакшен-сборка в dist/
npm run test      # тесты (vitest)
```

## Запуск сервера
```bash
cd server
npm install
cp .env.example .env   # заполнить секреты
npm run server:start   # node index.mjs
```

## Деплой
- Клиент: `npm run deploy` (vk-miniapps-deploy) — на VK Mini Apps Hosting
- Сервер: на выделенном сервере, процесс под pm2 (`abyss-idle-api`)

## Безопасность
- Авторизация: HMAC-SHA256 подпись launch-параметров VK
- Секреты (`.env`, `VK_APP_SECRET`) хранятся только на сервере, в git не попадают
# bazdna-idle
