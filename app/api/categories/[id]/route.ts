import { NextRequest, NextResponse } from 'next/server';
import { getCategoryById, updateCategory, deleteCategory } from '@/lib/queries/categories';
import { syncCategoryToShopify, deleteCategoryFromShopify } from '@/lib/shopify/category-sync';
import { z } from 'zod';

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  parent_id: z.number().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
    }

    const category = await getCategoryById(id);
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(category);
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
      return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
    }

    const body = await request.json();
    const validated = updateCategorySchema.parse(body);

    const category = await updateCategory({ id, ...validated });

    // Auto-sync to Shopify
    try {
      await syncCategoryToShopify(category.id);
    } catch (syncError: any) {
      console.error('Failed to sync category to Shopify:', syncError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json(category);
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
      return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
    }

    const searchParams = request.nextUrl.searchParams;
    const brandId = parseInt(searchParams.get('brand_id') || '4');

    // Delete from Shopify first
    try {
      await deleteCategoryFromShopify(id);
    } catch (syncError: any) {
      console.error('Failed to delete category from Shopify:', syncError);
      // Continue with database deletion even if Shopify deletion fails
    }

    await deleteCategory(id, brandId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

