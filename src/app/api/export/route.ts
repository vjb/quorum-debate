import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { messages, telemetry, threadId, globalTask, topology } = await req.json();
    
    const exportData = {
      sessionId: threadId,
      timestamp: new Date().toISOString(),
      topology,
      globalTask,
      telemetry,
      transcript: messages.map((m: any) => ({
        agent: m.agentId,
        text: m.text
      }))
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="debate_audit_${threadId || 'export'}.json"`
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
