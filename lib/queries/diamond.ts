import pool from '@/lib/db';

export async function getDiamondByProductId(productId: number) {
  const result = await pool.query(
    'SELECT * FROM diamond WHERE product_id = $1 LIMIT 1',
    [productId]
  );
  return result.rows[0] || null;
}

export async function updateDiamond(productId: number, updates: any) {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 0;

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      paramCount++;
      fields.push(`${key} = $${paramCount}`);
      values.push(value);
    }
  });

  if (fields.length === 0) {
    return await getDiamondByProductId(productId);
  }

  // Check if diamond exists
  const existing = await getDiamondByProductId(productId);
  
  if (existing) {
    // Update existing
    paramCount++;
    values.push(productId);
    
    const result = await pool.query(
      `UPDATE diamond SET ${fields.join(', ')}, updated_at = now()
       WHERE product_id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0];
  } else {
    // Create new diamond record
    const insertFields = ['product_id', ...Object.keys(updates).filter(k => updates[k] !== undefined && updates[k] !== null && updates[k] !== '')];
    const insertValues = [productId, ...Object.values(updates).filter(v => v !== undefined && v !== null && v !== '')];
    const placeholders = insertValues.map((_, i) => `$${i + 1}`).join(', ');
    
    const result = await pool.query(
      `INSERT INTO diamond (${insertFields.join(', ')}, created_at, updated_at)
       VALUES (${placeholders}, now(), now())
       RETURNING *`,
      insertValues
    );
    return result.rows[0];
  }
}

