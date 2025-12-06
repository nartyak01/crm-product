const { updateCollection, findCollectionByTitle } = require('../lib/collection-functions');

/**
 * CLI: Update Collection
 * Usage: node update-collection.js <collectionId|name> [--title "New Title"] [--description "Description"] [--handle "handle"]
 * Example: node update-collection.js 'Earrings' --title "New Earrings"
 * Example: node update-collection.js gid://shopify/Collection/123 --title "New Title"
 */

async function main() {
  const args = process.argv.slice(2);
  const identifier = args[0];

  if (!identifier) {
    console.error('❌ Error: Collection ID or name is required');
    console.error('Usage: node update-collection.js <collectionId|name> [--title "Title"] [--description "Description"] [--handle "handle"] [--image "url"]');
    console.error('Example: node update-collection.js "Earrings" --title "New Earrings"');
    console.error('Example: node update-collection.js gid://shopify/Collection/123 --title "New Title"');
    process.exit(1);
  }

  const updates = {};

  // Parse options
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (flag === '--title') updates.title = value;
    else if (flag === '--description') updates.descriptionHtml = value;
    else if (flag === '--handle') updates.handle = value;
    else if (flag === '--image') updates.image = value;
  }

  if (Object.keys(updates).length === 0) {
    console.error('❌ Error: No updates provided');
    console.error('Usage: node update-collection.js <collectionId|name> [--title "Title"] [--description "Description"] [--handle "handle"] [--image "url"]');
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

    console.log('\n📝 Updating collection...');
    console.log(`   ID: ${collectionId}`);
    console.log(`   Updates: ${JSON.stringify(updates, null, 2)}`);

    const collection = await updateCollection(collectionId, updates);

    console.log('\n✅ Updated collection:');
    console.log(JSON.stringify(collection, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

