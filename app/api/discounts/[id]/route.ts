import { NextRequest, NextResponse } from 'next/server';
import { getPromotionById, updatePromotion, deletePromotion } from '@/lib/queries/promotions';
import { z } from 'zod';

const updatePromotionSchema = z.object({
  promo_code: z.string().min(1).optional(),
  promo_name: z.string().min(1).optional(),
  promo_type: z.enum(['discount', 'bogo', 'bundle', 'tiered', 'free_shipping']).optional(),
  discount_type: z.enum(['products', 'orders']).optional(), // Chỉ dùng khi promo_type = 'discount'
  status: z.enum(['draft', 'active', 'paused', 'expired', 'archived', 'update']).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  usage_limit_total: z.number().nullable().optional(),
  usage_limit_per_customer: z.number().nullable().optional(),
  eligibility_rules: z.any().optional(),
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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid promotion ID' }, { status: 400 });
    }

    const promotion = await getPromotionById(id);
    if (!promotion) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    }

    return NextResponse.json(promotion);
  } catch (error: any) {
    console.error('Error fetching promotion:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch promotion from database',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid promotion ID' }, { status: 400 });
    }

    const body = await request.json();
    const validated = updatePromotionSchema.parse(body);

    const promotion = await updatePromotion({ id, ...validated });

    return NextResponse.json(promotion);
  } catch (error: any) {
    console.error('Error updating promotion:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json(
      {
        error: error.message || 'Failed to update promotion in database',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid promotion ID' }, { status: 400 });
    }

    const deleted = await deletePromotion(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Promotion not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting promotion:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to delete promotion from database',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

