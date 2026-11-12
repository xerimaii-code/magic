try { require('dotenv').config(); } catch (_) {}
module.exports = {
  apps: [
    {
      name: "magic-game-server",
      script: "./magic_server.js",
      autorestart: true,
      watch: false,
      max_memory_restart: "520M",
      node_args: "--expose-gc",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        PM2_MANAGED: "true",
        IN_PROCESS_AI_RUNNER: "true",
        AI_TOTAL_POOL: "600",
        MAX_CONCURRENT_AI: "400",
        MAX_CONCURRENT_USERS: "150",
        MAX_CPU_PERCENT: "65",
        REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
        BATCH_SYNC_INTERVAL_MS: process.env.BATCH_SYNC_INTERVAL_MS || "600000"
      }
    }
  ]
};
