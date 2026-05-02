const appDir = process.env.APP_DIR || "/srv/apps/quxueban";
const backendDir = process.env.BACKEND_DIR || `${appDir}/backend`;
const pm2App = process.env.PM2_APP || "study-planner-api";

module.exports = {
  apps: [{
    name: pm2App,
    script: "./dist/index.js",
    cwd: backendDir,
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
    error_file: `${backendDir}/logs/err.log`,
    out_file: `${backendDir}/logs/out.log`,
    log_date_format: "YYYY-MM-DD HH:mm:ss Z"
  }]
};
