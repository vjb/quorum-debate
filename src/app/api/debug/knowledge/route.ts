import { NextRequest, NextResponse } from 'next/server';
import { parseDocument } from '@/lib/rag/parser';
import { getChatModel } from '@/lib/langgraph/agents';
import { HumanMessage } from '@langchain/core/messages';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    let allText = "";
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const tempPath = path.join(os.tmpdir(), `debug_${Date.now()}_${file.name}`);
      fs.writeFileSync(tempPath, buffer);
      
      try {
        const text = await parseDocument(tempPath);
        allText += `\n--- FILE: ${file.name} ---\n${text}\n`;
      } finally {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      }
    }

    if (!allText.trim()) {
      return NextResponse.json({ summary: "DEBUG: No text could be extracted from these files." });
    }

    // Use a Tier 1 model to summarize what was found to prove it "understands"
    const model = getChatModel("openai/gpt-4o");
    const response = await model.invoke([
      new HumanMessage(`You are a technical diagnostic tool. I am providing you with text extracted from a document. 
      Please provide a very brief (2-sentence) summary of the core topic and one specific detail from the text to prove you can read it.
      
      EXTRACTED TEXT:
      ${allText.slice(0, 10000)}`)
    ]);

    return NextResponse.json({ 
      summary: `DIAGNOSTIC SUCCESS\nCharacters Extracted: ${allText.length}\n\nAI VERIFICATION:\n${response.content}` 
    });

  } catch (error: any) {
    console.error("Debug API Error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
