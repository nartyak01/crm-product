/**
 * Test script to check if metafield definition has pin and access set
 * Usage: node test-check-pin-access.js
 */

const { executeGraphQL } = require('./shopify/lib/graphql-client');

async function checkMetafieldPinAndAccess() {
  try {
    const definitionId = 'gid://shopify/MetafieldDefinition/163521823024';
    
    console.log('📝 Checking metafield definition pin and access...');
    console.log(`   Definition ID: ${definitionId}\n`);
    
    const query = `
      query GetMetafieldDefinition($id: ID!) {
        metafieldDefinition(id: $id) {
          id
          name
          pinnedPosition
          access {
            admin
            storefront
          }
        }
      }
    `;
    
    const variables = { id: definitionId };
    
    const result = await executeGraphQL(query, variables);
    const definition = result.metafieldDefinition;
    
    if (!definition) {
      console.log('❌ Metafield definition not found');
      return;
    }
    
    console.log('📊 Metafield Definition Status:');
    console.log(`   Name: ${definition.name}`);
    console.log(`   ID: ${definition.id}`);
    console.log(`   Pinned Position: ${definition.pinnedPosition !== null && definition.pinnedPosition !== undefined ? definition.pinnedPosition : 'NOT SET (null)'}`);
    console.log(`   Access:`);
    console.log(`     Admin: ${definition.access?.admin || 'NOT SET'}`);
    console.log(`     Storefront: ${definition.access?.storefront || 'NOT SET'}`);
    
    console.log('\n📋 Expected Values:');
    console.log('   Pinned Position: 1');
    console.log('   Admin: MERCHANT_READ_WRITE');
    console.log('   Storefront: PUBLIC_READ');
    
    console.log('\n✅ Status:');
    if (definition.pinnedPosition === 1) {
      console.log('   ✅ Pinned correctly');
    } else {
      console.log('   ❌ NOT PINNED (pinnedPosition is null or not 1)');
    }
    
    if (definition.access?.admin === 'MERCHANT_READ_WRITE' && definition.access?.storefront === 'PUBLIC_READ') {
      console.log('   ✅ Access options set correctly');
    } else {
      console.log('   ❌ Access options NOT set correctly');
      console.log(`      Current: admin=${definition.access?.admin}, storefront=${definition.access?.storefront}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  checkMetafieldPinAndAccess();
}

module.exports = { checkMetafieldPinAndAccess };


