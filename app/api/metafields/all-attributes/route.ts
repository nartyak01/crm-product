import { NextRequest, NextResponse } from 'next/server';
import { getAllAttributesWithBrandId } from '@/lib/queries/metafields';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const brandId = parseInt(searchParams.get('brand_id') || '4');
    
    const attributes = await getAllAttributesWithBrandId(brandId);
    return NextResponse.json(attributes);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

