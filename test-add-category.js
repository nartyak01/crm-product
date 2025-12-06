/**
 * Test script: Add "jewelry" category to product with SKU 555744
 * Run: node test-add-category.js
 * 
 * Note: This script uses environment variables from .env.local
 * Make sure to set them or run from Next.js context
 */

const { Client } = require('pg');

// Load env vars manually (Next.js style)
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

async function testAddCategory() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // 1. Find product by SKU
    const productQuery = `
      SELECT id, sku, name, product_type 
      FROM product 
      WHERE UPPER(TRIM(sku)) = UPPER(TRIM($1))
      LIMIT 1
    `;
    const productResult = await client.query(productQuery, ['555744']);
    
    if (productResult.rows.length === 0) {
      console.error('❌ Product with SKU 555744 not found');
      return;
    }

    const product = productResult.rows[0];
    console.log('📦 Found product:', {
      id: product.id,
      sku: product.sku,
      name: product.name,
      product_type: product.product_type,
    });

    // 2. Find "jewelry" category (with brand_id = 4)
    const categoryQuery = `
      SELECT id, name, brand_id 
      FROM category 
      WHERE UPPER(TRIM(name)) = UPPER(TRIM($1)) 
      AND brand_id = 4
      LIMIT 1
    `;
    const categoryResult = await client.query(categoryQuery, ['jewelry']);
    
    if (categoryResult.rows.length === 0) {
      console.error('❌ Category "jewelry" not found (with brand_id = 4)');
      console.log('💡 Available categories:');
      const allCategories = await client.query(
        'SELECT id, name, brand_id FROM category WHERE brand_id = 4 ORDER BY name'
      );
      allCategories.rows.forEach(cat => {
        console.log(`   - ${cat.name} (id: ${cat.id}, brand_id: ${cat.brand_id})`);
      });
      return;
    }

    const category = categoryResult.rows[0];
    console.log('📁 Found category:', {
      id: category.id,
      name: category.name,
      brand_id: category.brand_id,
    });

    // 3. Check if product already has this category
    const checkQuery = `
      SELECT * FROM product_category 
      WHERE product_id = $1 AND category_id = $2
    `;
    const checkResult = await client.query(checkQuery, [product.id, category.id]);
    
    if (checkResult.rows.length > 0) {
      console.log('ℹ️ Product already has this category');
      return;
    }

    // 4. Add category to product
    const insertQuery = `
      INSERT INTO product_category (product_id, category_id)
      VALUES ($1, $2)
      ON CONFLICT (product_id, category_id) DO NOTHING
      RETURNING *
    `;
    const insertResult = await client.query(insertQuery, [product.id, category.id]);
    
    if (insertResult.rows.length > 0) {
      console.log('✅ Successfully added category "jewelry" to product SKU 555744');
    } else {
      console.log('ℹ️ Category already exists (conflict)');
    }

    // 5. Verify - get all categories for this product
    const verifyQuery = `
      SELECT c.id, c.name, c.brand_id
      FROM category c
      INNER JOIN product_category pc ON c.id = pc.category_id
      WHERE pc.product_id = $1 AND c.brand_id = 4
      ORDER BY c.name
    `;
    const verifyResult = await client.query(verifyQuery, [product.id]);
    console.log('📋 Product categories:', verifyResult.rows.map(c => c.name));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await client.end();
  }
}

testAddCategory();

