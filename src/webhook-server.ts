// Import các thư viện cần thiết
import express, { Request, Response, RequestHandler } from 'express'; // Framework để tạo server
import bodyParser from 'body-parser'; // Middleware để parse dữ liệu từ request
import { Client, TextChannel } from 'discord.js'; // Thư viện tương tác với Discord
import * as dotenv from 'dotenv'; // Đọc biến môi trường từ file .env


/*
Mẫu nhận tiền: 
Số dư TK VCB 9869887363 +45,000 VND lúc 08-06-2025 14:09:03. Số dư 51,970,619 VND. Ref 058493.080625.140903.VO HONG KHIEM CHUYEN KHOAN-080625-14:09:02 058493

Mẫu chuyển tiền
Số dư TK VCB 9869887363 -29,000,000 VND lúc 08-06-2025 18:22:09. Số dư 22,970,619 VND. Ref MBVCB.9780776044.341678.TONG DUC THANH NAM chuyen tien.CT tu 9869887363 TONG DUC THANH NAM toi 6808080808 TRUONG NHU MUI tai ACB
*/

interface TransferMoney {
  accountNumber: string; //9869887363
  amount: string; //-29,000,000 or +45,000
  time: string; //08-06-2025 18:22:09
  balance: string; //22,970,619
  content: string; // from Ref to end: Ref MBVCB.9780776044.341678.TONG DUC THANH NAM chuyen tien.CT tu 9869887363 TONG DUC THANH NAM toi 6808080808 TRUONG NHU MUI tai ACB
}

// Định nghĩa cấu trúc dữ liệu cho request body từ webhook
interface WebhookRequestBody {
  message: string;      // Nội dung tin nhắn chính
}

// Load environment variables
dotenv.config();

class WebhookServer {
  private app: express.Express; // Ứng dụng Express server
  private port: number; // Cổng chạy server
  private discordClient: Client; // Client kết nối tới Discord
  private readonly WEBHOOK_SECRET: string | undefined; // Khóa bí mật để xác thực webhook

  constructor(port: number = 3000) {
    this.app = express(); // Khởi tạo ứng dụng Express
    this.port = port; // Gán cổng
    this.discordClient = new Client({
      intents: [
        'Guilds', // Quyền truy cập server
        'GuildMessages', // Quyền đọc và gửi tin nhắn
        'MessageContent' // Quyền xem nội dung tin nhắn
      ]
    });
    
    // Xử lý sự kiện khi bot đã sẵn sàng
    this.discordClient.once('ready', () => {
      console.log(`Đã đăng nhập với tên: ${this.discordClient.user?.tag}`);
      console.log('Bot đã sẵn sàng nhận webhook');
    });
    
    // Xử lý lỗi
    this.discordClient.on('error', (error) => {
      console.error('Lỗi từ Discord client:', error);
    });
    
    // Lấy khóa bí mật từ biến môi trường
    this.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

    // Khởi tạo middleware và routes
    this.initializeMiddleware();
    this.initializeRoutes();
  }

  // Khởi tạo các middleware cho Express
  private initializeMiddleware(): void {
    this.app.use(bodyParser.json()); // Hỗ trợ dữ liệu JSON
    this.app.use(bodyParser.urlencoded({ extended: true })); // Hỗ trợ dữ liệu form
  }

  // Parse bank transfer message into TransferMoney object
  private parseTransferMessage(message: string): TransferMoney {
    console.log('Message:', message);
    const regex = /sd tk (\d+) \+?([\d,]+)vnd luc (\d{2}-\d{2}-\d{4} \d{2}:\d{2}:\d{2}(?:\.\d+)?)\. sd ([\d,]+)vnd\. ref (.*)/i;
    const match = message.match(regex);

    // console.log('Parsed values:', { match });
  
    if (!match || match.length < 6) {
      throw new Error("Không thể parse thông báo");
    }
  
    return {
      accountNumber: match[1], // 1014124319
      amount: '+' + match[2].replace(/,/g, ''), // +24818747 (already positive in the message)
      time: match[3].split('.')[0],           // 13-06-2025 09:11:28 (remove milliseconds if present)
      balance: match[4].replace(/,/g, ''),     // 26132642 (remove commas)
      content: match[5]         // 020097042206130911272025DKU1333947.87710.091128.PHAM VAN HOANG chuyen tien
    };
  }

