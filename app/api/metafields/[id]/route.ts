import { NextRequest, NextResponse } from 'next/server';
import { getMetafieldById, updateMetafield, deleteMetafield } from '@/lib/queries/metafields';
import { syncMetafieldTypeToShopify, deleteMetafieldFromShopify } from '@/lib/shopify/metafield-sync';
import pool from '@/lib/db';
import { z } from 'zod';

const updateMetafieldSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  value: z.string().optional(),
  description: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid metafield ID' }, { status: 400 });
    }

    const metafield = await getMetafieldById(id);
    if (!metafield) {
      return NextResponse.json({ error: 'Metafield not found' }, { status: 404 });
    }

    return NextResponse.json(metafield);
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
      return NextResponse.json({ error: 'Invalid metafield ID' }, { status: 400 });
    }

    const body = await request.json();
    const validated = updateMetafieldSchema.parse(body);

    // Get current metafield to know the type
    const currentMetafield = await getMetafieldById(id);
    if (!currentMetafield) {
      return NextResponse.json({ error: 'Metafield not found' }, { status: 404 });
    }

    const metafield = await updateMetafield({ id, ...validated });

    // Auto-sync metafield type to Shopify (use updated type if provided, otherwise current type)
    const metafieldType = validated.type || currentMetafield.type;
    
    // Get brand_id from database
    const brandIdResult = await pool.query(
      'SELECT brand_id FROM product_attribute WHERE id = $1',
      [id]
    );
    const brandId = brandIdResult.rows[0]?.brand_id || 4;
    
    try {
      await syncMetafieldTypeToShopify(metafieldType, brandId);
    } catch (syncError: any) {
      console.error('Failed to sync metafield to Shopify:', syncError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json(metafield);
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
      return NextResponse.json({ error: 'Invalid metafield ID' }, { status: 400 });
    }

    // Delete from Shopify first
    try {
      await deleteMetafieldFromShopify(id);
    } catch (syncError: any) {
      console.error('Failed to delete metafield from Shopify:', syncError);
      // Continue with database deletion even if Shopify deletion fails
    }

    await deleteMetafield(id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

