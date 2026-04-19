# Quorum Debate Protocol

## Architecture Overview

Quorum Debate is a multi-agent evaluation engine engineered to process documents and orchestrate structured, sequential dialogue between language models. The architecture utilizes Next.js for the frontend client, LangGraph for state machine execution, and OpenRouter for model inference routing. 

The system implements a Direct Context Injection strategy. When a user uploads a PDF or supported document, a dedicated Node.js background process extracts the binary data and parses the text. The extracted text is injected into the global context of the state graph, establishing a shared ground truth for the participating agents.

![Phase 1: Initial Configuration Interface](./public/screenshots/1.png)
*Figure 1: The initial configuration interface where users define the global objective, select the routing topology, and upload documentation for Direct Context Injection.*

## Core Mechanisms

### State Graph Routing
The orchestration layer is built on LangGraph. The debate is modeled as a cyclic state machine. The state object (`DebateState`) tracks the `turnCount`, active `messages`, and the array of `agents`. Conditional edges determine routing based on `turnCount` evaluated against the `maxTurns` integer. When the threshold is reached, execution routes to the `summarizer` node for consensus aggregation.

### Topology and Persona Configuration
The system relies on user-defined configurations to instantiate the debate topology. The frontend client passes an array of persona definitions (including identifier, base model, and system prompt). The LangGraph workflow dynamically maps these personas to discrete nodes, configuring a strict sequence by linking the output edge of `Agent N` to the input edge of `Agent N+1`, creating a continuous round-robin evaluation loop.

### Global vs. Agent-Specific Knowledge
Knowledge is categorized strictly into two tiers during the initialization phase:
- **Global Knowledge:** Documents uploaded at the root level. This data is extracted and injected into the universal context string, establishing the primary factual baseline for all participating agents.
- **Agent-Specific Knowledge:** Files mapped explicitly to an individual persona. This context is isolated within that specific agent's prompt generation logic, enabling asymmetric information architectures (e.g., providing a Financial Expert with private budgetary data while the Facilitator remains blind to it).

### Asynchronous Steering
The protocol supports human-in-the-loop interjections via the `/api/debate/[thread_id]/steer` endpoint. When a user injects a payload, the system utilizes the `asNode` parameter within LangGraph's `updateState` function. This forces the state machine to re-evaluate its conditional edges as if an agent node had just completed execution, ensuring the human message is processed by the next sequential agent in the topology rather than routing directly to the summarizer.

![Phase 2: Active Debate Execution](./public/screenshots/2.png)
*Figure 2: The mid-run execution state. The State Graph cycles through the configured agents, routing messages and executing the probabilistic consensus protocol.*

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

* **Synchronous Parsing Overhead:** The PDF extraction executes a blocking Node.js sub-process. High-volume concurrent uploads will degrade server response times. Moving extraction to a dedicated worker pool is necessary for horizontal scaling.
* **State Mutation Risks:** The human interjection protocol modifies the `maxTurns` integer dynamically. In highly nested topologies, this could cause race conditions if multiple users interject concurrently on the same session state.

