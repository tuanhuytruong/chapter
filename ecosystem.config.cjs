const appName = process.env.CHAPTER_PM2_NAME;

if (!appName) throw new Error("CHAPTER_PM2_NAME must be set in this release folder's .env.local");

module.exports = {
  apps: [
    {
      name: appName,
      script: "dist/server.mjs",
      instances: 1,
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
