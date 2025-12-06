/**
 * Test script to create metafield with name "Test" and value "Test 1"
 * Usage: node test-create-test-metafield.js
 */

async function createTestMetafield() {
  try {
    console.log('📝 Creating metafield: type="Test", name="Test 1"...');
    console.log('   (This will test pin and access options)\n');
    
    const response = await fetch('http://localhost:3000/api/metafields', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Test 1',      // Value name
        type: 'Test',         // Metafield type
        value: '',            // Optional default value
        description: '',      // Optional description
        brand_id: 4,         // Brand ID
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error creating metafield:');
      console.error(JSON.stringify(data, null, 2));
      process.exit(1);
    }

    console.log('✅ Metafield created in database:');
    console.log(JSON.stringify(data, null, 2));
    
    // Wait a bit for sync to complete
    console.log('\n⏳ Waiting for Shopify sync (3 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check sync status
    const checkResponse = await fetch('http://localhost:3000/api/metafields');
    const metafields = await checkResponse.json();
    const testMetafield = metafields.find((m) => m.type === 'Test');
    
    if (testMetafield) {
      console.log('\n📊 Metafield Status:');
      console.log(`   Type: ${testMetafield.type}`);
      console.log(`   Values: ${testMetafield.values.join(', ')}`);
      
      if (testMetafield.shopify_metafield_definition_id) {
        console.log(`\n✅ Shopify Definition ID: ${testMetafield.shopify_metafield_definition_id}`);
        console.log('\n⚠️  Please check in Shopify Admin:');
        console.log('   1. Is the metafield pinned? (should see pin icon)');
        console.log('   2. Are all 3 options enabled in "Options" section?');
        console.log('      - Filter on the product list and in the Admin API');
        console.log('      - Use as a condition in smart collections');
        console.log('      - Storefront API access');
      } else {
        console.log('\n⚠️  Warning: No Shopify Definition ID found');
        console.log('   Sync may have failed. Check server logs.');
      }
    } else {
      console.log('\n⚠️  Test metafield not found in list');
    }
    
    console.log('\n💡 Check server console logs for any warnings about pin/access');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  createTestMetafield();
}

module.exports = { createTestMetafield };


