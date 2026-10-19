module.exports = {
  apps: [
    {
      name: "magic-game-server",
      script: "./magic_server.js",
      autorestart: true,
      watch: false,
      max_memory_restart: "750M",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        PM2_MANAGED: "true",
        AI_TOTAL_POOL: "300",
        MAX_CONCURRENT_AI: "50"
      }
    },
    {
      name: "magic-ai-runner",
      script: "./aiAgentRunner.js",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        SERVER_WS_URL: "ws://127.0.0.1:4000/ws",
        SERVER_HTTP_URL: "http://127.0.0.1:4000",
        DOTENV_CONFIG_PATH: "./.env",
        AI_TOTAL_POOL: "300",
        MAX_CONCURRENT_AI: "50"
      }
    }
  ]
};
