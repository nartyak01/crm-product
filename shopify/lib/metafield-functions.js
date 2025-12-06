const { executeGraphQL } = require('./graphql-client');
const { publishToAllChannels } = require('./publish-utils');
const { nameToKey } = require('./helpers');

/**
 * Metafield Definition Functions
 * Functions for managing Shopify metafield definitions via GraphQL Admin API
 */

const DEFAULT_NAMESPACE = 'custom';
const DEFAULT_OWNER_TYPE = 'PRODUCT';
const DEFAULT_TYPE = 'list.single_line_text_field';

/**
 * Get Metafield Definition by ID
 * @param {string} definitionId - Definition ID
 * @returns {Promise<Object>} - Metafield definition
 */
async function getMetafieldDefinition(definitionId) {
  if (!definitionId) {
    throw new Error('Missing required field: definitionId');
  }

  const query = `
    query GetMetafieldDefinition($id: ID!) {
      metafieldDefinition(id: $id) {
        id
        name
        namespace
        key
        type {
          name
        }
        ownerType
        description
        validations {
          name
          value
        }
        pinnedPosition
        access {
          customerAccount
          storefront
        }
      }
    }
  `;

  const variables = {
    id: definitionId,
  };

  const result = await executeGraphQL(query, variables);
  return result.metafieldDefinition;
}

/**
 * List Metafield Definitions
 * @param {string} ownerType - Owner type (default: "PRODUCT")
 * @param {string} namespace - Namespace filter (optional)
 * @returns {Promise<Array>} - Array of metafield definitions
 */
