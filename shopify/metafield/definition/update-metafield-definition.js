const { updateMetafieldDefinition } = require('../../lib/metafield-functions');

/**
 * CLI: Update Metafield Definition
 * Usage: node update-metafield-definition.js <definitionId> [--name "Name"] [--description "Description"]
 */

async function main() {
  const args = process.argv.slice(2);
  const definitionId = args[0];

  if (!definitionId) {
    console.error('❌ Error: Definition ID is required');
    console.error('Usage: node update-metafield-definition.js <definitionId> [--name "Name"] [--description "Description"]');
    process.exit(1);
  }

  const updates = {};

  // Parse options
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    if (flag === '--name') updates.name = value;
    else if (flag === '--description') updates.description = value;
  }

  if (Object.keys(updates).length === 0) {
    console.error('❌ Error: No updates provided');
    process.exit(1);
  }

  try {
    console.log('📝 Updating metafield definition...');
    console.log(`   ID: ${definitionId}`);
    console.log(`   Updates: ${JSON.stringify(updates, null, 2)}`);

    const definition = await updateMetafieldDefinition(definitionId, updates);

    console.log('\n✅ Updated metafield definition:');
    console.log(JSON.stringify(definition, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

