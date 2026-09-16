#!/bin/bash
set -e

echo "=== Шаг 1: Создание БД ==="
sudo -u postgres psql -c "CREATE DATABASE abyss_idle;" 2>/dev/null || echo "БД уже существует"
sudo -u postgres psql -c "CREATE USER game_api WITH PASSWORD 'change-me';" 2>/dev/null || echo "Пользователь уже существует"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE abyss_idle TO game_api;" 2>/dev/null
sudo -u postgres psql -c "ALTER USER game_api CREATEDB;" 2>/dev/null

echo "=== Шаг 2: Инициализация схемы ==="
sudo -u postgres psql abyss_idle < /var/www/game-project/server/schema.sql
echo "Схема создана!"

echo "=== Шаг 3: Конфиг PM2 (index.ts под tsx) ==="
SERVER_DIR="${SERVER_DIR:-/var/www/game-project/server}"

cat > "$SERVER_DIR/ecosystem.config.cjs" << 'ECOF'
module.exports = {
  apps: [{
    name: "abyss-idle-api",
    script: "index.ts",
    interpreter: "tsx",
    cwd: "/var/www/game-project/server",
    autorestart: true,
    max_memory_restart: "300M",
    time: true,
    error_file: "/var/www/game-project/server/logs/err.log",
    out_file: "/var/www/game-project/server/logs/out.log",
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
  }],
};
ECOF
echo "ecosystem.config.cjs обновлён!"

echo "=== Шаг 4: Проверка .env ==="
# Секреты НЕ пишем в репозиторий/скрипт — они должны быть заданы заранее
# (например, в server/.env). Скрипт только проверяет, что они на месте.
: "${VK_APP_SECRET:?Задайте VK_APP_SECRET в окружении или в server/.env}"
: "${VK_SERVICE_TOKEN:?Задайте VK_SERVICE_TOKEN в окружении или в server/.env}"
: "${DATABASE_URL:?Задайте DATABASE_URL в окружении (например, postgresql://game_api:ПАРОЛЬ@127.0.0.1:5432/abyss_idle)}"
: "${ADMIN_VK_IDS:?Задайте ADMIN_VK_IDS — без него админка недоступна}"
echo ".env в порядке (секреты берутся из окружения)"

echo "=== Шаг 5: Установка зависимостей ==="
cd "$SERVER_DIR" && npm install

echo "=== Шаг 6: Перезапуск PM2 ==="
pm2 delete abyss-idle-api 2>/dev/null || true
pm2 start "$SERVER_DIR/ecosystem.config.cjs"
pm2 save

echo "=== Шаг 7: Проверка ==="
sleep 2
curl http://127.0.0.1:3001/health
echo ""
curl http://127.0.0.1:3001/api/balance
echo ""
pm2 status

echo ""
echo "=== ВСЁ ГОТОВО ==="
