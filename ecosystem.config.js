module.exports = {
  apps: [{
    name: "study-planner-api",
    script: "./dist/index.js",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "1G",
    env: {
      NODE_ENV: "production",
      PORT: 3001,
      DATABASE_URL: "postgresql://grubby@localhost:5432/study_planner_dev",
      JWT_SECRET: "your-production-jwt-secret-key-change-this-in-production",
      JWT_EXPIRES_IN: "7d",
      API_PREFIX: "/api",
      CORS_ORIGIN: "http://124.220.103.120,http://localhost:5173",
      LOG_LEVEL: "info"
    },
    error_file: "./logs/err.log",
    out_file: "./logs/out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss Z"
  }]
};
