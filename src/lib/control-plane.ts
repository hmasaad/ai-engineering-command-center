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
    why: "Every action is an event: workflow, agent, tool, risk, duration, tokens, status. You cannot approve what you cannot see.",
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
    why: "Side effects only after policy, verification, observability, and a human: deploy, rollback, patch.",
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
