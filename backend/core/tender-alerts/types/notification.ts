import { z } from 'zod';

// Schema para notificación Discord
export const discordNotificationSchema = z.object({
  content: z.string(),
  embeds: z.array(z.object({
    title: z.string(),
    description: z.string(),
    color: z.number().optional(),
    fields: z.array(z.object({
      name: z.string(),
      value: z.string(),
      inline: z.boolean().optional(),
    })).optional(),
  })).optional(),
});

// Tipos inferidos
export type DiscordNotification = z.infer<typeof discordNotificationSchema>;