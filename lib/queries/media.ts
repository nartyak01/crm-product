import pool from '@/lib/db';
import { Media, CreateMediaInput } from '@/types/database';

export async function getMediaFiles(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  media_type?: 'image' | 'video';
}) {
  const { limit = 50, offset = 0, search, media_type } = params || {};
  
  let query = 'SELECT * FROM media WHERE 1=1';
  const values: any[] = [];
  let paramCount = 0;

  if (search) {
    paramCount++;
    query += ` AND file_name ILIKE $${paramCount}`;
    values.push(`%${search}%`);
  }

  if (media_type) {
    paramCount++;
    query += ` AND media_type = $${paramCount}`;
    values.push(media_type);
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
  values.push(limit, offset);

  const result = await pool.query(query, values);
  return result.rows as Media[];
}

export async function getMediaCount(params?: {
  search?: string;
  media_type?: 'image' | 'video';
}): Promise<number> {
  const { search, media_type } = params || {};
  
  let query = 'SELECT COUNT(*) as total FROM media WHERE 1=1';
  const values: any[] = [];
  let paramCount = 0;

  if (search) {
    paramCount++;
    query += ` AND file_name ILIKE $${paramCount}`;
    values.push(`%${search}%`);
  }

  if (media_type) {
    paramCount++;
    query += ` AND media_type = $${paramCount}`;
    values.push(media_type);
  }

  const result = await pool.query(query, values);
  return parseInt(result.rows[0].total);
}

export async function getMediaById(id: number): Promise<Media | null> {
  const result = await pool.query('SELECT * FROM media WHERE id = $1', [id]);
  return result.rows[0] as Media || null;
}

export async function getMediaByFileUrl(fileUrl: string): Promise<Media | null> {
  const result = await pool.query('SELECT * FROM media WHERE file_url = $1', [fileUrl]);
  return result.rows[0] as Media || null;
}

export async function getMediaByFilePath(filePath: string): Promise<Media | null> {
  const result = await pool.query('SELECT * FROM media WHERE file_path = $1', [filePath]);
  return result.rows[0] as Media || null;
}

export async function createMedia(data: CreateMediaInput & { presigned_url?: string }): Promise<Media> {
  const result = await pool.query(
    `INSERT INTO media (file_name, file_path, file_url, presigned_url, file_type, file_size, media_type, bucket_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.file_name,
      data.file_path,
      data.file_url,
      data.presigned_url || '',
      data.file_type,
      data.file_size,
      data.media_type,
      data.bucket_name,
    ]
  );
  return result.rows[0] as Media;
}

export async function deleteMedia(id: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM media WHERE id = $1 RETURNING id', [id]);
  return result.rows.length > 0;
}


