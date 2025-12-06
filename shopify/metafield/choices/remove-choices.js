const { removeChoices } = require('../../lib/metafield-choices-functions');

/**
 * CLI: Remove Choices
 * Usage: node remove-choices.js <name|definitionId> "choice1" "choice2" [options]
 */

async function main() {
  const args = process.argv.slice(2);
  const identifier = args[0];

  if (!identifier || args.length < 2) {
    console.error('❌ Error: Identifier and at least one choice are required');
    console.error('Usage: node remove-choices.js <name|definitionId> <choice1> [choice2] ... [options]');
    console.error('\nOptions:');
    console.error('  --namespace <namespace>     Default: custom');
    console.error('  --owner-type <type>        Default: PRODUCT');
    process.exit(1);
  }

  const choicesToRemove = [];
  let namespace = 'custom';
  let ownerType = 'PRODUCT';
  
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--namespace' && args[i + 1]) {
      namespace = args[i + 1];
      i++;
    } else if (args[i] === '--owner-type' && args[i + 1]) {
      ownerType = args[i + 1];
      i++;
    } else {
      choicesToRemove.push(args[i]);
    }
  }

  if (choicesToRemove.length === 0) {
    console.error('❌ Error: At least one choice is required');
    process.exit(1);
  }

  try {
    console.log('➖ Removing choices...');
    console.log(`   Metafield: ${identifier}`);
    console.log(`   Choices to remove: ${choicesToRemove.join(', ')}`);
    
    const updated = await removeChoices(identifier, choicesToRemove, namespace, ownerType);
    console.log('\n✅ Updated definition:');
    console.log(JSON.stringify(updated, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

