/**
 * Shopify GraphQL Client
 * Shared utilities for executing GraphQL queries/mutations to Shopify Admin API
 * 
 * Note: Next.js automatically loads .env.local, so we use process.env directly
 */

// Shopify API Configuration
// Next.js automatically loads .env.local for server-side code
const SHOPIFY_STORE = process.env.SHOPIFY_STORE || '';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-10';

// GraphQL endpoint
const SHOPIFY_GRAPHQL_URL = `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

/**
 * Generate curl command from GraphQL query and variables
 */
function generateCurlCommand(query, variables = {}) {
  const body = JSON.stringify({ query, variables }, null, 2);
  const escapedBody = body.replace(/'/g, "'\\''");
  
  return `curl -X POST \\
  "${SHOPIFY_GRAPHQL_URL}" \\
  -H "Content-Type: application/json" \\
  -H "X-Shopify-Access-Token: ${SHOPIFY_ACCESS_TOKEN}" \\
  -d '${escapedBody}'`;
}

/**
 * Execute GraphQL query/mutation
 * @param {string} query - GraphQL query/mutation string
 * @param {Object} variables - Variables for the query
 * @param {boolean} showCurl - Whether to display curl command before executing
 * @returns {Promise<Object>} - GraphQL response data
 */
async function executeGraphQL(query, variables = {}, showCurl = false) {
  if (!SHOPIFY_STORE || !SHOPIFY_ACCESS_TOKEN) {
    throw new Error('❌ Missing Shopify credentials. Please set SHOPIFY_STORE and SHOPIFY_ACCESS_TOKEN in .env.local');
  }

  // Display curl command if requested
  if (showCurl) {
    console.log('\n📋 Equivalent curl command:');
    console.log('─'.repeat(80));
    console.log(generateCurlCommand(query, variables));
    console.log('─'.repeat(80));
    console.log('');
  }

  try {
    const response = await fetch(SHOPIFY_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    // Check HTTP status
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText}`);
    }

    const data = await response.json();

    if (data.errors) {
      const errorDetails = {
        errors: data.errors,
        response: data,
      };
      console.error('GraphQL Error Details:', JSON.stringify(errorDetails, null, 2));
      throw new Error(`GraphQL Error: ${JSON.stringify(data.errors, null, 2)}`);
    }

    if (!data.data) {
      throw new Error(`Invalid response: No data field in response. Response: ${JSON.stringify(data, null, 2)}`);
    }

    return data.data;
  } catch (error) {
    // Preserve original error message
    if (error.message) {
      throw error;
    }
    throw new Error(`Request failed: ${error.message}`);
  }
}

module.exports = {
  executeGraphQL,
  generateCurlCommand,
  SHOPIFY_GRAPHQL_URL,
  SHOPIFY_API_VERSION,
};

