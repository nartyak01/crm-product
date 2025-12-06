const { deleteMetafieldDefinition } = require('../../lib/metafield-functions');

/**
 * CLI: Remove Metafield Definition
 * Usage: node remove-metafield-definition.js <definitionId>
 */

async function main() {
  const args = process.argv.slice(2);
  const definitionId = args[0];

  if (!definitionId) {
    console.error('❌ Error: Definition ID is required');
    console.error('Usage: node remove-metafield-definition.js <definitionId>');
    process.exit(1);
  }

  try {
    console.log('🗑️  Deleting metafield definition...');
    console.log(`   ID: ${definitionId}`);

    const deletedId = await deleteMetafieldDefinition(definitionId);

    console.log('\n✅ Deleted definition ID:', deletedId);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

