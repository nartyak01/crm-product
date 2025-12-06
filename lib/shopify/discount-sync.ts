import pool from '@/lib/db';
import { getPromotionById } from '@/lib/queries/promotions';
import { PromotionWithRelations, PromotionEligibleProduct, PromotionType } from '@/types/database';

// Import Shopify GraphQL client (CommonJS module)
const { executeGraphQL } = require('../../shopify/lib/graphql-client');

/**
 * Helper function to get Shopify IDs from database
 */
async function getShopifyIdsFromEligibleProducts(
  eligibleProducts: PromotionEligibleProduct[]
): Promise<{
  productIds: string[];
  variantIds: string[];
  collectionIds: string[];
}> {
  const productIds: string[] = [];
  const variantIds: string[] = [];
  const collectionIds: string[] = [];

  // Get unique IDs
  const uniqueProductIds = [...new Set(eligibleProducts.filter(p => p.product_id).map(p => p.product_id!))];
  const uniqueVariantIds = [...new Set(eligibleProducts.filter(p => p.variant_id).map(p => p.variant_id!))];
  const uniqueCollectionIds = [...new Set(eligibleProducts.filter(p => p.collection_id).map(p => p.collection_id!))];

  // Query shopify_product_id from product table
  if (uniqueProductIds.length > 0) {
    const productResult = await pool.query(
      `SELECT shopify_product_id FROM product WHERE id = ANY($1::bigint[]) AND shopify_product_id IS NOT NULL`,
      [uniqueProductIds]
    );
    productIds.push(...productResult.rows.map((row: any) => row.shopify_product_id));
  }

  // Query shopify_collection_id from category table
  if (uniqueCollectionIds.length > 0) {
    const categoryResult = await pool.query(
      `SELECT shopify_collection_id FROM category WHERE id = ANY($1::bigint[]) AND shopify_collection_id IS NOT NULL`,
      [uniqueCollectionIds]
    );
    collectionIds.push(...categoryResult.rows.map((row: any) => row.shopify_collection_id));
  }

  // Note: Variant IDs need special handling - Shopify variant ID is different from product ID
  // TODO: If you have shopify_variant_id stored, query it here
  // For now, variants are skipped

  return { productIds, variantIds, collectionIds };
}

/**
 * Map promotion data to Shopify discount input based on promotion type
 */
