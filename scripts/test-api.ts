// Script temporal para testear API de Mercado Público usando provider pattern
import { getDefaultTenderProvider, getAvailableProviders } from '../backend/core/tender-alerts/providers/index.js';
import * as TenderModel from '../backend/core/tender-alerts/models/tender.js';
import { DEFAULT_FILTER_CONFIG } from '../backend/core/tender-alerts/types/tender.js';

async function testMercadoPublicoAPI() {
  console.log('🌐 Testing Mercado Público API using provider pattern...');
  
  // Test 0: Show available providers
  console.log('\n📋 Available providers:');
  const providers = getAvailableProviders();
  providers.forEach(p => {
    console.log(`   - ${p.name} (${p.id}): ${p.description}`);
  });

  try {
    const tenderProvider = getDefaultTenderProvider();

    // Test 1: Conectividad básica
    console.log('\n📡 Test 1: Fetching tenders from API...');
    const tenders = await tenderProvider.getTenders();
    console.log(`✅ API Connection: SUCCESS - Found ${tenders.length} tenders`);

    // Test 2: Validación de datos
    console.log('\n🔍 Test 2: Data validation...');
    const firstTender = tenders[0];
    if (firstTender) {
      console.log('✅ Data Structure: SUCCESS');
      console.log('📋 Sample tender:');
      console.log(`   - ID: ${firstTender.CodigoExterno}`);
      console.log(`   - Nombre: ${firstTender.Nombre?.substring(0, 50)}...`);
      console.log(`   - Comprador: ${firstTender.Comprador || 'N/A'}`);
      console.log(`   - Estado: ${firstTender.EstadoLicitacion || 'N/A'}`);
    } else {
      console.log('❌ No tenders found in API response');
    }

    // Test 3: Filtrado por keywords
    console.log('\n🏷️ Test 3: Keyword filtering...');
    const filteredTenders = TenderModel.filterByKeywords(tenders, DEFAULT_FILTER_CONFIG);
    console.log(`✅ Filter Logic: SUCCESS`);
    console.log(`📊 Results: ${filteredTenders.length}/${tenders.length} tenders match keywords`);
    
    if (filteredTenders.length > 0) {
      console.log('🎯 Sample filtered tenders:');
      filteredTenders.slice(0, 3).forEach((tender, index) => {
        console.log(`   ${index + 1}. ${tender.Nombre.substring(0, 60)}...`);
        console.log(`      Keywords: ${tender.matchedKeywords.join(', ')}`);
      });
    }

    // Test 4: Retry mechanism
    console.log('\n🔄 Test 4: Retry mechanism...');
    const tendersWithRetry = await tenderProvider.getTendersWithRetry();
    if (tendersWithRetry.length === tenders.length) {
      console.log('✅ Retry Logic: SUCCESS - Same results as direct call');
    } else {
      console.log('⚠️ Retry Logic: Different results than direct call');
    }

    // Resumen
    console.log('\n📊 API Test Summary:');
    console.log(`   - Total tenders: ${tenders.length}`);
    console.log(`   - Filtered tenders: ${filteredTenders.length}`);
    console.log(`   - Success rate: ${tenders.length > 0 ? '100%' : '0%'}`);
    console.log(`   - Keywords used: ${DEFAULT_FILTER_CONFIG.keywords.join(', ')}`);

  } catch (error) {
    console.error('❌ API Test Failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('API request failed')) {
        console.log('💡 Check if API token is valid');
      } else if (error.message.includes('Failed to fetch tenders')) {
        console.log('💡 Check network connectivity');
      }
    }
  }
}

testMercadoPublicoAPI();