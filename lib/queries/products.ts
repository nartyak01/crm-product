import pool from '@/lib/db';
import { Product, CreateProductInput, UpdateProductInput, ProductWithRelations } from '@/types/database';

export async function getProducts(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  product_type?: string;
  brand_id?: number;
}) {
  const { limit = 50, offset = 0, search, status, product_type, brand_id } = params || {};
  
  // Build WHERE conditions first
  const whereConditions: string[] = [];
  const values: any[] = [];
  let paramCount = 0;

  if (search) {
    paramCount++;
    whereConditions.push(`(p.name ILIKE $${paramCount} OR p.sku ILIKE $${paramCount})`);
    values.push(`%${search}%`);
  }

  if (status) {
    paramCount++;
    whereConditions.push(`p.status = $${paramCount}`);
    values.push(status);
  }

  if (product_type) {
    paramCount++;
    whereConditions.push(`p.product_type = $${paramCount}`);
    values.push(product_type);
  }

  if (brand_id !== undefined) {
    paramCount++;
    whereConditions.push(`p.brand_id = $${paramCount}`);
    values.push(brand_id);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Use subquery to get distinct products sorted by created_at DESC, then join for images
  let query = `
    SELECT 
      p.*,
      (SELECT thumbnail FROM product_image WHERE product_id = p.id LIMIT 1) as thumbnail,
      (SELECT image_path FROM diamond WHERE product_id = p.id AND p.product_type = 'diamond' LIMIT 1) as diamond_image_path
    FROM product p
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
  `;
  values.push(limit, offset);

  const result = await pool.query(query, values);
  return result.rows as (Product & { thumbnail?: string; diamond_image_path?: string })[];
}

export async function getProductById(id: number): Promise<ProductWithRelations | null> {
  const productResult = await pool.query('SELECT * FROM product WHERE id = $1', [id]);
  
  if (productResult.rows.length === 0) {
    return null;
  }

  const product = productResult.rows[0] as Product;

  // Get categories (only with brand_id = 4)
  const categoriesResult = await pool.query(
    `SELECT c.* FROM category c
     INNER JOIN product_category pc ON c.id = pc.category_id
     WHERE pc.product_id = $1 AND c.brand_id = 4`,
    [id]
  );

  // Get images
  const imagesResult = await pool.query(
    'SELECT * FROM product_image WHERE product_id = $1',
    [id]
  );

  // Get metafields - different logic for diamond vs other products
  let metafields: any[] = [];
  
  if (product.product_type === 'diamond') {
    // For diamond products, get fields from diamond table
    const diamondResult = await pool.query(
      `SELECT * FROM diamond WHERE product_id = $1 LIMIT 1`,
      [id]
    );
    
    if (diamondResult.rows.length > 0) {
      const diamond = diamondResult.rows[0];
      // Map diamond fields to metafields format
      const diamondFields = [
        { key: 'shape', label: 'Shape' },
        { key: 'cut_grade', label: 'Cut Grade' },
        { key: 'carat', label: 'Carat' },
        { key: 'color', label: 'Color' },
        { key: 'clarity', label: 'Clarity' },
        { key: 'grading_lab', label: 'Grading Lab' },
        { key: 'certificate_number', label: 'Certificate Number' },
        { key: 'certificate_path', label: 'Certificate Path' },
        { key: 'image_path', label: 'Image Path' },
        { key: 'total_price', label: 'Total Price' },
        { key: 'measurement_length', label: 'Measurement Length' },
        { key: 'measurement_width', label: 'Measurement Width' },
        { key: 'measurement_height', label: 'Measurement Height' },
        { key: 'country', label: 'Country' },
        { key: 'state_region', label: 'State/Region' },
        { key: 'guaranteed_availability', label: 'Guaranteed Availability' },
        { key: 'item_id', label: 'Item ID' },
      ];
      
      metafields = diamondFields
        .filter(field => diamond[field.key] !== null && diamond[field.key] !== '' && diamond[field.key] !== undefined)
        .map((field, index) => ({
          id: `diamond_${field.key}_${index}`,
          product_id: id,
          attribute_id: null,
          value: field.key === 'guaranteed_availability' 
            ? (diamond[field.key] ? 'Yes' : 'No')
            : String(diamond[field.key]),
          is_variant_value: false,
          created_at: diamond.created_at,
          updated_at: diamond.updated_at,
          attribute: {
            id: null,
            name: field.label,
            type: 'diamond_field',
            value: '',
            description: '',
          },
        }));
    }
  } else {
    // For other products, get metafields from product_attribute_value
    const metafieldsResult = await pool.query(
      `SELECT pav.*, pa.name as attribute_name, pa.type as attribute_type
       FROM product_attribute_value pav
       INNER JOIN product_attribute pa ON pav.attribute_id = pa.id
       WHERE pav.product_id = $1`,
      [id]
    );
    
    metafields = metafieldsResult.rows.map((row: any) => ({
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
        description: '',
      },
    }));
  }

  return {
    ...product,
    categories: categoriesResult.rows,
    images: imagesResult.rows[0] || null,
    metafields,
  } as ProductWithRelations;
}

