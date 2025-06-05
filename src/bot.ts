import { SlashCommandBuilder } from "@discordjs/builders";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import {
  ChannelType,
  Client,
  CommandInteraction,
  IntentsBitField,
  type Message,
} from "discord.js";
import * as dotenv from "dotenv";
import { ChatMessageRequest } from "./dify-client/api.types";
import DifyChatClient from "./dify-client/dify-client";
import { DifyFile, ThoughtItem, VisionFile } from "./dify-client/dify.types";
import { data as imgCommandData, execute as imgCommandExecute } from "./commands/imgCommand";

// Tải các biến môi trường từ file .env
dotenv.config();

// Map để lưu trữ conversation ID theo user hoặc channel
const conversationCache = new Map<string, string>();

class DiscordBot {
  private client: Client; // Discord client instance
  private difyClient: DifyChatClient; // Dify AI client để giao tiếp với AI
  private readonly TOKEN: string; // Token của Discord bot
  private readonly HISTORY_MODE: string; // Chế độ lưu lịch sử: "user" hoặc "channel"
  private readonly MAX_MESSAGE_LENGTH: number; // Độ dài tối đa của tin nhắn Discord
  private readonly MESSAGE_CONTENT_ALLOWED: boolean; // Có được phép đọc nội dung tin nhắn không
  private readonly TRIGGER_KEYWORDS: string[]; // Các từ khóa kích hoạt bot

  constructor() {
    // Khởi tạo các biến cấu hình từ environment variables
    this.TOKEN = process.env.DISCORD_BOT_TOKEN || "";
    this.HISTORY_MODE = process.env.HISTORY_MODE || "";
    this.MAX_MESSAGE_LENGTH = Number(process.env.MAX_MESSAGE_LENGTH) || 2000;
    this.MESSAGE_CONTENT_ALLOWED =
      String(process.env.MESSAGE_CONTENT_ALLOWED).toLowerCase() === "true" ||
      false;

    // Parse các từ khóa kích hoạt từ JSON string
    this.TRIGGER_KEYWORDS = this.parseTriggerKeywords();

    // Kiểm tra token có tồn tại không
    if (!this.TOKEN) {
      throw new Error("DISCORD_BOT_TOKEN must be provided in the .env file");
    }

    // Thiết lập các quyền (intents) cần thiết cho bot
    const intents = [
      IntentsBitField.Flags.Guilds, // Quyền truy cập server
      IntentsBitField.Flags.GuildMessages, // Quyền đọc tin nhắn trong server
      IntentsBitField.Flags.DirectMessages, // Quyền đọc tin nhắn riêng tư
    ];

    // Nếu được phép đọc nội dung tin nhắn, thêm quyền này
    if (this.MESSAGE_CONTENT_ALLOWED) {
      intents.push(IntentsBitField.Flags.MessageContent);
    }

    // Khởi tạo Discord client với các quyền đã thiết lập
    this.client = new Client({
      intents,
    });
    
    // Khởi tạo Dify client để giao tiếp với AI
    this.difyClient = new DifyChatClient();

    // Event listener khi bot sẵn sàng hoạt động
    this.client.once("ready", () => {
      console.log(
        "Discord bot is ready!",
        "Client ID:",
        this.client.user!.id,
        `\nInstall this bot to your server with this link: https://discord.com/api/oauth2/authorize?client_id=${this.client.user!.id}&permissions=0&scope=bot%20applications.commands `
      );
    });

    // Event listener khi có tin nhắn mới được tạo
    this.client.on("messageCreate", async (message) => {
      // Bỏ qua tin nhắn từ bot khác
      if (message.author.bot) return;

      // Kiểm tra xem bot có được mention không
      const isMentioned = message.mentions.has(this.client.user!);
      
      // Kiểm tra xem tin nhắn có chứa từ khóa kích hoạt không
      const isKeywordTriggered =
        this.MESSAGE_CONTENT_ALLOWED &&
        this.TRIGGER_KEYWORDS.some((keyword: string) =>
          message.content.toLowerCase().includes(keyword.toLowerCase())
        );

      // Nếu được mention hoặc có từ khóa kích hoạt, xử lý tin nhắn
      if (isMentioned || isKeywordTriggered) {
        await this.handleChatMessage(message);
      }
    });

    // Event listener khi có interaction (slash command) được tạo
    this.client.on("interactionCreate", async (interaction) => {
      if (!interaction.isCommand()) return;

      // Xử lý slash command "/chat"
      if (interaction.commandName === "chat") {
        await this.handleChatCommand(interaction);
      } 
      // Xử lý slash command "/new-conversation" để bắt đầu cuộc trò chuyện mới
      else if (interaction.commandName === "new-conversation") {
        const cacheId =
          this.HISTORY_MODE && this.HISTORY_MODE === "user"
            ? interaction.user.id // Nếu mode là "user", dùng user ID
            : interaction.channelId; // Nếu mode là "channel", dùng channel ID
        
        // Xóa lịch sử conversation
        conversationCache.delete(cacheId);
        await interaction.reply("New conversation started!");
      }
      // Xử lý slash command "/img" để gửi ảnh đến kênh chỉ định
      else if (interaction.commandName === "img") {
        await imgCommandExecute(interaction);
      }
    });
  }

