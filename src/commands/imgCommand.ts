// Import các thư viện cần thiết
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, PermissionFlagsBits, TextChannel, EmbedBuilder } from "discord.js";

// Khởi tạo lệnh slash với tên và mô tả
export const data = new SlashCommandBuilder()
  .setName('img')  // Tên lệnh: /img
  .setDescription('Gửi ảnh đến kênh đã chỉ định')  // Mô tả lệnh
  // Thêm tùy chọn đính kèm file ảnh
  .addAttachmentOption(option =>
    option.setName('file')  // Tên tham số: file
      .setDescription('Tệp hình ảnh đính kèm')  // Mô tả tham số
      .setRequired(true)  // Bắt buộc phải có
  )
  // Thêm tùy chọn nhập chú thích
  .addStringOption(option =>
    option.setName('caption')  // Tên tham số: caption
      .setDescription('Chú thích cho hình ảnh (bắt buộc)')  // Mô tả tham số
      .setRequired(true)  // Bắt buộc phải có
  )
  // Thiết lập quyền mặc định: thành viên cần quyền gửi tin nhắn để sử dụng lệnh
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

// Hàm thực thi khi lệnh được gọi
export async function execute(interaction: CommandInteraction) {
  // Trả lời tạm thời để có thêm thời gian xử lý (chỉ hiển thị với người gửi)
  await interaction.deferReply({ ephemeral: true });

  // Lấy thông tin file đính kèm và chú thích từ lệnh
  const attachment = interaction.options.get('file')?.attachment;  // Lấy file ảnh đính kèm
  const caption = interaction.options.get('caption')?.value as string | undefined;  // Lấy nội dung chú thích
  
  // Kiểm tra xem có file đính kèm không
  if (!attachment) {
    return interaction.editReply({ content: '❌ Vui lòng đính kèm hình ảnh!' });
  }

  try {
    // Lấy ID kênh đích từ biến môi trường
    const targetChannelId = process.env.TARGET_CHANNEL_ID;
    // Kiểm tra xem đã cấu hình kênh đích chưa
    if (!targetChannelId) {
      return interaction.editReply({ content: '❌ Lỗi cấu hình: Chưa cài đặt kênh đích!' });
    }

    // Lấy kênh đích từ cache và kiểm tra xem có phải là kênh văn bản không
    const targetChannel = interaction.client.channels.cache.get(targetChannelId);
    if (!targetChannel || !(targetChannel instanceof TextChannel)) {
      return interaction.editReply({ content: '❌ Không tìm thấy kênh đích hoặc kênh không hỗ trợ gửi tin nhắn!' });
    }

    try {
      // Tạo embed để hiển thị ảnh, chú thích và thông tin người gửi
      const embed = new EmbedBuilder()
        .setImage('attachment://image.png')  // Đặt ảnh cho embed
        .setAuthor({
          name: interaction.user.tag,
          iconURL: interaction.user.displayAvatarURL()
        })
        .setDescription(`**Nội dung:** ${caption}`)
        .setFooter({ text: `ID: ${interaction.user.id}` })
        .setTimestamp();
      
      // Gửi embed chứa ảnh và chú thích đến kênh đích
      await (targetChannel as TextChannel).send({
        embeds: [embed],  // Gửi embed
        files: [{
          attachment: attachment.url,  // URL của file đính kèm
          name: 'image.png' // Tên file cố định cho file đính kèm
        }]
      });
    } catch (error) {
      // Ghi log lỗi nếu có lỗi khi gửi ảnh
      console.error('Lỗi khi gửi ảnh đến kênh:', error);
      return interaction.editReply({ content: '❌ Đã xảy ra lỗi khi gửi ảnh tới kênh!' });
    }

    // Gửi thông báo thành công cho người dùng
    await interaction.editReply({ content: '✅ Đã gửi hình ảnh tới kênh thành công!' });
  } catch (error) {
    // Xử lý lỗi tổng thể
    console.error('Lỗi khi xử lý lệnh ảnh:', error);
    await interaction.editReply({ content: '❌ Đã xảy ra lỗi khi xử lý ảnh!' });
  }
}