async function mapPromoToShopifyInput(promo: PromotionWithRelations): Promise<any> {
  // Map status: 'draft' -> 'DRAFT', 'active' -> 'ACTIVE', etc.
  const mapStatusToShopify = (status: string): string => {
    switch (status) {
      case 'draft':
        return 'DRAFT';
      case 'active':
        return 'ACTIVE';
      case 'paused':
        return 'PAUSED';
      case 'expired':
        return 'EXPIRED';
      case 'archived':
        return 'ARCHIVED';
      default:
        return 'ACTIVE';
    }
  };

  // Base input for code discounts (basicCodeDiscount, bxgyCodeDiscount, freeShippingCodeDiscount)
  // Note: DiscountCodeBasicInput does NOT support status field
  const baseInputForCode: any = {
    title: promo.promo_name,
    startsAt: promo.start_date || new Date().toISOString(),
    endsAt: promo.end_date || null,
    usageLimit: promo.usage_limit_total || null,
    appliesOncePerCustomer: promo.usage_limit_per_customer === 1,
    customerSelection: { // Required field to avoid "Context can't be blank" error
      all: true,
    },
    // Note: basicCodeDiscount does NOT support status field
  };

  // Base input for automatic discounts (automaticBasicDiscount)
  // Note: DiscountAutomaticBasicInput does not support usageLimit, appliesOncePerCustomer, customerSelection, status
  const baseInputForAutomatic: any = {
    title: promo.promo_name,
    startsAt: promo.start_date || new Date().toISOString(),
    endsAt: promo.end_date || null,
    // Note: automaticBasicDiscount does NOT support status field
  };

  // Get the first code if exists
  const code = promo.codes && promo.codes.length > 0 ? promo.codes[0].code : null;
  const hasCode = !!code;

  // Determine Shopify discount type based on whether promo has codes
  // - Has codes (inserted into promo_codes table) -> Code discount (basicCodeDiscount)
  // - No codes -> Automatic discount (automaticBasicDiscount)
  // Note: discount_type ('products' vs 'orders') only distinguishes "Amount off products" vs "Amount off orders"
  // Both can be either code discount or automatic discount
  
  if (promo.promo_type === 'discount') {
    // Amount off products or Amount off order
    if (!promo.discount_rule) {
      throw new Error(
        `Discount rule is required for discount type promotion. ` +
        `Please update the promotion with discount_rule data before syncing to Shopify.`
      );
    }

    const discountRule = promo.discount_rule;

    // Map discount value
    let customerGets: any;
    if (discountRule.discount_type === 'percentage') {
      // Shopify expects decimal percentage (0.1 for 10%), value must be between 0.0 and 1.0
      const percentageValue = parseFloat(String(discountRule.discount_value || 0)) / 100;
      customerGets = {
        value: {
          percentage: percentageValue,
        },
      };
    } else if (discountRule.discount_type === 'fixed_amount') {
      // Fixed amount discount - Shopify API structure
      // Use discountAmount with amount and appliesOnEachItem
      // If promo.discount_type = 'products', use discountRule.apply_to to determine appliesOnEachItem
      // - apply_to = 'line_item' → appliesOnEachItem = true (applies to each item)
      // - apply_to = 'order' → appliesOnEachItem = false (applies to order total)
      // If promo.discount_type = 'orders', appliesOnEachItem = false
      let appliesOnEachItem = false;
      if (promo.discount_type === 'products') {
        const applyTo = discountRule.apply_to || 'line_item';
        appliesOnEachItem = applyTo === 'line_item';
      } else if (promo.discount_type === 'orders') {
        appliesOnEachItem = false;
      }
      customerGets = {
        value: {
          discountAmount: {
            amount: parseFloat(String(discountRule.discount_value || 0)),
            appliesOnEachItem: appliesOnEachItem,
          },
        },
      };
    } else {
      throw new Error(`Unsupported discount type: ${discountRule.discount_type}`);
    }

    // Map items based on discount_type
    // - discount_type = 'products' -> amount off products (needs items from promo_eligible_products)
    // - discount_type = 'orders' -> amount off orders (no items field, order level discount)
    if (promo.discount_type === 'products') {
      // Amount off products - need to map eligible products and collections
      const items: any = {};
      
      if (promo.eligible_products && promo.eligible_products.length > 0) {
        const includes = promo.eligible_products.filter(
          (p: PromotionEligibleProduct) => p.inclusion_type === 'include'
        );
        
        if (includes.length > 0) {
          // Query database to get Shopify IDs
          const { productIds, variantIds, collectionIds } = await getShopifyIdsFromEligibleProducts(includes);
          
          // Shopify API structure for basicCodeDiscount/automaticBasicDiscount:
          // items: { 
          //   products: { productsToAdd: [...] },
          //   collections: { add: [...] }  // collections uses object with "add" field
          // }
          if (productIds.length > 0) {
            items.products = {
              productsToAdd: productIds,
            };
          }
          
          // Add collections if available - collections uses object with "add" field
          if (collectionIds.length > 0) {
            items.collections = {
              add: collectionIds,  // Use "add" field instead of "collectionIds"
            };
          }
          
          // If we have specific products OR collections, use them
          // This ensures "amount off products" for collections doesn't become "amount off order"
          if (productIds.length > 0 || collectionIds.length > 0) {
            customerGets.items = items;
          } else {
            // No products or collections found, fall back to all
            customerGets.items = { all: true };
          }
        } else {
          // No includes, default to all
          customerGets.items = { all: true };
        }
      } else {
        // No eligible_products specified, default to all products
        customerGets.items = { all: true };
      }
    } else if (promo.discount_type === 'orders') {
      // Amount off orders - order level discount
      // Shopify requires items.all = true for order-level discounts
      customerGets.items = { all: true };
    } else {
      // Default to products if discount_type is null/undefined (legacy support)
      customerGets.items = { all: true };
    }

    // Map minimum purchase requirements (customerBuys)
    // Note: DiscountCodeBasicInput does NOT support customerBuys
    // Only automaticBasicDiscount may support customerBuys (needs verification)
    let customerBuys: any = null;
    if (discountRule.minimum_purchase_type && discountRule.minimum_purchase_type !== 'none') {
      if (discountRule.minimum_purchase_type === 'amount' && discountRule.minimum_purchase_amount) {
        // Minimum purchase amount
        customerBuys = {
          value: {
            greaterThanOrEqualToSubtotal: {
              amount: parseFloat(String(discountRule.minimum_purchase_amount)),
              currencyCode: 'USD', // TODO: Get from shop settings
            },
          },
        };
      } else if (discountRule.minimum_purchase_type === 'quantity' && discountRule.minimum_purchase_quantity) {
        // Minimum quantity of items
        customerBuys = {
          items: {
            minimumQuantity: {
              greaterThanOrEqualToQuantity: discountRule.minimum_purchase_quantity,
            },
          },
        };
      }
    }

    // Map combinesWith from eligibility_rules
    const eligibilityRules = promo.eligibility_rules as any;
    const combinesWith = eligibilityRules?.combinesWith ? {
      productDiscounts: eligibilityRules.combinesWith.productDiscounts ?? true,
      orderDiscounts: eligibilityRules.combinesWith.orderDiscounts ?? true,
      shippingDiscounts: eligibilityRules.combinesWith.shippingDiscounts ?? false,
    } : undefined;

    // Determine Shopify discount type based on whether promo has codes
    let shopifyInput: any;
    if (hasCode) {
      // Has codes -> Code discount (basicCodeDiscount)
      // Note: DiscountCodeBasicInput does NOT support status and customerBuys
      shopifyInput = {
        basicCodeDiscount: {
          ...baseInputForCode,
          code: code,
          customerGets,
          ...(combinesWith && { combinesWith }), // Add combinesWith if available
          // Note: basicCodeDiscount does NOT support customerBuys
        },
      };
    } else {
      // No codes -> Automatic discount (automaticBasicDiscount)
      shopifyInput = {
        automaticBasicDiscount: {
          ...baseInputForAutomatic, // Use baseInputForAutomatic (no usageLimit, appliesOncePerCustomer, customerSelection, status)
          customerGets,
          ...(combinesWith && { combinesWith }), // Add combinesWith if available
          // Note: automaticBasicDiscount may not support customerBuys either (needs verification)
          // ...(customerBuys && { customerBuys }),
        },
      };
    }

    // Debug: Log the data being sent
    console.log('📤 Shopify Discount Input:', JSON.stringify(shopifyInput, null, 2));

    return shopifyInput;
  } else if (promo.promo_type === 'bogo') {
    // Buy X Get Y
    if (!promo.bogo_rule) {
      throw new Error('BOGO rule is required for bogo type promotion');
    }

    const bogoRule = promo.bogo_rule;

    // Customer buys
    let customerBuys: any;
    if (bogoRule.buy_type === 'quantity') {
      customerBuys = {
        items: {
          minimumQuantity: {
            greaterThanOrEqualToQuantity: bogoRule.buy_quantity || 1,
          },
        },
      };

      // Add product/collection restrictions if exists
      if (promo.eligible_products && promo.eligible_products.length > 0) {
        const buyProducts = promo.eligible_products.filter(
          (p: PromotionEligibleProduct) => p.context === 'buy_side' || p.context === 'both' || !p.context
        );
        if (buyProducts.length > 0) {
          const includes = buyProducts.filter((p: PromotionEligibleProduct) => p.inclusion_type === 'include');
          if (includes.length > 0) {
            // Query database to get Shopify IDs
            const { productIds, variantIds, collectionIds } = await getShopifyIdsFromEligibleProducts(includes);
            
            if (productIds.length > 0) customerBuys.items.productIds = productIds;
            if (variantIds.length > 0) customerBuys.items.productVariantIds = variantIds;
            if (collectionIds.length > 0) customerBuys.items.collectionIds = collectionIds;
          }
        }
      }
    } else if (bogoRule.buy_type === 'amount') {
      customerBuys = {
        value: {
          greaterThanOrEqualToSubtotal: {
            amount: bogoRule.buy_amount || 0,
            currencyCode: 'USD',
          },
        },
      };
    } else {
      throw new Error(`Unsupported buy type: ${bogoRule.buy_type}`);
    }

    // Customer gets
    let customerGets: any;
    if (bogoRule.get_type === 'same_product') {
      customerGets = {
        items: {
          quantity: {
            quantity: bogoRule.get_quantity || 1,
          },
          allItems: true,
        },
        value: {
          percentage: {
            value: 100, // Free
          },
        },
      };
    } else if (bogoRule.get_type === 'specific_products') {
      const getProducts = promo.eligible_products?.filter(
        (p: PromotionEligibleProduct) => p.context === 'get_side' || p.context === 'both'
      );
      
      // Query database to get Shopify IDs
      const { productIds, variantIds, collectionIds } = await getShopifyIdsFromEligibleProducts(
        getProducts || []
      );
      
      customerGets = {
        items: {
          quantity: {
            quantity: bogoRule.get_quantity || 1,
          },
          productIds: productIds.length > 0 ? productIds : [],
          productVariantIds: variantIds.length > 0 ? variantIds : [],
          collectionIds: collectionIds.length > 0 ? collectionIds : [],
        },
        value: {
          percentage: {
            value: 100, // Free
          },
        },
      };
    } else {
      throw new Error(`Unsupported get type: ${bogoRule.get_type}`);
    }

    // Map combinesWith from eligibility_rules for BOGO
    const eligibilityRulesBogo = promo.eligibility_rules as any;
    const combinesWithBogo = eligibilityRulesBogo?.combinesWith ? {
      productDiscounts: eligibilityRulesBogo.combinesWith.productDiscounts ?? true,
      orderDiscounts: eligibilityRulesBogo.combinesWith.orderDiscounts ?? true,
      shippingDiscounts: eligibilityRulesBogo.combinesWith.shippingDiscounts ?? false,
    } : undefined;

    return {
      bxgyCodeDiscount: {
        ...baseInputForCode,
        code: code || '',
        customerBuys,
        customerGets,
        ...(combinesWithBogo && { combinesWith: combinesWithBogo }), // Add combinesWith if available
      },
    };
  } else if (promo.promo_type === 'free_shipping') {
    // Free shipping discount
    const appliesTo: any = {
      allItems: promo.eligible_products?.length === 0 || !promo.eligible_products,
    };

    if (promo.eligible_products && promo.eligible_products.length > 0) {
      const includes = promo.eligible_products.filter((p: PromotionEligibleProduct) => p.inclusion_type === 'include');
      if (includes.length > 0) {
        // Query database to get Shopify IDs
        const { productIds, variantIds, collectionIds } = await getShopifyIdsFromEligibleProducts(includes);
        
        appliesTo.allItems = false;
        if (productIds.length > 0) appliesTo.productIds = productIds;
        if (variantIds.length > 0) appliesTo.productVariantIds = variantIds;
        if (collectionIds.length > 0) appliesTo.collectionIds = collectionIds;
      }
    }

    // Minimum requirement
    const minimumRequirement: any = {
      subtotal: {
        greaterThanOrEqualToSubtotal: {
          amount: 0,
          currencyCode: 'USD',
        },
      },
    };

    // Map combinesWith from eligibility_rules for free shipping
    const eligibilityRulesFreeShipping = promo.eligibility_rules as any;
    const combinesWithFreeShipping = eligibilityRulesFreeShipping?.combinesWith ? {
      productDiscounts: eligibilityRulesFreeShipping.combinesWith.productDiscounts ?? true,
      orderDiscounts: eligibilityRulesFreeShipping.combinesWith.orderDiscounts ?? true,
      shippingDiscounts: eligibilityRulesFreeShipping.combinesWith.shippingDiscounts ?? false,
    } : undefined;

    return {
      freeShippingCodeDiscount: {
        ...baseInputForCode,
        code: code || '',
        appliesTo,
        minimumRequirement,
        ...(combinesWithFreeShipping && { combinesWith: combinesWithFreeShipping }), // Add combinesWith if available
      },
    };
  } else {
    throw new Error(`Unsupported promotion type: ${promo.promo_type}`);
  }
}

