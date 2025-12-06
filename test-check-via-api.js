/**
 * Test script to check metafield pin/access via API
 * Usage: node test-check-via-api.js
 */

async function checkViaAPI() {
  try {
    const definitionId = 'gid://shopify/MetafieldDefinition/163521823024';
    
    console.log('📝 Checking metafield definition via API...');
    console.log(`   Definition ID: ${definitionId}\n`);
    
    const response = await fetch('http://localhost:3000/api/metafields/check-definition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        definition_id: definitionId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Error:', data.error);
      return;
    }

    console.log('📊 Metafield Definition Status:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n✅ Status Summary:');
    if (data.isPinned) {
      console.log(`   ✅ PINNED at position ${data.pinnedPosition}`);
    } else {
      console.log('   ❌ NOT PINNED');
    }
    
    if (data.hasCorrectAccess) {
      console.log('   ✅ Access options set correctly');
    } else {
      console.log('   ❌ Access options NOT set correctly');
      console.log(`      Current: ${JSON.stringify(data.access)}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

if (require.main === module) {
  checkViaAPI();
}

module.exports = { checkViaAPI };