export async function createProduct(data: CreateProductInput): Promise<Product> {
  const {
    sku,
    name,
    product_type = 'jewelry',
    retail_price = 0,
    sale_price = 0,
    description = '',
    is_pre_order = false,
    status = 'draft',
  } = data;

  // Tự động set brand_id = 4 cho tất cả sản phẩm mới
  const brand_id = 4;

  const result = await pool.query(
    `INSERT INTO product (sku, name, product_type, retail_price, sale_price, description, is_pre_order, status, brand_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [sku, name, product_type, retail_price, sale_price, description, is_pre_order, status, brand_id]
  );

  return result.rows[0] as Product;
}

export async function updateProduct(data: UpdateProductInput): Promise<Product> {
  const { id, ...updates } = data;
  console.log('🗄️ [DB] updateProduct called:', { id, updates });
  
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 0;

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined) {
      paramCount++;
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
      console.log(`🗄️ [DB] Adding field to update: ${key} =`, value);
    }
  });

  if (fields.length === 0) {
    console.log('⚠️ [DB] No fields to update, returning existing product');
    const result = await pool.query('SELECT * FROM product WHERE id = $1', [id]);
    return result.rows[0] as Product;
  }

  paramCount++;
  values.push(id);

  const query = `UPDATE product SET ${fields.join(', ')}, updated_at = now()
     WHERE id = $${paramCount}
     RETURNING *`;
  
  console.log('🔍 [DB] Executing SQL query:', query);
  console.log('📊 [DB] Query values:', values);

  const result = await pool.query(query, values);
  
  if (result.rows.length === 0) {
    console.error('❌ [DB] No product found with id:', id);
    throw new Error('Product not found');
  }
  
  console.log('✅ [DB] Product updated successfully:', result.rows[0]);
  return result.rows[0] as Product;
}

export async function deleteProduct(id: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM product WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
}

export async function getProductCount(params?: {
  search?: string;
  status?: string;
  product_type?: string;
  brand_id?: number;
}): Promise<number> {
  const { search, status, product_type, brand_id } = params || {};
  
  let query = 'SELECT COUNT(*) FROM product WHERE 1=1';
  const values: any[] = [];
  let paramCount = 0;

  if (search) {
    paramCount++;
    query += ` AND (name ILIKE $${paramCount} OR sku ILIKE $${paramCount})`;
    values.push(`%${search}%`);
  }

  if (status) {
    paramCount++;
    query += ` AND status = $${paramCount}`;
    values.push(status);
  }

  if (product_type) {
    paramCount++;
    query += ` AND product_type = $${paramCount}`;
    values.push(product_type);
  }

  if (brand_id !== undefined) {
    paramCount++;
    query += ` AND brand_id = $${paramCount}`;
    values.push(brand_id);
  }

  const result = await pool.query(query, values);
  return parseInt(result.rows[0].count);
}

