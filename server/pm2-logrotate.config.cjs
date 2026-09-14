// Конфигурация ротации логов PM2 для game-api
// Установка: pm2 install pm2-logrotate
// Настройка:
//   pm2 set pm2-logrotate/rotate_module true
//   pm2 set pm2-logrotate/rotate_interval "0 0 * * *"   // ежедневно
//   pm2 set pm2-logrotate/rotate_size "10M"
//   pm2 set pm2-logrotate/retain "14"
//   pm2 set pm2-logrotate/compress true
//   pm2 set pm2-logrotate/dateFormat "YYYY-MM-DD_HHmmss"

module.exports = {
  apps: [{
    name: "game-api",
    script: "index.ts",
    interpreter: "tsx",
    cwd: "/var/www/game-project/server",
    env_file: "/var/www/game-project/server/.env",
    autorestart: true,
    max_memory_restart: "300M",
    time: true,
    error_file: "/var/www/game-project/server/logs/err.log",
    out_file: "/var/www/game-project/server/logs/out.log",
    merge_logs: true,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z",
  }],
};
