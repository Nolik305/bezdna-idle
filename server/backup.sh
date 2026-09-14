#!/bin/bash
# Ежедневный бэкап БД abyss_idle
# Добавить в crontab: 0 3 * * * /var/www/game-project/server/backup.sh

set -euo pipefail

BACKUP_DIR="/var/backups/abyss_idle"
PG_HOST="127.0.0.1"
PG_PORT="5432"
PG_DB="abyss_idle"
PG_USER="game_api"
PG_PASS="${PGPASSWORD:-}"

# Создаём директорию если нет
mkdir -p "$BACKUP_DIR"

# Дата для файла
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/abyss_${DATE}.sql.gz"

# Делаем дамп и сжимаем
echo "[$(date)] Starting backup..."
PGPASSWORD="$PG_PASS" pg_dump \
  -h "$PG_HOST" \
  -p "$PG_PORT" \
  -U "$PG_USER" \
  -d "$PG_DB" \
  --no-owner \
  --no-privileges \
  --verbose \
  | gzip > "$BACKUP_FILE"

# Проверяем размер
SIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || echo "0")
if [ "$SIZE" -gt 0 ]; then
  echo "[$(date)] Backup created: $BACKUP_FILE ($((SIZE / 1024)) KB)"
else
  echo "[$(date)] ERROR: Backup file is empty!" >&2
  exit 1
fi

# Удаляем бэкапы старше 30 дней
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete 2>/dev/null
echo "[$(date)] Old backups cleaned up."

# Ограничиваем количество файлов (оставляем последние 10)
ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
echo "[$(date)] Backup complete."
