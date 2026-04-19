import { NextRequest, NextResponse } from 'next/server';
import { getPastReflections } from '@/lib/memory/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agentName = searchParams.get('agentName');
  
  if (!agentName) {
    return NextResponse.json({ error: 'agentName is required' }, { status: 400 });
  }

  try {
    const reflections = await getPastReflections(agentName, 5);
    return NextResponse.json({ reflections });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
