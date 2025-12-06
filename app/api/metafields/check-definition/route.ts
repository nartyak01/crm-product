import { NextRequest, NextResponse } from 'next/server';
import { getMetafieldDefinition } from '../../../../shopify/lib/metafield-functions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const definitionId = body.definition_id;

    if (!definitionId) {
      return NextResponse.json({ error: 'definition_id is required' }, { status: 400 });
    }

    const definition = await getMetafieldDefinition(definitionId);

    if (!definition) {
      return NextResponse.json({ error: 'Metafield definition not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: definition.id,
      name: definition.name,
      pinnedPosition: definition.pinnedPosition,
      access: definition.access,
      isPinned: definition.pinnedPosition !== null && definition.pinnedPosition !== undefined,
      hasCorrectAccess: 
        definition.access?.admin === 'MERCHANT_READ_WRITE' && 
        definition.access?.storefront === 'PUBLIC_READ',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


