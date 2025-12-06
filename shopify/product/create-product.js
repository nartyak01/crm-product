// Note: Next.js automatically loads .env.local, so we use process.env directly
const { Client } = require('pg');
const { createProduct, normalizeImageUrl, parseGalleryImages } = require('../lib/product-functions');
const { findCollectionByTitle, addProductToCollection } = require('../lib/collection-functions');
const { findDefinitionIdByName, setProductMetafield, listMetafieldDefinitions } = require('../lib/metafield-functions');
const { nameToKey } = require('../lib/helpers');

/**
 * CLI: Create Product from Database
 * Usage: node create-product.js --sku ABC123
 */

/**
 * Decode URL-encoded description
 */
function decodeDescription(description) {
  if (!description || typeof description !== 'string') {
    return '';
  }
  try {
    return decodeURIComponent(description);
  } catch (e) {
    return description;
  }
}

/**
 * Get metafield definition info (namespace, key, type) from definition name
 * @param {string} name - Metafield name (e.g., "Shape", "Cut Grade")
 * @param {string} namespace - Namespace (default: "custom")
 * @param {string} ownerType - Owner type (default: "PRODUCT")
 * @returns {Promise<Object|null>} - Definition info with namespace, key, type or null
 */
async function getMetafieldDefinitionInfo(name, namespace = 'custom', ownerType = 'PRODUCT') {
  const definitions = await listMetafieldDefinitions(ownerType, namespace);
  const definition = definitions.find(def => def.name === name);
  
  if (!definition) {
    return null;
  }
  
  return {
    id: definition.id,
    namespace: definition.namespace,
    key: definition.key,
    type: definition.type?.name || 'single_line_text_field'
  };
}

/**
 * Get product from database by SKU - automatically detects if it's diamond or normal product
 * Returns product with either attributes (normal) or diamond fields
 */
