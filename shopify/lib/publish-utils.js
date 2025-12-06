const { executeGraphQL } = require('./graphql-client');

/**
 * Publish Utils
 * Functions to publish resources to all available sales channels
 */

/**
 * Get all available publications (sales channels)
 * @returns {Promise<Array>} - Array of publication objects with id and name
 */
async function getPublications() {
  try {
    const query = `
      query GetPublications {
        publications(first: 50) {
          edges {
            node {
              id
              name
            }
          }
        }
      }
    `;

    const result = await executeGraphQL(query);
    const publications = result.publications.edges.map(edge => edge.node);
    
    if (publications.length > 0) {
      console.log(`📋 Found ${publications.length} publication(s): ${publications.map(p => p.name).join(', ')}`);
    } else {
      console.log('ℹ️  No publications found');
    }
    
    return publications;
  } catch (error) {
    console.error(`❌ Failed to get publications: ${error.message}`);
    // If query fails, it might be due to missing read_publications scope
    if (error.message.includes('publications') || error.message.includes('Field')) {
      console.warn(`   Note: read_publications scope may be required`);
    }
    throw error;
  }
}

/**
 * Publish a resource to all available sales channels
 * @param {string} resourceId - ID of the resource to publish (gid://shopify/...)
 * @returns {Promise<Object>} - Published resource
 */
