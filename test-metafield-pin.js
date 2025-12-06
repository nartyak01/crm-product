/**
 * Test script to check if metafield has pin and access set
 * Usage: node test-metafield-pin.js
 */

async function checkMetafieldPin() {
  try {
    console.log('📝 Checking metafield "Test" pin and access status...');
    
    // Get metafield definition ID from database
    const response = await fetch('http://localhost:3000/api/metafields');
    const metafields = await response.json();
    const testMetafield = metafields.find((m) => m.type === 'Test');
    
    if (!testMetafield || !testMetafield.shopify_metafield_definition_id) {
      console.log('❌ Test metafield not found or not synced');
      return;
    }
    
    const definitionId = testMetafield.shopify_metafield_definition_id;
    console.log(`\n✅ Found metafield definition: ${definitionId}`);
    
    // Query Shopify to check pin and access
    const checkResponse = await fetch('http://localhost:3000/api/metafields/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        definition_id: definitionId,
      }),
    });
    
    if (checkResponse.ok) {
      const data = await checkResponse.json();
      console.log('\n📊 Metafield Definition Status:');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.pinnedPosition) {
        console.log(`\n✅ Pinned at position: ${data.pinnedPosition}`);
      } else {
        console.log('\n⚠️  Not pinned');
      }
      
      if (data.access) {
        console.log(`\n📋 Access settings:`);
        console.log(`   Admin: ${data.access.admin}`);
        console.log(`   Storefront: ${data.access.storefront}`);
        
        if (data.access.admin === 'MERCHANT_READ_WRITE' && data.access.storefront === 'PUBLIC_READ') {
          console.log('\n✅ All access options are set correctly!');
        } else {
          console.log('\n⚠️  Access options may not be set correctly');
        }
      } else {
        console.log('\n⚠️  No access settings found');
      }
    } else {
      console.log('\n⚠️  Could not check metafield status (API endpoint may not exist)');
      console.log('   Please check manually in Shopify Admin');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

if (require.main === module) {
  checkMetafieldPin();
}

module.exports = { checkMetafieldPin };

