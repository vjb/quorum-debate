import { describe, it, expect } from 'vitest';
import { runDebateGraph } from '@/lib/langgraph/graph';
import { DebateState } from '@/lib/langgraph/state';

describe('LangGraph State Machine', () => {
  it('should execute a debate round and transition state', async () => {
    const initialState: typeof DebateState.State = {
      globalTask: 'Reply with exactly the word: "AGREED".',
      agents: [
        { id: 'agent-1', role: 'Responder', personality: 'Concise' }
      ],
      messages: [],
      isConcluded: false,
      turnCount: 0
    };

    // runDebateGraph will execute the state machine using a checkpointer
    const finalState = await runDebateGraph(initialState, 'test-thread-1');
    
    expect(finalState.messages.length).toBeGreaterThan(0);
    expect(finalState.turnCount).toBeGreaterThan(0);
  });
});