  // Phương thức để khởi động bot
  public start() {
    return this.client.login(this.TOKEN);
  }

  // Parse các từ khóa kích hoạt từ JSON string trong environment variable
  private parseTriggerKeywords(): string[] {
    let keywords: string[] = [];
    const rawKeywords = process.env.TRIGGER_KEYWORDS;
    if (!rawKeywords) return keywords;

    try {
      keywords = JSON.parse(rawKeywords);
    } catch (error) {
      console.warn(
        "Invalid JSON in TRIGGER_KEYWORDS. Ignoring this configuration.",
        error
      );
    }
    return keywords;
  }

  // Cài đặt slash commands cho một server cụ thể
  public async installSlashCommand(guildId: string) {
    const commands = [
      // Command "/chat" để chat riêng tư với bot
      new SlashCommandBuilder()
        .setName("chat")
        .setDescription(
          "Chat with the bot in private. No one but you will see this messasge or the bot response."
        )
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("Your message.")
            .setRequired(true)
        )
        .toJSON(),
      
      // Command "/new-conversation" để bắt đầu cuộc trò chuyện mới
      new SlashCommandBuilder()
        .setName("new-conversation")
        .setDescription(
          "Start a new conversation with the bot. This will clear the chat history."
        )
        .toJSON(),
      
      // Thêm command "/img" để gửi ảnh đến kênh chỉ định
      imgCommandData.toJSON(),
    ];

    const rest = new REST({ version: "9" }).setToken(this.TOKEN);