  // Phân tích tin nhắn giao dịch ngân hàng
  private parseBankMessage(message: string): TransferMoney | null {
    try {
      // 
      const normal_message = message
          .normalize('NFD')                     // Tách dấu ra khỏi ký tự gốc
          .replace(/[\u0300-\u036f]/g, '')      // Xóa các dấu
          .replace(/đ/g, 'd')                   // Chuyển đ -> d
          .replace(/Đ/g, 'd')                   // Chuyển Đ -> d (chữ thường luôn)
          .toLowerCase(); 
      
      // First try to parse using the new parseTransferMessage
      try {
        const transfer = this.parseTransferMessage(normal_message);
        return transfer;
        
      } catch (error) {
        console.log('Failed to parse with new method', error);
      }
      
      // Trả về null nếu không khớp với mẫu nào
      return null;
    } catch (error) {
      console.error('Error parsing bank message:', error);
      return null;
    }
  }

  // Khởi tạo các route cho ứng dụng
  private initializeRoutes(): void {
    // Endpoint kiểm tra trạng thái cho Koyeb
    this.app.get('/', (_, res) => {
      res.status(200).json({ status: 'ok' });
    });
    
    // Endpoint kiểm tra trạng thái (giữ lại để tương thích ngược)
    this.app.get('/health', (_, res) => {
      res.status(200).json({ status: 'ok' });
    });

    // Endpoint nhận webhook từ bên ngoài
    this.app.post('/webhook', (async (req: Request, res: Response) => {
      try {
        const body = req.body as WebhookRequestBody; // Lấy dữ liệu từ request
        
        // Xác thực request nếu có cài đặt WEBHOOK_SECRET
        // if (this.WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== this.WEBHOOK_SECRET) {
        //   res.status(401).json({ error: 'Không có quyền truy cập' });
        //   return;
        // }

        const { message } = body; // Lấy nội dung tin nhắn

        // Kiểm tra các trường bắt buộc
        if (!message) {
          res.status(400).json({ error: 'Thiếu nội dung tin nhắn' });
          return;
        }
        
        // Phân tích tin nhắn giao dịch ngân hàng
        const bankTransaction = this.parseBankMessage(message);
        
        // Chỉ xử lý nếu là giao dịch hợp lệ (gửi tiền hoặc rút tiền)
        if (!bankTransaction || !(bankTransaction.amount.startsWith('+') || bankTransaction.amount.startsWith('-'))) {
          console.log('Không phải là giao dịch gửi/rút tiền, bỏ qua');
          return res.status(200).json({ status: 'ignored', message: 'Not a deposit/withdrawal transaction' });
        }

        // Log thông tin các kênh có sẵn để debug
        console.log('Các kênh có sẵn:', this.discordClient.channels.cache.map(c => ({
          id: c.id,
          type: c.type,
          name: 'name' in c ? c.name : 'no-name',
          guild: 'guild' in c ? c.guild?.name : 'no-guild'
        })));
        
        // Lấy kênh Discord theo ID cứng (hardcoded)
        const channel = this.discordClient.channels.cache.get("1377145807739945111") as TextChannel | undefined;
        if (!channel) {
          console.error(`Channel not found.`);
          return res.status(400).json({ 
            error: 'Invalid channel ID',
            availableChannels: this.discordClient.channels.cache.map(c => ({
              id: c.id,
              type: c.type,
              name: 'name' in c ? c.name : 'no-name'
            }))
          });
        }
        
        const embed = {
          color: bankTransaction.amount.startsWith('+') ? 0x00ff00 : 0xff0000, // Màu xanh cho nhận tiền, đỏ cho chuyển tiền
          title: bankTransaction.amount.startsWith('+') ? '💳 THÔNG BÁO NHẬN TIỀN' : '💸 THÔNG BÁO CHUYỂN TIỀN',
          fields: [
            {
              name: '🏦 Ngân hàng',
              value: 'VCB (Vietcombank)',
              inline: true
            },
            {
              name: '📅 Thời gian',
              value: bankTransaction.time,
              inline: true
            },
            {
              name: '💳 Số tài khoản',
              value: bankTransaction.accountNumber,
              inline: true
            },
            {
              name: '💰 Số tiền',
              value: bankTransaction.amount,
              inline: true
            },
            {
              name: '💵 Số dư',
              value: bankTransaction.balance,
              inline: true
            },
            {
              name: '📌 Nội dung',
              value: bankTransaction.content || 'Không có nội dung',
              inline: false
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: 'Innocef AI thông báo GD - VCB'
          }
        };

        // Gửi tin nhắn đến kênh Discord
        await channel.send({ embeds: [embed] });
        res.status(200).json({ status: 'success' });
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }) as RequestHandler);
  }

  // Start the server
  public async start(): Promise<void> {
    try {
      // Login to Discord
      if (!process.env.DISCORD_BOT_TOKEN) {
        throw new Error('DISCORD_BOT_TOKEN is not set in environment variables');
      }

      await this.discordClient.login(process.env.DISCORD_BOT_TOKEN);

      // Start the Express server
      this.app.listen(this.port, () => {
        console.log(`Server is running on port ${this.port}`);
      });
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

export default WebhookServer;