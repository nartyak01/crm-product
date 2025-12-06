import pool from '@/lib/db';
import { Category, CreateCategoryInput, UpdateCategoryInput, CategoryTree } from '@/types/database';

export async function getCategories(brandId?: number): Promise<Category[]> {
  if (brandId !== undefined) {
    const result = await pool.query(
      'SELECT * FROM category WHERE brand_id = $1 ORDER BY name',
      [brandId]
    );
    return result.rows as Category[];
  }
  const result = await pool.query('SELECT * FROM category ORDER BY name');
  return result.rows as Category[];
}

export async function getCategoryTree(brandId?: number): Promise<CategoryTree[]> {
  const categories = await getCategories(brandId);
  const categoryMap = new Map<number, CategoryTree>();
  const rootCategories: CategoryTree[] = [];

  // Create map of all categories
  categories.forEach((cat) => {
    categoryMap.set(cat.id, { ...cat, children: [] });
  });

  // Build tree structure
  categories.forEach((cat) => {
    const categoryNode = categoryMap.get(cat.id)!;
    if (!cat.parent_id) {
      rootCategories.push(categoryNode);
    } else {
      const parent = categoryMap.get(cat.parent_id);
      if (parent) {
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(categoryNode);
      }
    }
  });

  return rootCategories;
}

export async function getCategoryById(id: number): Promise<Category | null> {
  const result = await pool.query('SELECT * FROM category WHERE id = $1', [id]);
  return result.rows[0] as Category || null;
}

export async function createCategory(data: CreateCategoryInput, brandId: number = 4): Promise<Category> {
  const { name, parent_id } = data;
  const result = await pool.query(
    'INSERT INTO category (name, parent_id, brand_id) VALUES ($1, $2, $3) RETURNING *',
    [name, parent_id || null, brandId]
  );
  return result.rows[0] as Category;
}

export async function updateCategory(data: UpdateCategoryInput): Promise<Category> {
  const { id, name, parent_id } = data;
  const updates: string[] = [];
  const values: any[] = [];
  let paramCount = 0;

  if (name !== undefined) {
    paramCount++;
    updates.push(`name = $${paramCount}`);
    values.push(name);
  }

  if (parent_id !== undefined) {
    paramCount++;
    updates.push(`parent_id = $${paramCount}`);
    values.push(parent_id);
  }

  if (updates.length === 0) {
    const result = await pool.query('SELECT * FROM category WHERE id = $1', [id]);
    return result.rows[0] as Category;
  }

  paramCount++;
  values.push(id);

  const result = await pool.query(
    `UPDATE category SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
    values
  );

  return result.rows[0] as Category;
}

export async function deleteCategory(id: number, brandId: number = 4): Promise<boolean> {
  // Check if category has children with same brand_id
  const childrenResult = await pool.query(
    'SELECT COUNT(*) FROM category WHERE parent_id = $1 AND brand_id = $2',
    [id, brandId]
  );
  
  if (parseInt(childrenResult.rows[0].count) > 0) {
    throw new Error('Cannot delete category with children');
  }

  // Check if category is used by products
  const productsResult = await pool.query(
    'SELECT COUNT(*) FROM product_category WHERE category_id = $1',
    [id]
  );

  if (parseInt(productsResult.rows[0].count) > 0) {
    throw new Error('Cannot delete category that is assigned to products');
  }

  // Only delete if category belongs to the specified brand
  const result = await pool.query(
    'DELETE FROM category WHERE id = $1 AND brand_id = $2 RETURNING id',
    [id, brandId]
  );
  return result.rows.length > 0;
}

export async function getProductCategories(productId: number, brandId: number = 4): Promise<Category[]> {
  const result = await pool.query(
    `SELECT c.* FROM category c
     INNER JOIN product_category pc ON c.id = pc.category_id
     WHERE pc.product_id = $1 AND c.brand_id = $2`,
    [productId, brandId]
  );
  return result.rows as Category[];
}

export async function assignCategoryToProduct(productId: number, categoryId: number): Promise<void> {
  await pool.query(
    `INSERT INTO product_category (product_id, category_id)
     VALUES ($1, $2)
     ON CONFLICT (product_id, category_id) DO NOTHING`,
    [productId, categoryId]
  );
}

export async function removeCategoryFromProduct(productId: number, categoryId: number): Promise<void> {
  await pool.query(
    'DELETE FROM product_category WHERE product_id = $1 AND category_id = $2',
    [productId, categoryId]
  );
}

