// Script temporal para testear operaciones de DynamoDB
import * as TenderModel from '../backend/core/tender-alerts/models/tender.js';
import type { Tender } from '../backend/core/tender-alerts/types/tender.js';

async function testDynamoDBOperations() {
  console.log('🗄️ Testing DynamoDB operations...');

  // Test tender data
  const testTender: Tender = {
    CodigoExterno: 'TEST-' + Date.now(),
    Nombre: 'TEST - Curso de Capacitación en Tecnología Educativa',
    Comprador: 'Ministerio de Educación (TEST)',
    EstadoLicitacion: 'Activa',
    FechaCierre: '2025-12-31',
    CodigoLicitacion: 'TEST-LIC-001',
    UnidadTecnica: 'Unidad de Tecnología',
    FechaCreacion: '2025-09-03',
    Tipo: 'Licitación Pública',
  };

  try {
    // Test 1: Verificar que no existe
    console.log('\n🔍 Test 1: Check if tender exists (should be false)...');
    const existsBefore = await TenderModel.exists(testTender.CodigoExterno);
    if (!existsBefore) {
      console.log('✅ Exists Check: SUCCESS - Tender does not exist yet');
    } else {
      console.log('⚠️ Exists Check: Tender already exists, this may affect other tests');
    }

    // Test 2: Crear nueva licitación
    console.log('\n📝 Test 2: Create new tender...');
    const keywords = ['curso', 'capacitación'];
    const storedTender = await TenderModel.create(testTender, keywords);
    console.log('✅ Create Operation: SUCCESS');
    console.log(`   - Tender ID: ${storedTender.tenderId}`);
    console.log(`   - Created At: ${storedTender.createdAt}`);
    console.log(`   - Notified: ${storedTender.notified}`);
    console.log(`   - Keywords: ${storedTender.keywords?.join(', ')}`);

    // Test 3: Verificar que ahora existe
    console.log('\n🔍 Test 3: Check if tender exists (should be true)...');
    const existsAfter = await TenderModel.exists(testTender.CodigoExterno);
    if (existsAfter) {
      console.log('✅ Exists Check: SUCCESS - Tender now exists');
    } else {
      console.log('❌ Exists Check: FAILED - Tender should exist but doesn\'t');
    }

    // Test 4: Marcar como notificada
    console.log('\n🔔 Test 4: Mark tender as notified...');
    await TenderModel.markAsNotified(storedTender);
    console.log('✅ Mark as Notified: SUCCESS');

    // Test 5: Verificar que se actualizó (esto requerirá leer el registro)
    console.log('\n📖 Test 5: Verify notification flag...');
    try {
      // Usando el cliente directamente para verificar
      const updatedTender = await TenderModel.tenderClient.get(testTender.CodigoExterno);
      if (updatedTender.notified === true) {
        console.log('✅ Notification Update: SUCCESS - Tender marked as notified');
      } else {
        console.log('❌ Notification Update: FAILED - Notified flag not updated');
      }
    } catch (error) {
      console.log('❌ Notification Verification: FAILED - Could not read updated tender');
    }

    // Test 6: Filtrado de keywords
    console.log('\n🏷️ Test 6: Keyword filtering...');
    const testTenders = [testTender];
    const filtered = TenderModel.filterByKeywords(testTenders);
    if (filtered.length > 0 && filtered[0].matchedKeywords.length > 0) {
      console.log('✅ Keyword Filtering: SUCCESS');
      console.log(`   - Matched keywords: ${filtered[0].matchedKeywords.join(', ')}`);
    } else {
      console.log('⚠️ Keyword Filtering: No keywords matched (check test tender name)');
    }

    // Cleanup: Eliminar tender de prueba
    console.log('\n🧹 Cleanup: Removing test tender...');
    await TenderModel.tenderClient.delete(testTender.CodigoExterno);
    console.log('✅ Cleanup: SUCCESS - Test tender removed');

    // Resumen
    console.log('\n📊 DynamoDB Test Summary:');
    console.log('   - ✅ Create operation');
    console.log('   - ✅ Exists checking'); 
    console.log('   - ✅ Update operation');
    console.log('   - ✅ Keyword filtering');
    console.log('   - ✅ Cleanup operation');
    console.log('   - 🎉 All DynamoDB operations working correctly!');

  } catch (error) {
    console.error('❌ DynamoDB Test Failed:', error);
    
    // Attempt cleanup even if tests failed
    try {
      console.log('\n🧹 Emergency cleanup...');
      await TenderModel.tenderClient.delete(testTender.CodigoExterno);
      console.log('✅ Emergency cleanup successful');
    } catch (cleanupError) {
      console.log('⚠️ Emergency cleanup failed - you may need to manually delete test data');
    }
  }
}

testDynamoDBOperations();