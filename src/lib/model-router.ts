import { db } from "@/lib/db";

export type ModelLane = "fast" | "reasoning" | "specialized";

export type ModelLaneDef = {
  id: ModelLane;
  label: string;
  model: string;
  for: string;
  why: string;
  inputPerMillion: number;
  outputPerMillion: number;
};

export const MODEL_LANES: Record<ModelLane, ModelLaneDef> = {
  fast: {
    id: "fast",
    label: "Fast / cheap",
    model: "command-center.fast",
    for: "Simple tasks",
    why: "Formatting, summaries, tests, and routine reads. Optimize latency and cost.",
    inputPerMillion: 0.4,
    outputPerMillion: 1.6,
  },
  reasoning: {
    id: "reasoning",
    label: "Reasoning",
    model: "command-center.reason",
    for: "Architecture tasks",
    why: "Plans, RCA, and design. Spend tokens where judgment compounds.",
    inputPerMillion: 3,
    outputPerMillion: 15,
  },
  specialized: {
    id: "specialized",
    label: "Specialized",
    model: "command-center.secure",
    for: "Security tasks",
    why: "Stronger reasoning for threat, injection, and exfil. Quality over cheap.",
    inputPerMillion: 5,
    outputPerMillion: 25,
  },
};

export const MODEL_ROUTER_ASCII = `                 Task
                  ↓
             Model Router
                  │
       ┌──────────┼──────────┐
       ↓          ↓          ↓
    Fast/cheap  Reasoning   Specialized
       │          │          │
       ↓          ↓          ↓
    Simple     Architecture  Security
    tasks        tasks        tasks`;

export const MODEL_ROUTER_UNSAFE_ASCII = `Every agent
      ↓
Most expensive model`;

export const MODEL_ROUTE_EXAMPLES: Array<{
  task: string;
  lane: ModelLane;
  why: string;
}> = [
  {
    task: "Code formatting",
    lane: "fast",
    why: "Cheap/fast. A formatter does not need a reasoning pass.",
  },
  {
    task: "PR summarization",
    lane: "fast",
    why: "Fast model. Restate the diff; do not redesign the system.",
  },
  {
    task: "Architecture design",
    lane: "reasoning",
    why: "Reasoning model. The plan is the product of this step.",
  },
  {
    task: "Security analysis",
    lane: "specialized",
    why: "Stronger reasoning. Threat, injection, and exfil miss more when you cheap out.",
  },
  {
    task: "Incident RCA",
    lane: "reasoning",
    why: "Reasoning model. Root cause has to survive the next specialist.",
  },
];

const SPECIALIZED_ROLES = new Set([
  "security",
  "prompt_injection",
  "agent_hijacking",
  "rag_poisoning",
  "mcp_security",
  "data_exfiltration",
  "tool_permissions",
  "security_gateway",
  "threat_response",
]);

const REASONING_ROLES = new Set([
  "architect",
  "root_cause",
  "incident",
  "incident_response",
  "bug_investigation",
  "verification",
  "refactoring",
  "tech_debt",
  "performance",
  "release_risk",
  "release_analyst",
  "recovery",
]);

export type ModelRouteInput = {
  role: string;
  action?: string | null;
  domain?: string | null;
  stepName?: string | null;
  instruction?: string | null;
  taskTitle?: string | null;
};

export type ModelRoute = {
  lane: ModelLane;
  model: string;
  label: string;
  reason: string;
};