async function getProductBySkuFromDB(sku) {
  if (!sku || typeof sku !== 'string' || sku.trim() === '') {
    throw new Error('SKU is required and cannot be empty');
  }

  // Create a new client for each call to avoid reuse issues
  const pgClient = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    await pgClient.connect();

    // First, check if product has diamond data
    const checkDiamondQuery = `
      SELECT COUNT(*) as count
      FROM diamond
      WHERE product_id = (SELECT id FROM product WHERE UPPER(TRIM(sku)) = UPPER(TRIM($1)) LIMIT 1)
    `;
    const diamondCheck = await pgClient.query(checkDiamondQuery, [sku]);
    const hasDiamond = diamondCheck.rows[0]?.count > 0;

    // Query product with categories
    const productQuery = `
      SELECT 
        p.id,
        p.sku,
        p.name,
        p.product_type,
        p.retail_price,
        p.sale_price,
        p.description,
        p.is_pre_order,
        p.status,
        p.published_at,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', c.id,
              'name', c.name,
              'parent_id', c.parent_id
            ) ORDER BY c.id
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'::json
        ) as categories
      FROM product p
      LEFT JOIN product_category pc ON p.id = pc.product_id
      LEFT JOIN category c ON pc.category_id = c.id
      WHERE UPPER(TRIM(p.sku)) = UPPER(TRIM($1))
      GROUP BY p.id, p.sku, p.name, p.product_type, p.retail_price, p.sale_price, 
               p.description, p.is_pre_order, p.status, p.published_at
      LIMIT 1
    `;

    const productResult = await pgClient.query(productQuery, [sku]);

    if (productResult.rows.length === 0) {
      return null;
    }

    const product = productResult.rows[0];

    // Query product_image separately (one-to-one relationship)
    const imageQuery = `
      SELECT thumbnail, gallery
      FROM product_image
      WHERE product_id = $1
      LIMIT 1
    `;

    const imageResult = await pgClient.query(imageQuery, [product.id]);
    const imageData = imageResult.rows.length > 0 ? imageResult.rows[0] : { thumbnail: null, gallery: null };

    // Merge image data into product object
    product.thumbnail = imageData.thumbnail;
    product.gallery = imageData.gallery;

    // Remove duplicate categories by id
    let categories = [];
    if (product.categories && Array.isArray(product.categories) && product.categories.length > 0) {
      const categoryMap = new Map();
      product.categories.forEach(cat => {
        if (cat && cat.id && !categoryMap.has(cat.id)) {
          categoryMap.set(cat.id, cat);
        }
      });
      categories = Array.from(categoryMap.values());
    }

    let result = {
      ...product,
      categories: categories,
    };

    // If product has diamond data, fetch diamond fields
    if (hasDiamond) {
      const diamondQuery = `
        SELECT 
          shape, cut_grade, carat, color, clarity, grading_lab,
          certificate_number, certificate_path, image_path, total_price,
          measurement_length, measurement_width, measurement_height,
          country, state_region, guaranteed_availability, item_id
        FROM diamond
        WHERE product_id = $1
        LIMIT 1
      `;
      
      const diamondResult = await pgClient.query(diamondQuery, [product.id]);
      
      if (diamondResult.rows.length > 0) {
        result.diamond = diamondResult.rows[0];
        result.attributes = []; // Empty for diamond products
      } else {
        result.diamond = null;
        result.attributes = [];
      }
    } else {
      // For normal products, fetch attributes
      const attributesQuery = `
        SELECT 
          pa.type,
          pa.name,
          pav.value
        FROM product_attribute_value pav
        INNER JOIN product_attribute pa ON pav.attribute_id = pa.id
        WHERE pav.product_id = $1
        ORDER BY pa.type, pa.name
      `;

      const attributesResult = await pgClient.query(attributesQuery, [product.id]);
      result.attributes = attributesResult.rows.map(row => ({
        type: row.type,
        name: row.name,
        value: row.value,
      }));
      result.diamond = null;
    }

    // Display fetched data
    console.log('\n📋 Product data from database:');
    console.log('─'.repeat(100));
    console.log(`ID: ${result.id}`);
    console.log(`SKU: ${result.sku}`);
    console.log(`Name: ${result.name}`);
    console.log(`Product Type: ${result.product_type || '(null)'}`);
    console.log(`Type: ${hasDiamond ? 'Diamond Product' : 'Normal Product'}`);
    console.log(`Retail Price: ${result.retail_price || '(null)'}`);
    console.log(`Sale Price: ${result.sale_price || '(null)'}`);
    console.log(`Status: ${result.status || '(null)'}`);
    console.log(`Is Pre-order: ${result.is_pre_order || false}`);
    console.log(`Published At: ${result.published_at || '(null)'}`);
    console.log(`Thumbnail: ${result.thumbnail ? result.thumbnail.substring(0, 100) + (result.thumbnail.length > 100 ? '...' : '') : '(empty)'}`);
    console.log(`Gallery: ${result.gallery ? (typeof result.gallery === 'string' ? result.gallery.substring(0, 200) + (result.gallery.length > 200 ? '...' : '') : JSON.stringify(result.gallery).substring(0, 200)) : '(empty)'}`);
    console.log(`Description: ${result.description ? result.description.substring(0, 200) + (result.description.length > 200 ? '...' : '') : '(empty)'}`);
    console.log(`\nCategories (${result.categories.length}):`);
    if (result.categories.length > 0) {
      result.categories.forEach((cat, idx) => {
        console.log(`   ${idx + 1}. ID: ${cat.id}, Name: ${cat.name}, Parent ID: ${cat.parent_id || '(null)'}`);
      });
    } else {
      console.log('   (none)');
    }
    
    if (hasDiamond) {
      console.log(`\nDiamond Fields:`);
      if (result.diamond && Object.keys(result.diamond).some(key => result.diamond[key] !== null && result.diamond[key] !== '')) {
        Object.entries(result.diamond).forEach(([key, value]) => {
          if (value !== null && value !== '') {
            console.log(`   ${key}: ${value}`);
          }
        });
      } else {
        console.log('   (none)');
      }
    } else {
      console.log(`\nAttributes (${result.attributes.length}):`);
      if (result.attributes.length > 0) {
        result.attributes.forEach((attr, idx) => {
          console.log(`   ${idx + 1}. ${attr.type}.${attr.name}: ${attr.value}`);
        });
      } else {
        console.log('   (none)');
      }
    }
    console.log('─'.repeat(100));
    console.log('');

    return result;
  } catch (error) {
    throw new Error(`Database query failed: ${error.message}`);
  } finally {
    await pgClient.end();
  }
}

/**
 * Create product from SKU (reusable function)
 * Automatically handles both normal products (with attributes) and diamond products (with diamond fields)
 * @param {string} sku - Product SKU
 * @returns {Promise<Object>} - Created product object
 */
