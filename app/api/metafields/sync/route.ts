import { NextRequest, NextResponse } from 'next/server';
import { getAllAttributesWithBrandId } from '@/lib/queries/metafields';
import { syncMetafieldTypeToShopify } from '@/lib/shopify/metafield-sync';

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const brandId = parseInt(searchParams.get('brand_id') || '4');
    const metafieldId = searchParams.get('metafield_id');
    const metafieldType = searchParams.get('type');

    if (metafieldId) {
      // Sync single metafield (by ID)
      const id = parseInt(metafieldId);
      if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid metafield ID' }, { status: 400 });
      }

      // Get metafield to find its type
      const { getMetafieldById } = require('@/lib/queries/metafields');
      const metafield = await getMetafieldById(id);
      
      if (!metafield) {
        return NextResponse.json({ error: 'Metafield not found' }, { status: 404 });
      }

      await syncMetafieldTypeToShopify(metafield.type, brandId);
      
      return NextResponse.json({ 
        success: true, 
        metafield_id: id,
        type: metafield.type
      });
    } else if (metafieldType) {
      // Sync all metafields of a specific type
      await syncMetafieldTypeToShopify(metafieldType, brandId);
      
      return NextResponse.json({ 
        success: true, 
        type: metafieldType
      });
    } else {
      // Sync all metafield types
      const attributes = await getAllAttributesWithBrandId(brandId);
      const uniqueTypes = [...new Set(attributes.map(attr => attr.type))];
      const results = [];

      for (const type of uniqueTypes) {
        try {
          await syncMetafieldTypeToShopify(type, brandId);
          results.push({
            type,
            success: true,
          });
        } catch (error: any) {
          results.push({
            type,
            success: false,
            error: error.message,
          });
        }
      }

      return NextResponse.json({
        success: true,
        total: uniqueTypes.length,
        synced: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

