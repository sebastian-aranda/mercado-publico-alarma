// Script para ejecutar todos los tests del sistema
console.log('🧪 Running all system tests...\n');

async function runAllTests() {
  try {
    console.log('1️⃣ Testing Discord Notifications...');
    console.log('=' .repeat(50));
    await import('./test-discord.js');
    
    console.log('\n2️⃣ Testing Mercado Público API...');
    console.log('=' .repeat(50));
    await import('./test-api.js');
    
    console.log('\n3️⃣ Testing DynamoDB Operations...');
    console.log('=' .repeat(50));
    await import('./test-dynamodb.js');
    
    console.log('\n🎉 All tests completed!');
    console.log('=' .repeat(50));
    console.log('✅ System fully tested and validated');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

runAllTests();