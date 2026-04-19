import { NextRequest, NextResponse } from 'next/server';
import { createDebateGraph } from '@/lib/langgraph/graph';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: Promise<{ thread_id: string }> }) {
  try {
    const { thread_id: threadId } = await params;
    if (!threadId) {
      return NextResponse.json({ error: 'Missing thread_id' }, { status: 400 });
    }

    const app = createDebateGraph();
    const config = { configurable: { thread_id: threadId } };
    
    // Get the checkpointed state
    const state = await app.getState(config);

    if (!state || !state.values) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    // Return the messages and status to hydrate the UI
    const values = state.values as any;
    
    // Format messages for the UI
    const formattedMessages = (values.messages || []).map((msg: any) => {
      // Find the agent ID from the message name if possible
      const agentId = msg.name || (msg.additional_kwargs && msg.additional_kwargs.name) || 'Agent';
      return {
        agentId: agentId,
        text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      };
    });

    return NextResponse.json({
      messages: formattedMessages,
      isConcluded: !!values.isConcluded,
      globalTask: values.globalTask || '',
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
