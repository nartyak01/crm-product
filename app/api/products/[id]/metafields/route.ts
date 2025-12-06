import { NextRequest, NextResponse } from 'next/server';
import {
  getProductMetafields,
  setProductMetafield,
  deleteProductMetafield,
} from '@/lib/queries/metafields';
import { z } from 'zod';

const setMetafieldSchema = z.object({
  attribute_id: z.preprocess(
    (val) => {
      if (typeof val === 'string') {
        const num = parseInt(val, 10);
        return isNaN(num) ? val : num;
      }
      return val;
    },
    z.number().int().positive()
  ),
  value: z.string().min(1, 'Value cannot be empty'),
  is_variant_value: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const metafields = await getProductMetafields(productId);
    return NextResponse.json(metafields);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await request.json();
    console.log('📥 [API] POST /api/products/[id]/metafields - Request body:', body);
    console.log('📥 [API] Product ID:', productId);
    
    const validated = setMetafieldSchema.parse(body);
    console.log('✅ [API] Validation passed:', validated);

    const metafield = await setProductMetafield(
      productId,
      validated.attribute_id,
      validated.value,
      validated.is_variant_value || false
    );

    console.log('✅ [API] Metafield created/updated:', metafield);
    return NextResponse.json(metafield);
  } catch (error: any) {
    console.error('❌ [API] Error in POST /api/products/[id]/metafields:', error);
    
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      console.error('❌ [API] Validation errors:', error.errors);
      return NextResponse.json({ 
        error: `Validation failed: ${errorMessages}`,
        details: error.errors 
      }, { status: 400 });
    }
    
    console.error('❌ [API] Database/Server error:', error.message);
    return NextResponse.json({ 
      error: error.message || 'Failed to set product metafield',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const attributeId = parseInt(searchParams.get('attribute_id') || '0');

    if (isNaN(attributeId) || attributeId === 0) {
      return NextResponse.json({ error: 'Invalid attribute ID' }, { status: 400 });
    }

    await deleteProductMetafield(productId, attributeId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

