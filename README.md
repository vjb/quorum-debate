# Quorum Debate Protocol

## Architecture Overview

Quorum Debate is a multi-agent evaluation engine engineered to process documents and orchestrate deterministic dialogue between language models. The architecture utilizes Next.js for the frontend client, LangGraph for state machine execution, and OpenRouter for model inference routing. 

The system implements a Direct Context Injection strategy. When a user uploads a PDF or supported document, a dedicated Node.js background process extracts the binary data and parses the text. The first 10,000 characters are injected into the global context of the state graph, establishing a shared ground truth for the participating agents.

![Quorum Debate Interface - View 1](./public/screenshot1.png)

## Core Mechanisms

### State Graph Routing
The orchestration layer is built on LangGraph. The debate is modeled as a cyclic state machine. The state object (`DebateState`) tracks the `turnCount`, active `messages`, and the array of `agents`. Conditional edges determine routing based on `turnCount` evaluated against the `maxTurns` integer. When the threshold is reached, execution routes to the `summarizer` node for consensus aggregation.

### Asynchronous Steering
The protocol supports human-in-the-loop interjections via the `/api/debate/[thread_id]/steer` endpoint. When a user injects a payload, the system utilizes the `asNode` parameter within LangGraph's `updateState` function. This forces the state machine to re-evaluate its conditional edges as if an agent node had just completed execution, ensuring the human message is processed by the next sequential agent in the topology rather than routing directly to the summarizer.

![Quorum Debate Interface - View 2](./public/screenshot2.png)

## Step 0: Environment Configuration

Before executing the local server, the environment must be configured. 

Duplicate the `.env.example` file and rename it to `.env`. Populate all keys with valid credentials. The `.env.example` file contains specific requirements for the OpenRouter and OpenAI credentials. The application requires these keys to instantiate the execution endpoints.

## Installation and Execution

1. Install package dependencies:
```bash
npm install
```

2. Execute the local development server:
```bash
npm run dev
```

3. Access the interface at `http://localhost:3000`.

## Known Limitations & Future Work

* **Context Window Truncation:** The system relies on a rigid 10,000-character slice for Direct Context Injection. Documents exceeding this limit are truncated. Future iterations require an event-driven fallback to local embedding models for chunked vector retrieval.
* **Synchronous Parsing Overhead:** The PDF extraction executes a blocking Node.js sub-process. High-volume concurrent uploads will degrade server response times. Moving extraction to a dedicated worker pool is necessary for horizontal scaling.
* **State Mutation Risks:** The human interjection protocol modifies the `maxTurns` integer dynamically. In highly nested topologies, this could cause race conditions if multiple users interject concurrently on the same session state.

![Quorum Debate Interface - View 3](./public/screenshot3.png)
