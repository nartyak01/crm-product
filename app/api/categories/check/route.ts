import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    // Check total categories
    const totalResult = await pool.query('SELECT COUNT(*) as total FROM category');
    const total = parseInt(totalResult.rows[0].total);

    // Check categories by brand_id
    const brandStatsResult = await pool.query(`
      SELECT 
        brand_id,
        COUNT(*) as count
      FROM category
      GROUP BY brand_id
      ORDER BY brand_id NULLS LAST
    `);

    // Get all categories with brand_id = 4
    const brand4Result = await pool.query(`
      SELECT 
        id,
        name,
        parent_id,
        brand_id
      FROM category
      WHERE brand_id = 4
      ORDER BY name
    `);

    // Check category tree structure for brand_id = 4
    const treeResult = await pool.query(`
      WITH RECURSIVE category_tree AS (
        -- Root categories (parent_id IS NULL)
        SELECT 
          id,
          name,
          parent_id,
          brand_id,
          0 as level,
          name::text as path
        FROM category
        WHERE brand_id = 4 AND parent_id IS NULL
        
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

    // Check categories with NULL brand_id
    const nullBrandResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM category
      WHERE brand_id IS NULL
    `);

    return NextResponse.json({
      summary: {
        total: total,
        brand4Count: brand4Result.rows.length,
        nullBrandCount: parseInt(nullBrandResult.rows[0].count),
      },
      byBrand: brandStatsResult.rows.map(row => ({
        brand_id: row.brand_id === null ? 'NULL' : row.brand_id,
        count: parseInt(row.count),
      })),
      brand4Categories: brand4Result.rows.map(cat => ({
        id: cat.id,
        name: cat.name,
        parent_id: cat.parent_id,
        brand_id: cat.brand_id,
      })),
      brand4Tree: treeResult.rows.map(cat => ({
        id: cat.id,
        name: cat.name,
        parent_id: cat.parent_id,
        level: cat.level,
        path: cat.path,
      })),
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

