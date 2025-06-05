# Discord Bot Commands

## Available Commands

### `/chat [message]`
Chat privately with the bot. Your messages and the bot's responses will only be visible to you.

### `/new-conversation`
Start a new conversation with the bot, clearing the chat history.

### `/img [file] [caption]`
Upload an image with an optional caption to a specified channel. The bot will send the image and caption to the channel configured in `TARGET_CHANNEL_ID`.

**Parameters:**
- `file`: (Required) The image file to upload
- `caption`: (Optional) A caption to include with the image

## Setup

1. **Environment Variables**
   - Copy `.env-example` to `.env` and fill in the required values:
     ```
     DISCORD_BOT_TOKEN=your_discord_bot_token
     TARGET_CHANNEL_ID=your_target_channel_id
     # Other existing variables...
     ```

2. **Getting Channel ID**
   - In Discord, enable Developer Mode in User Settings > Advanced
   - Right-click on the target channel and select "Copy ID"
   - Paste the ID as the `TARGET_CHANNEL_ID` in your `.env` file

3. **Bot Permissions**
   - The bot needs the following permissions in the target channel:
     - View Channel
     - Send Messages
     - Attach Files

4. **Registering Commands**
   - After setting up the environment variables, register the commands with:
     ```bash
     npm run install-cmd
     ```
   - This only needs to be done once per server or when you add new commands.

## Usage

1. Type `/img` in any channel where the bot is present
2. Attach an image file
3. The bot will send the image to the configured channel and confirm the upload

## Troubleshooting

- **Command not showing up**: Make sure to register the commands with `npm run install-cmd`
- **Permission errors**: Check that the bot has the necessary permissions in the target channel
- **File upload issues**: Ensure the file is a valid image and under Discord's file size limit (8MB for regular servers, 100MB for servers with Nitro boost)
