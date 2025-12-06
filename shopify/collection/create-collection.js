const { createCollection } = require('../lib/collection-functions');

/**
 * CLI: Create Collection
 * Usage: node create-collection.js 'Diamond' [--description "Description"] [--handle "handle"]
 */

async function main() {
  const args = process.argv.slice(2);
  const title = args[0];

  if (!title) {
    console.error('❌ Error: Title is required');
    console.error('Usage: node create-collection.js <title> [--description "Description"] [--handle "handle"] [--image "url"]');
    process.exit(1);
  }

  const options = {
    descriptionHtml: null,
    handle: null,
    image: null,
  };

  // Parse options
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (flag === '--description') options.descriptionHtml = value;
    else if (flag === '--handle') options.handle = value;
    else if (flag === '--image') options.image = value;
  }

  try {
    console.log('📝 Creating collection...');
    console.log(`   Title: ${title}`);
    if (options.descriptionHtml) console.log(`   Description: ${options.descriptionHtml}`);
    if (options.handle) console.log(`   Handle: ${options.handle}`);
    if (options.image) console.log(`   Image: ${options.image}`);

    const collection = await createCollection({
      title,
      ...options,
    });

    console.log('\n✅ Created collection:');
    console.log(JSON.stringify(collection, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