async function publishToAllChannels(resourceId) {
  if (!resourceId) {
    throw new Error('Missing required field: resourceId');
  }

  console.log(`\n📢 Starting publish process for: ${resourceId}`);

  try {
    // Get all publications
    const publications = await getPublications();

    if (publications.length === 0) {
      console.log('ℹ️  No publications found, skipping publish step');
      return null;
    }

    console.log(`📢 Publishing ${resourceId} to ${publications.length} publication(s): ${publications.map(p => p.name).join(', ')}`);

    const mutation = `
      mutation PublishToChannel($id: ID!, $input: [PublicationInput!]!) {
        publishablePublish(id: $id, input: $input) {
          publishable {
            ... on Product {
              id
              title
            }
            ... on Collection {
              id
              title
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    let successCount = 0;
    let failedCount = 0;
    const failedPublications = [];

    // Try publishing all at once first
    const variables = {
      id: resourceId,
      input: publications.map(pub => ({
        publicationId: pub.id,
      })),
    };

    try {
      const result = await executeGraphQL(mutation, variables);

      // Check if result has publishablePublish field
      if (!result || !result.publishablePublish) {
        console.error(`❌ Invalid response from publishablePublish mutation`);
        console.error(`   Response: ${JSON.stringify(result, null, 2)}`);
        throw new Error('Invalid response from publishablePublish mutation');
      }

      if (result.publishablePublish.userErrors && result.publishablePublish.userErrors.length > 0) {
        const errors = result.publishablePublish.userErrors;
        console.error(`❌ Publish errors (all at once): ${JSON.stringify(errors, null, 2)}`);
        
        // Check if error is due to missing permissions
        const hasPermissionError = errors.some(err => 
          err.message && (
            err.message.toLowerCase().includes('permission') ||
            err.message.toLowerCase().includes('scope') ||
            err.message.toLowerCase().includes('access')
          )
        );
        if (hasPermissionError) {
          console.warn(`⚠️  Permission warning: ${errors.map(e => e.message).join(', ')}`);
          console.warn(`   Note: write_publications scope may be required`);
          return null;
        }

        // If publishing all at once fails, try publishing individually
        console.log(`\n⚠️  Publishing all at once failed, trying to publish individually...`);
        
        for (const pub of publications) {
          try {
            const individualVariables = {
              id: resourceId,
              input: [{
                publicationId: pub.id,
              }],
            };

            const individualResult = await executeGraphQL(mutation, individualVariables);

            // Check response
            if (!individualResult || !individualResult.publishablePublish) {
              console.error(`❌ Invalid response when publishing to "${pub.name}"`);
              console.error(`   Response: ${JSON.stringify(individualResult, null, 2)}`);
              failedCount++;
              failedPublications.push({ name: pub.name, error: 'Invalid response' });
              continue;
            }

            if (individualResult.publishablePublish.userErrors && individualResult.publishablePublish.userErrors.length > 0) {
              const individualErrors = individualResult.publishablePublish.userErrors;
              console.error(`❌ Failed to publish to "${pub.name}": ${JSON.stringify(individualErrors, null, 2)}`);
              failedCount++;
              failedPublications.push({ name: pub.name, errors: individualErrors });
            } else {
              console.log(`   ✓ Published to "${pub.name}"`);
              successCount++;
            }
          } catch (error) {
            console.error(`❌ Error publishing to "${pub.name}": ${error.message}`);
            failedCount++;
            failedPublications.push({ name: pub.name, error: error.message });
          }
        }
      } else {
        // Success - all published at once
        console.log(`✅ Published to ${publications.length} sales channels: ${publications.map(p => p.name).join(', ')}`);
        return result.publishablePublish.publishable;
      }
    } catch (error) {
      console.error(`❌ Failed to publish (all at once): ${error.message}`);
      console.error(`   Full error: ${JSON.stringify(error, null, 2)}`);
      
      // Fallback: try publishing individually
      console.log(`\n⚠️  Trying to publish individually...`);
      
      for (const pub of publications) {
        try {
          const individualVariables = {
            id: resourceId,
            input: [{
              publicationId: pub.id,
            }],
          };

          const individualResult = await executeGraphQL(mutation, individualVariables);

          // Check response
          if (!individualResult || !individualResult.publishablePublish) {
            console.error(`❌ Invalid response when publishing to "${pub.name}"`);
            console.error(`   Response: ${JSON.stringify(individualResult, null, 2)}`);
            failedCount++;
            failedPublications.push({ name: pub.name, error: 'Invalid response' });
            continue;
          }

          if (individualResult.publishablePublish.userErrors && individualResult.publishablePublish.userErrors.length > 0) {
            const individualErrors = individualResult.publishablePublish.userErrors;
            console.error(`❌ Failed to publish to "${pub.name}": ${JSON.stringify(individualErrors, null, 2)}`);
            failedCount++;
            failedPublications.push({ name: pub.name, errors: individualErrors });
          } else {
            console.log(`   ✓ Published to "${pub.name}"`);
            successCount++;
          }
        } catch (error) {
          console.error(`❌ Error publishing to "${pub.name}": ${error.message}`);
          failedCount++;
          failedPublications.push({ name: pub.name, error: error.message });
        }
      }
    }

    // Summary
    if (successCount > 0 || failedCount > 0) {
      console.log(`\n📊 Publish Summary:`);
      console.log(`   ✅ Success: ${successCount}/${publications.length}`);
      console.log(`   ❌ Failed: ${failedCount}/${publications.length}`);
      
      if (failedPublications.length > 0) {
        console.log(`\n❌ Failed Publications:`);
        failedPublications.forEach(({ name, errors, error }) => {
          if (errors) {
            console.log(`   - ${name}: ${JSON.stringify(errors)}`);
          } else {
            console.log(`   - ${name}: ${error}`);
          }
        });
      }
    }

    if (successCount === 0) {
      throw new Error(`Failed to publish to any publication. All ${publications.length} publication(s) failed.`);
    }

    if (successCount === publications.length) {
      console.log(`\n✅ Successfully published to all ${publications.length} sales channels!`);
    } else {
      console.log(`\n⚠️  Published to ${successCount}/${publications.length} sales channels (${failedCount} failed)`);
    }

    return { successCount, failedCount, failedPublications };
  } catch (error) {
    // Log full error for debugging
    console.error(`❌ Failed to publish ${resourceId}: ${error.message}`);
    if (error.message.includes('publishablePublish') || error.message.includes('Field')) {
      console.error(`   This may indicate the mutation is not available or format is incorrect`);
      console.error(`   Full error: ${JSON.stringify(error, null, 2)}`);
    }
    throw error;
  }
}

module.exports = {
  getPublications,
  publishToAllChannels,
};

