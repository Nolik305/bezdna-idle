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

echo "=== Шаг 3: Исправление ecosystem.config.cjs ==="
cat > /var/www/game-project/server/ecosystem.config.cjs << 'ECOF'
module.exports = {
  apps: [{
    name: "abyss-idle-api",
    script: "index.mjs",
    cwd: "/var/www/game-project/server",
    env_file: "/var/www/game-project/server/.env",
    autorestart: true,
    max_memory_restart: "300M",
    time: true,
    error_file: "/var/www/game-project/server/pm2-err.log",
    out_file: "/var/www/game-project/server/pm2-out.log",
    log_file: "/var/www/game-project/server/pm2-combined.log",
    merge_logs: true,
  }],
};
ECOF
echo "ecosystem.config.cjs обновлён!"

echo "=== Шаг 4: Обновление .env ==="
cat > /var/www/game-project/server/.env << 'ENVF'
PORT=3001
DATABASE_URL=postgres://game_api:change-me@127.0.0.1:5432/abyss_idle
VK_APP_ID=54071180
VK_APP_SECRET=j4uRXmj32NEdCpqnWXkj
VK_SERVICE_TOKEN=42a692ac42a692ac42a692accd419f9d20442a642a692ac2a0cbac36426b3bd93e0e18d
CORS_ORIGIN=https://vk.ru
ADMIN_VK_IDS=835693694
VITE_API_URL=https://135.106.211.85
ENVF
echo ".env обновлён!"

echo "=== Шаг 5: Установка зависимостей ==="
cd /var/www/game-project/server && npm install

echo "=== Шаг 6: Перезапуск PM2 ==="
pm2 delete abyss-idle-api 2>/dev/null || true
pm2 start /var/www/game-project/server/ecosystem.config.cjs
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
