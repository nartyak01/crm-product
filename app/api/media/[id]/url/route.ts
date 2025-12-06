import { NextRequest, NextResponse } from 'next/server';
import { getMediaById } from '@/lib/queries/media';
import { getPresignedUrl } from '@/lib/vultr-s3';

/**
 * GET /api/media/[id]/url
 * Get presigned URL for media file (valid for 1 hour)
 * Use this when bucket is private
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid media ID' }, { status: 400 });
    }

    const media = await getMediaById(id);
    if (!media) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    // Generate presigned URL (valid for 1 hour)
    const presignedUrl = await getPresignedUrl(media.file_path);
    
    console.log('🔗 [Media URL API] Generated presigned URL for media:', {
      id: media.id,
      fileName: media.file_name,
      expiresIn: '1 hour',
    });

    return NextResponse.json({ 
      url: presignedUrl,
      expiresIn: 3600, // 1 hour in seconds
    });
  } catch (error: any) {
    console.error('❌ [Media URL API] Error generating presigned URL:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to generate presigned URL' 
    }, { status: 500 });
  }
}

