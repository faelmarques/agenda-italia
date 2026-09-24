module.exports = {
  apps: [
    {
      name: "agenda-italia",
      script: "node_modules/tsx/dist/cli.mjs",
      args: "server/index.ts",
      interpreter: "node",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      time: true,
      merge_logs: true,
      out_file: "logs/pm2-output.log",
      error_file: "logs/pm2-error.log",
    },
  ],
};
