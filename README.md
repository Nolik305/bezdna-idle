# БЕЗДНА — Idle RPG

Рогалик-поход за лутом в VK Mini Apps (idle RPG). Бой, крафт, гильдии, дуэли по MMR, сезоны, чат.

## Стек
- **Клиент:** React + TypeScript + Vite (VK Mini Apps)
- **Сервер:** Node.js (http) + PostgreSQL, запуск под `tsx`
- **Хостинг:** VK Mini Apps Hosting, API на выделенном сервере за nginx

## Структура
```
src/            — клиент (React/TS)
  game/         — игровая логика (logic.ts, data.ts, types.ts), состояние (useGame)
  ui/           — экраны и компоненты
  platform/     — интеграция VK (bridge, auth, облачные сейвы, чат, гильдии)
public/sprites/ — PNG-спрайты мобов (108) и предметов (112)
server/         — бэкенд (index.ts, state-simulator.ts, schema.sql)
```

> Сервер импортирует игровую логику напрямую из `src/game` (`server/state-simulator.ts`),
> поэтому правила боя/экономики для клиента и сервера всегда одни и те же.

## Запуск клиента
```bash
npm install
npm run dev       # дев-сервер Vite
npm run build     # продакшен-сборка в dist/
npm run typecheck # проверка типов
npm run test      # тесты (vitest)
npm run check     # typecheck + тесты (запускается перед деплоем)
```

Переменные окружения клиента — см. `.env.example` (`VITE_API_URL`, `VITE_ADMIN_VK_ID`).

## Запуск сервера
```bash
cd server
npm install
cp .env.example .env   # заполнить секреты (реальные значения в git не попадают)
npm start              # node --import tsx index.ts
```

## Деплой
- Клиент: `npm run deploy` (vk-miniapps-deploy) — на VK Mini Apps Hosting
- Сервер: на выделенном сервере, процесс под pm2 (`abyss-idle-api`, конфиг `server/ecosystem.config.cjs`)

## Безопасность
- Авторизация: HMAC-SHA256 подпись launch-параметров VK (`server/index.ts: verifyLaunchParams`)
- Секреты (`.env`, `VK_APP_SECRET`, `VK_SERVICE_TOKEN`, пароль БД) хранятся только на сервере
  и в git **не попадают** — `.env` в `.gitignore`. В репозитории только плейсхолдеры в `.env.example`.
- Если секрет всё же утёк в историю — ротировать (VK App Settings → Secret key) и чистить историю
  (`git filter-repo`), см. `AUDIT-2026-09-16.md`.
