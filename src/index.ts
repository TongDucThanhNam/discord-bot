// Import các module cần thiết
import DiscordBot from "./bot"; // Import class DiscordBot từ file bot.ts
import WebhookServer from "./webhook-server"; // Import class WebhookServer
import * as dotenv from 'dotenv'; // Thư viện đọc biến môi trường từ file .env

// Tải các biến môi trường từ file .env vào process.env
dotenv.config();

// Khởi tạo và chạy Discord bot
const bot = new DiscordBot(); // Tạo mới instance của DiscordBot
bot.start().catch(console.error); // Bắt đầu bot và xử lý lỗi nếu có

// Khởi động máy chủ webhook nếu được bật trong cấu hình
if (process.env.ENABLE_WEBHOOK_SERVER === 'true') {
  // Lấy cổng từ biến môi trường hoặc mặc định là 3000
  const port = parseInt(process.env.WEBHOOK_PORT || '3000', 10);
  // Tạo mới instance của WebhookServer
  const webhookServer = new WebhookServer(port);
  // Khởi động máy chủ webhook và xử lý lỗi nếu có
  webhookServer.start().catch(console.error);
  // Log trạng thái của webhook server
  console.log(`Webhook server is ${process.env.ENABLE_WEBHOOK_SERVER === 'true' ? 'enabled' : 'disabled'}`);
}

// Xử lý các ngoại lệ chưa được bắt (uncaught exceptions)
process.on('uncaughtException', (error) => {
  console.error('Lỗi chưa được xử lý:', error);
  // Thoát tiến trình với mã lỗi 1 (có thể khởi động lại tiến trình ở đây nếu cần)
  process.exit(1);
});

// Xử lý các Promise bị từ chối nhưng chưa được bắt (unhandled promise rejections)
process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise bị từ chối chưa được xử lý tại:', promise, 'lý do:', reason);
});