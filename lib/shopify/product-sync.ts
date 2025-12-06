import pool from '@/lib/db';
import { Product } from '@/types/database';

// Import Shopify functions (CommonJS modules)
const {
  createProduct,
  updateProduct,
  deleteProduct,
  findProductBySku,
  normalizeImageUrl,
  parseGalleryImages,
} = require('../../shopify/lib/product-functions');

const {
  findCollectionByTitle,
  addProductToCollection,
} = require('../../shopify/lib/collection-functions');

const {
  findDefinitionIdByName,
  setProductMetafield,
} = require('../../shopify/lib/metafield-functions');

/**
 * Decode URL-encoded description
 */
function decodeDescription(description: string | null): string {
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
 * Format metafield name from type: "cut_grade" -> "Cut Grade"
 */
function formatMetafieldName(str: string): string {
  return str
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Get product with all relations from database
 */
async function getProductWithRelations(productId: number) {
  // Get product
  const productResult = await pool.query(
    'SELECT * FROM product WHERE id = $1',
    [productId]
  );

  if (productResult.rows.length === 0) {
    throw new Error(`Product with id ${productId} not found`);
  }

  const product = productResult.rows[0];

  // Get categories
  const categoriesResult = await pool.query(
    `SELECT c.* FROM category c
     INNER JOIN product_category pc ON c.id = pc.category_id
     WHERE pc.product_id = $1`,
    [productId]
  );
  product.categories = categoriesResult.rows;

  // Get images
  const imagesResult = await pool.query(
    'SELECT thumbnail, gallery FROM product_image WHERE product_id = $1 LIMIT 1',
    [productId]
  );
  if (imagesResult.rows.length > 0) {
    product.thumbnail = imagesResult.rows[0].thumbnail;
    product.gallery = imagesResult.rows[0].gallery;
  }

  // Check if product has diamond data
  const diamondCheck = await pool.query(
    'SELECT COUNT(*) as count FROM diamond WHERE product_id = $1',
    [productId]
  );
  const hasDiamond = parseInt(diamondCheck.rows[0].count) > 0;

  if (hasDiamond) {
    // Get diamond data
    const diamondResult = await pool.query(
      `SELECT shape, cut_grade, carat, color, clarity, grading_lab,
       certificate_number, certificate_path, image_path, total_price,
       measurement_length, measurement_width, measurement_height,
       country, state_region, guaranteed_availability, item_id
       FROM diamond WHERE product_id = $1 LIMIT 1`,
      [productId]
    );
    product.diamond = diamondResult.rows.length > 0 ? diamondResult.rows[0] : null;
    product.attributes = [];
  } else {
    // Get attributes
    const attributesResult = await pool.query(
      `SELECT pa.type, pa.name, pav.value
       FROM product_attribute_value pav
       INNER JOIN product_attribute pa ON pav.attribute_id = pa.id
       WHERE pav.product_id = $1
       ORDER BY pa.type, pa.name`,
      [productId]
    );
    product.attributes = attributesResult.rows.map((row: any) => ({
      type: row.type,
      name: row.name,
      value: row.value,
    }));
    product.diamond = null;
  }

  return product;
}

/**
 * Get metafield definition info (namespace, key, type) from definition name
 */
async function getMetafieldDefinitionInfo(name: string, namespace = 'custom', ownerType = 'PRODUCT') {
  const { listMetafieldDefinitions } = require('../../shopify/lib/metafield-functions');
  const definitions = await listMetafieldDefinitions(ownerType, namespace);
  const definition = definitions.find((def: any) => def.name === name);

  if (!definition) {
    return null;
  }

  return {
    id: definition.id,
    namespace: definition.namespace,
    key: definition.key,
    type: definition.type?.name || 'single_line_text_field',
  };
}

/**
 * Sync product to Shopify
 * Creates or updates product and saves Shopify ID to database
 */
export async function syncProductToShopify(productId: number): Promise<string> {
  const dbProduct = await getProductWithRelations(productId);
  const isDiamondProduct = dbProduct.diamond !== null;

  try {
    // Prepare images
    const images: string[] = [];
    if (dbProduct.thumbnail) {
      const normalized = normalizeImageUrl(dbProduct.thumbnail);
      if (normalized) images.push(normalized);
    }
    if (isDiamondProduct && dbProduct.diamond?.image_path) {
      const normalized = normalizeImageUrl(dbProduct.diamond.image_path);
      if (normalized && !images.includes(normalized)) {
        images.push(normalized);
      }
    }
    const galleryImages = parseGalleryImages(dbProduct.gallery);
    galleryImages.forEach((imgUrl: string) => {
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
    const tags: string[] = [];
    if (dbProduct.is_pre_order) {
      tags.push('pre-order');
    }

    // Prepare description
    const descriptionHtml = decodeDescription(dbProduct.description || '');

    // Determine product status
    const productStatus = dbProduct.status === 'updated' ? 'ACTIVE' : 'DRAFT';

    let shopifyProductId: string;
    let shopifyProduct: any;

    // Check if product already has a Shopify product ID
    if (dbProduct.shopify_product_id) {
      // Update existing product
      shopifyProduct = await updateProduct(dbProduct.shopify_product_id, {
        title: dbProduct.name,
        descriptionHtml: descriptionHtml || undefined,
        vendor: 'Hebes',
        productType: dbProduct.product_type || undefined,
        tags: tags.length > 0 ? tags : undefined,
        status: productStatus,
      });
      shopifyProductId = shopifyProduct.id;
    } else {
      // Check if product with same SKU already exists on Shopify
      const existingProduct = await findProductBySku(dbProduct.sku);

      if (existingProduct) {
        // Use existing product
        shopifyProductId = existingProduct.id;
        shopifyProduct = existingProduct;
      } else {
        // Create new product
        shopifyProduct = await createProduct({
          title: dbProduct.name,
          sku: dbProduct.sku,
          price: price,
          descriptionHtml: descriptionHtml || undefined,
          vendor: 'Hebes',
          productType: dbProduct.product_type || undefined,
          images: images,
          tags: tags,
          status: productStatus,
        });
        shopifyProductId = shopifyProduct.id;
      }
    }

    // Add product to collections based on categories
    if (dbProduct.categories && dbProduct.categories.length > 0) {
      for (const category of dbProduct.categories) {
        if (category.name && category.shopify_collection_id) {
          try {
            await addProductToCollection(shopifyProductId, category.shopify_collection_id);
          } catch (error: any) {
            console.warn(`Failed to add product to collection "${category.name}": ${error.message}`);
          }
        }
      }
    }

    // Set metafields
    if (isDiamondProduct && dbProduct.diamond) {
      // Set metafields from diamond fields
      const diamondMetafieldFields = [
        'shape', 'cut_grade', 'carat', 'color', 'clarity', 'grading_lab',
        'certificate_number', 'certificate_path', 'image_path', 'total_price',
        'measurement_length', 'measurement_width', 'measurement_height',
        'country', 'state_region', 'guaranteed_availability', 'item_id',
      ];

      for (const fieldName of diamondMetafieldFields) {
        const fieldValue = (dbProduct.diamond as any)[fieldName];
        if (fieldValue === null || fieldValue === '' || (fieldValue === 0 && fieldName !== 'guaranteed_availability')) {
          continue;
        }

        try {
          const metafieldName = formatMetafieldName(fieldName);
          const definitionInfo = await getMetafieldDefinitionInfo(metafieldName, 'custom', 'PRODUCT');

          if (!definitionInfo) {
            continue;
          }

          let metafieldValue = String(fieldValue);
          if (fieldName === 'guaranteed_availability') {
            metafieldValue = fieldValue ? 'Yes' : 'No';
          }

          if (definitionInfo.type === 'list.single_line_text_field') {
            metafieldValue = JSON.stringify([metafieldValue]);
          }

          await setProductMetafield(
            shopifyProductId,
            definitionInfo.namespace,
            definitionInfo.key,
            metafieldValue,
            definitionInfo.type
          );
        } catch (error: any) {
          console.warn(`Failed to set metafield "${fieldName}": ${error.message}`);
        }
      }
    } else if (!isDiamondProduct && dbProduct.attributes && dbProduct.attributes.length > 0) {
      // Set metafields from attributes
      for (const attr of dbProduct.attributes) {
        try {
          const metafieldName = formatMetafieldName(attr.type);
          const definitionInfo = await getMetafieldDefinitionInfo(metafieldName, 'custom', 'PRODUCT');

          if (!definitionInfo) {
            continue;
          }

          let metafieldValue = String(attr.value);
          if (definitionInfo.type === 'list.single_line_text_field') {
            metafieldValue = JSON.stringify([metafieldValue]);
          }

          await setProductMetafield(
            shopifyProductId,
            definitionInfo.namespace,
            definitionInfo.key,
            metafieldValue,
            definitionInfo.type
          );
        } catch (error: any) {
          console.warn(`Failed to set metafield "${attr.type}.${attr.name}": ${error.message}`);
        }
      }
    }

    // Save Shopify product ID to database
    await pool.query(
      'UPDATE product SET shopify_product_id = $1 WHERE id = $2',
      [shopifyProductId, productId]
    );

    return shopifyProductId;
  } catch (error: any) {
    throw new Error(`Failed to sync product to Shopify: ${error.message}`);
  }
}

/**
 * Delete product from Shopify
 * Removes product and clears Shopify ID from database
 */
export async function deleteProductFromShopify(productId: number): Promise<void> {
  const productResult = await pool.query(
    'SELECT shopify_product_id FROM product WHERE id = $1',
    [productId]
  );

  if (productResult.rows.length === 0) {
    throw new Error(`Product with id ${productId} not found`);
  }

  const shopifyProductId = productResult.rows[0].shopify_product_id;

  if (!shopifyProductId) {
    // Product not synced to Shopify, nothing to delete
    return;
  }

  try {
    await deleteProduct(shopifyProductId);

    // Clear Shopify product ID from database
    await pool.query(
      'UPDATE product SET shopify_product_id = NULL WHERE id = $1',
      [productId]
    );
  } catch (error: any) {
    throw new Error(`Failed to delete product from Shopify: ${error.message}`);
  }
}

