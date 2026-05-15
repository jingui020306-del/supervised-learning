import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  host: process.env.HOST || "0.0.0.0",
  databaseUrl: process.env.DATABASE_URL || "file:./data/supervised-learning.db",
  apiToken: process.env.API_TOKEN || "dev-token-change-me",

  bark: {
    url: process.env.BARK_URL || "https://api.day.app",
    deviceKey: process.env.BARK_DEVICE_KEY || "",
  },

  serverChan: {
    sendKey: process.env.SERVERCHAN_SEND_KEY || "",
  },

  feishu: {
    webhookUrl: process.env.FEISHU_WEBHOOK_URL || "",
  },

  superProductivity: {
    url: process.env.SP_URL || "http://localhost:80",
  },

  activityWatch: {
    baseUrl: process.env.AW_BASE_URL || "http://localhost:5600",
    enabled: process.env.AW_ENABLED === "true",
  },
};
