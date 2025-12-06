const { createMetafieldDefinition } = require('../../lib/metafield-functions');
const { nameToKey } = require('../../lib/helpers');

/**
 * CLI: Create Metafield Definition
 * Usage: node create-metafield-definition.js "Care Instructions" [options]
 */

async function main() {
  const args = process.argv.slice(2);
  const name = args[0];

  if (!name) {
    console.error('❌ Error: Name is required');
    console.error('Usage: node create-metafield-definition.js <name> [options]');
    console.error('\nOptions:');
    console.error('  --namespace <namespace>     Default: custom');
    console.error('  --key <key>                Default: auto-generated from name');
    console.error('  --owner-type <type>        Default: PRODUCT');
    console.error('  --type <type>              Default: list.single_line_text_field');
    console.error('  --description <description>');
    process.exit(1);
  }

  const options = {
    namespace: 'custom',
    key: null,
    ownerType: 'PRODUCT',
    type: 'list.single_line_text_field',
    description: null,
  };

  // Parse options
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    if (flag === '--namespace') options.namespace = value;
    else if (flag === '--key') options.key = value;
    else if (flag === '--owner-type') options.ownerType = value;
    else if (flag === '--type') options.type = value;
    else if (flag === '--description') options.description = value;
  }

  const finalKey = options.key || nameToKey(name);

  try {
    console.log('📝 Creating metafield definition...');
    console.log(`   Name: ${name}`);
    console.log(`   Namespace: ${options.namespace}`);
    console.log(`   Key: ${finalKey} (${options.key ? 'provided' : 'auto-generated'})`);
    console.log(`   Owner Type: ${options.ownerType}`);
    console.log(`   Type: ${options.type}`);
    if (options.description) console.log(`   Description: ${options.description}`);

    const definition = await createMetafieldDefinition({
      name,
      ...options,
      key: finalKey,
    });

    console.log('\n✅ Created metafield definition:');
    console.log(JSON.stringify(definition, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

