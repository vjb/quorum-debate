import { describe, it, expect } from 'vitest';
import path from 'path';
import { parseDocument } from '@/lib/rag/parser';
import { createAgentVectorStore, getAgentRetriever } from '@/lib/rag/vectorstore';

describe('RAG & Knowledge Base', () => {
  const assetsDir = path.resolve(__dirname, '../../test-assets');

  describe('Document Parser', () => {
    it('should extract text from a PDF file', async () => {
      const filePath = path.join(assetsDir, 'FDA_Beverage_Guidelines.pdf');
      const text = await parseDocument(filePath);
      expect(text).toContain('FDA mandates 0g of sugar');
    });

    it('should extract text from a DOCX file', async () => {
      const filePath = path.join(assetsDir, 'Requirements.docx');
      const text = await parseDocument(filePath);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(0);
    });
  });

  describe('Vector Store Isolation', () => {
    it('should isolate knowledge between agents', async () => {
      const agent1Id = 'agent-creative';
      const agent2Id = 'agent-legal';

      const store1 = await createAgentVectorStore(agent1Id);
      const store2 = await createAgentVectorStore(agent2Id);

      await store1.addDocuments([{ pageContent: 'Nova Surge is a cool drink.', metadata: {} }]);
      await store2.addDocuments([{ pageContent: 'FDA mandates 0g of sugar.', metadata: {} }]);

      const retriever1 = getAgentRetriever(agent1Id);
      const retriever2 = getAgentRetriever(agent2Id);

      const results1 = await retriever1.invoke('sugar');
      // Agent 1 shouldn't know about the FDA sugar mandate
      expect(results1[0].pageContent).not.toContain('FDA mandates');

      const results2 = await retriever2.invoke('sugar');
      // Agent 2 should know about it
      expect(results2.length).toBeGreaterThan(0);
      expect(results2[0].pageContent).toContain('FDA mandates');
    });
  });
});
