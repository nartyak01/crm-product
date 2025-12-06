import { NextRequest, NextResponse } from 'next/server';
import { getProducts, createProduct, getProductCount } from '@/lib/queries/products';
import { z } from 'zod';

const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  product_type: z.enum(['jewelry', 'diamond', 'gemstone']).optional(),
  retail_price: z.number().min(0).optional(),
  sale_price: z.number().min(0).optional(),
  description: z.string().optional(),
  is_pre_order: z.boolean().optional(),
  status: z.enum(['draft', 'publish', 'updated', 'do_not_import']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const product_type = searchParams.get('product_type') || undefined;
    // Mặc định lấy sản phẩm có brand_id = 4
    const brand_id = parseInt(searchParams.get('brand_id') || '4');

    // Lấy dữ liệu từ PostgreSQL database (được cấu hình trong .env.local)
    const products = await getProducts({ limit, offset, search, status, product_type, brand_id });
    const total = await getProductCount({ search, status, product_type, brand_id });

    return NextResponse.json({
      products,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch products from database',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createProductSchema.parse(body);

    // Tạo sản phẩm mới trong PostgreSQL database (được cấu hình trong .env.local)
    const product = await createProduct(validated);

    return NextResponse.json(product, { status: 201 });
  } catch (error: any) {
    console.error('Error creating product:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create product in database',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }, 
      { status: 500 }
    );
  }
}

