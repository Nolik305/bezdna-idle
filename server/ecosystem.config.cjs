module.exports = {
  apps: [{
    name: "abyss-idle-api",
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
