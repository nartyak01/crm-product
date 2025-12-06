const { updateProduct, findProductBySku } = require('../lib/product-functions');

/**
 * CLI: Update Product
 * Usage: node update-product.js --sku ABC123 [--title "New Title"] [options]
 */

async function main() {
  const args = process.argv.slice(2);
  
  let sku = null;
  const updates = {};

  // Parse arguments
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    if (flag === '--sku') sku = value;
    else if (flag === '--title') updates.title = value;
    else if (flag === '--description') updates.descriptionHtml = value;
    else if (flag === '--vendor') updates.vendor = value;
    else if (flag === '--product-type') updates.productType = value;
    else if (flag === '--status') updates.status = value.toUpperCase();
    else if (flag === '--tags') {
      if (value) updates.tags = value.split(',').map(t => t.trim());
    }
  }

  if (!sku) {
    console.error('❌ Error: --sku is required');
    console.error('Usage: node update-product.js --sku ABC123 [options]');
    console.error('\nOptions:');
    console.error('  --title <title>              Product title');
    console.error('  --description <description>   Product description (HTML)');
    console.error('  --vendor <vendor>             Vendor');
    console.error('  --product-type <type>         Product type');
    console.error('  --status <status>             Status: ACTIVE, DRAFT, ARCHIVED');
    console.error('  --tags <tags>                Comma-separated tags');
    process.exit(1);
  }

  if (Object.keys(updates).length === 0) {
    console.error('❌ Error: No updates provided');
    process.exit(1);
  }

  try {
    console.log(`🔍 Finding product with SKU: ${sku}...`);
    const product = await findProductBySku(sku);
    
    if (!product) {
      console.error(`❌ Error: Product with SKU "${sku}" not found`);
      process.exit(1);
    }

    console.log(`📝 Updating product...`);
    console.log(`   ID: ${product.id}`);
    console.log(`   Current Title: ${product.title}`);
    console.log(`   Updates: ${JSON.stringify(updates, null, 2)}`);

    const updated = await updateProduct(product.id, updates);

    console.log('\n✅ Updated product:');
    console.log(JSON.stringify(updated, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

