// Note: Next.js automatically loads .env.local, so we use process.env directly
const { executeGraphQL } = require('./graphql-client');
const { publishToAllChannels } = require('./publish-utils');

/**
 * Product Functions
 * Functions for managing Shopify products via GraphQL Admin API
 */

const SHOPIFY_STORE = process.env.SHOPIFY_STORE || '';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
// Use same API version as graphql-client for consistency
const { SHOPIFY_API_VERSION } = require('./graphql-client');
const SHOPIFY_REST_URL = `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}`;

/**
 * Normalize image URL to full URL if needed
 */
function normalizeImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return null;
  }

  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL || 'https://admin.hebesbychloe.com/wp-content/uploads/';
  const baseUrl = IMAGE_BASE_URL.endsWith('/') ? IMAGE_BASE_URL : `${IMAGE_BASE_URL}/`;
  const imagePath = imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl;
  
  return `${baseUrl}${imagePath}`;
}

/**
 * Parse gallery images from various formats
 */
function parseGalleryImages(gallery) {
  if (!gallery) return [];
  
  try {
    const parsed = JSON.parse(gallery);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (e) {
    if (typeof gallery === 'string') {
      if (gallery.includes('|')) {
        return gallery.split('|').map(url => url.trim()).filter(url => url);
      }
      return gallery.split(',').map(url => url.trim()).filter(url => url);
    }
  }
  
  return [];
}

/**
 * Create Product
 * @param {Object} product - Product object
 * @param {string} product.title - Product title (required)
 * @param {string} product.sku - Product SKU (required)
 * @param {string} product.price - Product price (required)
 * @param {string} product.descriptionHtml - HTML description (optional)
 * @param {string} product.vendor - Vendor (optional, default: 'Hebes')
 * @param {string} product.productType - Product type (optional)
 * @param {Array<string>} product.images - Image URLs (optional)
 * @param {Array<string>} product.tags - Tags (optional)
 * @param {string} product.status - Status: ACTIVE, DRAFT, ARCHIVED (optional, default: 'ACTIVE')
 * @returns {Promise<Object>} - Created product
 */
async function createProduct(product) {
  const {
    title,
    sku,
    price,
    descriptionHtml = null,
    vendor = 'Hebes',
    productType = null,
    images = [],
    tags = [],
    status = 'ACTIVE',
  } = product;

  if (!title) {
    throw new Error('Missing required field: title');
  }

  if (!sku || typeof sku !== 'string' || sku.trim() === '') {
    throw new Error('Missing or invalid SKU. SKU is required for all products.');
  }

  if (!price) {
    throw new Error('Missing required field: price');
  }

  const cleanSku = sku.trim();

  // Create product using GraphQL
  const mutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
          handle
          status
          vendor
          productType
          variants(first: 1) {
            edges {
              node {
                id
                sku
                price
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Try to set variants and images directly in ProductInput (supported in API 2025-10+)
  const input = {
    title,
    ...(descriptionHtml && { descriptionHtml }),
    ...(vendor && { vendor }),
    ...(productType && { productType }),
    ...(tags.length > 0 && { tags }),
    status: status,
    variants: [
      {
        sku: cleanSku,
        price: price.toString(),
        inventoryPolicy: 'DENY',
        inventoryManagement: 'SHOPIFY',
      }
    ],
    // Add images directly in ProductInput (supported in API 2025-10+)
    ...(images.length > 0 && {
      images: images
        .map(url => normalizeImageUrl(url))
        .filter(url => url !== null)
        .map(url => ({ src: url }))
    }),
  };

  const variables = {
    input,
  };

  let result;
  let imagesSetInInput = false;
  try {
    result = await executeGraphQL(mutation, variables);
    // If successful, check if images were set (they might not be in response immediately)
    imagesSetInInput = images.length > 0;
  } catch (error) {
    // If variants or images field is not supported, fallback to creating product first then updating
    if (error.message.includes('variants') || error.message.includes('images') || error.message.includes('Field is not defined')) {
      console.log('   ⚠️  Variants field not supported in ProductInput, using fallback method...');
      
      // Create product without variants and images (will add them separately)
      const inputWithoutVariants = {
        title,
        ...(descriptionHtml && { descriptionHtml }),
        ...(vendor && { vendor }),
        ...(productType && { productType }),
        ...(tags.length > 0 && { tags }),
        status: status,
      };
      
      result = await executeGraphQL(mutation, { input: inputWithoutVariants });
      
      if (result.productCreate.userErrors.length > 0) {
        const errors = result.productCreate.userErrors;
        throw new Error(`User Errors: ${JSON.stringify(errors, null, 2)}`);
      }
      
      const createdProduct = result.productCreate.product;
      
      if (!createdProduct.variants || !createdProduct.variants.edges || createdProduct.variants.edges.length === 0) {
        throw new Error('Product was created but no variant found. Cannot set SKU.');
      }

      const variantId = createdProduct.variants.edges[0].node.id;
      const variantNumericId = variantId.split('/').pop();
      const restUrl = `${SHOPIFY_REST_URL}/variants/${variantNumericId}.json`;
      
      const variantData = {
        variant: {
          id: parseInt(variantNumericId),
          sku: cleanSku,
          price: price.toString(),
          inventory_policy: 'deny',
          inventory_management: 'shopify',
        },
      };

      const restResponse = await fetch(restUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
        },
        body: JSON.stringify(variantData),
      });

      const restData = await restResponse.json();

      if (!restResponse.ok || restData.errors) {
        throw new Error(`Failed to set SKU on variant: ${JSON.stringify(restData.errors || restData, null, 2)}`);
      }

      // Update response
      if (createdProduct.variants && createdProduct.variants.edges && createdProduct.variants.edges.length > 0) {
        createdProduct.variants.edges[0].node.sku = restData.variant.sku;
        createdProduct.variants.edges[0].node.price = restData.variant.price;
      }

      console.log(`   ✓ Product created and variant updated with SKU: ${cleanSku}, Price: ${price}`);
      
      // Add images using REST API (since we're in fallback mode)
      if (images.length > 0) {
        try {
          const normalizedUrls = images
            .map(url => normalizeImageUrl(url))
            .filter(url => url !== null);

          if (normalizedUrls.length > 0) {
            const productNumericId = createdProduct.id.split('/').pop();
            const restUrl = `${SHOPIFY_REST_URL}/products/${productNumericId}.json`;
            
            const productData = {
              product: {
                id: parseInt(productNumericId),
                images: normalizedUrls.map(url => ({ src: url })),
              },
            };

            const imageResponse = await fetch(restUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
              },
              body: JSON.stringify(productData),
            });

            if (!imageResponse.ok) {
              const imageData = await imageResponse.json();
              console.warn(`⚠️  Warning: Could not update product images: ${JSON.stringify(imageData.errors || imageData)}`);
            } else {
              console.log(`   ✓ Added ${normalizedUrls.length} image(s) to product via REST API`);
            }
          }
        } catch (imgError) {
          console.warn(`⚠️  Warning: Could not add product images: ${imgError.message}`);
        }
      }
      
      // Publish to all sales channels (in fallback path)
      console.log('\n📢 Attempting to publish product to all sales channels...');
      try {
        const publishResult = await publishToAllChannels(createdProduct.id);
        if (publishResult) {
          console.log('✅ Product publish process completed');
        } else {
          console.log('ℹ️  Product publish process returned null (may have been skipped)');
        }
      } catch (error) {
        console.error(`❌ Error: Could not publish to all sales channels: ${error.message}`);
        console.error(`   Full error: ${error.stack || JSON.stringify(error, null, 2)}`);
        console.warn(`⚠️  Warning: Product was created but may not be published to all channels`);
      }
      
      return createdProduct;
    } else {
      throw error;
    }
  }

  if (result.productCreate.userErrors.length > 0) {
    const errors = result.productCreate.userErrors;
    throw new Error(`User Errors: ${JSON.stringify(errors, null, 2)}`);
  }

  const createdProduct = result.productCreate.product;

  // Verify SKU was set correctly
  if (createdProduct.variants && createdProduct.variants.edges && createdProduct.variants.edges.length > 0) {
    const variant = createdProduct.variants.edges[0].node;
    if (variant.sku === cleanSku && variant.price === price.toString()) {
      console.log(`   ✓ Product created with SKU: ${cleanSku}, Price: ${price}`);
    } else {
      console.warn(`   ⚠️  SKU or price mismatch. Expected SKU: ${cleanSku}, Got: ${variant.sku || '(empty)'}`);
      // If SKU wasn't set correctly, try to update it using REST API
      if (variant.sku !== cleanSku) {
        const variantId = variant.id;
        const variantNumericId = variantId.split('/').pop();
        const restUrl = `${SHOPIFY_REST_URL}/variants/${variantNumericId}.json`;
        
        const variantData = {
          variant: {
            id: parseInt(variantNumericId),
            sku: cleanSku,
            price: price.toString(),
            inventory_policy: 'deny',
            inventory_management: 'shopify',
          },
        };

        const restResponse = await fetch(restUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          },
          body: JSON.stringify(variantData),
        });

        const restData = await restResponse.json();

        if (!restResponse.ok || restData.errors) {
          throw new Error(`Failed to set SKU on variant: ${JSON.stringify(restData.errors || restData, null, 2)}`);
        }

        // Update response
        createdProduct.variants.edges[0].node.sku = restData.variant.sku;
        createdProduct.variants.edges[0].node.price = restData.variant.price;
        console.log(`   ✓ Updated variant with SKU: ${cleanSku}`);
      }
    }
  }

  // Add images if provided and not already set in ProductInput
  // If images were set in ProductInput, they should already be in the product
  // Otherwise, use REST API as fallback
  if (images.length > 0 && !imagesSetInInput) {
    try {
      const normalizedUrls = images
        .map(url => normalizeImageUrl(url))
        .filter(url => url !== null);

      if (normalizedUrls.length > 0) {
        const productNumericId = createdProduct.id.split('/').pop();
        const restUrl = `${SHOPIFY_REST_URL}/products/${productNumericId}.json`;
        
        const productData = {
          product: {
            id: parseInt(productNumericId),
            images: normalizedUrls.map(url => ({ src: url })),
          },
        };

        const restResponse = await fetch(restUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
          },
          body: JSON.stringify(productData),
        });

        if (!restResponse.ok) {
          const restData = await restResponse.json();
          console.warn(`⚠️  Warning: Could not update product images: ${JSON.stringify(restData.errors || restData)}`);
        } else {
          console.log(`   ✓ Added ${normalizedUrls.length} image(s) to product via REST API`);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Warning: Could not add product images: ${error.message}`);
    }
  } else if (images.length > 0 && imagesSetInInput) {
    console.log(`   ✓ Images set in ProductInput (${images.length} image(s))`);
  }

  // Publish to all sales channels
  console.log('\n📢 Attempting to publish product to all sales channels...');
  try {
    const publishResult = await publishToAllChannels(createdProduct.id);
    if (publishResult) {
      console.log('✅ Product publish process completed');
    } else {
      console.log('ℹ️  Product publish process returned null (may have been skipped)');
    }
  } catch (error) {
    console.error(`❌ Error: Could not publish to all sales channels: ${error.message}`);
    console.error(`   Full error: ${error.stack || JSON.stringify(error, null, 2)}`);
    console.warn(`⚠️  Warning: Product was created but may not be published to all channels`);
  }

  return createdProduct;
}

/**
 * Update Product
 * @param {string} productId - Product ID (gid://shopify/Product/...)
 * @param {Object} updates - Fields to update
 * @param {string} updates.title - Product title (optional)
 * @param {string} updates.descriptionHtml - HTML description (optional)
 * @param {string} updates.vendor - Vendor (optional)
 * @param {string} updates.productType - Product type (optional)
 * @param {Array<string>} updates.tags - Tags (optional)
 * @param {string} updates.status - Status: ACTIVE, DRAFT, ARCHIVED (optional)
 * @returns {Promise<Object>} - Updated product
 */
async function updateProduct(productId, updates) {
  if (!productId) {
    throw new Error('Missing required field: productId');
  }

  const mutation = `
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          title
          handle
          status
          vendor
          productType
          variants(first: 1) {
            edges {
              node {
                id
                sku
                price
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const input = {
    id: productId,
    ...updates,
  };

  const variables = {
    input,
  };

  const result = await executeGraphQL(mutation, variables);

  if (result.productUpdate.userErrors.length > 0) {
    const errors = result.productUpdate.userErrors;
    throw new Error(`User Errors: ${JSON.stringify(errors, null, 2)}`);
  }

  return result.productUpdate.product;
}

/**
 * Delete Product
 * @param {string} productId - Product ID (gid://shopify/Product/...)
 * @returns {Promise<string>} - Deleted product ID
 */
async function deleteProduct(productId) {
  if (!productId) {
    throw new Error('Missing required field: productId');
  }

  const mutation = `
    mutation productDelete($input: ProductDeleteInput!) {
      productDelete(input: $input) {
        deletedProductId
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      id: productId,
    },
  };

  const result = await executeGraphQL(mutation, variables);

  if (result.productDelete.userErrors.length > 0) {
    const errors = result.productDelete.userErrors;
    throw new Error(`User Errors: ${JSON.stringify(errors, null, 2)}`);
  }

  return result.productDelete.deletedProductId;
}

/**
 * Find Product by SKU
 * @param {string} sku - Product SKU
 * @returns {Promise<Object|null>} - Product object or null if not found
 */
async function findProductBySku(sku) {
  if (!sku || typeof sku !== 'string' || sku.trim() === '') {
    throw new Error('SKU is required and cannot be empty');
  }

  const cleanSku = sku.trim();
  let after = null;
  let hasNextPage = true;
  let pageCount = 0;
  const maxPages = 100;

  while (hasNextPage && pageCount < maxPages) {
    pageCount++;
    const query = `
      query GetProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            node {
              id
              title
              variants(first: 10) {
                edges {
                  node {
                    id
                    sku
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const result = await executeGraphQL(query, { first: 50, after });
    
    for (const edge of result.products.edges) {
      const product = edge.node;
      const matchingVariant = product.variants.edges.find(
        v => v.node.sku === cleanSku
      );
      
      if (matchingVariant) {
        const getProductQuery = `
          query getProduct($id: ID!) {
            product(id: $id) {
              id
              title
              handle
              status
              vendor
              productType
              variants(first: 10) {
                edges {
                  node {
                    id
                    sku
                    price
                  }
                }
              }
            }
          }
        `;
        const fullResult = await executeGraphQL(getProductQuery, { id: product.id });
        return fullResult.product;
      }
    }

    hasNextPage = result.products.pageInfo.hasNextPage;
    after = result.products.pageInfo.endCursor;
  }

  return null;
}

module.exports = {
  createProduct,
  updateProduct,
  deleteProduct,
  findProductBySku,
  normalizeImageUrl,
  parseGalleryImages,
};

