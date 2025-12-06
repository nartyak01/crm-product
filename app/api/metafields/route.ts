import { NextRequest, NextResponse } from 'next/server';
import { getMetafields, createMetafield, getAllAttributesWithBrandId } from '@/lib/queries/metafields';
import { syncMetafieldTypeToShopify } from '@/lib/shopify/metafield-sync';
import { z } from 'zod';

const createMetafieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  value: z.string().optional(),
  description: z.string().optional(),
});

export async function GET() {
  try {
    const metafields = await getMetafields();
    return NextResponse.json(metafields);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createMetafieldSchema.parse(body);
    const brandId = parseInt(body.brand_id || '4');

    const metafield = await createMetafield(validated, brandId);

    // Auto-sync metafield type to Shopify
    try {
      await syncMetafieldTypeToShopify(validated.type, brandId);
    } catch (syncError: any) {
      console.error('Failed to sync metafield to Shopify:', {
        error: syncError.message,
        stack: syncError.stack,
        type: validated.type,
        brandId,
        metafieldId: metafield.id,
      });
      // Don't fail the request, just log the error
    }

    return NextResponse.json(metafield, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