/**
 * Handle Shopify discount response and save to platform_sync
 */
async function handleShopifyDiscountResponse(
  promoId: number,
  shopifyResponse: any,
  mutationType: 'create' | 'update'
): Promise<void> {
  let shopifyDiscountId: string | null = null; // GID format: gid://shopify/DiscountCodeNode/123456

  // Extract discount GID from response
  if (mutationType === 'create') {
    if (shopifyResponse.discountAutomaticBasicCreate?.automaticDiscountNode?.id) {
      shopifyDiscountId = shopifyResponse.discountAutomaticBasicCreate.automaticDiscountNode.id;
    } else if (shopifyResponse.discountCodeBasicCreate?.codeDiscountNode?.id) {
      shopifyDiscountId = shopifyResponse.discountCodeBasicCreate.codeDiscountNode.id;
    } else if (shopifyResponse.discountCodeBxgyCreate?.codeDiscountNode?.id) {
      shopifyDiscountId = shopifyResponse.discountCodeBxgyCreate.codeDiscountNode.id;
    } else if (shopifyResponse.discountCodeFreeShippingCreate?.codeDiscountNode?.id) {
      shopifyDiscountId = shopifyResponse.discountCodeFreeShippingCreate.codeDiscountNode.id;
    }
  } else {
    // update
    if (shopifyResponse.discountAutomaticBasicUpdate?.automaticDiscountNode?.id) {
      shopifyDiscountId = shopifyResponse.discountAutomaticBasicUpdate.automaticDiscountNode.id;
    } else if (shopifyResponse.discountCodeBasicUpdate?.codeDiscountNode?.id) {
      shopifyDiscountId = shopifyResponse.discountCodeBasicUpdate.codeDiscountNode.id;
    } else if (shopifyResponse.discountCodeBxgyUpdate?.codeDiscountNode?.id) {
      shopifyDiscountId = shopifyResponse.discountCodeBxgyUpdate.codeDiscountNode.id;
    } else if (shopifyResponse.discountCodeFreeShippingUpdate?.codeDiscountNode?.id) {
      shopifyDiscountId = shopifyResponse.discountCodeFreeShippingUpdate.codeDiscountNode.id;
    } else if (shopifyResponse.discountCodeDeactivate?.codeDiscountNode?.id) {
      shopifyDiscountId = shopifyResponse.discountCodeDeactivate.codeDiscountNode.id;
    } else if (shopifyResponse.discountCodeActivate?.codeDiscountNode?.id) {
      shopifyDiscountId = shopifyResponse.discountCodeActivate.codeDiscountNode.id;
    }
  }

  // Log response for debugging
  console.log('📥 Shopify Response:', JSON.stringify(shopifyResponse, null, 2));
  console.log('🔍 Mutation type:', mutationType);
  
  if (!shopifyDiscountId) {
    console.error('❌ Failed to extract shopify_discount_id from response:', JSON.stringify(shopifyResponse, null, 2));
    throw new Error(`Failed to extract shopify_discount_id from Shopify response for promo ${promoId}. Response: ${JSON.stringify(shopifyResponse)}`);
  }

  console.log('✅ Extracted shopify_discount_id:', shopifyDiscountId);

  // Save to platform_sync - chỉ lưu GID vào shopify_discount_id
  const platformSync = {
    shopify_discount_id: shopifyDiscountId, // GID format: gid://shopify/DiscountCodeNode/123456
    status: 'synced',
    last_synced: new Date().toISOString(),
    mutation_type: mutationType,
  };

  // CREATE: set status = 'active' trên DB
  // UPDATE: giữ nguyên status hiện tại
  if (mutationType === 'create') {
    await pool.query(
      `UPDATE promo SET 
        shopify_discount_id = $1,
        platform_sync = $2,
        status = 'active',
        updated_at = now() 
      WHERE id = $3`,
      [shopifyDiscountId, JSON.stringify(platformSync), promoId]
    );
  } else {
    // UPDATE: nếu status hiện tại = 'update' thì set thành 'active', ngược lại giữ nguyên
    const currentPromo = await pool.query('SELECT status FROM promo WHERE id = $1', [promoId]);
    const currentStatus = currentPromo.rows[0]?.status;
    
    if (currentStatus === 'update') {
      // Nếu status = 'update', sau khi update thành công thì set thành 'active'
      await pool.query(
        `UPDATE promo SET 
          shopify_discount_id = $1,
          platform_sync = $2,
          status = 'active',
          updated_at = now() 
        WHERE id = $3`,
        [shopifyDiscountId, JSON.stringify(platformSync), promoId]
      );
    } else {
      // Giữ nguyên status hiện tại
      await pool.query(
        `UPDATE promo SET 
          shopify_discount_id = $1,
          platform_sync = $2, 
          updated_at = now() 
        WHERE id = $3`,
        [shopifyDiscountId, JSON.stringify(platformSync), promoId]
      );
    }
  }
}

