import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { DebateState } from "./state";
import { getPineconeStore } from "../rag/pinecone";

export function getChatModel(modelName: string = "openai/gpt-4o-mini") {
  return new ChatOpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    modelName: modelName, 
    temperature: 0.7,
    maxRetries: 0, 
    timeout: 10000, 
    streaming: true,
  });
}

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function invokeAgent(state: typeof DebateState.State, agentIndex: number, config: any) {
  const agent = state.agents[agentIndex];
  const model = getChatModel(agent.model || "openai/gpt-4o-mini");
  const thread_id = config?.configurable?.thread_id;
  
  let additionalContext = "";
  if (thread_id) {
    try {
      const globalStore = await getPineconeStore(`${thread_id}_global`);
      const agentStore = await getPineconeStore(`${thread_id}_agent_${agentIndex}`);
      
      const lastMessage = state.messages[state.messages.length - 1];
      let query = lastMessage && lastMessage.content ? lastMessage.content.toString() : state.globalTask;
      
      // If the query is too short or generic, augment it with the global task
      if (query.length < 20) {
        query = `${state.globalTask} ${query}`;
      }
      
      const globalResults = await globalStore.similaritySearch(query, 5);
      const agentResults = await agentStore.similaritySearch(query, 5);
      
      if (globalResults.length > 0) {
        additionalContext += `\n\n[UPLOADED GLOBAL KNOWLEDGE]:\n${globalResults.map(r => r.pageContent).join('\n')}`;
      }
      if (agentResults.length > 0) {
        additionalContext += `\n\n[YOUR SPECIFIC KNOWLEDGE]:\n${agentResults.map(r => r.pageContent).join('\n')}`;
      }
    } catch (e) {
      console.error("RAG Error", e);
    }
  }

  const globalBriefness = "\n\nCRITICAL: BE CONVERSATIONAL. Address other agents by name (e.g. \"I agree with Alpha, but...\"). Build on their ideas, challenge their assumptions, and drive the discussion toward a final consensus. Do not just list points; engage in a real back-and-forth debate. Keep your response concise (under 150 words). \n\nIMPORTANT: DO NOT start your message with your name or a role prefix (e.g., do not write 'The Facilitator: ...'). Just start speaking. \n\nIMPORTANT: Prioritize the information in the [UPLOADED KNOWLEDGE] sections above if available. If a document is provided, critique and discuss its specific contents.";
  const systemMessage = new SystemMessage(`Your name is ${agent.name}. You are playing the role of ${agent.role}.\n\nYour goal is to collaborate or debate with the other agents to solve the following Global Task: ${state.globalTask}\n\n${additionalContext}${globalBriefness}`);
  
  // Sanitize all message names for provider compatibility
  const sanitizedMessages = state.messages.map(m => {
    if (m.name) m.name = sanitizeName(m.name);
    return m;
  });

  const turnMessages: any[] = [systemMessage];
  if (agent.images && agent.images.length > 0) {
    turnMessages.push(new HumanMessage({
      content: [
        { type: "text", text: "You have been provided with the following visual evidence/context:" },
        ...agent.images
      ]
    }));
  }

  const response = await model.invoke([...turnMessages, ...sanitizedMessages]);
  response.name = sanitizeName(agent.name); // Ensure name is valid for provider
  
  const telemetry = {
    [agent.name]: {
      promptTokens: response.usage_metadata?.input_tokens || 0,
      completionTokens: response.usage_metadata?.output_tokens || 0
    }
  };

  return { messages: [response], turnCount: 1, telemetry };
}

export async function invokeAllAgents(state: typeof DebateState.State, config: any) {
  const promises = state.agents.map((agent, index) => invokeAgent(state, index, config));
  const results = await Promise.all(promises);
  const allMessages = results.flatMap(r => r.messages);
  return { messages: allMessages, turnCount: state.agents.length };
}

export async function evaluateConsensus(state: typeof DebateState.State) {
  const model = getChatModel();
  
  const systemMessage = new SystemMessage(
    `You are the Debate Evaluator. Your job is to listen to the debate. If consensus is reached, or if you have enough information, reply with exactly: "CONSENSUS_REACHED". Otherwise, ask a follow up question to drive the debate forward.`
  );
  
  const allImages = state.agents.flatMap(a => a.images || []);
  const turnMessages: any[] = [systemMessage];
  if (allImages.length > 0) {
    turnMessages.push(new HumanMessage({
      content: [
        { type: "text", text: "The following visual evidence was presented during the debate:" },
        ...allImages
      ]
    }));
  }

  const response = await model.invoke([...turnMessages, ...state.messages]);
  
  const telemetry = {
    "Evaluator": {
      promptTokens: response.usage_metadata?.input_tokens || 0,
      completionTokens: response.usage_metadata?.output_tokens || 0
    }
  };
  
  const text = response.content as string;
  // Note: we no longer set isConcluded here directly. 
  // We let the router decide whether to summarize or keep going.
  // We can set a flag or just return the message. 
  // Wait, if it says CONSENSUS_REACHED, the router will check if the message includes it.
  // Actually, to make routing easy, we can set `isConcluded: true` if it says CONSENSUS_REACHED.
  if (text.includes("CONSENSUS_REACHED")) {
    response.name = sanitizeName("Debate_Evaluator");
    return { isConcluded: true, telemetry, messages: [response] };
  }
  
  response.name = sanitizeName("Debate_Evaluator");
  return { messages: [response], telemetry };
}

import { TOPOLOGIES } from "../topologies";

export async function summarizeDebate(state: typeof DebateState.State) {
  const model = getChatModel();
  
  const topologyDef = TOPOLOGIES[state.topology] || TOPOLOGIES['round-table'];
  const prompt = topologyDef.synthesizerPrompt + `\n\nThe Global Task was: ${state.globalTask}`;
  const globalBriefness = "\n\nCRITICAL: BE EXTREMELY BRIEF. Use compact bullet points only. MINIMIZE WHITE SPACE. No fluff, no intros, no outros.";
  const systemMessage = new SystemMessage(prompt + globalBriefness);
  
  const allImages = state.agents.flatMap(a => a.images || []);
  const turnMessages: any[] = [systemMessage];
  if (allImages.length > 0) {
    turnMessages.push(new HumanMessage({
      content: [
        { type: "text", text: "Final Synthesis includes review of the following visual evidence:" },
        ...allImages
      ]
    }));
  }

  const response = await model.invoke([...turnMessages, ...state.messages]);
  
  const telemetry = {
    "System Synthesizer": {
      promptTokens: response.usage_metadata?.input_tokens || 0,
      completionTokens: response.usage_metadata?.output_tokens || 0
    }
  };

  // We set isConcluded to true just in case, and append the summary message
  // We mutate the response name to 'System Synthesizer' so the UI displays it as such.
  response.name = sanitizeName('System_Synthesizer');
  
  return { messages: [response], telemetry, isConcluded: true, status: 'concluded' };
}
