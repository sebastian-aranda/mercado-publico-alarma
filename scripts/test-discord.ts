// Script temporal para testear notificaciones Discord
import { Resource } from 'sst';

async function testDiscordNotification() {
  console.log('🔔 Testing Discord webhook...');
  
  const DISCORD_WEBHOOK_URL = Resource.DiscordWebhookUrl.value;
  console.log('🌐 Using webhook:', DISCORD_WEBHOOK_URL.substring(0, 50) + '...');

  // Test 1: Mensaje simple
  try {
    const response1 = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '🧪 **Test de notificación** - Sistema de monitoreo funcionando correctamente!'
      })
    });

    if (response1.ok) {
      console.log('✅ Test 1 - Mensaje simple: SUCCESS');
    } else {
      console.log('❌ Test 1 - Error:', response1.status, response1.statusText);
    }
  } catch (error) {
    console.log('❌ Test 1 - Error:', error.message);
  }

  // Test 2: Embed rico (simular licitación)
  try {
    const response2 = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '🔔 **TEST - Nueva Licitación Detectada**',
        embeds: [{
          title: 'TEST - Curso de Capacitación en Tecnología',
          description: '**ID:** TEST-123456',
          color: 0x00ff00,
          fields: [
            {
              name: '🏢 Comprador',
              value: 'Ministerio de Educación (TEST)',
              inline: true,
            },
            {
              name: '📋 Estado',
              value: 'Activa (TEST)',
              inline: true,
            },
            {
              name: '🏷️ Keywords Encontradas',
              value: 'curso, capacitación',
              inline: false,
            },
            {
              name: '📅 Fecha Cierre',
              value: '2025-09-10 (TEST)',
              inline: true,
            },
          ],
        }],
      })
    });

    if (response2.ok) {
      console.log('✅ Test 2 - Embed rico: SUCCESS');
    } else {
      console.log('❌ Test 2 - Error:', response2.status, response2.statusText);
    }
  } catch (error) {
    console.log('❌ Test 2 - Error:', error.message);
  }

  console.log('📱 Verifica tu canal de Discord para confirmar que llegaron las notificaciones!');
}

testDiscordNotification();