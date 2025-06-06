import DiscordBot from "./bot";
import WebhookServer from "./webhook-server";
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Start Discord bot
const bot = new DiscordBot();
bot.start().catch(console.error);

// Start webhook server if enabled
if (process.env.ENABLE_WEBHOOK_SERVER === 'true') {
  const port = parseInt(process.env.WEBHOOK_PORT || '3000', 10);
  const webhookServer = new WebhookServer(port);
  webhookServer.start().catch(console.error);
  console.log(`Webhook server is ${process.env.ENABLE_WEBHOOK_SERVER === 'true' ? 'enabled' : 'disabled'}`);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Optionally restart the process
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});