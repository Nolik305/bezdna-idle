module.exports = {
  apps: [{
    name: "abyss-idle-api",
    script: "index.mjs",
    cwd: "/opt/abyss-idle-api",
    env_file: "/opt/abyss-idle-api/.env",
    autorestart: true,
    max_memory_restart: "300M",
    time: true,
  }],
};
