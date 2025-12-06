import { NextRequest, NextResponse } from 'next/server';
import { getCategories, getCategoryTree, createCategory } from '@/lib/queries/categories';
import { syncCategoryToShopify } from '@/lib/shopify/category-sync';
import { z } from 'zod';

const createCategorySchema = z.object({
  name: z.string().min(1),
  parent_id: z.number().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const tree = searchParams.get('tree') === 'true';
    const brandId = parseInt(searchParams.get('brand_id') || '4');

    if (tree) {
      const categories = await getCategoryTree(brandId);
      return NextResponse.json(categories);
    }

    const categories = await getCategories(brandId);
    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createCategorySchema.parse(body);
    const brandId = parseInt(body.brand_id || '4');

    const category = await createCategory(validated, brandId);

    // Auto-sync to Shopify
    try {
      await syncCategoryToShopify(category.id);
    } catch (syncError: any) {
      console.error('Failed to sync category to Shopify:', syncError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json(category, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

