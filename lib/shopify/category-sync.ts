import pool from '@/lib/db';
import { Category } from '@/types/database';

// Import Shopify functions (CommonJS modules)
const {
  createCollection,
  updateCollection,
  deleteCollection,
  findCollectionByTitle,
} = require('../../shopify/lib/collection-functions');

/**
 * Sync category to Shopify Collection
 * Creates or updates collection and saves Shopify ID to database
 */
export async function syncCategoryToShopify(categoryId: number): Promise<string> {
  // Get category from database
  const categoryResult = await pool.query(
    'SELECT * FROM category WHERE id = $1',
    [categoryId]
  );

  if (categoryResult.rows.length === 0) {
    throw new Error(`Category with id ${categoryId} not found`);
  }

  const category: Category = categoryResult.rows[0];

  try {
    let shopifyCollectionId: string;

    // Check if category already has a Shopify collection ID
    if (category.shopify_collection_id) {
      // Update existing collection
      const updatedCollection = await updateCollection(category.shopify_collection_id, {
        title: category.name,
      });
      shopifyCollectionId = updatedCollection.id;
    } else {
      // Check if collection with same name already exists
      const existingCollection = await findCollectionByTitle(category.name);
      
      if (existingCollection) {
        // Use existing collection
        shopifyCollectionId = existingCollection.id;
      } else {
        // Create new collection
        const newCollection = await createCollection({
          title: category.name,
        });
        shopifyCollectionId = newCollection.id;
      }
    }

    // Save Shopify collection ID to database
    await pool.query(
      'UPDATE category SET shopify_collection_id = $1 WHERE id = $2',
      [shopifyCollectionId, categoryId]
    );

    return shopifyCollectionId;
  } catch (error: any) {
    throw new Error(`Failed to sync category to Shopify: ${error.message}`);
  }
}

/**
 * Delete category from Shopify
 * Removes collection and clears Shopify ID from database
 */
export async function deleteCategoryFromShopify(categoryId: number): Promise<void> {
  const categoryResult = await pool.query(
    'SELECT shopify_collection_id FROM category WHERE id = $1',
    [categoryId]
  );

  if (categoryResult.rows.length === 0) {
    throw new Error(`Category with id ${categoryId} not found`);
  }

  const shopifyCollectionId = categoryResult.rows[0].shopify_collection_id;

  if (!shopifyCollectionId) {
    // Category not synced to Shopify, nothing to delete
    return;
  }

  try {
    await deleteCollection(shopifyCollectionId);

    // Clear Shopify collection ID from database
    await pool.query(
      'UPDATE category SET shopify_collection_id = NULL WHERE id = $1',
      [categoryId]
    );
  } catch (error: any) {
    throw new Error(`Failed to delete category from Shopify: ${error.message}`);
  }
}

