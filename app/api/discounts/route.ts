import { NextRequest, NextResponse } from 'next/server';
import { getPromotions, createPromotion, getPromotionCount } from '@/lib/queries/promotions';
import { z } from 'zod';

const createPromotionSchema = z.object({
  promo_code: z.string().min(1),
  promo_name: z.string().min(1),
  promo_type: z.enum(['discount', 'bogo', 'bundle', 'tiered', 'free_shipping']),
  discount_type: z.enum(['products', 'orders']).optional(), // Chỉ dùng khi promo_type = 'discount'
  status: z.enum(['draft', 'active', 'paused', 'expired', 'archived', 'update']).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  usage_limit_total: z.number().nullable().optional(),
  usage_limit_per_customer: z.number().nullable().optional(),
  eligibility_rules: z.any().optional(),
  tenant_id: z.number().optional(),
  created_by: z.number().nullable().optional(),
  discount_rule: z
    .object({
      discount_type: z.enum(['percentage', 'fixed_amount', 'fixed_price', 'free_shipping']),
      discount_value: z.number().nullable().optional(),
      max_discount_amount: z.number().nullable().optional(),
      apply_to: z.enum(['order', 'line_item', 'shipping']),
      allocation_method: z.enum(['across', 'each']).nullable().optional(),
      minimum_purchase_type: z.enum(['none', 'amount', 'quantity']).nullable().optional(),
      minimum_purchase_amount: z.number().nullable().optional(),
      minimum_purchase_quantity: z.number().nullable().optional(),
    })
    .optional(),
  bogo_rule: z
    .object({
      buy_type: z.enum(['quantity', 'amount', 'specific_products']),
      buy_quantity: z.number().nullable().optional(),
      buy_amount: z.number().nullable().optional(),
      buy_product_rules: z.any().optional(),
      get_type: z.enum(['same_product', 'specific_products', 'cheapest', 'any']),
      get_quantity: z.number().optional(),
      get_product_rules: z.any().optional(),
      max_applications_per_order: z.number().nullable().optional(),
    })
    .optional(),
  codes: z
    .array(
      z.object({
        code: z.string(),
        usage_limit: z.number().nullable().optional(),
        expires_at: z.string().nullable().optional(),
      })
    )
    .optional(),
  eligible_products: z
    .array(
      z.object({
        product_id: z.string().nullable().optional(),
        variant_id: z.string().nullable().optional(),
        collection_id: z.string().nullable().optional(),
        product_sku: z.string().nullable().optional(),
        inclusion_type: z.enum(['include', 'exclude']),
        context: z.enum(['buy_side', 'get_side', 'both']).nullable().optional(),
      })
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const promo_type = searchParams.get('promo_type') || undefined;
    const tenant_id = parseInt(searchParams.get('tenant_id') || '1');

    const promotions = await getPromotions({ limit, offset, search, status, promo_type, tenant_id });
    const total = await getPromotionCount({ search, status, promo_type, tenant_id });

    return NextResponse.json({
      promotions,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error('Error fetching promotions:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch promotions from database',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createPromotionSchema.parse(body);

    const promotion = await createPromotion(validated);

    return NextResponse.json(promotion, { status: 201 });
  } catch (error: any) {
    console.error('Error creating promotion:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      {
        error: error.message || 'Failed to create promotion in database',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

