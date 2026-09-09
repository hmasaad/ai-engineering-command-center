export type ControlPlaneLayer = {
  id: string;
  label: string;
  href: string;
  why: string;
  tone?: "live" | "warn" | "muted";
};

export const CONTROL_PLANE: ControlPlaneLayer[] = [
  {
    id: "orchestrator",
    label: "Orchestrator",
    href: "/history",
    why: "Schedules the expanded workflow. It does not apply patches, deploys, or database writes.",
    tone: "live",
  },
  {
    id: "policy",
    label: "Policy Engine",
    href: "/security/gateway",
    why: "Authentication, authorization, policy, risk, prompt injection, and tool validation run before a tool is invoked. Allow, deny, or hold for a human.",
    tone: "warn",
  },
  {
    id: "runtime",
    label: "Agent Runtime",
    href: "/agents",
    why: "The bound specialist. Role comes from the registry, not from the prompt.",
    tone: "live",
  },
  {
    id: "workflow",
    label: "Autonomous Workflow",
    href: "/autonomous",
    why: "The expanded playbook — AI PR Resolution, release, production alert — not a single unconstrained agent.",
    tone: "live",
  },
  {
    id: "tools",
    label: "Tool Execution",
    href: "/security/tools",
    why: "Agents never call GitHub, databases, AWS, or APIs directly. Agent → Tool Request → Security Gateway → Allow / Deny / Human Approval.",
    tone: "warn",
  },
  {
    id: "agents",
    label: "Agent Execution",
    href: "/history",
    why: "Artifacts: plans, notes, reviews. A brief is not a live mutate until Execution.",
    tone: "live",
  },
  {
    id: "verification",
    label: "Verification",
    href: "/development",
    why: "Tests, regression, and post-release checks. Evidence before anything is applied.",
    tone: "live",
  },
  {
    id: "observability",
    label: "Observability",
    href: "/observability",
    why: "Security asks whether an action should be allowed. Observability asks what the system did: which agent, which tools, what the model received, tokens, cost, duration, and the gateway decision.",
    tone: "live",
  },
  {
    id: "risk",
    label: "Risk / Approval",
    href: "/approvals",
    why: "Human-in-the-loop. Low = automatic. Medium = review recommended. High / critical = mandatory approval.",
    tone: "warn",
  },
  {
    id: "execution",
    label: "Execution",
    href: "/history",
    why: "Side effects only after risk evaluation. Low runs automatically. Medium waits for approval. High is mandatory human. Never “let the AI do everything.”",
    tone: "live",
  },
];

export const CONTROL_PLANE_ASCII = `                  ORCHESTRATOR
                       │
                       ↓
                POLICY ENGINE
                       │
                       ↓
                 AGENT RUNTIME
                       │
                       ↓
              AUTONOMOUS WORKFLOW
                       │
             ┌─────────┴─────────┐
             ↓                   ↓
       TOOL EXECUTION        AGENT EXECUTION
             │                   │
             └─────────┬─────────┘
                       ↓
                 VERIFICATION
                       ↓
                 OBSERVABILITY
                       ↓
              RISK / APPROVAL
                       ↓
                  EXECUTION`;
