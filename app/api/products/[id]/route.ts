import { NextRequest, NextResponse } from 'next/server';
import { getProductById, updateProduct, deleteProduct } from '@/lib/queries/products';
import { z } from 'zod';

const updateProductSchema = z.object({
  sku: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  product_type: z.enum(['standard', 'custom', 'variant', 'set', 'jewelry', 'diamond', 'gemstone']).optional(),
  retail_price: z.number().min(0).optional(),
  sale_price: z.number().min(0).optional(),
  description: z.string().optional(),
  is_pre_order: z.boolean().optional(),
  status: z.enum(['draft', 'publish', 'updated', 'do_not_import']).optional(),
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

    const product = await getProductById(id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      console.error('❌ [API] Invalid product ID:', params.id);
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await request.json();
    console.log('📥 [API] Received PUT request for product:', id);
    console.log('📥 [API] Request body:', body);

    const validated = updateProductSchema.parse(body);
    console.log('✅ [API] Validation passed:', validated);

    console.log('💾 [API] Calling updateProduct query with:', { id, ...validated });
    const product = await updateProduct({ id, ...validated });
    console.log('✅ [API] Product updated in database:', product);

    return NextResponse.json(product);
  } catch (error: any) {
    console.error('❌ [API] Error updating product:', error);
    if (error instanceof z.ZodError) {
      console.error('❌ [API] Validation errors:', error.errors);
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

    const deleted = await deleteProduct(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

