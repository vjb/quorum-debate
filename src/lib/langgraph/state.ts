import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  personality?: string;
  model: string;
  images?: any[];
}

export interface TelemetryData {
  promptTokens: number;
  completionTokens: number;
}

export const DebateState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, next) => curr.concat(next),
    default: () => [],
  }),
  turnCount: Annotation<number>({
    reducer: (curr, next) => curr + next,
    default: () => 0,
  }),
  isConcluded: Annotation<boolean>({
    reducer: (curr, next) => next,
    default: () => false,
  }),
  agents: Annotation<AgentConfig[]>({
    reducer: (curr, next) => next,
    default: () => [],
  }),
  globalTask: Annotation<string>({
    reducer: (curr, next) => next,
    default: () => "",
  }),
  status: Annotation<'active' | 'paused' | 'concluded'>({
    reducer: (curr, next) => next,
    default: () => 'active',
  }),
  topology: Annotation<string>({
    reducer: (curr, next) => next,
    default: () => 'round-table',
  }),
  maxTurns: Annotation<number>({
    reducer: (curr, next) => next,
    default: () => 10,
  }),
  telemetry: Annotation<Record<string, TelemetryData>>({
    reducer: (curr, next) => {
      const updated = { ...curr };
      for (const [key, val] of Object.entries(next)) {
        if (!updated[key]) updated[key] = { promptTokens: 0, completionTokens: 0 };
        updated[key].promptTokens += val.promptTokens;
        updated[key].completionTokens += val.completionTokens;
      }
      return updated;
    },
    default: () => ({}),
  }),
  documentNames: Annotation<string[]>({
    reducer: (curr, next) => Array.from(new Set([...curr, ...next])),
    default: () => [],
  })
});