async function listMetafieldDefinitions(ownerType = 'PRODUCT', namespace = null) {
  const query = `
    query GetMetafieldDefinitions($first: Int!, $ownerType: MetafieldOwnerType!) {
      metafieldDefinitions(first: $first, ownerType: $ownerType) {
        edges {
          node {
            id
            name
            namespace
            key
            type {
              name
            }
            ownerType
            description
            validations {
              name
              value
            }
            pinnedPosition
            access {
              admin
              storefront
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

  const variables = {
    first: 50,
    ownerType: ownerType || 'PRODUCT',
  };

  const result = await executeGraphQL(query, variables);
  let definitions = result.metafieldDefinitions.edges.map(edge => edge.node);

  if (namespace) {
    definitions = definitions.filter(def => def.namespace === namespace);
  }

  return definitions;
}

/**
 * Create Metafield Definition
 * @param {Object} definition - Metafield definition object
 * @param {string} definition.name - Display name (required)
 * @param {string} definition.namespace - Namespace (default: "custom")
 * @param {string} definition.key - Key (auto-generated if not provided)
 * @param {string} definition.ownerType - Owner type (default: "PRODUCT")
 * @param {string} definition.type - Metafield type (default: "list.single_line_text_field")
 * @param {string} definition.description - Description (optional)
 * @param {Array} definition.validations - Validations (optional)
 * @returns {Promise<Object>} - Created definition
 */
async function createMetafieldDefinition(definition) {
  const {
    name,
    namespace = DEFAULT_NAMESPACE,
    key = null,
    ownerType = DEFAULT_OWNER_TYPE,
    type = DEFAULT_TYPE,
    description = null,
    validations = null,
  } = definition;

  if (!name) {
    throw new Error('Missing required field: name');
  }

  const finalKey = key || nameToKey(name);

  let finalValidations = validations;
  if (!finalValidations && type === 'list.single_line_text_field') {
    finalValidations = [
      {
        name: 'choices',
        value: JSON.stringify([])
      }
    ];
  }

  const mutation = `
    mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
      metafieldDefinitionCreate(definition: $definition) {
        createdDefinition {
          id
          name
          namespace
          key
          type {
            name
          }
          ownerType
          description
          validations {
            name
            value
          }
          pinnedPosition
          access {
            admin
            storefront
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    definition: {
      name,
      namespace,
      key: finalKey,
      ownerType,
      type: type,
      ...(description && { description }),
      ...(finalValidations && { validations: finalValidations }),
      // Pin definition - use pin: true instead of pinnedPosition
      pin: true,
      // Access options
      // Note: Requires Admin API scopes:
      // - write_products (for PRODUCT owner type metafield definitions)
      // - write_metaobjects (for metaobject metafield definitions)
      // - unauthenticated_read_metaobjects (for PUBLIC_READ storefront access)
      access: {
        customerAccount: 'READ', // Allow customer account access
        storefront: 'PUBLIC_READ', // Storefront API access
      },
    },
  };

  // Execute mutation - pin and access are required
  let result;
  try {
    result = await executeGraphQL(mutation, variables);
  } catch (error) {
    // Log the error to see what's wrong
    console.error('Error creating metafield definition with pin/access:', error.message);
    // If access or pin are not supported, log warning but still try
    if (error.message && (error.message.includes('access') || error.message.includes('pin') || error.message.includes('pinnedPosition') || error.message.includes('not defined'))) {
      console.warn('⚠️  pin or access may not be supported in this API version, trying without them...');
      const variablesWithoutAccess = {
        definition: {
          name,
          namespace,
          key: finalKey,
          ownerType,
          type: type,
          ...(description && { description }),
          ...(finalValidations && { validations: finalValidations }),
        },
      };
      result = await executeGraphQL(mutation, variablesWithoutAccess);
      console.warn('⚠️  Metafield created without pin/access. Please set manually in Shopify Admin.');
    } else {
      throw error;
    }
  }

  if (!result || !result.metafieldDefinitionCreate) {
    throw new Error('Invalid response from Shopify API');
  }

  if (result.metafieldDefinitionCreate.userErrors && result.metafieldDefinitionCreate.userErrors.length > 0) {
    const errors = result.metafieldDefinitionCreate.userErrors;
    // Check if errors are about access/pin
    const hasAccessError = errors.some(e => 
      e.message && (e.message.includes('access') || e.message.includes('pin') || e.message.includes('pinnedPosition') || e.message.includes('not defined'))
    );
    
    if (hasAccessError) {
      console.warn('⚠️  User errors about pin/access:', JSON.stringify(errors, null, 2));
      console.warn('⚠️  Metafield may have been created but without pin/access. Please set manually in Shopify Admin.');
      // Still return the definition if it was created
      if (result.metafieldDefinitionCreate.createdDefinition) {
        return result.metafieldDefinitionCreate.createdDefinition;
      }
    }
    throw new Error(`User Errors: ${JSON.stringify(errors, null, 2)}`);
  }

  const createdDefinition = result.metafieldDefinitionCreate.createdDefinition;
  
  if (!createdDefinition) {
    throw new Error('Failed to create metafield definition: No definition returned');
  }
  
  // Verify pin and access were set
  if (createdDefinition.pinnedPosition === null || createdDefinition.pinnedPosition === undefined) {
    console.warn('⚠️  Warning: pin was not set. Metafield may not be pinned.');
  } else {
    console.log(`✅ Metafield pinned at position: ${createdDefinition.pinnedPosition}`);
  }
  
  if (!createdDefinition.access || createdDefinition.access.storefront !== 'PUBLIC_READ') {
    console.warn('⚠️  Warning: Access options may not be set correctly:', createdDefinition.access);
  } else {
    console.log('✅ Access options set correctly:', {
      customerAccount: createdDefinition.access.customerAccount,
      storefront: createdDefinition.access.storefront,
    });
  }
  
  return createdDefinition;

  // Publish to all sales channels (metafield definitions are published automatically, but we can verify)
  try {
    // Note: Metafield definitions don't need publishing like products/collections
    // They're available immediately after creation
    console.log('✅ Metafield definition created and available');
  } catch (error) {
    console.warn(`⚠️  Warning: ${error.message}`);
  }

  return createdDefinition;
}

/**
 * Update Metafield Definition
 * @param {string} definitionId - Definition ID
 * @param {Object} updates - Fields to update
 * @param {string} updates.name - Name (optional)
 * @param {string} updates.description - Description (optional)
 * @param {Array} updates.validations - Validations (optional)
 * @returns {Promise<Object>} - Updated definition
 */
async function updateMetafieldDefinition(definitionId, updates) {
  const {
    name,
    description = null,
    validations = null,
  } = updates;

  if (!definitionId) {
    throw new Error('Missing required field: definitionId');
  }

  const currentDefinition = await getMetafieldDefinition(definitionId);

  const mutation = `
    mutation UpdateMetafieldDefinition($definition: MetafieldDefinitionUpdateInput!) {
      metafieldDefinitionUpdate(definition: $definition) {
        updatedDefinition {
          id
          name
          namespace
          key
          type {
            name
          }
          ownerType
          description
          validations {
            name
            value
          }
          pinnedPosition
          access {
            admin
            storefront
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    definition: {
      namespace: currentDefinition.namespace,
      key: currentDefinition.key,
      ownerType: currentDefinition.ownerType,
      ...(name && { name }),
      ...(description !== null && { description }),
      ...(validations && { validations }),
      // Note: pinnedPosition and access are only available in Create, not Update
      // They need to be set during creation
    },
  };

  const result = await executeGraphQL(mutation, variables);

  if (result.metafieldDefinitionUpdate.userErrors.length > 0) {
    const errors = result.metafieldDefinitionUpdate.userErrors;
    throw new Error(`User Errors: ${JSON.stringify(errors, null, 2)}`);
  }

  return result.metafieldDefinitionUpdate.updatedDefinition;
}

/**
 * Delete Metafield Definition
 * @param {string} definitionId - Definition ID
 * @returns {Promise<string>} - Deleted definition ID
 */
async function deleteMetafieldDefinition(definitionId) {
  if (!definitionId) {
    throw new Error('Missing required field: definitionId');
  }

  const mutation = `
    mutation DeleteMetafieldDefinition($id: ID!) {
      metafieldDefinitionDelete(id: $id) {
        deletedDefinitionId
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    id: definitionId,
  };

  const result = await executeGraphQL(mutation, variables);

  if (result.metafieldDefinitionDelete.userErrors.length > 0) {
    const errors = result.metafieldDefinitionDelete.userErrors;
    throw new Error(`User Errors: ${JSON.stringify(errors, null, 2)}`);
  }

  return result.metafieldDefinitionDelete.deletedDefinitionId;
}

/**
 * Find Definition ID by name
 * @param {string} name - Metafield name
 * @param {string} namespace - Namespace (default: "custom")
 * @param {string} ownerType - Owner type (default: "PRODUCT")
 * @returns {Promise<string|null>} - Definition ID or null
 */
async function findDefinitionIdByName(name, namespace = 'custom', ownerType = 'PRODUCT') {
  const definitions = await listMetafieldDefinitions(ownerType, namespace);
  const definition = definitions.find(def => def.name === name);
  return definition ? definition.id : null;
}

/**
 * Set Metafield Value on Product
 * @param {string} productId - Product ID (gid://shopify/Product/...)
 * @param {string} namespace - Metafield namespace (default: "custom")
 * @param {string} key - Metafield key
 * @param {string} value - Metafield value
 * @param {string} type - Metafield type (default: "single_line_text_field")
 * @returns {Promise<Object>} - Created/updated metafield
 */
async function setProductMetafield(productId, namespace, key, value, type = 'single_line_text_field') {
  if (!productId || !namespace || !key || value === undefined || value === null) {
    throw new Error('Missing required fields: productId, namespace, key, value');
  }

  const mutation = `
    mutation metafieldSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
          value
          type
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    metafields: [
      {
        ownerId: productId,
        namespace: namespace,
        key: key,
        value: value.toString(),
        type: type,
      }
    ]
  };

  const result = await executeGraphQL(mutation, variables);

  if (result.metafieldsSet.userErrors.length > 0) {
    const errors = result.metafieldsSet.userErrors;
    throw new Error(`User Errors: ${JSON.stringify(errors, null, 2)}`);
  }

  return result.metafieldsSet.metafields[0];
}

module.exports = {
  createMetafieldDefinition,
  updateMetafieldDefinition,
  deleteMetafieldDefinition,
  getMetafieldDefinition,
  listMetafieldDefinitions,
  findDefinitionIdByName,
  setProductMetafield,
};

