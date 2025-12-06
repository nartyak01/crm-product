import { NextRequest, NextResponse } from 'next/server';
import { getMediaFiles, getMediaCount } from '@/lib/queries/media';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || undefined;
    const media_type = searchParams.get('media_type') as 'image' | 'video' | undefined;

    const media = await getMediaFiles({ limit, offset, search, media_type });
    const total = await getMediaCount({ search, media_type });

    return NextResponse.json({
      media,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('Error fetching media:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch media from database',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
}


