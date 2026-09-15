const path = require("node:path");

const backend = path.join(__dirname, "apps/backend");
const frontend = path.join(__dirname, "apps/frontend");
const logs = path.join(__dirname, "logs");

const API_INSTANCES = Number(process.env.API_INSTANCES ?? 2);

module.exports = {
  apps: [
    {
      name: "duplex-api",
      cwd: backend,
      script: "dist/index.js",
      instances: API_INSTANCES,
      exec_mode: "fork",
      increment_var: "PORT",
      env: {
        NODE_ENV: "production",
        PORT: 4100,
      },

      kill_timeout: 15_000,
      max_memory_restart: "512M",
      error_file: path.join(logs, "api-error.log"),
      out_file: path.join(logs, "api-out.log"),
      time: true,
    },
    {
      name: "duplex-web",
      cwd: frontend,
      script: "node_modules/.bin/next",
      args: "start --port 3000",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },

      kill_timeout: 10_000,
      max_memory_restart: "512M",
      error_file: path.join(logs, "web-error.log"),
      out_file: path.join(logs, "web-out.log"),
      time: true,
    },
  ],
};
