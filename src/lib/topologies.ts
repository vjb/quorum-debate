export interface RoleSlot {
  roleId: string;
  defaultName: string;
  defaultRole: string;
}

export interface TopologyPreset {
  id: string;
  name: string;
  globalTask: string;
  maxTurns: number;
}

export interface TopologyDefinition {
  id: string;
  name: string;
  description: string;
  synthesizerPrompt: string;
  slots: RoleSlot[];
  presets: TopologyPreset[];
}

export const TOPOLOGIES: Record<string, TopologyDefinition> = {
  "round-table": {
    id: "round-table",
    name: "Round Table (Collaborative)",
    description: "A collaborative setting where experts build on each other's ideas sequentially.",
    synthesizerPrompt: "You are the Executive Synthesizer. Read the Round Table transcript and output a final Markdown-formatted 'Consensus Report'. Highlight the shared agreements, the nuanced additions by each expert, and the final collaborative solution.",
    slots: [
      { roleId: "facilitator", defaultName: "The Facilitator", defaultRole: "Guides the discussion, ensures everyone stays on topic, and synthesizes the final outcome." },
      { roleId: "expert_1", defaultName: "Domain Expert Alpha", defaultRole: "Provides deep technical or domain-specific insights." },
      { roleId: "expert_2", defaultName: "Domain Expert Beta", defaultRole: "Provides alternative perspectives and expands on Alpha's ideas." }
    ],
    presets: [
      { id: "rt-1", name: "Marketing Campaign Design", globalTask: "Design a comprehensive marketing campaign for a new energy drink targeting software engineers.", maxTurns: 6 },
      { id: "rt-2", name: "Product Roadmap Planning", globalTask: "Plan the Q3 product roadmap focusing on AI integration into our existing SaaS platform.", maxTurns: 6 },
      { id: "rt-3", name: "Ethical AI Guidelines", globalTask: "Draft a set of ethical AI guidelines for our internal development teams.", maxTurns: 6 }
    ]
  },
  "courtroom": {
    id: "courtroom",
    name: "Courtroom (Adversarial)",
    description: "An adversarial setting where two sides argue opposing views.",
    synthesizerPrompt: "You are the Chief Justice. Read the Courtroom transcript and output a final Markdown-formatted 'Official Verdict'. Summarize the core arguments from the Prosecution and the Defense, and explicitly state who won the debate and why.",
    slots: [
      { roleId: "prosecutor", defaultName: "The Prosecutor", defaultRole: "Aggressively attacks the premise or finds flaws in the subject matter." },
      { roleId: "defense", defaultName: "The Defense", defaultRole: "Defends the premise and rebuts the Prosecutor's attacks." },
      { roleId: "judge", defaultName: "The Judge", defaultRole: "Listens to both sides, asks probing questions, and forces them to clarify weaknesses." }
    ],
    presets: [
      { id: "crt-1", name: "Open Source AI Patents", globalTask: "Should artificial intelligence be allowed to hold software patents independently of humans?", maxTurns: 6 },
      { id: "crt-2", name: "Remote Work Mandate", globalTask: "Is a strict return-to-office mandate beneficial for long-term corporate innovation?", maxTurns: 6 },
      { id: "crt-3", name: "Universal Basic Income", globalTask: "Will Universal Basic Income (UBI) solve the economic displacement caused by automation?", maxTurns: 6 }
    ]
  },
  "red-blue": {
    id: "red-blue",
    name: "Red Team vs Blue Team",
    description: "A specialized adversarial mode for stress-testing and architecture.",
    synthesizerPrompt: "You are the Lead Security Analyst. Read the transcript and output a final Markdown-formatted 'Security Posture Report'. Detail the architectural strengths, the vulnerabilities successfully exploited by the Red Team, and provide a final Risk Score (0-100).",
    slots: [
      { roleId: "blue_team", defaultName: "Blue Team (Builder)", defaultRole: "Proposes robust architectures or solutions and patches flaws." },
      { roleId: "red_team", defaultName: "Red Team (Attacker)", defaultRole: "Relentlessly tries to break, exploit, or find edge cases in the Blue Team's proposals." },
      { roleId: "analyst", defaultName: "Neutral Analyst", defaultRole: "Observes the attacks and defenses, scoring the resilience of the system mid-debate." }
    ],
    presets: [
      { id: "rb-vortex", name: "Vortex Security Audit (Flagship)", globalTask: "Audit the migration of the 'Vortex' Core Banking system to a multi-region ZK-Rollup AWS architecture. Focus on data residency laws and hot-wallet security.", maxTurns: 6 },
      { id: "rb-1", name: "Cloud Architecture Review", globalTask: "Propose and attack a multi-region AWS architecture for a real-time financial trading platform.", maxTurns: 6 },
      { id: "rb-2", name: "Zero Trust Implementation", globalTask: "Design and critique a Zero Trust network rollout for a remote-first enterprise.", maxTurns: 6 },
      { id: "rb-3", name: "Blockchain Voting System", globalTask: "Build and attempt to compromise a decentralized blockchain-based national voting system.", maxTurns: 6 }
    ]
  },
  "brainstorm": {
    id: "brainstorm",
    name: "Brainstorm Swarm",
    description: "Parallel idea generation followed by brutal critique.",
    synthesizerPrompt: "You are the Innovation Director. Read the Brainstorm transcript and output a final Markdown-formatted 'Ranked Idea List'. Discard the failed ideas and heavily detail the top 2 surviving ideas that should be funded.",
    slots: [
      { roleId: "ideator_1", defaultName: "Creative Ideator 1", defaultRole: "Generates wild, out-of-the-box ideas without filtering." },
      { roleId: "ideator_2", defaultName: "Creative Ideator 2", defaultRole: "Generates practical, grounded ideas." },
      { roleId: "critic", defaultName: "The Harsh Critic", defaultRole: "Reviews all generated ideas simultaneously, destroys the weak ones, and elevates the best." }
    ],
    presets: [
      { id: "bs-1", name: "Viral App Mechanics", globalTask: "Brainstorm viral engagement loops for a new fitness habit-tracking app.", maxTurns: 6 },
      { id: "bs-2", name: "Sustainable Packaging", globalTask: "Generate novel, cost-effective biodegradable packaging solutions for a logistics company.", maxTurns: 6 },
      { id: "bs-3", name: "Employee Retention", globalTask: "Brainstorm unconventional perks to dramatically increase software engineering retention.", maxTurns: 6 }
    ]
  },
  "panel": {
    id: "panel",
    name: "Moderated Panel",
    description: "A structured Q&A panel.",
    synthesizerPrompt: "You are the Panel Journalist. Read the Panel transcript and output a final Markdown-formatted 'Key Takeaways Article'. Summarize the moderator's core questions and contrast the differing viewpoints of the panelists.",
    slots: [
      { roleId: "moderator", defaultName: "Panel Moderator", defaultRole: "Breaks the global task into sub-questions and directs them to the debaters." },
      { roleId: "debater_a", defaultName: "Panelist A", defaultRole: "Answers the moderator's questions from an optimistic or progressive viewpoint." },
      { roleId: "debater_b", defaultName: "Panelist B", defaultRole: "Answers the moderator's questions from a pessimistic, cautious, or conservative viewpoint." }
    ],
    presets: [
      { id: "pnl-1", name: "Future of Space Exploration", globalTask: "Discuss the privatization of space exploration and its implications for humanity.", maxTurns: 6 },
      { id: "pnl-2", name: "Social Media Regulation", globalTask: "Should algorithms on social media platforms be regulated by the government?", maxTurns: 6 },
      { id: "pnl-3", name: "Genetic Engineering", globalTask: "Explore the moral and scientific boundaries of human CRISPR genetic modification.", maxTurns: 6 }
    ]
  },
  "stress-test": {
    id: "stress-test",
    name: "Adversarial Stress Test",
    description: "A high-pressure cycle where one agent proposes and two agents relentlessly attack.",
    synthesizerPrompt: "You are the Stress Test Director. Output a 'Vulnerability Matrix' in Markdown. Identify the single point of failure that the Proposal could not defend against.",
    slots: [
      { roleId: "proposer", defaultName: "The Architect", defaultRole: "Proposes a complex system, plan, or argument and must defend it against all attacks." },
      { roleId: "attacker_a", defaultName: "Adversary Alpha", defaultRole: "Finds logical fallacies, edge cases, and economic flaws in the Architect's proposal." },
      { roleId: "attacker_b", defaultName: "Adversary Beta", defaultRole: "Finds security vulnerabilities, social engineering risks, and implementation bottlenecks." }
    ],
    presets: [
      { id: "st-1", name: "Zero Trust Architecture", globalTask: "Stress test a Zero Trust migration plan for a Fortune 500 company with 50% legacy on-prem infrastructure.", maxTurns: 6 },
      { id: "st-2", name: "Autonomous Vehicle Ethics", globalTask: "Stress test the ethical decision-making engine of a Level 5 autonomous fleet operating in a dense urban environment.", maxTurns: 6 },
      { id: "st-3", name: "Central Bank Digital Currency", globalTask: "Stress test a nationwide CBDC rollout focusing on privacy-leak edge cases and double-spending attacks.", maxTurns: 6 }
    ]
  }
};
