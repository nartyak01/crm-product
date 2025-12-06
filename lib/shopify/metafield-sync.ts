import pool from '@/lib/db';
import { ProductAttribute } from '@/types/database';

// Import Shopify functions (CommonJS modules)
const {
  createMetafieldDefinition,
  updateMetafieldDefinition,
  deleteMetafieldDefinition,
  findDefinitionIdByName,
  listMetafieldDefinitions,
} = require('../../shopify/lib/metafield-functions');

const {
  setChoices,
} = require('../../shopify/lib/metafield-choices-functions');

const { nameToKey } = require('../../shopify/lib/helpers');

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
 * Get all attribute values for a given type (for choices)
 */
async function getAttributeValuesForType(type: string, brandId: number = 4): Promise<string[]> {
  const result = await pool.query(
    'SELECT DISTINCT name FROM product_attribute WHERE type = $1 AND brand_id = $2 ORDER BY name',
    [type, brandId]
  );
  return result.rows.map((row: any) => row.name);
}

/**
 * Sync metafield (product_attribute) to Shopify Metafield Definition
 * Creates or updates definition and saves Shopify ID to database
 */
export async function syncMetafieldToShopify(attributeId: number): Promise<string> {
  // Get attribute from database
  const attributeResult = await pool.query(
    'SELECT * FROM product_attribute WHERE id = $1',
    [attributeId]
  );

  if (attributeResult.rows.length === 0) {
    throw new Error(`Product attribute with id ${attributeId} not found`);
  }

  const attribute: ProductAttribute = attributeResult.rows[0];

  try {
    const metafieldName = formatMetafieldName(attribute.type);
    const namespace = 'custom';
    const ownerType = 'PRODUCT';
    const metafieldType = 'list.single_line_text_field';

    let shopifyDefinitionId: string;

    // Check if attribute already has a Shopify definition ID
    if (attribute.shopify_metafield_definition_id) {
      // Update existing definition
      const updatedDefinition = await updateMetafieldDefinition(
        attribute.shopify_metafield_definition_id,
        {
          name: metafieldName,
          description: attribute.description || null,
        }
      );
      shopifyDefinitionId = updatedDefinition.id;
    } else {
      // Check if definition with same name already exists
      const existingDefinition = await findDefinitionIdByName(metafieldName, namespace, ownerType);

      if (existingDefinition) {
        // Use existing definition
        shopifyDefinitionId = existingDefinition;
      } else {
        // Create new definition
        try {
          const newDefinition = await createMetafieldDefinition({
            name: metafieldName,
            namespace,
            ownerType,
            type: metafieldType,
            description: attribute.description || null,
          });
          shopifyDefinitionId = newDefinition.id;
        } catch (error: any) {
          console.error('Error creating metafield definition:', {
            name: metafieldName,
            namespace,
            ownerType,
            type: metafieldType,
            error: error.message,
            stack: error.stack,
          });
          throw error;
        }
      }
    }

    // Get brand_id from attribute (it might not be in the type, so query it)
    const brandIdResult = await pool.query(
      'SELECT brand_id FROM product_attribute WHERE id = $1',
      [attributeId]
    );
    const brandId = brandIdResult.rows[0]?.brand_id || 4;

    // Get all attribute values for this type to update choices
    const choices = await getAttributeValuesForType(attribute.type, brandId);
    
    if (choices.length > 0) {
      try {
        await setChoices(shopifyDefinitionId, choices);
      } catch (error: any) {
        console.warn(`Failed to update choices for metafield ${metafieldName}: ${error.message}`);
        // Don't throw - definition was created/updated successfully
      }
    }

    // Save Shopify definition ID to database
    await pool.query(
      'UPDATE product_attribute SET shopify_metafield_definition_id = $1 WHERE id = $2',
      [shopifyDefinitionId, attributeId]
    );

    return shopifyDefinitionId;
  } catch (error: any) {
    throw new Error(`Failed to sync metafield to Shopify: ${error.message}`);
  }
}

/**
 * Sync all metafields of a given type to Shopify
 * Used when new attribute values are added
 */
export async function syncMetafieldTypeToShopify(type: string, brandId: number = 4): Promise<void> {
  // Get all attributes of this type
  const attributesResult = await pool.query(
    'SELECT id, brand_id FROM product_attribute WHERE type = $1 AND brand_id = $2',
    [type, brandId]
  );

  if (attributesResult.rows.length === 0) {
    return;
  }

  // Sync the first attribute (they all share the same metafield definition)
  const firstAttributeId = attributesResult.rows[0].id;
  const shopifyDefinitionId = await syncMetafieldToShopify(firstAttributeId);

  // Update all other attributes of the same type with the same Shopify definition ID
  await pool.query(
    'UPDATE product_attribute SET shopify_metafield_definition_id = $1 WHERE type = $2 AND brand_id = $3',
    [shopifyDefinitionId, type, brandId]
  );

  // Update choices with all current values
  const choices = await getAttributeValuesForType(type, brandId);
  if (choices.length > 0) {
    try {
      await setChoices(shopifyDefinitionId, choices);
    } catch (error: any) {
      console.warn(`Failed to update choices for metafield type ${type}: ${error.message}`);
    }
  }
}

/**
 * Delete metafield from Shopify
 * Removes definition and clears Shopify ID from database
 */
export async function deleteMetafieldFromShopify(attributeId: number): Promise<void> {
  const attributeResult = await pool.query(
    'SELECT shopify_metafield_definition_id, type FROM product_attribute WHERE id = $1',
    [attributeId]
  );

  if (attributeResult.rows.length === 0) {
    throw new Error(`Product attribute with id ${attributeId} not found`);
  }

  const shopifyDefinitionId = attributeResult.rows[0].shopify_metafield_definition_id;
  const attributeType = attributeResult.rows[0].type;

  if (!shopifyDefinitionId) {
    // Attribute not synced to Shopify, nothing to delete
    return;
  }

  // Check if other attributes of the same type exist
  const otherAttributesResult = await pool.query(
    'SELECT COUNT(*) as count FROM product_attribute WHERE type = $1 AND id != $2',
    [attributeType, attributeId]
  );

  const otherAttributesCount = parseInt(otherAttributesResult.rows[0].count);

  if (otherAttributesCount > 0) {
    // Other attributes of the same type exist, don't delete the definition
    // Just clear the Shopify ID for this attribute
    await pool.query(
      'UPDATE product_attribute SET shopify_metafield_definition_id = NULL WHERE id = $1',
      [attributeId]
    );
    return;
  }

  try {
    await deleteMetafieldDefinition(shopifyDefinitionId);

    // Clear Shopify definition ID from database
    await pool.query(
      'UPDATE product_attribute SET shopify_metafield_definition_id = NULL WHERE id = $1',
      [attributeId]
    );
  } catch (error: any) {
    throw new Error(`Failed to delete metafield from Shopify: ${error.message}`);
  }
}

