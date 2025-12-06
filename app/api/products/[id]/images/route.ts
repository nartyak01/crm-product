import { NextRequest, NextResponse } from 'next/server';
import {
  getProductImages,
  createOrUpdateProductImage,
  updateProductThumbnail,
  updateProductGallery,
  deleteProductImage,
} from '@/lib/queries/images';
import { getMediaByFileUrl, getMediaByFilePath } from '@/lib/queries/media';
import { getPresignedUrl } from '@/lib/vultr-s3';
import { z } from 'zod';

// Helper function to extract file_path from Vultr URL
function extractFilePathFromVultrUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  // Format: https://endpoint/bucket/filePath
  const pattern = /^https?:\/\/[^\/]+\/[^\/]+\/(.+)$/;
  const match = url.match(pattern);
  return match && match.length >= 2 ? match[1] : null;
}

// Helper function to get presigned URL from media table
// URL can be either file_url or presigned_url
async function getPresignedUrlFromMedia(url: string): Promise<string | null> {
  if (!url || typeof url !== 'string') return null;
  
  try {
    // First, try to find media record by file_url
    let media = await getMediaByFileUrl(url);
    
    // If not found and URL looks like a Vultr URL, try to extract file_path and find by file_path
    if (!media && url.includes('vultrobjects.com')) {
      const filePath = extractFilePathFromVultrUrl(url);
      if (filePath) {
        console.log('🔄 [Presigned URL] URL is Vultr URL, extracting file_path:', filePath);
        media = await getMediaByFilePath(filePath);
      }
    }
    
    if (media) {
      // If media has presigned_url, use it (but check if it's still valid - for now just use it)
      if (media.presigned_url) {
        console.log('✅ [Presigned URL] Found presigned URL in media table');
        return media.presigned_url;
      }
      
      // If media found but no presigned_url, generate new one
      if (media.file_path) {
        console.log('🔄 [Presigned URL] Generating new presigned URL for:', media.file_path);
        try {
          const newPresignedUrl = await getPresignedUrl(media.file_path);
          // Update media record with new presigned URL
          const pool = (await import('@/lib/db')).default;
          await pool.query(
            'UPDATE media SET presigned_url = $1 WHERE id = $2',
            [newPresignedUrl, media.id]
          );
          console.log('✅ [Presigned URL] Generated and saved new presigned URL');
          return newPresignedUrl;
        } catch (error: any) {
          console.warn('⚠️ [Presigned URL] Failed to generate new presigned URL:', error.message);
        }
      }
    } else {
      console.warn('⚠️ [Presigned URL] Media record not found for URL:', url);
    }
  } catch (error: any) {
    console.warn('⚠️ [Presigned URL] Error finding media record:', error.message);
  }
  
  return null;
}

const updateImageSchema = z.object({
  thumbnail: z.string().optional(),
  gallery: z.union([z.string(), z.array(z.string())]).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const images = await getProductImages(id);
    return NextResponse.json(images);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await request.json();
    const validated = updateImageSchema.parse(body);

    // Get presigned URLs from media table if available
    // Handle both update and remove (empty string/array)
    let thumbnailUrl: string | undefined;
    let galleryUrls: string[] = [];

    // Thumbnail: check if provided (even if empty string to remove)
    if (validated.thumbnail !== undefined) {
      if (validated.thumbnail) {
        // Has value: get presigned URL
        const presignedUrl = await getPresignedUrlFromMedia(validated.thumbnail);
        thumbnailUrl = presignedUrl || validated.thumbnail;
      } else {
        // Empty string: remove thumbnail
        thumbnailUrl = '';
      }
    }

    // Gallery: check if provided (even if empty array to remove)
    if (validated.gallery !== undefined) {
      const galleryArray = Array.isArray(validated.gallery) 
        ? validated.gallery 
        : (typeof validated.gallery === 'string' ? JSON.parse(validated.gallery) : []);
      
      if (Array.isArray(galleryArray) && galleryArray.length > 0) {
        // Has images: get presigned URLs
        galleryUrls = await Promise.all(
          galleryArray.map(async (url: string) => {
            const presignedUrl = await getPresignedUrlFromMedia(url);
            return presignedUrl || url;
          })
        );
      } else {
        // Empty array: remove gallery
        galleryUrls = [];
      }
    }

    // Update images (handle both update and remove)
    if (validated.thumbnail !== undefined && validated.gallery !== undefined) {
      // Both provided: update both
      const images = await createOrUpdateProductImage(
        id,
        thumbnailUrl || '',
        JSON.stringify(galleryUrls)
      );
      return NextResponse.json(images);
    } else if (validated.thumbnail !== undefined) {
      // Only thumbnail provided: update thumbnail (can be empty to remove)
      const images = await updateProductThumbnail(id, thumbnailUrl || '');
      return NextResponse.json(images);
    } else if (validated.gallery !== undefined) {
      // Only gallery provided: update gallery (can be empty array to remove)
      const images = await updateProductGallery(id, JSON.stringify(galleryUrls));
      return NextResponse.json(images);
    }

    return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    await deleteProductImage(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

