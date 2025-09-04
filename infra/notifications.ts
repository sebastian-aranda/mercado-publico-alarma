/// <reference path="../.sst/platform/config.d.ts" />

export function Notifications() {
  // 🔐 Discord Webhook URL
  const discordWebhookUrl = new sst.Secret("DiscordWebhookUrl");

  // 🔐 Telegram Bot Token (opcional, para futuras implementaciones)
  const telegramBotToken = new sst.Secret("TelegramBotToken");
  const telegramChatId = new sst.Secret("TelegramChatId");

  return {
    bindings: {
      discordWebhookUrl,
      telegramBotToken,
      telegramChatId,
    },
  };
}
