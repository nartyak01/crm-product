import { NextRequest, NextResponse } from 'next/server';
import {
  getProductCategories,
  assignCategoryToProduct,
  removeCategoryFromProduct,
} from '@/lib/queries/categories';
import { z } from 'zod';

const assignCategorySchema = z.object({
  category_id: z.number(),
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

    const categories = await getProductCategories(productId);
    return NextResponse.json(categories);
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
      console.error('❌ [API] Invalid product ID:', params.id);
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await request.json();
    console.log('📥 [API] POST /api/products/[id]/categories - Request body:', body);
    console.log('📥 [API] Product ID:', productId);

    // Validate and parse category_id
    let categoryId: number;
    if (typeof body.category_id === 'number') {
      categoryId = body.category_id;
    } else if (typeof body.category_id === 'string') {
      categoryId = parseInt(body.category_id);
      if (isNaN(categoryId)) {
        console.error('❌ [API] Invalid category_id format:', body.category_id);
        return NextResponse.json({ 
          error: 'Invalid category_id. Must be a number.',
          received: body.category_id,
          type: typeof body.category_id
        }, { status: 400 });
      }
    } else {
      console.error('❌ [API] Missing or invalid category_id:', body);
      return NextResponse.json({ 
        error: 'category_id is required and must be a number',
        received: body
      }, { status: 400 });
    }

    console.log('✅ [API] Validated category_id:', categoryId);
    await assignCategoryToProduct(productId, categoryId);

    console.log('✅ [API] Category assigned successfully');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ [API] Error in POST /api/products/[id]/categories:', error);
    if (error instanceof z.ZodError) {
      console.error('❌ [API] Zod validation errors:', error.errors);
      return NextResponse.json({ 
        error: 'Validation failed',
        details: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      }, { status: 400 });
    }
    return NextResponse.json({ 
      error: error.message || 'Failed to assign category',
      details: error.stack
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
    const categoryId = parseInt(searchParams.get('category_id') || '0');

    if (isNaN(categoryId) || categoryId === 0) {
      return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
    }

    await removeCategoryFromProduct(productId, categoryId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