async function createProductFromSku(sku) {
  if (!sku || typeof sku !== 'string' || sku.trim() === '') {
    throw new Error('SKU is required and cannot be empty');
  }

  console.log(`🔍 Fetching product from database with SKU: ${sku}...`);
  
  // Get product from database (automatically detects diamond or normal)
  const dbProduct = await getProductBySkuFromDB(sku);
  
  if (!dbProduct) {
    throw new Error(`Product with SKU "${sku}" not found in database`);
  }

  const isDiamondProduct = dbProduct.diamond !== null;

  console.log('✅ Product found in database:');
  console.log(`   Name: ${dbProduct.name}`);
  console.log(`   Product Type: ${dbProduct.product_type}`);
  console.log(`   Type: ${isDiamondProduct ? 'Diamond Product' : 'Normal Product'}`);
  console.log(`   Price: ${dbProduct.sale_price || dbProduct.retail_price}`);
  console.log(`   Categories: ${dbProduct.categories.length}`);
  if (isDiamondProduct) {
    console.log(`   Has Diamond Data: Yes`);
  } else {
    console.log(`   Attributes: ${dbProduct.attributes.length}`);
  }

  // Prepare images
  const images = [];
  if (dbProduct.thumbnail) {
    const normalized = normalizeImageUrl(dbProduct.thumbnail);
    if (normalized) images.push(normalized);
  }
  // Also check diamond image_path if available
  if (isDiamondProduct && dbProduct.diamond && dbProduct.diamond.image_path) {
    const normalized = normalizeImageUrl(dbProduct.diamond.image_path);
    if (normalized && !images.includes(normalized)) {
      images.push(normalized);
    }
  }
  const galleryImages = parseGalleryImages(dbProduct.gallery);
  galleryImages.forEach(imgUrl => {
    const normalized = normalizeImageUrl(imgUrl);
    if (normalized && !images.includes(normalized)) {
      images.push(normalized);
    }
  });

  // Prepare price
  const price = dbProduct.sale_price > 0 
    ? dbProduct.sale_price.toString() 
    : dbProduct.retail_price.toString();

  // Prepare tags
  const tags = [];
  if (dbProduct.is_pre_order) {
    tags.push('pre-order');
  }

  // Prepare description
  const descriptionHtml = decodeDescription(dbProduct.description || '');

  // Determine product status: 'updated' -> 'ACTIVE', others -> 'DRAFT'
  const productStatus = dbProduct.status === 'updated' ? 'ACTIVE' : 'DRAFT';

  console.log('\n📝 Creating product on Shopify...');
  console.log(`   Title: ${dbProduct.name}`);
  console.log(`   SKU: ${dbProduct.sku}`);
  console.log(`   Price: ${price}`);
  console.log(`   Status: ${productStatus} (from DB status: ${dbProduct.status})`);
  if (descriptionHtml) console.log(`   Description: ${descriptionHtml.substring(0, 100)}...`);
  if (images.length > 0) console.log(`   Images: ${images.length}`);
  if (tags.length > 0) console.log(`   Tags: ${tags.join(', ')}`);

  // Create product on Shopify
  const product = await createProduct({
    title: dbProduct.name,
    sku: dbProduct.sku,
    price: price,
    descriptionHtml: descriptionHtml,
    vendor: 'Hebes',
    productType: dbProduct.product_type || null,
    images: images,
    tags: tags,
    status: productStatus,
  });

  console.log('\n✅ Created product on Shopify:');
  console.log(JSON.stringify(product, null, 2));

  // Add product to collections based on categories
  if (dbProduct.categories.length > 0) {
    console.log('\n📦 Adding product to collections...');
    const collectionIds = [];
    
    for (const category of dbProduct.categories) {
      if (category.name) {
        try {
          // Find collection by category name
          const collection = await findCollectionByTitle(category.name);
          
          if (collection) {
            // Add product to collection
            await addProductToCollection(product.id, collection.id);
            collectionIds.push(collection.id);
            console.log(`   ✓ Added to collection: ${collection.title}`);
          } else {
            console.log(`   ⚠️  Collection not found: "${category.name}" (skipping)`);
          }
        } catch (error) {
          console.warn(`   ⚠️  Warning: Could not add to collection "${category.name}": ${error.message}`);
        }
      }
    }
    
    if (collectionIds.length > 0) {
      console.log(`\n✅ Added product to ${collectionIds.length} collection(s)`);
    } else if (dbProduct.categories.length > 0) {
      console.log(`\nℹ️  No matching collections found for product categories`);
    }
  }

  // Set metafields - different logic for diamond vs normal products
  if (isDiamondProduct && dbProduct.diamond) {
    // Set metafields from diamond fields
    console.log('\n🏷️  Setting product metafields from diamond data...');
    let metafieldCount = 0;
    const skippedMetafields = [];
    
    // Fields from diamond table that should be set as metafields
    const diamondMetafieldFields = [
      'shape',
      'cut_grade',
      'carat',
      'color',
      'clarity',
      'grading_lab',
      'certificate_number',
      'certificate_path',
      'image_path',
      'total_price',
      'measurement_length',
      'measurement_width',
      'measurement_height',
      'country',
      'state_region',
      'guaranteed_availability',
      'item_id',
    ];

    for (const fieldName of diamondMetafieldFields) {
      const fieldValue = dbProduct.diamond[fieldName];
      
      // Skip null, empty string, or zero values (except for guaranteed_availability which is boolean)
      if (fieldValue === null || fieldValue === '' || 
          (fieldValue === 0 && fieldName !== 'guaranteed_availability')) {
        continue;
      }

      try {
        // Format metafield name from field name: "cut_grade" -> "Cut Grade"
        const formatMetafieldName = (str) => {
          return str
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        };
        
        const metafieldName = formatMetafieldName(fieldName);
        
        // Get definition info (namespace, key, type) from definition name
        const definitionInfo = await getMetafieldDefinitionInfo(metafieldName, 'custom', 'PRODUCT');
        
        if (!definitionInfo) {
          skippedMetafields.push(`${fieldName} (metafield "${metafieldName}" not found)`);
          continue;
        }
        
        // Convert value to string for metafield
        let metafieldValue = String(fieldValue);
        if (fieldName === 'guaranteed_availability') {
          metafieldValue = fieldValue ? 'Yes' : 'No';
        }
        
        // Format value for list type: must be JSON string
        // For list.single_line_text_field, value must be JSON array like ["Round"]
        if (definitionInfo.type === 'list.single_line_text_field') {
          metafieldValue = JSON.stringify([metafieldValue]);
        }
        
        // Set metafield value on product with info from definition
        await setProductMetafield(
          product.id,
          definitionInfo.namespace,  // Get from definition
          definitionInfo.key,        // Get from definition
          metafieldValue,
          definitionInfo.type        // Get from definition (e.g., "list.single_line_text_field")
        );
        
        metafieldCount++;
        console.log(`   ✓ Set metafield: ${metafieldName} = ${metafieldValue} (type: ${definitionInfo.type})`);
      } catch (error) {
        skippedMetafields.push(`${fieldName} (${error.message})`);
        console.warn(`   ⚠️  Warning: Could not set metafield "${fieldName}": ${error.message}`);
      }
    }
    
    if (metafieldCount > 0) {
      console.log(`\n✅ Set ${metafieldCount} metafield(s) on product from diamond data`);
    }
    
    if (skippedMetafields.length > 0) {
      console.log(`\n⚠️  Skipped ${skippedMetafields.length} metafield(s):`);
      skippedMetafields.forEach(msg => console.log(`   - ${msg}`));
    }
  } else if (!isDiamondProduct && dbProduct.attributes.length > 0) {
    // Set metafields from attributes (normal products)
    console.log('\n🏷️  Setting product metafields from attributes...');
    let metafieldCount = 0;
    const skippedMetafields = [];
    
    for (const attr of dbProduct.attributes) {
      try {
        // Format metafield name from type: "cut_grade" -> "Cut Grade"
        // This matches the format used in sync-metafields-from-db.js
        const formatMetafieldName = (str) => {
          return str
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        };
        
        // Use attr.type to format metafield name (e.g., "cut_grade" -> "Cut Grade")
        const metafieldName = formatMetafieldName(attr.type);
        
        // Get definition info (namespace, key, type) from definition name
        const definitionInfo = await getMetafieldDefinitionInfo(metafieldName, 'custom', 'PRODUCT');
        
        if (!definitionInfo) {
          skippedMetafields.push(`${attr.type}.${attr.name} (metafield "${metafieldName}" not found)`);
          continue;
        }
        
        // Format value for list type: must be JSON string
        // For list.single_line_text_field, value must be JSON array like ["Round"]
        let metafieldValue = String(attr.value);
        if (definitionInfo.type === 'list.single_line_text_field') {
          metafieldValue = JSON.stringify([metafieldValue]);
        }
        
        // Set metafield value on product with info from definition
        await setProductMetafield(
          product.id,
          definitionInfo.namespace,  // Get from definition
          definitionInfo.key,         // Get from definition
          metafieldValue,
          definitionInfo.type         // Get from definition
        );
        
        metafieldCount++;
        console.log(`   ✓ Set metafield: ${metafieldName} = ${metafieldValue} (type: ${definitionInfo.type})`);
      } catch (error) {
        skippedMetafields.push(`${attr.type}.${attr.name} (${error.message})`);
        console.warn(`   ⚠️  Warning: Could not set metafield "${attr.type}.${attr.name}": ${error.message}`);
      }
    }
    
    if (metafieldCount > 0) {
      console.log(`\n✅ Set ${metafieldCount} metafield(s) on product`);
    }
    
    if (skippedMetafields.length > 0) {
      console.log(`\n⚠️  Skipped ${skippedMetafields.length} metafield(s):`);
      skippedMetafields.forEach(msg => console.log(`   - ${msg}`));
    }
  } else {
    console.log('\nℹ️  No attributes or diamond data found, skipping metafield assignment');
  }

  return product;
}

/**
 * CLI main function
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
    console.error('Usage: node create-product.js --sku ABC123');
    process.exit(1);
  }

  try {
    await createProductFromSku(sku);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

// Export for reuse
module.exports = { createProductFromSku, getProductBySkuFromDB, decodeDescription };
