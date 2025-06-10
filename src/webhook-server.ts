import express, { Request, Response, RequestHandler } from 'express';
import bodyParser from 'body-parser';
import { Client, TextChannel } from 'discord.js';
import * as dotenv from 'dotenv';

interface WebhookRequestBody {
  message: string;
  from?: string;         // Tên người chuyển tiền
  amount?: string;      // Số tiền
  content?: string;     // Nội dung chuyển tiền
  bank?: string;        // Ngân hàng
  transactionId?: string; // Mã giao dịch
  channelId: string;    // ID kênh Discord
}

// Load environment variables
dotenv.config();

class WebhookServer {
  private app: express.Express;
  private port: number;
  private discordClient: Client;
  private readonly WEBHOOK_SECRET: string | undefined;

  constructor(port: number = 3000) {
    this.app = express();
    this.port = port;
    this.discordClient = new Client({
      intents: [
        'Guilds',
        'GuildMessages',
        'MessageContent'
      ]
    });
    
    // Add ready event handler
    this.discordClient.once('ready', () => {
      console.log(`Logged in as ${this.discordClient.user?.tag}`);
      console.log('Bot is ready to receive webhooks');
    });
    
    // Add error handler
    this.discordClient.on('error', (error) => {
      console.error('Discord client error:', error);
    });
    this.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

    this.initializeMiddleware();
    this.initializeRoutes();
  }

  private initializeMiddleware(): void {
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));
  }

  private initializeRoutes(): void {
    // Health check endpoint for Koyeb
    this.app.get('/', (_, res) => {
      res.status(200).json({ status: 'ok' });
    });
    
    // Health check endpoint (kept for backward compatibility)
    this.app.get('/health', (_, res) => {
      res.status(200).json({ status: 'ok' });
    });

    // Webhook endpoint for MacroDroid
    this.app.post('/webhook', (async (req: Request, res: Response) => {
      try {
        const body = req.body as WebhookRequestBody;
        
        // Verify the request if WEBHOOK_SECRET is set
        if (this.WEBHOOK_SECRET && req.headers['x-webhook-secret'] !== this.WEBHOOK_SECRET) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }

        const { message, from, channelId } = body;

        if (!message) {
          res.status(400).json({ error: 'Message is required' });
          return;
        }

        if (!channelId) {
          res.status(400).json({ error: 'channelId is required' });
          return;
        }

        // Get the channel with debug logging
        console.log('Available channels:', this.discordClient.channels.cache.map(c => ({
          id: c.id,
          type: c.type,
          name: 'name' in c ? c.name : 'no-name',
          guild: 'guild' in c ? c.guild?.name : 'no-guild'
        })));
        
        const channel = this.discordClient.channels.cache.get("1377145807739945111") as TextChannel | undefined;
        if (!channel) {
          console.error(`Channel not found. Looking for ID: ${channelId}`);
          return res.status(400).json({ 
            error: 'Invalid channel ID',
            availableChannels: this.discordClient.channels.cache.map(c => ({
              id: c.id,
              type: c.type,
              name: 'name' in c ? c.name : 'no-name'
            }))
          });
        }

        // Format the message with transaction details in a table
        const now = new Date();
        const formattedDate = now.toLocaleString('vi-VN', {
            timeZone: 'Asia/Ho_Chi_Minh',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        // Create an embed message
        const embed = {
            color: 0x00ff00, // Green color
            title: '💳 THÔNG BÁO NHẬN TIỀN',
            fields: [
                {
                    name: '⏰ Thời gian',
                    value: formattedDate,
                    inline: false
                },
                {
                    name: '👤 Người chuyển',
                    value: from || 'Không xác định',
                    inline: true
                },
                {
                    name: '💰 Số tiền',
                    value: body.amount ? `${body.amount} VND` : 'Không xác định',
                    inline: true
                },
                {
                    name: '🏦 Ngân hàng',
                    value: body.bank || 'Không xác định',
                    inline: true
                },
                {
                    name: '🆔 Mã giao dịch',
                    value: body.transactionId || 'Không có',
                    inline: true
                },
                {
                    name: '📝 Nội dung',
                    value: body.content || 'Không có nội dung',
                    inline: false
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: 'Hệ thống thông báo tự động'
            }
        };

        // Send the embed message to Discord
        await channel.send({ embeds: [embed] });
        
        res.status(200).json({ success: true });
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }) as RequestHandler);
  }

  public async start(): Promise<void> {
    // Login the Discord client
    if (process.env.DISCORD_BOT_TOKEN) {
      await this.discordClient.login(process.env.DISCORD_BOT_TOKEN);
    } else {
      console.warn('DISCORD_BOT_TOKEN is not set. Discord client will not be logged in.');
    }
    
    // Start the server
    return new Promise((resolve) => {
      this.app.listen(this.port, () => {
        console.log(`Webhook server is running on port ${this.port}`);
        resolve();
      });
    });
  }
}

export default WebhookServer;