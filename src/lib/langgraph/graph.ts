import { StateGraph, END, START, MemorySaver } from "@langchain/langgraph";
import { DebateState } from "./state";
import { invokeAgent, summarizeDebate } from "./agents";

// To persist across requests, attach to globalThis in dev
const globalAny: any = global;
export const checkpointer = globalAny.__checkpointer || new MemorySaver();
if (process.env.NODE_ENV !== 'production') globalAny.__checkpointer = checkpointer;

/**
 * Creates a dynamic graph where each agent has their own named node.
 * This ensures streaming metadata reflects the specific agent's name.
 */
export function createDebateGraph(agents: any[] = []) {
  const workflow = new StateGraph(DebateState);

  // If no agents provided (e.g. initial setup or error), add a placeholder
  if (agents.length === 0) {
    workflow.addNode("agent", async (state, config) => {
      const agentIndex = state.turnCount % Math.max(state.agents.length, 1);
      return invokeAgent(state, agentIndex, config);
    });
    workflow.addConditionalEdges(START, () => "agent");
    workflow.addConditionalEdges("agent", (state) => {
      if (state.status === 'paused') return END;
      if (state.turnCount >= state.maxTurns || state.isConcluded) return "summarizer";
      return "agent";
    });
  } else {
    // Add a node for each specific agent name
    agents.forEach((agent, i) => {
      const nodeName = agent.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      workflow.addNode(nodeName, async (state, config) => {
        return invokeAgent(state, i, config);
      });
    });

    // Start with the first agent
    const firstNode = agents[0].name.replace(/[^a-zA-Z0-9_-]/g, '_');
    workflow.addEdge(START, firstNode);

    // Add edges between agents to form a circle (Round Robin)
    agents.forEach((agent, i) => {
      const currentNode = agent.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const nextNode = agents[(i + 1) % agents.length].name.replace(/[^a-zA-Z0-9_-]/g, '_');

      workflow.addConditionalEdges(currentNode, (state) => {
        if (state.status === 'paused') return END;
        if (state.turnCount >= state.maxTurns || state.isConcluded) return "summarizer";
        return nextNode;
      });
    });
  }

  workflow.addNode("summarizer", summarizeDebate);
  workflow.addEdge("summarizer", END);

  return workflow.compile({ checkpointer });
}
