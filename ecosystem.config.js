module.exports = {
  apps: [
    {
      name: "chapter",
      script: "dist/server.mjs",
      instances: 1,
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
