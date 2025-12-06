import { NextRequest, NextResponse } from 'next/server';
import { updateDiamond, getDiamondByProductId } from '@/lib/queries/diamond';
import { z } from 'zod';

const updateDiamondSchema = z.object({
  shape: z.string().optional(),
  cut_grade: z.string().optional(),
  carat: z.number().min(0).optional(),
  color: z.string().optional(),
  clarity: z.string().optional(),
  grading_lab: z.string().optional(),
  certificate_number: z.string().optional(),
  certificate_path: z.string().optional(),
  image_path: z.string().optional(),
  total_price: z.number().min(0).optional(),
  measurement_length: z.number().min(0).optional(),
  measurement_width: z.number().min(0).optional(),
  measurement_height: z.number().min(0).optional(),
  country: z.string().optional(),
  state_region: z.string().optional(),
  guaranteed_availability: z.boolean().optional(),
  item_id: z.string().optional(),
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

    const diamond = await getDiamondByProductId(productId);
    return NextResponse.json(diamond);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const productId = parseInt(params.id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await request.json();
    const validated = updateDiamondSchema.parse(body);
    
    const diamond = await updateDiamond(productId, validated);
    return NextResponse.json(diamond);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

