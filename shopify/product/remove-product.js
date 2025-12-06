const { deleteProduct, findProductBySku } = require('../lib/product-functions');

/**
 * CLI: Remove Product
 * Usage: node remove-product.js --sku ABC123
 */

async function main() {
  const args = process.argv.slice(2);
  
  let sku = null;

  // Parse arguments
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    
    if (flag === '--sku') sku = value;
  }

  if (!sku) {
    console.error('❌ Error: --sku is required');
    console.error('Usage: node remove-product.js --sku ABC123');
    process.exit(1);
  }

  try {
    console.log(`🔍 Finding product with SKU: ${sku}...`);
    const product = await findProductBySku(sku);
    
    if (!product) {
      console.error(`❌ Error: Product with SKU "${sku}" not found`);
      process.exit(1);
    }

    console.log('🗑️  Deleting product...');
    console.log(`   ID: ${product.id}`);
    console.log(`   Title: ${product.title}`);

    const deletedId = await deleteProduct(product.id);

    console.log('\n✅ Deleted product ID:', deletedId);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

