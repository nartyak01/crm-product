import { NextRequest, NextResponse } from 'next/server';
import { syncDiscountToShopify } from '@/lib/shopify/discount-sync';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid promotion ID' }, { status: 400 });
    }

    console.log('[Sync Discount] Starting sync for discount ID:', id);
    const result = await syncDiscountToShopify(id);
    console.log('[Sync Discount] Sync completed successfully:', JSON.stringify(result, null, 2));

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('[Sync Discount] Error syncing discount to Shopify:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to sync discount to Shopify',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

