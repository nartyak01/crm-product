import pool from '@/lib/db';
import { ProductImage } from '@/types/database';

export async function getProductImages(productId: number): Promise<ProductImage | null> {
  const result = await pool.query(
    'SELECT * FROM product_image WHERE product_id = $1',
    [productId]
  );
  return result.rows[0] as ProductImage || null;
}

export async function createOrUpdateProductImage(
  productId: number,
  thumbnail: string,
  gallery: string
): Promise<ProductImage> {
  // gallery can be JSON array or comma-separated string
  const galleryValue = Array.isArray(gallery) ? JSON.stringify(gallery) : gallery;

  // Check if product_image exists
  const existing = await pool.query(
    'SELECT * FROM product_image WHERE product_id = $1',
    [productId]
  );

  if (existing.rows.length > 0) {
    // Update existing
    const result = await pool.query(
      `UPDATE product_image 
       SET thumbnail = $1, gallery = $2, updated_at = now()
       WHERE product_id = $3
       RETURNING *`,
      [thumbnail, galleryValue, productId]
    );
    return result.rows[0] as ProductImage;
  } else {
    // Insert new
    const result = await pool.query(
      `INSERT INTO product_image (product_id, thumbnail, gallery)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [productId, thumbnail, galleryValue]
    );
    return result.rows[0] as ProductImage;
  }
}

export async function updateProductThumbnail(productId: number, thumbnail: string): Promise<ProductImage> {
  // Check if product_image exists
  const existing = await pool.query(
    'SELECT * FROM product_image WHERE product_id = $1',
    [productId]
  );

  if (existing.rows.length > 0) {
    // Update existing
    const result = await pool.query(
      `UPDATE product_image 
       SET thumbnail = $1, updated_at = now()
       WHERE product_id = $2
       RETURNING *`,
      [thumbnail, productId]
    );
    return result.rows[0] as ProductImage;
  } else {
    // Insert new
    const result = await pool.query(
      `INSERT INTO product_image (product_id, thumbnail, gallery)
       VALUES ($1, $2, '[]')
       RETURNING *`,
      [productId, thumbnail]
    );
    return result.rows[0] as ProductImage;
  }
}

export async function updateProductGallery(productId: number, gallery: string | string[]): Promise<ProductImage> {
  const galleryValue = Array.isArray(gallery) ? JSON.stringify(gallery) : gallery;

  // Check if product_image exists
  const existing = await pool.query(
    'SELECT * FROM product_image WHERE product_id = $1',
    [productId]
  );

  if (existing.rows.length > 0) {
    // Update existing
    const result = await pool.query(
      `UPDATE product_image 
       SET gallery = $1, updated_at = now()
       WHERE product_id = $2
       RETURNING *`,
      [galleryValue, productId]
    );
    return result.rows[0] as ProductImage;
  } else {
    // Insert new
    const result = await pool.query(
      `INSERT INTO product_image (product_id, thumbnail, gallery)
       VALUES ($1, '', $2)
       RETURNING *`,
      [productId, galleryValue]
    );
    return result.rows[0] as ProductImage;
  }
}

export async function deleteProductImage(productId: number): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM product_image WHERE product_id = $1 RETURNING id',
    [productId]
  );
  return result.rows.length > 0;
}

// parseGallery function moved to lib/utils.ts to avoid importing database code in client components

