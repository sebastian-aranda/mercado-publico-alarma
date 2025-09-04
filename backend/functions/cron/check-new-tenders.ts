import type { ScheduledEvent } from 'aws-lambda';

// New refactored imports with providers pattern
import { getDefaultTenderProvider } from '../../core/tender-alerts/providers/index.js';
import { DiscordNotifier } from '../../core/tender-alerts/models/notification.js';
import * as TenderModel from '../../core/tender-alerts/models/tender.js';
import { DEFAULT_FILTER_CONFIG } from '../../core/tender-alerts/types/tender.js';

export const handler = async (event: ScheduledEvent) => {
  console.log('🚀 Starting tender monitoring job', { time: new Date().toISOString() });

  try {
    // 1. Inicializar servicios usando provider pattern
    const tenderProvider = getDefaultTenderProvider();
    const notifier = new DiscordNotifier();

    // 2. Obtener licitaciones del API usando provider
    console.log('📡 Fetching tenders from Mercado Público API...');
    const allTenders = await tenderProvider.getTendersWithRetry();
    console.log(`📋 Found ${allTenders.length} total tenders`);

    // 3. Filtrar por keywords
    const filteredTenders = TenderModel.filterByKeywords(allTenders, DEFAULT_FILTER_CONFIG);
    const filterStats = {
      original: allTenders.length,
      filtered: filteredTenders.length,
      percentage: allTenders.length > 0 ? (filteredTenders.length / allTenders.length * 100).toFixed(1) : '0',
      keywords: DEFAULT_FILTER_CONFIG.keywords,
    };
    console.log(`🔍 Filtered tenders:`, filterStats);

    // 4. Identificar nuevas licitaciones
    const newTenders = [];
    const storedTenders = []; // Para tracking de updates
    
    for (const tender of filteredTenders) {
      const exists = await TenderModel.exists(tender.CodigoExterno);
      
      if (!exists) {
        // Nueva licitación - crear en DB
        const storedTender = await TenderModel.create(tender, tender.matchedKeywords);
        
        newTenders.push(tender);
        storedTenders.push(storedTender);
        
        console.log(`✨ New tender found: ${tender.CodigoExterno} - ${tender.Nombre}`);
      }
    }

    // 5. Enviar notificaciones si hay nuevas licitaciones
    if (newTenders.length > 0) {
      console.log(`🔔 Sending notifications for ${newTenders.length} new tenders`);
      
      if (newTenders.length === 1) {
        await notifier.sendTenderNotification(newTenders[0]);
      } else {
        await notifier.sendBatchNotification(newTenders);
      }

      // Marcar como notificadas
      for (const storedTender of storedTenders) {
        await TenderModel.markAsNotified(storedTender);
      }
    } else {
      console.log('ℹ️ No new tenders found');
    }

    // 6. Estadísticas finales
    const summary = {
      totalTenders: allTenders.length,
      filteredTenders: filteredTenders.length,
      newTenders: newTenders.length,
      keywords: filterStats.keywords,
      timestamp: new Date().toISOString(),
    };

    console.log('✅ Job completed successfully', summary);

    return {
      statusCode: 200,
      body: JSON.stringify(summary),
    };

  } catch (error) {
    console.error('❌ Job failed:', error);
    
    // Notificación de error (opcional)
    try {
      const notifier = new DiscordNotifier();
      await notifier.sendMessage(`🚨 Error en monitoreo de licitaciones: ${error}`);
    } catch (notificationError) {
      console.error('Failed to send error notification:', notificationError);
    }

    throw error;
  }
};