/**
 * Sync promotion to Shopify
 */
export async function syncDiscountToShopify(promoId: number): Promise<any> {
  // Get promotion with all relations
  const promo = await getPromotionById(promoId);
  if (!promo) {
    throw new Error(`Promotion with id ${promoId} not found`);
  }

  console.log('[Sync Discount] Promotion data:', JSON.stringify({
    id: promo.id,
    promo_code: promo.promo_code,
    promo_name: promo.promo_name,
    promo_type: promo.promo_type,
    discount_type: promo.discount_type,
    status: promo.status,
    has_discount_rule: !!promo.discount_rule,
    has_bogo_rule: !!promo.bogo_rule,
    codes_count: promo.codes?.length || 0,
    eligible_products_count: promo.eligible_products?.length || 0,
  }, null, 2));

  // Check if already synced - có shopify_discount_id (GID) thì dùng update
  // Priority: check shopify_discount_id column first, then fallback to platform_sync
  const shopifyDiscountId = promo.shopify_discount_id || (promo.platform_sync as any)?.shopify_discount_id;
  const isUpdate = shopifyDiscountId && shopifyDiscountId.startsWith('gid://');

  console.log('[Sync Discount] Sync mode:', isUpdate ? 'UPDATE' : 'CREATE');
  console.log('[Sync Discount] Shopify Discount ID:', shopifyDiscountId || 'None (new discount)');

  // Map to Shopify input
  const shopifyInput = await mapPromoToShopifyInput(promo);

  // Debug: Log the mapped input
  console.log('[Sync Discount] Mapped Shopify Input:', JSON.stringify(shopifyInput, null, 2));

  let mutation: string;
  let variables: any;

  // Determine which Shopify mutation to use based on shopifyInput keys
  // - automaticBasicDiscount -> discountAutomaticBasicCreate/Update (automatic discount)
  // - basicCodeDiscount -> discountCodeBasicCreate/Update (code discount)
  // Note: This is determined by whether promo has codes (inserted into promo_codes table)
  
  // Check if status is paused and this is an update
  const isPaused = promo.status === 'paused';
  const isUpdateStatus = promo.status === 'update'; // Check if status is 'update'
  
  if (promo.promo_type === 'discount') {
    // Check which type of discount based on shopifyInput structure
    if (shopifyInput.automaticBasicDiscount) {
      // Automatic discount (no codes)
      if (isUpdate) {
        // Handle paused status for automatic discounts
        if (isPaused) {
          // Tắt: đặt endsAt < thời điểm hiện tại
          const now = new Date();
          const pastDate = new Date(now.getTime() - 1000); // 1 second ago
          shopifyInput.automaticBasicDiscount.endsAt = pastDate.toISOString();
        } else {
          // Bật: đặt startsAt = now và endsAt = null
          shopifyInput.automaticBasicDiscount.startsAt = new Date().toISOString();
          shopifyInput.automaticBasicDiscount.endsAt = null;
        }

        mutation = `
          mutation discountAutomaticBasicUpdate($id: ID!, $automaticBasicDiscount: DiscountAutomaticBasicInput!) {
            discountAutomaticBasicUpdate(id: $id, automaticBasicDiscount: $automaticBasicDiscount) {
              automaticDiscountNode {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        variables = {
          id: shopifyDiscountId, // GID format
          automaticBasicDiscount: shopifyInput.automaticBasicDiscount,
        };
      } else {
        mutation = `
          mutation discountAutomaticBasicCreate($automaticBasicDiscount: DiscountAutomaticBasicInput!) {
            discountAutomaticBasicCreate(automaticBasicDiscount: $automaticBasicDiscount) {
              automaticDiscountNode {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        variables = {
          automaticBasicDiscount: shopifyInput.automaticBasicDiscount,
        };
      }
    } else if (shopifyInput.basicCodeDiscount) {
      // Code discount (has codes)
      if (isUpdate) {
        // Handle paused status for code discounts
        if (isPaused) {
          // Tắt discount: dùng discountCodeDeactivate
          mutation = `
            mutation discountCodeDeactivate($id: ID!) {
              discountCodeDeactivate(id: $id) {
                codeDiscountNode {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `;
          variables = {
            id: shopifyDiscountId, // GID format
          };
        } else if (isUpdateStatus) {
          // Status is 'update': dùng discountCodeBasicUpdate để update data
          mutation = `
            mutation discountCodeBasicUpdate($id: ID!, $basicCodeDiscount: DiscountCodeBasicInput!) {
              discountCodeBasicUpdate(id: $id, basicCodeDiscount: $basicCodeDiscount) {
                codeDiscountNode {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `;
          variables = {
            id: shopifyDiscountId, // GID format
            basicCodeDiscount: shopifyInput.basicCodeDiscount,
          };
        } else {
          // Bật discount: dùng discountCodeActivate (chỉ activate, không update data)
          mutation = `
            mutation discountCodeActivate($id: ID!) {
              discountCodeActivate(id: $id) {
                codeDiscountNode {
                  id
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `;
          variables = {
            id: shopifyDiscountId, // GID format
          };
        }
      } else {
        mutation = `
          mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
            discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
              codeDiscountNode {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        variables = {
          basicCodeDiscount: shopifyInput.basicCodeDiscount,
        };
      }

    } else {
      throw new Error('Invalid shopifyInput structure for discount type promotion');
    }
  } else if (promo.promo_type === 'bogo') {
    if (isUpdate) {
      // Handle paused status for BOGO discounts (code discount)
      if (isPaused) {
        // Tắt discount: dùng discountCodeDeactivate
        mutation = `
          mutation discountCodeDeactivate($id: ID!) {
            discountCodeDeactivate(id: $id) {
              codeDiscountNode {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        variables = {
          id: shopifyDiscountId, // GID format
        };
      } else if (isUpdateStatus) {
        // Status is 'update': dùng discountCodeBxgyUpdate để update data
        mutation = `
          mutation discountCodeBxgyUpdate($id: ID!, $bxgyCodeDiscount: DiscountCodeBxgyInput!) {
            discountCodeBxgyUpdate(id: $id, bxgyCodeDiscount: $bxgyCodeDiscount) {
              codeDiscountNode {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        variables = {
          id: shopifyDiscountId, // GID format
          bxgyCodeDiscount: shopifyInput.bxgyCodeDiscount,
        };
      } else {
        // Bật discount: dùng discountCodeActivate
        mutation = `
          mutation discountCodeActivate($id: ID!) {
            discountCodeActivate(id: $id) {
              codeDiscountNode {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        variables = {
          id: shopifyDiscountId, // GID format
        };
      }
    } else {
      mutation = `
        mutation discountCodeBxgyCreate($bxgyCodeDiscount: DiscountCodeBxgyInput!) {
          discountCodeBxgyCreate(bxgyCodeDiscount: $bxgyCodeDiscount) {
            codeDiscountNode {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      variables = {
        bxgyCodeDiscount: shopifyInput.bxgyCodeDiscount,
      };
    }
  } else if (promo.promo_type === 'free_shipping') {
    if (isUpdate) {
      // Handle paused status for free shipping discounts (code discount)
      if (isPaused) {
        // Tắt discount: dùng discountCodeDeactivate
        mutation = `
          mutation discountCodeDeactivate($id: ID!) {
            discountCodeDeactivate(id: $id) {
              codeDiscountNode {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        variables = {
          id: shopifyDiscountId, // GID format
        };
      } else if (isUpdateStatus) {
        // Status is 'update': dùng discountCodeFreeShippingUpdate để update data
        mutation = `
          mutation discountCodeFreeShippingUpdate($id: ID!, $freeShippingCodeDiscount: DiscountCodeFreeShippingInput!) {
            discountCodeFreeShippingUpdate(id: $id, freeShippingCodeDiscount: $freeShippingCodeDiscount) {
              codeDiscountNode {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        variables = {
          id: shopifyDiscountId, // GID format
          freeShippingCodeDiscount: shopifyInput.freeShippingCodeDiscount,
        };
      } else {
        // Bật discount: dùng discountCodeActivate
        mutation = `
          mutation discountCodeActivate($id: ID!) {
            discountCodeActivate(id: $id) {
              codeDiscountNode {
                id
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        variables = {
          id: shopifyDiscountId, // GID format
        };
      }
    } else {
      mutation = `
        mutation discountCodeFreeShippingCreate($freeShippingCodeDiscount: DiscountCodeFreeShippingInput!) {
          discountCodeFreeShippingCreate(freeShippingCodeDiscount: $freeShippingCodeDiscount) {
            codeDiscountNode {
              id
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      variables = {
        freeShippingCodeDiscount: shopifyInput.freeShippingCodeDiscount,
      };
    }
  } else {
    throw new Error(`Unsupported promotion type: ${promo.promo_type}`);
  }

  // Log mutation and variables before executing
  console.log('[Sync Discount] GraphQL Mutation:', mutation);
  console.log('[Sync Discount] GraphQL Variables:', JSON.stringify(variables, null, 2));

  // Execute GraphQL mutation
  const response = await executeGraphQL(mutation, variables);
  console.log('[Sync Discount] Shopify Response:', JSON.stringify(response, null, 2));

  // Check for user errors
  const errorKey = isUpdate
    ? Object.keys(response).find((key) => key.includes('Update') || key.includes('Deactivate') || key.includes('Activate'))
    : Object.keys(response).find((key) => key.includes('Create'));

  if (errorKey && response[errorKey]?.userErrors?.length > 0) {
    const errors = response[errorKey].userErrors;
    throw new Error(`Shopify API errors: ${errors.map((e: any) => e.message).join(', ')}`);
  }

  // Save response to platform_sync
  await handleShopifyDiscountResponse(promoId, response, isUpdate ? 'update' : 'create');

  return response;
}

