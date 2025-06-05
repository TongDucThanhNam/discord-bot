import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, PermissionFlagsBits, TextChannel, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName('img')
  .setDescription('Gửi ảnh đến kênh đã chỉ định')
  .addAttachmentOption(option =>
    option.setName('file')
      .setDescription('Tệp hình ảnh đính kèm')
      .setRequired(true)
  )
  .addStringOption(option =>
    option.setName('caption')
      .setDescription('Chú thích cho hình ảnh (bắt buộc)')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export async function execute(interaction: CommandInteraction) {
  // Defer the reply to give us more time to process
  await interaction.deferReply({ ephemeral: true });

  // Get the attachment and caption from the command
  const attachment = interaction.options.get('file')?.attachment;
  const caption = interaction.options.get('caption')?.value as string | undefined;
  
  if (!attachment) {
    return interaction.editReply({ content: '❌ Vui lòng đính kèm hình ảnh!' });
  }

  try {
    // Get the target channel ID from environment variables
    const targetChannelId = process.env.TARGET_CHANNEL_ID;
    if (!targetChannelId) {
      return interaction.editReply({ content: '❌ Lỗi cấu hình: Chưa cài đặt kênh đích!' });
    }

    // Get the target channel and verify it's a text channel
    const targetChannel = interaction.client.channels.cache.get(targetChannelId);
    if (!targetChannel || !(targetChannel instanceof TextChannel)) {
      return interaction.editReply({ content: '❌ Không tìm thấy kênh đích hoặc kênh không hỗ trợ gửi tin nhắn!' });
    }

    try {
      // Create an embed with both caption and image
      const embed = new EmbedBuilder()
        .setImage('attachment://image.png');
      
      // Add caption as the embed description with 'Nội dung:' prefix
      embed.setDescription(`Nội dung: ${caption}`);
      
      // Send only the embed with the attached image
      await (targetChannel as TextChannel).send({
        embeds: [embed],
        files: [{
          attachment: attachment.url,
          name: 'image.png' // Fixed filename for the attachment
        }]
      });
    } catch (error) {
      console.error('Error sending image to channel:', error);
      return interaction.editReply({ content: '❌ Đã xảy ra lỗi khi gửi ảnh tới kênh!' });
    }

    // Send success message
    await interaction.editReply({ content: '✅ Đã gửi hình ảnh tới kênh thành công!' });
  } catch (error) {
    console.error('Error processing image command:', error);
    await interaction.editReply({ content: '❌ Đã xảy ra lỗi khi xử lý ảnh!' });
  }
}
