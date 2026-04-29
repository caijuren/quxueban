module.exports = {
  apps: [{
    name: "study-planner-api",
    script: "./dist/index.js",
    cwd: "/home/ubuntu/backend",
    instances: 1,
    exec_mode: "fork",
    autorestart: true,
    max_restarts: 5,
    min_uptime: "10s",
    restart_delay: 5000,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 3001,
      API_PREFIX: "/api",
      LOG_LEVEL: "info"
    },
    error_file: "/home/ubuntu/backend/logs/err.log",
    out_file: "/home/ubuntu/backend/logs/out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z"
  }]
};
