# Памятка: обновление сервера и ошибка «нет соединения с облаком»

Дата: 2026-09-16
Проект: `bezdna-idle`
Сервер: `/var/www/game-project`
API: `https://135.106.211.85.nip.io`
PM2-процесс: `game-api`
База данных: `abyss_idle`

## Что произошло

Игра показывала, что нет соединения с облаком. При проверке обнаружились несколько независимых проблем:

1. Локальная папка сервера содержала изменения в `dist/index.html`, поэтому `git pull --ff-only origin main` был остановлен.
2. На сервере использовалось имя PM2-процесса `game-api`, а в старых командах было имя `abyss-idle-api`.
3. Команды выполнялись из неправильной папки: после `cd server` повторный `cd server` создавал путь `server/server`.
4. В серверной папке отсутствовал `.env` с `DATABASE_URL`.
5. Из-за отсутствия пароля PostgreSQL API возвращал:

```text
SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
```

6. CORS разрешал `vk.ru`, но не `vk.com`.
7. Старые сохранения игроков содержали повреждённые значения вроде `hero.gold=null`. Это отдельная проблема данных, не причина падения подключения к PostgreSQL.

## Как понять, что API работает

Проверка health:

```bash
curl -i https://135.106.211.85.nip.io/health
```

Правильный ответ:

```text
HTTP/2 200
{"ok":true}
```

Проверка подключения API к базе:

```bash
curl -i https://135.106.211.85.nip.io/api/balance
```

Правильный ответ:

```text
HTTP/2 200
{"config":{}}
```

Если `/health` отвечает `200`, а `/api/balance` отвечает `500`, сервер запущен, но backend не может обратиться к PostgreSQL.

## Одноразовая настройка базы и `.env`

Выполнять от пользователя `root` на сервере:

```bash
cd /var/www/game-project/server

DB_PASSWORD="$(openssl rand -hex 24)"

runuser -u postgres -- psql -v ON_ERROR_STOP=1 -c \
"ALTER ROLE game_api WITH LOGIN PASSWORD '$DB_PASSWORD';"

printf '%s\n' \
"DATABASE_URL=postgresql://game_api:${DB_PASSWORD}@127.0.0.1:5432/abyss_idle" \
"CORS_ORIGIN=https://vk.com,https://vk.ru,https://nolik305.github.io,https://135.106.211.85.nip.io" \
> .env

runuser -u postgres -- psql -d abyss_idle -f schema.sql

runuser -u postgres -- psql -d abyss_idle <<'SQL'
GRANT USAGE ON SCHEMA public TO game_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO game_api;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO game_api;
SQL

chmod 600 .env
pm2 restart game-api --update-env
pm2 save
```

Пароль из команды не нужно записывать в этот файл или отправлять в чат. Файл `server/.env` не должен попадать в Git.

## Правильное обновление сервера

```bash
cd /var/www/game-project

git status --short
```

Если Git сообщает о локальных изменениях, временно сохранить их:

```bash
git stash push -u -m "before deploy"
```

Получить актуальный код:

```bash
git pull --ff-only origin main
```

Собрать frontend:

```bash
npm install
npm run build
```

Обновить backend-зависимости:

```bash
cd /var/www/game-project/server
npm ci
```

Перезапустить backend:

```bash
pm2 restart game-api --update-env
pm2 save
```

Финальные проверки:

```bash
curl -f https://135.106.211.85.nip.io/health
curl -f https://135.106.211.85.nip.io/api/balance
pm2 status
```

## Важные имена и пути

| Что | Правильное значение |
|---|---|
| Корень проекта | `/var/www/game-project` |
| Backend | `/var/www/game-project/server` |
| Конфигурация backend | `/var/www/game-project/server/.env` |
| Production build | `/var/www/game-project/dist` |
| PM2-процесс | `game-api` |
| База PostgreSQL | `abyss_idle` |
| Пользователь PostgreSQL | `game_api` |
| Health endpoint | `/health` |
| Публичный API | `/api/balance` |

## Частые ошибки

### `No such file or directory: server/server/package.json`

Вы уже находитесь в `/var/www/game-project/server` и повторно выполнили `cd server`. Перейдите в корень:

```bash
cd /var/www/game-project
```

### `npm error Missing script: typecheck`

Команду нужно выполнять из правильной папки. Сначала проверьте scripts:

```bash
cd /var/www/game-project/server
npm run
```

### `Process or Namespace abyss-idle-api not found`

Актуальное имя процесса:

```bash
pm2 restart game-api --update-env
```

### `curl: option --update-env is unknown`

Параметр `--update-env` относится к PM2, а не к curl. Команды должны быть отдельными:

```bash
pm2 restart game-api --update-env
curl -i https://135.106.211.85.nip.io/health
```

### `HTTP/2 500` на `/api/balance`

Проверьте логи:

```bash
pm2 logs game-api --lines 50 --nostream
```

Если там есть `client password must be a string`, исправьте `server/.env` и перезапустите PM2.

### `npm warn EBADENGINE`

Это предупреждение о версии Node.js, а не непосредственная ошибка сборки. Если `npm run build` завершился строкой `built in ...s`, frontend собран успешно. Для полного устранения предупреждения позже обновите Node.js до версии, которую требует package.json.

## Безопасность

Не публиковать в Git или чат:

- `server/.env`
- `DATABASE_URL`
- пароль PostgreSQL
- `VK_APP_SECRET`
- `VK_SERVICE_TOKEN`
- SSH-ключи и GitHub-токены

Проверка перед push:

```bash
git status --short
```

Файл `.env` должен быть указан в `.gitignore`.
