import { NextRequest, NextResponse } from 'next/server';
import { getProducts } from '@/lib/queries/products';
import { syncProductToShopify } from '@/lib/shopify/product-sync';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const productIds = body.product_ids as number[] | undefined;
    const limit = parseInt(body.limit || '50');
    const offset = parseInt(body.offset || '0');
    const status = body.status as string | undefined;

    if (productIds && Array.isArray(productIds)) {
      // Sync specific products
      const results = [];

      for (const productId of productIds) {
        try {
          const shopifyProductId = await syncProductToShopify(productId);
          results.push({
            product_id: productId,
            success: true,
            shopify_product_id: shopifyProductId,
          });
        } catch (error: any) {
          results.push({
            product_id: productId,
            success: false,
            error: error.message,
          });
        }
      }

      return NextResponse.json({
        success: true,
        total: productIds.length,
        synced: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      });
    } else {
      // Sync products from query
      const { products } = await getProducts({
        limit,
        offset,
        status,
        product_type: 'jewelry',
      });

      const results = [];

      for (const product of products) {
        try {
          const shopifyProductId = await syncProductToShopify(product.id);
          results.push({
            product_id: product.id,
            product_sku: product.sku,
            product_name: product.name,
            success: true,
            shopify_product_id: shopifyProductId,
          });
        } catch (error: any) {
          results.push({
            product_id: product.id,
            product_sku: product.sku,
            product_name: product.name,
            success: false,
            error: error.message,
          });
        }
      }

      return NextResponse.json({
        success: true,
        total: products.length,
        synced: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

