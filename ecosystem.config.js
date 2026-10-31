try { require('dotenv').config(); } catch (_) {} 
module.exports = {
  apps: [
    {
      name: "magic-game-server",
      script: "./magic_server.js",
      autorestart: true,
      watch: false,
      max_memory_restart: "850M",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        PM2_MANAGED: "true",
        AI_TOTAL_POOL: "600",
        MAX_CONCURRENT_AI: "100",
        MAX_CONCURRENT_USERS: "150",
        MAX_CPU_PERCENT: "65",
        REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
        BATCH_SYNC_INTERVAL_MS: process.env.BATCH_SYNC_INTERVAL_MS || "240000"
      }
    },
    {
      name: "magic-ai-runner",
      script: "./aiagentrunner.js",
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        SERVER_WS_URL: "ws://127.0.0.1:4000/ws",
        SERVER_HTTP_URL: "http://127.0.0.1:4000",
        AI_TOTAL_POOL: "600",
        MAX_CONCURRENT_AI: "100",
        MAX_CPU_PERCENT: "65",
        REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
        BATCH_SYNC_INTERVAL_MS: process.env.BATCH_SYNC_INTERVAL_MS || "240000"
      }
    }
  ]
};