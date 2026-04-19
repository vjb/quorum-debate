import { NextRequest, NextResponse } from 'next/server';
import { createDebateGraph, checkpointer } from '@/lib/langgraph/graph';
import { parseDocument } from '@/lib/rag/parser';
import { getPineconeStore } from '@/lib/rag/pinecone';
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getChatModel } from '@/lib/langgraph/agents';
import { getPastReflections, saveReflection } from '@/lib/memory/db';
import { logger } from '@/lib/utils/logger';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Polyfills for pdf-parse (pdf.js) in Node.js runtime
if (typeof global !== 'undefined' && !global.DOMMatrix) {
  global.DOMMatrix = class DOMMatrix {
    constructor() {}
  } as any;
}
if (typeof global !== 'undefined' && !global.Path2D) {
  global.Path2D = class Path2D {
    constructor() {}
  } as any;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple text splitter (no heavy dependencies)
function splitText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  logger.debug("--- DEBATE API START ---");
  try {
    const formData = await req.formData();
    const globalTask = formData.get('globalTask') as string;
    const agentsStr = formData.get('agents') as string;
    const existingThreadId = formData.get('thread_id') as string;
    const topology = formData.get('topology') as 'round-robin' | 'courtroom' | 'brainstorm' || 'round-robin';
    
    let thread_id = existingThreadId;
    let agents: any[] = [];
    let globalContext = globalTask;
    let imageBlocks: any[] = [];
    let documentNames: string[] = [];

    if (!existingThreadId) {
      if (!globalTask || !agentsStr) {
        return NextResponse.json({ error: 'Missing configuration' }, { status: 400 });
      }

      const agentsConf = JSON.parse(agentsStr) as { name: string, role: string, model: string }[];
      
      // We need the thread_id BEFORE processing files to namespace Pinecone
      thread_id = Math.random().toString(36).substring(7);

      // Process Global Files
    const globalFiles = formData.getAll('globalFiles') as File[];
    logger.debug(`Found ${globalFiles.length} global files to process`);
    const tmpDir = os.tmpdir();

    const globalStore = await getPineconeStore(`${thread_id}_global`);
    
    // For vision

    let allExtractedText = "";
    for (const file of globalFiles) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const tempPath = path.join(tmpDir, file.name);
      fs.writeFileSync(tempPath, buffer);
      
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
        const mimeType = lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg';
        const base64Str = buffer.toString('base64');
        imageBlocks.push({
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${base64Str}` }
        });
        globalContext += `\n\n[Uploaded Image: ${file.name} - See attached image]`;
        continue;
      }
      
      let text = '';
      try {
        text = await parseDocument(tempPath);
      } catch (e: any) {
        logger.error(`Error parsing global file ${file.name}:`, e.message);
      }

      if (text) {
        allExtractedText += `\n--- DOCUMENT: ${file.name} ---\n${text}\n`;
        documentNames.push(file.name);
      }
    }

    if (allExtractedText) {
      const snippet = allExtractedText.slice(0, 10000);
      globalContext = `[PRIMARY DOCUMENT CONTEXT - PRIORITIZE THIS]:\n${snippet}\n\n---\n\nUSER REQUEST: ${globalTask}`;
    }

    // Initialize Agents
    for (let i = 0; i < agentsConf.length; i++) {
      const conf = agentsConf[i];
      const agentFiles = formData.getAll(`agent_${i}_files`) as File[];
      
      const agentStore = await getPineconeStore(`${thread_id}_agent_${i}`);
      let hasFiles = false;
      let agentImages: any[] = [];

      for (const file of agentFiles) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const tempPath = path.join(tmpDir, file.name);
        fs.writeFileSync(tempPath, buffer);
        
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
          const mimeType = lowerName.endsWith('.png') ? 'image/png' : 'image/jpeg';
          const base64Str = buffer.toString('base64');
          agentImages.push({
            type: "image_url",
            image_url: { url: `data:${mimeType};base64,${base64Str}` }
          });
          logger.debug(`Captured image for ${conf.name}: ${file.name}`);
          continue;
        }

        let text = '';
        try {
          text = await parseDocument(tempPath);
        } catch (e: any) {
          logger.error(`Error parsing agent file ${file.name}:`, e.message);
        }

        if (text) {
          documentNames.push(`${file.name} (${conf.name})`);
          hasFiles = true;
        }
      }

      agents.push({
        id: `agent_${i}`,
        name: conf.name,
        role: conf.role + (hasFiles ? `\n\nKnowledge Base:\nYou have access to specific uploaded documents.` : ''),
        model: conf.model || 'openai/gpt-4o-mini',
        images: agentImages
      });
    }
  } // end if !existingThreadId

    // Initialize Graph
    let graphAgents = agents;
    if (existingThreadId) {
      const tempGraph = createDebateGraph();
      const existingState = await tempGraph.getState({ configurable: { thread_id: existingThreadId } });
      if (existingState && existingState.values) {
        graphAgents = existingState.values.agents || [];
      } else {
        return NextResponse.json({ error: 'Session expired or not found. Please click Reset Environment.' }, { status: 404 });
      }
    }

    const graph = createDebateGraph(graphAgents);
    
    // Create SSE Stream
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        const writeEvent = async (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Send thread_id and initial docs immediately
          await writeEvent({ type: 'thread_id', threadId: thread_id, documentNames });

          const initialMessages = imageBlocks && imageBlocks.length > 0 ? [
            new HumanMessage({
              content: [
                { type: "text", text: "Global Task Images Provided:" },
                ...imageBlocks
              ]
            })
          ] : [];

          const maxTurnsValue = parseInt((formData.get('maxTurns') as string) || '5', 10);
          const runStream = await graph.stream(
            existingThreadId ? null : {
              globalTask: globalContext,
              messages: [
                ...initialMessages,
                new HumanMessage(`The debate has been initialized. Our goal is to solve this task: ${globalContext}. Please review any provided knowledge and start the discussion.`)
              ],
              agents: agents,
              topology: topology,
              turnCount: 0,
              maxTurns: maxTurnsValue,
              isConcluded: false,
              status: 'active'
            },
            { configurable: { thread_id }, streamMode: "messages" }
          );

          for await (const chunk of runStream) {
            const [message, metadata] = chunk as [any, any];
            
            // nodeName will now be the actual agent name thanks to dynamic graph nodes
            const nodeName = metadata?.langgraph_node || 'Agent';
            
            let currentAgentId = nodeName;
            if (nodeName === 'summarizer') currentAgentId = 'System_Synthesizer';
            if (nodeName === 'evaluator') currentAgentId = 'Evaluator';
            if (nodeName === 'agent') currentAgentId = 'Agent';

            const content = message.content;
            
            if (content && typeof content === 'string') {
              await writeEvent({
                type: 'message',
                agentId: currentAgentId,
                chunk: content
              });
            }
          }

          // After stream completes, we check if it concluded
          const finalState = await graph.getState({ configurable: { thread_id } });
          logger.debug(`Debate stream finished. Final state retrieved. Telemetry present: ${!!finalState?.values?.telemetry}`);
          
          if (finalState?.values?.telemetry) {
            await writeEvent({ type: 'telemetry', telemetry: finalState.values.telemetry });
          }

          if (finalState?.values?.isConcluded) {
            await writeEvent({ type: 'concluded' });
            
            // Trigger background reflection job
            setTimeout(async () => {
              try {
                const agentsToReflect = finalState.values.agents || agents;
                const transcript = finalState.values.messages.map((m: any) => `${m._getType()}: ${m.content}`).join('\n\n');
                
                for (const agent of agentsToReflect) {
                  const model = getChatModel(agent.model);
                  const reflectionPrompt = [
                    new SystemMessage(`You are ${agent.name}. Reflect on the following debate transcript. Your global task was: ${globalContext}`),
                    new HumanMessage(`Debate Transcript:\n${transcript}\n\nBased on your performance in this debate, provide a 2-3 sentence reflection on what strategies worked, what arguments failed, and how you should adapt your approach in future debates.`)
                  ];
                  const res = await model.invoke(reflectionPrompt);
                  await saveReflection(agent.name, globalContext, res.content as string);
                }
                console.log('Agent reflections saved to episodic memory.');
              } catch (e) {
                console.error('Reflection error:', e);
              }
            }, 100);

          } else {
            await writeEvent({ type: 'concluded' }); // Default conclude if stream ends
          }
        } catch (e: any) {
          console.error('Graph Error:', e);
          fs.writeFileSync(path.join(os.tmpdir(), 'graph_error.txt'), e.stack || e.message);
          await writeEvent({ type: 'error', error: e.message });
        } finally {
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
