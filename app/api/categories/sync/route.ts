import { NextRequest, NextResponse } from 'next/server';
import { getCategories } from '@/lib/queries/categories';
import { syncCategoryToShopify } from '@/lib/shopify/category-sync';

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const brandId = parseInt(searchParams.get('brand_id') || '4');
    const categoryId = searchParams.get('category_id');

    if (categoryId) {
      // Sync single category
      const id = parseInt(categoryId);
      if (isNaN(id)) {
        return NextResponse.json({ error: 'Invalid category ID' }, { status: 400 });
      }

      const shopifyCollectionId = await syncCategoryToShopify(id);
      return NextResponse.json({ 
        success: true, 
        category_id: id,
        shopify_collection_id: shopifyCollectionId 
      });
    } else {
      // Sync all categories
      const categories = await getCategories(brandId);
      const results = [];

      for (const category of categories) {
        try {
          const shopifyCollectionId = await syncCategoryToShopify(category.id);
          results.push({
            category_id: category.id,
            category_name: category.name,
            success: true,
            shopify_collection_id: shopifyCollectionId,
          });
        } catch (error: any) {
          results.push({
            category_id: category.id,
            category_name: category.name,
            success: false,
            error: error.message,
          });
        }
      }

      return NextResponse.json({
        success: true,
        total: categories.length,
        synced: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

