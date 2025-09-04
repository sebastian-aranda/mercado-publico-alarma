import { Resource } from 'sst';
import type { DiscordNotification } from '../types/notification.js';
import { discordNotificationSchema } from '../types/notification.js';

//* Discord Notifier
export class DiscordNotifier {
  private readonly webhookUrl: string;

  constructor() {
    this.webhookUrl = Resource.DiscordWebhookUrl.value;
  }

  /**
   * Envía una notificación simple de texto
   */
  async sendMessage(message: string): Promise<void> {
    const payload = {
      content: message,
    };

    await this.sendRequest(payload);
  }

  /**
   * Envía una notificación rica con embed para una licitación
   */
  async sendTenderNotification(tender: any): Promise<void> {
    const payload: DiscordNotification = {
      content: '🔔 **Nueva Licitación Detectada**',
      embeds: [{
        title: tender.Nombre,
        description: `**ID:** ${tender.CodigoExterno}`,
        color: 0x00ff00, // Verde
        fields: [
          {
            name: '🏢 Comprador',
            value: tender.Comprador || 'No especificado',
            inline: true,
          },
          {
            name: '📋 Estado',
            value: tender.EstadoLicitacion || 'No especificado',
            inline: true,
          },
          {
            name: '🏷️ Keywords Encontradas',
            value: tender.matchedKeywords.join(', '),
            inline: false,
          },
          {
            name: '📅 Fecha Cierre',
            value: tender.FechaCierre || 'No especificada',
            inline: true,
          },
        ],
      }],
    };

    // Validar con Zod antes de enviar
    const validatedPayload = discordNotificationSchema.parse(payload);
    await this.sendRequest(validatedPayload);
  }

  /**
   * Envía notificación con resumen de múltiples licitaciones
   */
  async sendBatchNotification(tenders: any[]): Promise<void> {
    if (tenders.length === 0) return;

    const payload: DiscordNotification = {
      content: `🔔 **${tenders.length} Nuevas Licitaciones Detectadas**`,
      embeds: tenders.slice(0, 10).map((tender, index) => ({ // Máximo 10 embeds
        title: `${index + 1}. ${tender.Nombre.substring(0, 100)}${tender.Nombre.length > 100 ? '...' : ''}`,
        description: `**ID:** ${tender.CodigoExterno}`,
        color: 0x00ff00,
        fields: [
          {
            name: '🏷️ Keywords',
            value: tender.matchedKeywords.join(', '),
            inline: true,
          },
          {
            name: '📅 Cierre',
            value: tender.FechaCierre || 'No especificada',
            inline: true,
          },
        ],
      })),
    };

    if (tenders.length > 10) {
      payload.content += `\n*(Mostrando las primeras 10 de ${tenders.length} licitaciones)*`;
    }

    const validatedPayload = discordNotificationSchema.parse(payload);
    await this.sendRequest(validatedPayload);
  }

  /**
   * Envía la petición HTTP al webhook de Discord
   */
  private async sendRequest(payload: DiscordNotification): Promise<void> {
    // Verificar que Discord webhook es válido
    if (!this.webhookUrl || this.webhookUrl === 'dummy' || !this.webhookUrl.startsWith('https://')) {
      throw new Error('Discord webhook URL not properly configured');
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to send Discord notification: ${error.message}`);
      }
      throw new Error('Failed to send Discord notification: Unknown error');
    }
  }
}