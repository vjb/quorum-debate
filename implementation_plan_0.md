# Full-Stack Meta Agent TDD Build Process

This document outlines the complete, end-to-end implementation plan for the Multi-Agent Debate Application ("Quorum Debate"). It covers the architecture, the TDD execution phases, and the self-healing loops required to build the application autonomously.

## 1. Architecture & Directory Structure

### Application Stack
- **Frontend**: Next.js (App Router), React, Tailwind CSS, shadcn/ui, Vercel AI SDK (`@ai-sdk/react` or LangChain native hooks) for robust SSE stream consumption.
- **Backend**: Next.js API Routes (`export const runtime = "nodejs"`), LangGraph.js (with Checkpointing via `MemorySaver` to persist state across page refreshes).
- **LLM Routing**: OpenRouter (via `@langchain/openai`).
- **RAG/Knowledge**: LangChain Document Loaders (`pdf-parse`, `officeparser`), `MemoryVectorStore`.
- **Validation & Security**: Zod (for strict schema validation and enforcing a 5MB file upload limit to prevent memory crashes).
- **Testing**: `Vitest` (Backend), `Playwright` (Frontend E2E).

### Proposed Directories
#### `src/app/` (Frontend & API)
- `page.tsx`: Main dashboard, debate configuration, and arena UI.
- `api/debate/route.ts`: SSE stream, LangGraph initialization, LLM interactions.
#### `src/components/` (UI Components)
- `ui/`: shadcn/ui components.
- `debate/`: Custom components (`AgentConfigCard`, `DebateArena`, `FileUploader`).
#### `src/lib/` (Backend Logic & Utilities)
- `langgraph/state.ts`, `agents.ts`, `graph.ts`: LangGraph workflows and definitions.
- `rag/parser.ts`, `vectorstore.ts`: Document parsing and specific agent memory vector stores.
- `llm/openrouter.ts`: OpenRouter connection with exponential backoff.
- `logger.ts`: Configured `pino` logger.
#### `tests/` & `test-assets/`
- `tests/backend/`: `Vitest` tests (`rag.test.ts`, `graph.test.ts`).
- `tests/e2e/`: `Playwright` tests (`debate-flow.spec.ts`).
- `test-assets/`: Sample files (`FDA_Beverage_Guidelines.pdf`, `OWASP_Top_10_Standards.pdf`, `Pitch_Deck.pptx`, `Whiteboard_Sketch.png`, `Requirements.docx`) generated for live testing and the flagship demo.

---

## 2. Out-Of-The-Box Configuration Examples & Test Data

The following exact examples will be structured as default UI presets and test data for the flagship demo and E2E test suite. During Phase 1, I will generate the necessary dummy files (images, PDFs, DOCX) and place them in the `test-assets` directory to facilitate these scenarios.

### Example 1: The Marketing Compliance Clash
- **Global Task**: "Create a bold marketing campaign and tagline for our new energy drink, 'Nova Surge'."
- **Global Uploads**: An actual image file of a can (`nova_surge_can.png`).
- **Agent 1 (The Creative Director)**: Generates viral marketing copy. No specific uploads.
- **Agent 2 (The Legal Compliance Officer)**: Vetoes claims violating health standards. Specific Upload: A real `FDA_Beverage_Guidelines.pdf`.

### Example 2: The Software Architecture Review
- **Global Task**: "Review this proposed architecture for a real-time ride-sharing application."
- **Global Uploads**: An actual `Whiteboard_Sketch.png` and `Requirements.docx`.
- **Agent 1 (Lead Architect)**: Focuses on system scalability. No specific uploads.
- **Agent 2 (Security Auditor)**: Finds vulnerabilities. Specific Upload: A real `OWASP_Top_10_Standards.pdf`.

### Example 3: Startup Pitch Evaluation
- **Global Task**: "Evaluate this startup pitch for a Series A investment."
- **Global Uploads**: An actual `Pitch_Deck.pptx` to test PowerPoint extraction logic.
- **Agent 1 (The VC Analyst)**: Focuses on market size and traction. No specific uploads.
- **Agent 2 (The Technical Partner)**: Evaluates the tech stack feasibility. Specific Upload: A real `Tech_Architecture.pdf`.

---

## 3. Execution Protocol & Self-Healing Loops

The following phases will be executed sequentially. I will autonomously loop between testing and implementation code until each suite passes 100% cleanly.

### Phase 1: Project Initialization & Setup
- Initialize the Next.js project with Tailwind CSS and App Router.
- Install all necessary dependencies (`@langchain/openai`, `langgraph`, `pdf-parse`, `officeparser`, `pino`, `vitest`, `playwright`, `shadcn/ui`, etc.).
- Create the base directory structure and the `/test-assets` with sample test files.
- Ensure the `.env` file containing OpenRouter credentials is correct and loaded.

### Phase 2: Vitest Suite (Backend & Graph Logic)
- **Action**: Write the `Vitest` tests first.
- **Scope**:
  - Node.js document parsers (`pdf-parse`, `officeparser`).
  - Vector store isolation (Agent A cannot access Agent B's vector store).
  - LangGraph State machine transitions.
- **Constraints**: 100% real OpenRouter API calls using the test assets. ZERO mocking.

### Phase 3: LangGraph & API Implementation (Backend Self-Healing Loop)
- **Action**: Implement the backend routing, RAG logic, and LangGraph workflow.
- **Loop**: 
  1. Execute `vitest run`.
  2. Capture raw output/errors.
  3. Analyze why the implementation failed (e.g., rate limits, parsing errors).
  4. Autonomously fix the implementation code.
  5. Repeat until 100% pass rate.
- **Resilience**: Implement exponential backoff for real-world OpenRouter network realities.

### Phase 4: Playwright Automated UI & Browser Tests
- **Action**: Write the frontend Playwright test suite first.
- **Scope**:
  1. **Global Configuration Test**: Auto-fill "Global Task", upload a real image, assert preview thumbnail.
  2. **RAG Isolation Upload Test**: Select "Compliance Officer", upload `compliance.pdf`, assert isolation UI.
  3. **Live Streaming & UI Test**: Click "Start Debate", hit the real API, wait for real SSE stream, assert progressive rendering and auto-scroll.
  4. **Termination State Test**: Assert UI displays "Debate Concluded" banner when the LLM reaches consensus.

### Phase 5: Frontend Implementation (Frontend Self-Healing Loop)
- **Action**: Build the Next.js UI using shadcn/ui and Tailwind.
- **Loop**:
  1. Execute `npx playwright test`.
  2. Capture raw tracebacks/failures (routing, element not found, stream missing).
  3. Autonomously fix UI components and React state.
  4. Repeat until 100% pass rate.

## User Review Required

> [!IMPORTANT]
> The full roadmap is detailed above. Once you reply with "Approved", I will take over and run this entire process autonomously. You can leave, and I will continue self-healing the implementation against the test suites until the final suite is complete.
