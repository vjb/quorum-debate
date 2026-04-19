import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';

// Initialize Pinecone client
let pineconeClient: Pinecone | null = null;

export async function getPineconeClient() {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pineconeClient;
}

export async function ensurePineconeIndex() {
  const pc = await getPineconeClient();
  const indexName = 'quorum-debate';
  
  const existingIndexes = await pc.listIndexes();
  const indexExists = existingIndexes.indexes?.some(idx => idx.name === indexName);
  
  if (!indexExists) {
    console.log(`Creating Pinecone index: ${indexName}`);
    await pc.createIndex({
      name: indexName,
      dimension: 1536, // Assuming text-embedding-3-small
      metric: 'cosine',
      spec: { 
        serverless: { 
          cloud: 'aws', 
          region: 'us-east-1' 
        } 
      }
    });
    console.log('Index created successfully. Waiting for it to initialize...');
    // We might need to wait for the index to be ready, but for now we just return.
    // In production, you'd poll index status.
  }
  return pc.Index(indexName);
}

import { logger } from '../utils/logger';

export async function getPineconeStore(namespace: string) {
  logger.debug(`Getting Pinecone store for namespace: ${namespace}`);
  const pineconeIndex = await ensurePineconeIndex();
  
  // Use standard OpenAI for embeddings, using the provided OPENAI_API_KEY
  const embeddings = new OpenAIEmbeddings({
    modelName: 'text-embedding-3-small',
  });

  return new PineconeStore(embeddings, {
    pineconeIndex,
    namespace: namespace, // e.g., threadId_agentId
  });
}