    try {
      console.log("Started refreshing application (/) commands.");

      // Đăng ký commands với Discord API
      await rest.put(
        Routes.applicationGuildCommands(this.client.user!.id, guildId),
        { body: commands }
      );

      console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
      console.error(error);
    }
  }

  // Xử lý slash command "/chat"
  private async handleChatCommand(interaction: CommandInteraction) {
    // Defer reply để có thời gian xử lý (ephemeral = chỉ người dùng thấy)
    await interaction.deferReply({ ephemeral: true });

    const message = interaction.options.get("message", true);
    const cacheKey = this.getCacheKey(
      interaction.user.id,
      interaction.channel?.id
    );

    try {
      // Gọi AI để tạo câu trả lời
      const { messages, files } = await this.generateAnswer(
        {
          inputs: {
            username: interaction.user.globalName || interaction.user.username,
            now: new Date().toUTCString(),
          },
          query: message.value! as string,
          response_mode: "streaming", // Sử dụng streaming để nhận response theo thời gian thực
          conversation_id: (cacheKey && conversationCache.get(cacheKey)) || "",
          user: this.getUserId(interaction.user.id, interaction.guild?.id),
        },
        {
          cacheKey,
          handleChatflowAnswer: (chatflowMessages, files) => {
            if (chatflowMessages.length > 0) {
              this.sendInteractionAnswer(interaction, chatflowMessages, files);
            }
          },
        }
      );

      // Gửi câu trả lời cuối cùng
      this.sendInteractionAnswer(interaction, messages, files);
    } catch (error) {
      console.error("Error sending message to Dify:", error);
      await interaction.editReply({
        content: "Sorry, something went wrong while generating the answer.",
      });
    }
  }

  // Gửi câu trả lời cho slash command interaction
  private sendInteractionAnswer(
    interaction: CommandInteraction,
    messages: string[],
    files?: DifyFile[]
  ) {
    for (const [index, m] of messages.entries()) {
      if (m.length === 0) continue;

      // Chuẩn bị file attachments cho tin nhắn đầu tiên
      const additionalFields =
        index === 0
          ? {
              files: files?.map((f) => ({
                attachment: f.url,
                name: f.extension
                  ? `generated_${f.type}.${f.extension}`
                  : `generated_${f.type}`,
              })),
            }
          : {};

      // Gửi tin nhắn đầu tiên bằng editReply, các tin nhắn sau bằng followUp
      if (!interaction.replied && index === 0) {
        interaction.editReply({
          content: m,
          ...additionalFields,
        });
      } else {
        interaction.followUp({
          content: m,
          ephemeral: true,
          ...additionalFields,
        });
      }
    }
  }

  // Xử lý tin nhắn thường (mention hoặc keyword trigger)
  private async handleChatMessage(message: Message) {
    const cacheKey = this.getCacheKey(message.author.id, message.channelId);

    // Hiển thị typing indicator (trừ group DM)
    if (message.channel.type !== ChannelType.GroupDM) {
      message.channel.sendTyping().catch(console.error);
    }

    try {
      // Gọi AI để tạo câu trả lời
      const { messages, files } = await this.generateAnswer(
        {
          inputs: {
            username: message.author.globalName || message.author.username,
            now: new Date().toUTCString(),
          },
          query: message.content.replace(`<@${this.client.user?.id}>`, ""), // Loại bỏ mention khỏi query
          response_mode: "streaming",
          conversation_id: (cacheKey && conversationCache.get(cacheKey)) || "",
          user: this.getUserId(message.author.id, message.guild?.id),
        },
        {
          cacheKey,
          onPing: async () => {
            // Tiếp tục hiển thị typing indicator trong quá trình xử lý
            if (message.channel.type !== ChannelType.GroupDM) {
              await message.channel.sendTyping().catch(console.error);
            }
          },
          handleChatflowAnswer: (chatflowMessages, files) => {
            if (chatflowMessages.length > 0) {
              this.sendChatnswer(message, chatflowMessages, files);
            }
          },
        }
      );

      // Gửi câu trả lời cuối cùng
      this.sendChatnswer(message, messages, files);
    } catch (error) {
      console.error("Error sending message to Dify:", error);
      await message.reply(
        "Sorry, something went wrong while generating the answer."
      );
    }
  }

  // Gửi câu trả lời cho tin nhắn thường
  private sendChatnswer(
    message: Message,
    messages: string[],
    files?: DifyFile[]
  ) {
    for (const [index, m] of messages.entries()) {
      if (m.length === 0) continue;
      
      if (index === 0) {
        // Tin nhắn đầu tiên với file attachments
        message.reply({
          content: m,
          files: files?.map((f) => ({
            attachment: f.url,
            name: f.extension
              ? `generated_${f.type}.${f.extension}`
              : `generated_${f.type}`,
          })),
        });
      } else {
        // Các tin nhắn tiếp theo
        message.reply(m);
      }
    }
  }

  // Phương thức chính để tạo câu trả lời từ AI
  private async generateAnswer(
    reqiest: ChatMessageRequest,
    {
      cacheKey,
      onPing,
      handleChatflowAnswer,
    }: {
      cacheKey: string;
      onPing?: () => void;
      handleChatflowAnswer?: (
        messages: string[],
        files?: Array<VisionFile & { thought?: ThoughtItem }>
      ) => void;
    }
  ): Promise<{
    messages: string[];
    files: Array<VisionFile & { thought?: ThoughtItem }>;
  }> {
    // Nếu query rỗng, trả về kết quả rỗng
    if (reqiest.query.length === 0)
      return Promise.resolve({ messages: [], files: [] });
      
    return new Promise(async (resolve, reject) => {
      try {
        // Buffer để lưu trữ các loại response khác nhau
        let buffer = { defaultAnswer: "", chatflowAnswer: "" };
        let files: VisionFile[] = [];
        let fileGenerationThought: ThoughtItem[] = [];
        let bufferType = "defaultMessage";
        
        // Stream chat message từ Dify AI
        await this.difyClient.streamChatMessage(reqiest, {
          // Callback khi nhận được message chunk
          onMessage: async (answer, isFirstMessage, { conversationId }) => {
            switch (bufferType) {
              case "defaultMessage":
                buffer.defaultAnswer += answer;
                break;
              case "chatflowAnswer":
                buffer.chatflowAnswer += answer;
                break;
            }

            // Lưu conversation ID vào cache
            if (cacheKey) {
              conversationCache.set(cacheKey, conversationId);
            }
          },
          
          // Callback khi nhận được file
          onFile: async (file: DifyFile) => {
            files.push(file);
          },
          
          // Callback khi nhận được thought (suy nghĩ của AI)
          onThought: async (thought) => {
            fileGenerationThought.push(thought);
          },
          
          // Callback khi một node bắt đầu xử lý
          onNodeStarted: async (nodeStarted) => {
            switch (nodeStarted.data.node_type) {
              case "llm":
                bufferType = "chatflowAnswer";
                onPing?.(); // Trigger typing indicator
                break;
              case "tool":
                onPing?.(); // Trigger typing indicator
                break;
            }
          },
          
          // Callback khi một node hoàn thành xử lý
          onNodeFinished: async (nodeFinished) => {
            switch (nodeFinished.data.node_type) {
              case "answer":
                bufferType = "defaultMessage";
                // Gửi câu trả lời trung gian
                handleChatflowAnswer?.(
                  this.splitMessage(buffer.chatflowAnswer, {
                    maxLength: this.MAX_MESSAGE_LENGTH,
                  }),
                  files
                );
                files = [];
                buffer.chatflowAnswer = "";
                break;
              case "tool":
                // Xử lý file từ DALL-E tool
                if (
                  nodeFinished.data.title.includes("DALL-E") &&
                  nodeFinished.data?.outputs?.files?.length > 0
                ) {
                  for (let file of nodeFinished.data.outputs.files!) {
                    files.push(file);
                  }
                }
                break;
            }
          },
          
          // Callback khi hoàn thành toàn bộ quá trình
          onCompleted: () => {
            resolve({
              messages: this.splitMessage(
                [buffer.chatflowAnswer, buffer.defaultAnswer]
                  .filter(Boolean)
                  .join("\n\n"),
                {
                  maxLength: this.MAX_MESSAGE_LENGTH,
                }
              ),
              files: files.map((file) => ({
                ...file,
                thought: fileGenerationThought.find(
                  (t) => file.id && t.message_files?.includes(file.id)
                ),
              })) as any,
            });
          },
          onPing,
        });
      } catch (error: any) {
        reject(error);
      }
    });
  }

  // Tạo cache key dựa trên HISTORY_MODE
  private getCacheKey(
    userId: string | undefined,
    channelId: string | undefined
  ): string {
    switch (this.HISTORY_MODE) {
      case "user":
        return userId || ""; // Lưu lịch sử theo user
      case "channel":
        return channelId || ""; // Lưu lịch sử theo channel
      default:
        return ""; // Không lưu lịch sử
    }
  }

  // Tạo user ID dựa trên HISTORY_MODE
  private getUserId(userId: string | undefined, serverId: string | undefined) {
    switch (this.HISTORY_MODE) {
      case "user":
        return userId || "";
      case "channel":
        return serverId || "";
      default:
        return "";
    }
  }

  // Chia tin nhắn dài thành nhiều tin nhắn ngắn hơn để phù hợp với giới hạn Discord
  splitMessage(
    message: string,
    options: {
      maxLength?: number;
      char?: string;
      prepend?: string;
      append?: string;
    } = {}
  ): string[] {
    const {
      maxLength = 2000, // Độ dài tối đa mỗi tin nhắn
      char = "\n", // Ký tự để chia
      prepend = "", // Text thêm vào đầu mỗi tin nhắn
      append = "", // Text thêm vào cuối mỗi tin nhắn
    } = options;
    
    // Nếu tin nhắn ngắn hơn giới hạn, trả về nguyên vẹn
    if (message.length <= maxLength) return [message];
    
    // Chia tin nhắn theo ký tự chỉ định
    const splitText = message.split(char);
    
    // Kiểm tra xem có phần nào dài quá giới hạn không
    if (splitText.some((part) => part.length > maxLength))
      throw new RangeError("SPLIT_MAX_LEN");
    
    const messages = [""];
    
    // Ghép các phần lại với nhau, tạo tin nhắn mới khi cần
    for (let part of splitText) {
      if (messages[messages.length - 1].length + part.length + 1 > maxLength) {
        messages[messages.length - 1] += append;
        messages.push(prepend);
      }
      messages[messages.length - 1] +=
        (messages[messages.length - 1].length > 0 &&
        messages[messages.length - 1] !== prepend
          ? char
          : "") + part;
    }
    return messages;
  }
}

export default DiscordBot;