function blob(input: ModelRouteInput) {
  return [
    input.role,
    input.action,
    input.domain,
    input.stepName,
    input.instruction,
    input.taskTitle,
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

export function routeModel(input: ModelRouteInput): ModelRoute {
  const text = blob(input);
  const role = (input.role || "").replace(/-/g, "_");

  if (
    /exfil|prompt injection|hijack|threat model|mcp security|secret|data leak/.test(
      text,
    ) ||
    SPECIALIZED_ROLES.has(role) ||
    input.domain === "security"
  ) {
    if (!/human approval|approve/.test(text)) {
      const lane = MODEL_LANES.specialized;
      return {
        lane: "specialized",
        model: lane.model,
        label: lane.label,
        reason: "Security analysis → specialized / stronger reasoning model",
      };
    }
  }

  if (
    /architecture|remediation plan|root cause|\brca\b|technical plan|understand intent|risk analysis/.test(
      text,
    ) ||
    REASONING_ROLES.has(role) ||
    input.action === "plan" ||
    input.action === "investigate"
  ) {
    const lane = MODEL_LANES.reasoning;
    return {
      lane: "reasoning",
      model: lane.model,
      label: lane.label,
      reason: /root cause|\brca\b/.test(text)
        ? "Incident RCA → reasoning model"
        : "Architecture / investigation → reasoning model",
    };
  }

  const lane = MODEL_LANES.fast;
  const reason = /summar/.test(text)
    ? "PR summarization → fast model"
    : /format|lint/.test(text)
      ? "Code formatting → cheap/fast model"
      : "Simple task → cheap/fast model";
  return {
    lane: "fast",
    model: lane.model,
    label: lane.label,
    reason,
  };
}

export function laneForModel(model: string | null | undefined): ModelLane {
  const value = (model || "").toLowerCase();
  if (value.includes("fast")) return "fast";
  if (value.includes("secure") || value.includes("special")) return "specialized";
  return "reasoning";
}

export function routedModelLine(route: Pick<ModelRoute, "model" | "lane">) {
  return `Model: ${route.model} · ${route.lane}`;
}

export function parseRoutedModel(context: string | null | undefined) {
  const match = (context || "").match(/^Model:\s+(\S+)(?:\s+·\s+(\w+))?/m);
  if (!match) return null;
  const model = match[1];
  const lane = (match[2] as ModelLane | undefined) || laneForModel(model);
  return { model, lane };
}

export type ModelRouteLedgerRow = {
  id: string;
  agent: string;
  role: string;
  stepName: string;
  lane: ModelLane;
  model: string;
  reason: string;
  status: string;
  href: string;
};

export type ModelRouteLedger = {
  title: string;
  status: string;
  href: string;
  historyHref: string;
  rows: ModelRouteLedgerRow[];
  counts: Record<ModelLane, number>;
};

function emptyCounts(): Record<ModelLane, number> {
  return { fast: 0, reasoning: 0, specialized: 0 };
}

export async function getModelRouteLedger(): Promise<ModelRouteLedger | null> {
  const execution = await db.execution.findFirst({
    where: {
      OR: [
        { workflow: { name: "Production alert" } },
        { task: { title: { contains: "INCIDENT" } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      task: true,
      steps: {
        where: { startedAt: { not: null } },
        orderBy: { order: "asc" },
        include: { agent: true, span: true },
      },
    },
  });
  if (!execution || execution.steps.length === 0) return null;

  const counts = emptyCounts();
  const rows = execution.steps.map((step) => {
    const computed = routeModel({
      role: step.agent.role,
      domain: step.agent.domain,
      stepName: step.name,
      taskTitle: execution.task.title,
    });
    const parsed = parseRoutedModel(step.span?.context);
    const routed = parsed
      ? { lane: parsed.lane, model: parsed.model, reason: computed.reason }
      : computed;
    counts[routed.lane] += 1;
    return {
      id: step.id,
      agent: step.agent.name,
      role: step.agent.role,
      stepName: step.name,
      lane: routed.lane,
      model: routed.model,
      reason: routed.reason,
      status: step.status,
      href: `/observability/${execution.id}`,
    };
  });

  return {
    title: execution.task.title,
    status: execution.status,
    href: `/observability/${execution.id}`,
    historyHref: `/history/${execution.id}`,
    rows,
    counts,
  };
}

export async function getRecentModelRoutes() {
  const steps = await db.executionStep.findMany({
    where: { startedAt: { not: null } },
    orderBy: { startedAt: "desc" },
    take: 12,
    include: {
      agent: true,
      span: true,
      execution: { include: { task: true, project: true } },
    },
  });

  return steps.map((step) => {
    const computed = routeModel({
      role: step.agent.role,
      domain: step.agent.domain,
      stepName: step.name,
      taskTitle: step.execution.task.title,
    });
    const parsed = parseRoutedModel(step.span?.context);
    const routed = parsed
      ? { lane: parsed.lane, model: parsed.model, reason: computed.reason }
      : computed;
    return {
      id: step.id,
      agent: step.agent.name,
      stepName: step.name,
      lane: routed.lane,
      model: routed.model,
      reason: routed.reason,
      status: step.status,
      href: `/observability/${step.executionId}`,
      title: step.execution.task.title,
      project: step.execution.project.name,
    };
  });
}
