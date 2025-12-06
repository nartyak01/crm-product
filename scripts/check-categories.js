require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

// PostgreSQL connection configuration
const client = new Client({
  host: process.env.POSTGRES_HOST,
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
});

// Check categories in database
async function checkCategories() {
  try {
    console.log('🔌 Connecting to PostgreSQL database...');
    console.log(`   Host: ${process.env.POSTGRES_HOST}`);
    console.log(`   Database: ${process.env.POSTGRES_DB}\n`);
    
    await client.connect();
    console.log('✅ Database connection successful!\n');

    // Check total categories
    const totalResult = await client.query('SELECT COUNT(*) as total FROM category');
    console.log(`📊 Total categories in database: ${totalResult.rows[0].total}\n`);

    // Check categories by brand_id
    const brandStatsResult = await client.query(`
      SELECT 
        brand_id,
        COUNT(*) as count
      FROM category
      GROUP BY brand_id
      ORDER BY brand_id NULLS LAST
    `);
    
    console.log('📈 Categories by brand_id:');
    console.log('─'.repeat(60));
    brandStatsResult.rows.forEach(row => {
      const brandId = row.brand_id === null ? 'NULL' : row.brand_id;
      console.log(`   brand_id = ${brandId}: ${row.count} categories`);
    });
    console.log('');

    // Get all categories with brand_id = 4
    const brand4Result = await client.query(`
      SELECT 
        id,
        name,
        parent_id,
        brand_id
      FROM category
      WHERE brand_id = 4
      ORDER BY name
    `);

    console.log(`📋 Categories with brand_id = 4 (${brand4Result.rows.length} total):`);
    console.log('─'.repeat(80));
    
    if (brand4Result.rows.length === 0) {
      console.log('   ⚠️  No categories found with brand_id = 4');
    } else {
      console.log('   ID    | Name                          | Parent ID | Brand ID');
      console.log('   ' + '─'.repeat(76));
      brand4Result.rows.forEach(cat => {
        const id = String(cat.id).padEnd(7);
        const name = (cat.name || '').padEnd(28);
        const parentId = cat.parent_id === null ? 'NULL' : String(cat.parent_id);
        const parentIdStr = parentId.padEnd(10);
        const brandId = String(cat.brand_id).padEnd(9);
        console.log(`   ${id} | ${name} | ${parentIdStr} | ${brandId}`);
      });
    }
    console.log('');

    // Check category tree structure for brand_id = 4
    const treeResult = await client.query(`
      WITH RECURSIVE category_tree AS (
        -- Root categories (parent_id = 0 or NULL)
        SELECT 
          id,
          name,
          parent_id,
          brand_id,
          0 as level,
          name::text as path
        FROM category
        WHERE brand_id = 4 AND (parent_id = 0 OR parent_id IS NULL)
        
        UNION ALL
        
        -- Child categories
        SELECT 
          c.id,
          c.name,
          c.parent_id,
          c.brand_id,
          ct.level + 1,
          ct.path || ' > ' || c.name::text
        FROM category c
        INNER JOIN category_tree ct ON c.parent_id = ct.id
        WHERE c.brand_id = 4
      )
      SELECT * FROM category_tree
      ORDER BY level, name
    `);

    if (treeResult.rows.length > 0) {
      console.log('🌳 Category Tree Structure (brand_id = 4):');
      console.log('─'.repeat(80));
      treeResult.rows.forEach(cat => {
        const indent = '  '.repeat(cat.level);
        const parentInfo = cat.parent_id ? ` (parent: ${cat.parent_id})` : ' (root)';
        console.log(`   ${indent}${cat.name}${parentInfo}`);
      });
      console.log('');
    }

    // Check categories with NULL brand_id
    const nullBrandResult = await client.query(`
      SELECT COUNT(*) as count
      FROM category
      WHERE brand_id IS NULL
    `);

    if (parseInt(nullBrandResult.rows[0].count) > 0) {
      console.log(`⚠️  Warning: ${nullBrandResult.rows[0].count} categories have NULL brand_id`);
      console.log('   These categories will not be included in filtered queries.\n');
    }

    // Close connection
    await client.end();
    console.log('✅ Connection closed successfully.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  }
}

// Run check
checkCategories();

