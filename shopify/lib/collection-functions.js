const { executeGraphQL } = require('./graphql-client');
const { publishToAllChannels } = require('./publish-utils');

/**
 * Collection Functions
 * Functions for managing Shopify collections via GraphQL Admin API
 */

/**
 * Create Collection
 * @param {Object} collection - Collection object
 * @param {string} collection.title - Collection title (required)
 * @param {string} collection.descriptionHtml - HTML description (optional)
 * @param {string} collection.handle - URL handle (optional)
 * @param {Object} collection.ruleSet - Rule set for Smart Collection (optional)
 * @param {string} collection.image - Image URL (optional)
 * @returns {Promise<Object>} - Created collection
 */
async function createCollection(collection) {
  const {
    title,
    descriptionHtml = null,
    handle = null,
    ruleSet = null,
    image = null,
  } = collection;

  if (!title) {
    throw new Error('Missing required field: title');
  }

  const mutation = `
    mutation CollectionCreate($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection {
          id
          title
          handle
          description
          descriptionHtml
          image {
            url
            altText
          }
          productsCount {
            count
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
    title,
    ...(descriptionHtml && { descriptionHtml }),
    ...(handle && { handle }),
    ...(ruleSet && { ruleSet }),
    ...(image && { image: { src: image } }),
  };

  const variables = {
    input,
  };

  const result = await executeGraphQL(mutation, variables);

  if (result.collectionCreate.userErrors.length > 0) {
    const errors = result.collectionCreate.userErrors;
    throw new Error(`User Errors: ${JSON.stringify(errors, null, 2)}`);
  }

  const createdCollection = result.collectionCreate.collection;

  // Publish to all sales channels
  try {
    await publishToAllChannels(createdCollection.id);
  } catch (error) {
    console.warn(`⚠️  Warning: Could not publish to all sales channels: ${error.message}`);
  }

  return createdCollection;
}

/**
 * Update Collection
 * @param {string} collectionId - Collection ID (gid://shopify/Collection/...)
 * @param {Object} updates - Fields to update
 * @param {string} updates.title - Collection title (optional)
 * @param {string} updates.descriptionHtml - HTML description (optional)
 * @param {string} updates.handle - URL handle (optional)
 * @param {Object} updates.ruleSet - Rule set for Smart Collection (optional)
 * @param {string} updates.image - Image URL (optional)
 * @returns {Promise<Object>} - Updated collection
 */
async function updateCollection(collectionId, updates) {
  const {
    title = null,
    descriptionHtml = null,
    handle = null,
    ruleSet = null,
    image = null,
  } = updates;

  if (!collectionId) {
    throw new Error('Missing required field: collectionId');
  }

  const mutation = `
    mutation CollectionUpdate($input: CollectionInput!) {
      collectionUpdate(input: $input) {
        collection {
          id
          title
          handle
          description
          descriptionHtml
          image {
            url
            altText
          }
          productsCount {
            count
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
    id: collectionId,
    ...(title && { title }),
    ...(descriptionHtml !== null && { descriptionHtml }),
    ...(handle && { handle }),
    ...(ruleSet && { ruleSet }),
    ...(image && { image: { src: image } }),
  };

  const variables = {
    input,
  };

  const result = await executeGraphQL(mutation, variables);

  if (result.collectionUpdate.userErrors.length > 0) {
    const errors = result.collectionUpdate.userErrors;
    throw new Error(`User Errors: ${JSON.stringify(errors, null, 2)}`);
  }

  return result.collectionUpdate.collection;
}

/**
 * Delete Collection
 * @param {string} collectionId - Collection ID (gid://shopify/Collection/...)
 * @returns {Promise<string>} - Deleted collection ID
 */
async function deleteCollection(collectionId) {
  if (!collectionId) {
    throw new Error('Missing required field: collectionId');
  }

  const mutation = `
    mutation CollectionDelete($input: CollectionDeleteInput!) {
      collectionDelete(input: $input) {
        deletedCollectionId
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      id: collectionId,
    },
  };

  const result = await executeGraphQL(mutation, variables);

  if (result.collectionDelete.userErrors.length > 0) {
    const errors = result.collectionDelete.userErrors;
    throw new Error(`User Errors: ${JSON.stringify(errors, null, 2)}`);
  }

  return result.collectionDelete.deletedCollectionId;
}

/**
 * Find Collection by Title (case-insensitive)
 * @param {string} title - Collection title to find
 * @returns {Promise<Object|null>} - Collection object or null if not found
 */
async function findCollectionByTitle(title) {
  if (!title) {
    throw new Error('Missing required field: title');
  }

  const query = `
    query GetCollections($first: Int!) {
      collections(first: $first) {
        edges {
          node {
            id
            title
            handle
          }
        }
      }
    }
  `;

  const result = await executeGraphQL(query, { first: 250 });
  const collections = result.collections.edges.map(edge => edge.node);
  
  const found = collections.find(
    coll => coll.title.toLowerCase().trim() === title.toLowerCase().trim()
  );

  return found || null;
}

/**
 * Add Product to Collection
 * @param {string} productId - Product ID (gid://shopify/Product/...)
 * @param {string} collectionId - Collection ID (gid://shopify/Collection/...)
 * @returns {Promise<Object>} - Collection object
 */
async function addProductToCollection(productId, collectionId) {
  if (!productId || !collectionId) {
    throw new Error('Missing required fields: productId and collectionId');
  }

  const mutation = `
    mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
      collectionAddProducts(id: $id, productIds: $productIds) {
        collection {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    id: collectionId,
    productIds: [productId],
  };

  const result = await executeGraphQL(mutation, variables);

  if (result.collectionAddProducts.userErrors.length > 0) {
    const errors = result.collectionAddProducts.userErrors;
    throw new Error(`User Errors: ${JSON.stringify(errors, null, 2)}`);
  }

  return result.collectionAddProducts.collection;
}

module.exports = {
  createCollection,
  updateCollection,
  deleteCollection,
  findCollectionByTitle,
  addProductToCollection,
};

