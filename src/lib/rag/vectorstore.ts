import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

// Cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class SimpleMemoryVectorStore {
  private embeddings: OpenAIEmbeddings;
  private documents: { doc: Document; vector: number[] }[] = [];

  constructor(embeddings: OpenAIEmbeddings) {
    this.embeddings = embeddings;
  }

  async addDocuments(docs: Document[]) {
    const texts = docs.map((d) => d.pageContent);
    const vectors = await this.embeddings.embedDocuments(texts);
    for (let i = 0; i < docs.length; i++) {
      this.documents.push({ doc: docs[i], vector: vectors[i] });
    }
  }

  async similaritySearch(query: string, k = 4): Promise<Document[]> {
    const queryVector = await this.embeddings.embedQuery(query);
    const scored = this.documents.map((d) => ({
      doc: d.doc,
      score: cosineSimilarity(queryVector, d.vector),
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((s) => s.doc);
  }

  asRetriever() {
    return {
      invoke: async (query: string) => this.similaritySearch(query),
    };
  }
}

const vectorStores = new Map<string, SimpleMemoryVectorStore>();

export async function createAgentVectorStore(agentId: string): Promise<SimpleMemoryVectorStore> {
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENROUTER_API_KEY,
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
    modelName: "openai/text-embedding-3-small", 
    maxRetries: 0,
  });

  const store = new SimpleMemoryVectorStore(embeddings);
  vectorStores.set(agentId, store);
  return store;
}

export function getAgentRetriever(agentId: string) {
  const store = vectorStores.get(agentId);
  if (!store) {
    throw new Error(`Vector store for agent ${agentId} not found`);
  }
  return store.asRetriever();
}

export function clearAgentVectorStores() {
  vectorStores.clear();
}
