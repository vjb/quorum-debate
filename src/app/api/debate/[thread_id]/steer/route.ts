import { NextRequest, NextResponse } from 'next/server';
import { checkpointer } from '@/lib/langgraph/graph';
import { HumanMessage } from '@langchain/core/messages';
import { parseDocument } from '@/lib/rag/parser';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ thread_id: string }> }
) {
  try {
    const { thread_id: threadId } = await params;
    const formData = await req.formData();
    const action = formData.get('action') as string;
    const message = formData.get('message') as string;
    const files = formData.getAll('files') as File[];
    
    const config = { configurable: { thread_id: threadId } };

    const currentState = await checkpointer.get(config);
    if (!currentState) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    if (action === 'pause') {
      await checkpointer.put(config, currentState, { status: 'paused' });
      return NextResponse.json({ success: true, status: 'paused' });
    }

    if (action === 'inject') {
      let imageBlocks: any[] = [];
      let parsedTextContent = '';

      for (const file of files) {
        if (!file.name) continue;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        if (file.type.startsWith('image/')) {
          const base64Image = buffer.toString('base64');
          imageBlocks.push({
            type: "image_url",
            image_url: { url: `data:${file.type};base64,${base64Image}` }
          });
        } else {
          // It's a document, save to temp and parse
          const tempPath = path.join(os.tmpdir(), file.name);
          fs.writeFileSync(tempPath, buffer);
          try {
            const content = await parseDocument(tempPath);
            if (content) {
              parsedTextContent += `\n\n[Injected File: ${file.name}]:\n${content}`;
            }
          } catch (e) {
            console.error(`Failed to parse ${file.name}:`, e);
          }
        }
      }

      const finalMessageContent = message ? `[USER INJECTION]: ${message}${parsedTextContent}` : `[USER INJECTION]: Provide feedback on these files.${parsedTextContent}`;
      
      let messagePayload: any = finalMessageContent;
      if (imageBlocks.length > 0) {
        messagePayload = [
          { type: "text", text: finalMessageContent },
          ...imageBlocks
        ];
      }

      const humanMsg = new HumanMessage({ content: messagePayload });
      
      // We must use updateState to trigger LangGraph's reducers
      const { createDebateGraph } = await import('@/lib/langgraph/graph');
      const graph = createDebateGraph(currentState.values.agents || []);
      
      const currentMax = currentState.values.maxTurns || 10;
      const agentsCount = currentState.values.agents?.length || 2;
      
      // We must pretend this update came from one of the agents so LangGraph
      // re-evaluates the conditional edges and routes to the NEXT agent,
      // rather than blindly continuing to the summarizer if it was already queued.
      const firstAgentNode = (currentState.values.agents?.[0]?.name || 'agent').replace(/[^a-zA-Z0-9_-]/g, '_');
      
      await graph.updateState(config, {
        messages: [humanMsg],
        status: 'active',
        maxTurns: currentMax + agentsCount // Give every agent a chance to respond
      }, firstAgentNode);
      
      return NextResponse.json({ success: true, status: 'active' });
    }

    if (action === 'resume') {
      await checkpointer.put(config, currentState, { status: 'active' });
      return NextResponse.json({ success: true, status: 'active' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    console.error('Steer API Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
