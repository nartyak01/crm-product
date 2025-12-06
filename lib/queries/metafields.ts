import pool from '@/lib/db';
import {
  ProductAttribute,
  ProductAttributeValue,
  CreateMetafieldInput,
  UpdateMetafieldInput,
  GroupedMetafield,
} from '@/types/database';

export async function getMetafields(): Promise<(GroupedMetafield & { shopify_metafield_definition_id?: string | null })[]> {
  // Get all attributes with brand_id = 4, including shopify_metafield_definition_id
  const result = await pool.query(
    'SELECT name, type, shopify_metafield_definition_id FROM product_attribute WHERE brand_id = 4 ORDER BY type, name'
  );
  
  // Group by type
  const grouped = new Map<string, { names: string[], shopifyId: string | null | undefined }>();
  
  result.rows.forEach((row: any) => {
    const type = row.type;
    if (!grouped.has(type)) {
      grouped.set(type, { names: [], shopifyId: row.shopify_metafield_definition_id });
    }
    grouped.get(type)!.names.push(row.name);
    // Use the first non-null shopify ID found for this type
    if (!grouped.get(type)!.shopifyId && row.shopify_metafield_definition_id) {
      grouped.get(type)!.shopifyId = row.shopify_metafield_definition_id;
    }
  });
  
  // Convert to array format
  const metafields = Array.from(grouped.entries()).map(([type, data]) => ({
    name: type,
    type: type,
    values: data.names,
    shopify_metafield_definition_id: data.shopifyId,
  }));
  
  return metafields;
}

export async function getMetafieldById(id: number): Promise<ProductAttribute | null> {
  const result = await pool.query('SELECT * FROM product_attribute WHERE id = $1', [id]);
  return result.rows[0] as ProductAttribute || null;
}

export async function getAllAttributesWithBrandId(brandId: number): Promise<ProductAttribute[]> {
  const result = await pool.query(
    'SELECT * FROM product_attribute WHERE brand_id = $1 ORDER BY type, name',
    [brandId]
  );
  return result.rows as ProductAttribute[];
}

export async function createMetafield(data: CreateMetafieldInput, brandId: number = 4): Promise<ProductAttribute> {
  const { name, type, value = '', description = '' } = data;
  const result = await pool.query(
    `INSERT INTO product_attribute (name, type, value, description, brand_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, type, value, description, brandId]
  );
  return result.rows[0] as ProductAttribute;
}

export async function updateMetafield(data: UpdateMetafieldInput): Promise<ProductAttribute> {
  const { id, ...updates } = data;
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 0;

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      paramCount++;
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
    }
  });

  if (fields.length === 0) {
    const result = await pool.query('SELECT * FROM product_attribute WHERE id = $1', [id]);
    return result.rows[0] as ProductAttribute;
  }

  paramCount++;
  values.push(id);

  const result = await pool.query(
    `UPDATE product_attribute SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  return result.rows[0] as ProductAttribute;
}

export async function deleteMetafield(id: number): Promise<boolean> {
  // Check if metafield is used by products
  const productsResult = await pool.query(
    'SELECT COUNT(*) FROM product_attribute_value WHERE attribute_id = $1',
    [id]
  );

  if (parseInt(productsResult.rows[0].count) > 0) {
    throw new Error('Cannot delete metafield that is assigned to products');
  }

  const result = await pool.query('DELETE FROM product_attribute WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
}

export async function getProductMetafields(productId: number): Promise<
  (ProductAttributeValue & { attribute: ProductAttribute })[]
> {
  const result = await pool.query(
    `SELECT pav.*, pa.name as attribute_name, pa.type as attribute_type, pa.description as attribute_description
     FROM product_attribute_value pav
     INNER JOIN product_attribute pa ON pav.attribute_id = pa.id
     WHERE pav.product_id = $1`,
    [productId]
  );

  return result.rows.map((row: any) => ({
    id: row.id,
    product_id: row.product_id,
    attribute_id: row.attribute_id,
    value: row.value,
    is_variant_value: row.is_variant_value,
    created_at: row.created_at,
    updated_at: row.updated_at,
    attribute: {
      id: row.attribute_id,
      name: row.attribute_name,
      type: row.attribute_type,
      value: '',
      description: row.attribute_description || '',
    },
  }));
}

export async function setProductMetafield(
  productId: number,
  attributeId: number,
  value: string,
  isVariantValue: boolean = false
): Promise<ProductAttributeValue> {
  const result = await pool.query(
    `INSERT INTO product_attribute_value (product_id, attribute_id, value, is_variant_value)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (product_id, attribute_id)
     DO UPDATE SET value = $3, is_variant_value = $4, updated_at = now()
     RETURNING *`,
    [productId, attributeId, value, isVariantValue]
  );

  return result.rows[0] as ProductAttributeValue;
}

export async function deleteProductMetafield(productId: number, attributeId: number): Promise<void> {
  await pool.query(
    'DELETE FROM product_attribute_value WHERE product_id = $1 AND attribute_id = $2',
    [productId, attributeId]
  );
}

