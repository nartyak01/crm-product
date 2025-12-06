const { deleteCollection, findCollectionByTitle } = require('../lib/collection-functions');

/**
 * CLI: Remove Collection
 * Usage: node remove-collection.js <collectionId|name>
 * Example: node remove-collection.js 'Earrings'
 * Example: node remove-collection.js gid://shopify/Collection/123
 */

async function main() {
  const args = process.argv.slice(2);
  const identifier = args[0];

  if (!identifier) {
    console.error('❌ Error: Collection ID or name is required');
    console.error('Usage: node remove-collection.js <collectionId|name>');
    console.error('Example: node remove-collection.js "Earrings"');
    console.error('Example: node remove-collection.js gid://shopify/Collection/123');
    process.exit(1);
  }

  try {
    let collectionId = identifier;

    // Check if identifier is a GID (starts with gid://)
    if (!identifier.startsWith('gid://')) {
      // It's a name, find collection by title
      console.log(`🔍 Finding collection with name: "${identifier}"...`);
      const collection = await findCollectionByTitle(identifier);
      
      if (!collection) {
        console.error(`❌ Error: Collection "${identifier}" not found`);
        process.exit(1);
      }
      
      collectionId = collection.id;
      console.log(`   Found: ${collection.title} (ID: ${collection.id})`);
    }

    console.log('\n🗑️  Deleting collection...');
    console.log(`   ID: ${collectionId}`);

    const deletedId = await deleteCollection(collectionId);

    console.log('\n✅ Deleted collection ID:', deletedId);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

