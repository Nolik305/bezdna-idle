module.exports = {
  apps: [{
    name: "game-api",
    script: "index.mjs",
    cwd: "/var/www/game-project/server",
    env_file: "/var/www/game-project/server/.env",
    autorestart: true,
    max_memory_restart: "300M",
    time: true,
    error_file: "/var/www/game-project/server/pm2-err.log",
    out_file: "/var/www/game-project/server/pm2-out.log",
    merge_logs: true,
  }],
};
