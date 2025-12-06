import pool from '@/lib/db';
import {
  Promotion,
  PromotionWithRelations,
  CreatePromotionInput,
  UpdatePromotionInput,
  PromotionDiscountRule,
  PromotionBogoRule,
  PromotionCode,
  PromotionEligibleProduct,
} from '@/types/database';

export async function getPromotions(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  promo_type?: string;
  tenant_id?: number;
}) {
  const { limit = 50, offset = 0, search, status, promo_type, tenant_id } = params || {};

  const whereConditions: string[] = [];
  const values: any[] = [];
  let paramCount = 0;

  if (search) {
    paramCount++;
    whereConditions.push(`(p.promo_name ILIKE $${paramCount} OR p.promo_code ILIKE $${paramCount})`);
    values.push(`%${search}%`);
  }

  if (status) {
    paramCount++;
    whereConditions.push(`p.status = $${paramCount}`);
    values.push(status);
  }

  if (promo_type) {
    paramCount++;
    whereConditions.push(`p.promo_type = $${paramCount}`);
    values.push(promo_type);
  }

  if (tenant_id !== undefined) {
    paramCount++;
    whereConditions.push(`p.tenant_id = $${paramCount}`);
    values.push(tenant_id);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  const query = `
    SELECT p.*
    FROM promo p
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `;
  values.push(limit, offset);

  const result = await pool.query(query, values);
  return result.rows as Promotion[];
}

export async function getPromotionById(id: number): Promise<PromotionWithRelations | null> {
  const promoResult = await pool.query('SELECT * FROM promo WHERE id = $1', [id]);

  if (promoResult.rows.length === 0) {
    return null;
  }

  const promotion = promoResult.rows[0] as Promotion;

  // Get discount rule if exists
  const discountRuleResult = await pool.query(
    'SELECT * FROM promo_discount_rules WHERE promo_id = $1',
    [id]
  );
  const discount_rule = discountRuleResult.rows[0] as PromotionDiscountRule | undefined;

  // Get BOGO rule if exists
  const bogoRuleResult = await pool.query('SELECT * FROM promo_bogo_rules WHERE promo_id = $1', [id]);
  const bogo_rule = bogoRuleResult.rows[0] as PromotionBogoRule | undefined;

  // Get codes
  const codesResult = await pool.query('SELECT * FROM promo_codes WHERE promo_id = $1', [id]);
  const codes = codesResult.rows as PromotionCode[];

  // Get eligible products
  const eligibleProductsResult = await pool.query(
    'SELECT * FROM promo_eligible_products WHERE promo_id = $1',
    [id]
  );
  const eligible_products = eligibleProductsResult.rows as PromotionEligibleProduct[];

  // Get price overrides
  const priceOverridesResult = await pool.query(
    'SELECT * FROM promo_product_price_overrides WHERE promo_id = $1',
    [id]
  );
  const price_overrides = priceOverridesResult.rows;

  return {
    ...promotion,
    discount_rule,
    bogo_rule,
    codes,
    eligible_products,
    price_overrides,
  } as PromotionWithRelations;
}

export async function createPromotion(data: CreatePromotionInput): Promise<PromotionWithRelations> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Default tenant_id to 1 if not provided
    const tenant_id = data.tenant_id || 1;

    // Insert promotion
    const promoResult = await client.query(
      `INSERT INTO promo (
        promo_code, promo_name, promo_type, discount_type, status,
        start_date, end_date, usage_limit_total, usage_limit_per_customer,
        eligibility_rules, tenant_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        data.promo_code,
        data.promo_name,
        data.promo_type,
        data.discount_type || null,
        data.status || 'draft',
        data.start_date || null,
        data.end_date || null,
        data.usage_limit_total || null,
        data.usage_limit_per_customer || null,
        data.eligibility_rules ? JSON.stringify(data.eligibility_rules) : null,
        tenant_id,
        data.created_by || null,
      ]
    );

    const promotion = promoResult.rows[0] as Promotion;
    const promo_id = promotion.id;

    // Insert discount rule if provided
    // discount type promotions need discount_rule
    if (data.discount_rule && (data.promo_type === 'discount' || data.promo_type === 'free_shipping')) {
      await client.query(
        `INSERT INTO promo_discount_rules (
          promo_id, discount_type, discount_value, max_discount_amount,
          apply_to, allocation_method, minimum_purchase_type, minimum_purchase_amount, minimum_purchase_quantity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          promo_id,
          data.discount_rule.discount_type,
          data.discount_rule.discount_value || null,
          data.discount_rule.max_discount_amount || null,
          data.discount_rule.apply_to,
          data.discount_rule.allocation_method || null,
          data.discount_rule.minimum_purchase_type || 'none',
          data.discount_rule.minimum_purchase_amount || null,
          data.discount_rule.minimum_purchase_quantity || null,
        ]
      );
    }

    // Insert BOGO rule if provided
    if (data.bogo_rule && data.promo_type === 'bogo') {
      await client.query(
        `INSERT INTO promo_bogo_rules (
          promo_id, buy_type, buy_quantity, buy_amount, buy_product_rules,
          get_type, get_quantity, get_product_rules, max_applications_per_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          promo_id,
          data.bogo_rule.buy_type,
          data.bogo_rule.buy_quantity || null,
          data.bogo_rule.buy_amount || null,
          data.bogo_rule.buy_product_rules ? JSON.stringify(data.bogo_rule.buy_product_rules) : null,
          data.bogo_rule.get_type,
          data.bogo_rule.get_quantity || 1,
          data.bogo_rule.get_product_rules ? JSON.stringify(data.bogo_rule.get_product_rules) : null,
          data.bogo_rule.max_applications_per_order || null,
        ]
      );
    }

    // Insert codes if provided
    if (data.codes && data.codes.length > 0) {
      for (const codeData of data.codes) {
        await client.query(
          `INSERT INTO promo_codes (
            promo_id, code, usage_limit, expires_at
          ) VALUES ($1, $2, $3, $4)`,
          [promo_id, codeData.code, codeData.usage_limit || null, codeData.expires_at || null]
        );
      }
    }

    // Insert eligible products if provided
    if (data.eligible_products && data.eligible_products.length > 0) {
      for (const productData of data.eligible_products) {
        await client.query(
          `INSERT INTO promo_eligible_products (
            promo_id, product_id, variant_id, collection_id, product_sku, inclusion_type, context
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            promo_id,
            productData.product_id || null,
            productData.variant_id || null,
            productData.collection_id || null,
            productData.product_sku || null,
            productData.inclusion_type,
            productData.context || null,
          ]
        );
      }
    }

    // Insert price overrides if provided
    if (data.price_overrides && data.price_overrides.length > 0) {
      for (const overrideData of data.price_overrides) {
        await client.query(
          `INSERT INTO promo_product_price_overrides (
            promo_id, product_id, variant_id, product_sku, override_price, original_price, price_override_type
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            promo_id,
            overrideData.product_id || null,
            overrideData.variant_id || null,
            overrideData.product_sku || null,
            overrideData.override_price,
            overrideData.original_price || null,
            overrideData.price_override_type || 'sale_price',
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Return full promotion with relations
    return (await getPromotionById(promo_id))!;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePromotion(data: UpdatePromotionInput): Promise<PromotionWithRelations> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id, discount_rule, bogo_rule, codes, eligible_products, price_overrides, ...promoUpdates } = data;

    // Update promotion
    if (Object.keys(promoUpdates).length > 0) {
      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 0;

      Object.entries(promoUpdates).forEach(([key, value]) => {
        if (value !== undefined && key !== 'id') {
          paramCount++;
          if (key === 'eligibility_rules' && value !== null) {
            fields.push(`${key} = $${paramCount}`);
            values.push(JSON.stringify(value));
          } else {
            fields.push(`${key} = $${paramCount}`);
            values.push(value);
          }
        }
      });

      if (fields.length > 0) {
        paramCount++;
        fields.push('updated_at = now()');
        values.push(id);

        const query = `UPDATE promo SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
        await client.query(query, values);
      }
    }

    // Update or insert discount rule
    if (discount_rule !== undefined) {
      const existing = await client.query('SELECT id FROM promo_discount_rules WHERE promo_id = $1', [id]);

      if (existing.rows.length > 0) {
        // Update existing
        await client.query(
          `UPDATE promo_discount_rules SET
            discount_type = $1, discount_value = $2, max_discount_amount = $3,
            apply_to = $4, allocation_method = $5, 
            minimum_purchase_type = $6, minimum_purchase_amount = $7, minimum_purchase_quantity = $8,
            updated_at = now()
          WHERE promo_id = $9`,
          [
            discount_rule.discount_type,
            discount_rule.discount_value || null,
            discount_rule.max_discount_amount || null,
            discount_rule.apply_to,
            discount_rule.allocation_method || null,
            discount_rule.minimum_purchase_type || 'none',
            discount_rule.minimum_purchase_amount || null,
            discount_rule.minimum_purchase_quantity || null,
            id,
          ]
        );
      } else {
        // Insert new
        await client.query(
          `INSERT INTO promo_discount_rules (
            promo_id, discount_type, discount_value, max_discount_amount,
            apply_to, allocation_method, minimum_purchase_type, minimum_purchase_amount, minimum_purchase_quantity
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id,
            discount_rule.discount_type,
            discount_rule.discount_value || null,
            discount_rule.max_discount_amount || null,
            discount_rule.apply_to,
            discount_rule.allocation_method || null,
            discount_rule.minimum_purchase_type || 'none',
            discount_rule.minimum_purchase_amount || null,
            discount_rule.minimum_purchase_quantity || null,
          ]
        );
      }
    }

    // Update or insert BOGO rule
    if (bogo_rule !== undefined) {
      const existing = await client.query('SELECT id FROM promo_bogo_rules WHERE promo_id = $1', [id]);

      if (existing.rows.length > 0) {
        // Update existing
        await client.query(
          `UPDATE promo_bogo_rules SET
            buy_type = $1, buy_quantity = $2, buy_amount = $3, buy_product_rules = $4,
            get_type = $5, get_quantity = $6, get_product_rules = $7,
            max_applications_per_order = $8, updated_at = now()
          WHERE promo_id = $9`,
          [
            bogo_rule.buy_type,
            bogo_rule.buy_quantity || null,
            bogo_rule.buy_amount || null,
            bogo_rule.buy_product_rules ? JSON.stringify(bogo_rule.buy_product_rules) : null,
            bogo_rule.get_type,
            bogo_rule.get_quantity || 1,
            bogo_rule.get_product_rules ? JSON.stringify(bogo_rule.get_product_rules) : null,
            bogo_rule.max_applications_per_order || null,
            id,
          ]
        );
      } else {
        // Insert new
        await client.query(
          `INSERT INTO promo_bogo_rules (
            promo_id, buy_type, buy_quantity, buy_amount, buy_product_rules,
            get_type, get_quantity, get_product_rules, max_applications_per_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id,
            bogo_rule.buy_type,
            bogo_rule.buy_quantity || null,
            bogo_rule.buy_amount || null,
            bogo_rule.buy_product_rules ? JSON.stringify(bogo_rule.buy_product_rules) : null,
            bogo_rule.get_type,
            bogo_rule.get_quantity || 1,
            bogo_rule.get_product_rules ? JSON.stringify(bogo_rule.get_product_rules) : null,
            bogo_rule.max_applications_per_order || null,
          ]
        );
      }
    }

    // Handle codes (delete all and recreate for simplicity)
    if (codes !== undefined) {
      await client.query('DELETE FROM promo_codes WHERE promo_id = $1', [id]);
      if (codes.length > 0) {
        for (const codeData of codes) {
          await client.query(
            `INSERT INTO promo_codes (promo_id, code, usage_limit, expires_at)
            VALUES ($1, $2, $3, $4)`,
            [id, codeData.code, codeData.usage_limit || null, codeData.expires_at || null]
          );
        }
      }
    }

    // Handle eligible products (delete all and recreate for simplicity)
    if (eligible_products !== undefined) {
      await client.query('DELETE FROM promo_eligible_products WHERE promo_id = $1', [id]);
      if (eligible_products.length > 0) {
        for (const productData of eligible_products) {
          await client.query(
            `INSERT INTO promo_eligible_products (
              promo_id, product_id, variant_id, collection_id, product_sku, inclusion_type, context
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              id,
              productData.product_id || null,
              productData.variant_id || null,
              productData.collection_id || null,
              productData.product_sku || null,
              productData.inclusion_type,
              productData.context || null,
            ]
          );
        }
      }
    }

    // Handle price overrides (delete all and recreate for simplicity)
    if (price_overrides !== undefined) {
      await client.query('DELETE FROM promo_product_price_overrides WHERE promo_id = $1', [id]);
      if (price_overrides.length > 0) {
        for (const overrideData of price_overrides) {
          await client.query(
            `INSERT INTO promo_product_price_overrides (
              promo_id, product_id, variant_id, product_sku, override_price, original_price, price_override_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              id,
              overrideData.product_id || null,
              overrideData.variant_id || null,
              overrideData.product_sku || null,
              overrideData.override_price,
              overrideData.original_price || null,
              overrideData.price_override_type || 'sale_price',
            ]
          );
        }
      }
    }

    await client.query('COMMIT');

    // Return updated promotion with relations
    return (await getPromotionById(id))!;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deletePromotion(id: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM promo WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
}

export async function getPromotionCount(params?: {
  search?: string;
  status?: string;
  promo_type?: string;
  tenant_id?: number;
}): Promise<number> {
  const { search, status, promo_type, tenant_id } = params || {};

  let query = 'SELECT COUNT(*) FROM promo WHERE 1=1';
  const values: any[] = [];
  let paramCount = 0;

  if (search) {
    paramCount++;
    query += ` AND (promo_name ILIKE $${paramCount} OR promo_code ILIKE $${paramCount})`;
    values.push(`%${search}%`);
  }

  if (status) {
    paramCount++;
    query += ` AND status = $${paramCount}`;
    values.push(status);
  }

  if (promo_type) {
    paramCount++;
    query += ` AND promo_type = $${paramCount}`;
    values.push(promo_type);
  }

  if (tenant_id !== undefined) {
    paramCount++;
    query += ` AND tenant_id = $${paramCount}`;
    values.push(tenant_id);
  }

  const result = await pool.query(query, values);
  return parseInt(result.rows[0].count);
}

