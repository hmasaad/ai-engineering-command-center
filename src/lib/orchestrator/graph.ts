import type { Agent, GraphTask, Task, WorkflowStep } from "@prisma/client";
import type { PlaybookDef } from "@/lib/development";
import { db } from "@/lib/db";
import { parseJson, truncate } from "@/lib/utils";

export type GraphNodeDef = {
  key: string;
  name: string;
  agent: string;
  action: string;
  dependsOn: string[];
  requiresApproval: boolean;
  instruction?: string;
};

export type PublicGraphTask = {
  id: string;
  workflow_id: string;
  agent_id: string;
  input: string;
  dependencies: string[];
  status: string;
  output: string | null;
  tools_used: string[];
  risk: number;
  approval_required: boolean;
  timestamps: {
    created: string;
    started: string | null;
    completed: string | null;
    updated: string;
  };
};

export const PR_RESOLUTION_GRAPH: GraphNodeDef[] = [
  {
    key: "understand-intent",
    name: "Understand Intent",
    agent: "architect",
    action: "understand",
    dependsOn: [],
    requiresApproval: false,
    instruction:
      "Restate the operator request as a bounded PR-resolution job: which PR, what “done” means, and what must not change.",
  },
  {
    key: "create-plan",
    name: "Create Plan",
    agent: "architect",
    action: "plan",
    dependsOn: ["understand-intent"],
    requiresApproval: false,
    instruction:
      "Name the parallel analysis (code review, security, bug analysis), the fix slice, tests, risk, the human gate, then Create PR.",
  },
  {
    key: "code-review",
    name: "Code Review",
    agent: "pr-reviewer",
    action: "review",
    dependsOn: ["create-plan"],
    requiresApproval: false,
    instruction: "Read the linked pull request. Name defects, blast radius, and what a fix must preserve.",
  },
  {
    key: "security-review",
    name: "Security",
    agent: "security",
    action: "scan",
    dependsOn: ["create-plan"],
    requiresApproval: false,
    instruction: "Threat-model the PR and the likely fix. Residual risk before any patch.",
  },
  {
    key: "bug-analysis",
    name: "Bug Analysis",
    agent: "bug-investigation",
    action: "investigate",
    dependsOn: ["create-plan"],
    requiresApproval: false,
    instruction: "Hypothesize root cause from the PR, review notes, and security findings.",
  },
  {
    key: "generate-fix",
    name: "Generate Fix",
    agent: "developer",
    action: "implement",
    dependsOn: ["code-review", "security-review", "bug-analysis"],
    requiresApproval: false,
    instruction: "Propose a bounded patch from the joined analysis. Do not open a PR yet. Name rollback.",
  },
  {
    key: "run-tests",
    name: "Run Tests",
    agent: "qa",
    action: "test",
    dependsOn: ["generate-fix"],
    requiresApproval: false,
    instruction: "Define the evidence that would falsify the fix: happy path, failure, one regression.",
  },
  {
    key: "risk-analysis",
    name: "Risk Analysis",
    agent: "verification",
    action: "verify",
    dependsOn: ["run-tests"],
    requiresApproval: false,
    instruction: "Score residual risk of merging the proposed fix. Go / no-go for the human gate.",
  },
  {
    key: "human-approval",
    name: "Human Approval",
    agent: "reviewer",
    action: "review",
    dependsOn: ["risk-analysis"],
    requiresApproval: true,
    instruction: "Mandatory pause. Approve to allow Create PR; reject to halt.",
  },
  {
    key: "create-pr",
    name: "Create PR",
    agent: "developer",
    action: "create_pr",
    dependsOn: ["human-approval"],
    requiresApproval: false,
    instruction: "After the human gate, propose github.create_pr for the approved fix. Do not merge.",
  },
];

/** @deprecated Use PR_RESOLUTION_GRAPH */
export const PR_FIX_GRAPH = PR_RESOLUTION_GRAPH;

export const PR_RESOLUTION_ASCII = `                 User Request
                      ↓
                 ORCHESTRATOR
                      ↓
               Understand Intent
                      ↓
                Create Plan
                      ↓
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
   Code Review    Security       Bug Analysis
        │             │             │
        └─────────────┼─────────────┘
                      ↓
                Developer Agent
                      ↓
                 Generate Fix
                      ↓
                   QA Agent
                      ↓
                 Run Tests
                      ↓
              Verification Agent
                      ↓
                 Risk Analysis
                      ↓
                HUMAN APPROVAL
                      ↓
                   Create PR`;

export const PR_FIX_ASCII = PR_RESOLUTION_ASCII;

export const PR_RESOLUTION_NAME = "AI PR Resolution";
export const PR_RESOLUTION_ALIASES = ["PR fix", PR_RESOLUTION_NAME];

export const GRAPH_TEMPLATES: Record<string, GraphNodeDef[]> = {
  [PR_RESOLUTION_NAME]: PR_RESOLUTION_GRAPH,
  "PR fix": PR_RESOLUTION_GRAPH,
};

export function playbookFromGraph(
  name: string,
  domain: PlaybookDef["domain"],
  description: string,
  nodes: GraphNodeDef[],
): PlaybookDef {
  return {
    name,
    domain,
    description,
    steps: nodes.map((node) => ({
      agent: node.agent,
      name: node.name,
      action: node.action,
      requiresApproval: node.requiresApproval,
      instruction: node.instruction,
    })),
  };
}

export const PR_RESOLUTION_PLAYBOOK = playbookFromGraph(
  PR_RESOLUTION_NAME,
  "autonomous",
  "First real workflow: understand the PR, plan, run code review / security / bug analysis in parallel, generate a fix, test, score risk, pause for a human, then propose Create PR.",
  PR_RESOLUTION_GRAPH,
);

/** @deprecated Use PR_RESOLUTION_PLAYBOOK */
export const PR_FIX_PLAYBOOK = PR_RESOLUTION_PLAYBOOK;

export function graphFromWorkflowSteps(
  steps: Array<WorkflowStep & { agent: Agent }>,
): GraphNodeDef[] {
  return steps.map((step, index) => ({
    key: `step-${index}`,
    name: step.name,
    agent: step.agent.slug,
    action: step.action,
    dependsOn: index === 0 ? [] : [`step-${index - 1}`],
    requiresApproval: step.requiresApproval,
    instruction: step.instruction ?? undefined,
  }));
}

export function toPublicGraphTask(row: GraphTask): PublicGraphTask {
  return {
    id: row.id,
    workflow_id: row.workflowId,
    agent_id: row.agentId,
    input: row.input,
    dependencies: parseJson<string[]>(row.dependencies, []),
    status: row.status,
    output: row.output,
    tools_used: parseJson<string[]>(row.toolsUsed, []),
    risk: row.risk,
    approval_required: row.approvalRequired,
    timestamps: {
      created: row.createdAt.toISOString(),
      started: row.startedAt?.toISOString() ?? null,
      completed: row.completedAt?.toISOString() ?? null,
      updated: row.updatedAt.toISOString(),
    },
  };
}

export function nodeInput(input: {
  name: string;
  intent: string;
  task: Task;
  upstream: Array<{ name: string; output: string }>;
}) {
  const upstream =
    input.upstream.length === 0
      ? "None — this is a root node."
      : input.upstream
          .map((item) => `### ${item.name}\n${truncate(item.output, 500)}`)
          .join("\n\n");
  return `# ${input.name}

**Intent:** ${input.intent}
**Ticket:** ${input.task.title}
**Type / priority:** ${input.task.type} / ${input.task.priority}

${input.task.description.trim()}

## Upstream
${upstream}
`;
}

export function topoSort(nodes: GraphNodeDef[]): GraphNodeDef[] {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const remaining = new Set(nodes.map((node) => node.key));
  const ordered: GraphNodeDef[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining].filter((key) => {
      const node = byKey.get(key);
      if (!node) return false;
      return node.dependsOn.every((dep) => !remaining.has(dep));
    });
    if (ready.length === 0) {
      throw new Error("Task graph has a cycle.");
    }
    ready.sort((a, b) => nodes.findIndex((node) => node.key === a) - nodes.findIndex((node) => node.key === b));
    const next = byKey.get(ready[0]);
    if (!next) break;
    ordered.push(next);
    remaining.delete(next.key);
  }
  return ordered;
}

export async function materializeTaskGraph(input: {
  executionId: string;
  workflowId: string;
  workflowName: string;
  steps: Array<WorkflowStep & { agent: Agent }>;
  task: Task;
  intent?: string;
}) {
  const existing = await db.graphTask.count({ where: { executionId: input.executionId } });
  if (existing > 0) return;

  const template = GRAPH_TEMPLATES[input.workflowName] ?? graphFromWorkflowSteps(input.steps);
  const ordered = topoSort(template);
  const agents = await db.agent.findMany();
  const bySlug = Object.fromEntries(agents.map((agent) => [agent.slug, agent]));
  const intent = input.intent || input.task.title;
  const created: Array<{ key: string; id: string }> = [];

  for (const [order, node] of ordered.entries()) {
    const agent = bySlug[node.agent];
    if (!agent) {
      throw new Error(`Task graph references unknown agent “${node.agent}”.`);
    }
    if (!agent.enabled) {
      throw new Error(`Task graph references disabled agent “${node.agent}”.`);
    }
    const inputText = nodeInput({
      name: node.name,
      intent,
      task: input.task,
      upstream: [],
    });
    const step = await db.executionStep.create({
      data: {
        executionId: input.executionId,
        workflowStepId: input.steps[order]?.id ?? null,
        agentId: agent.id,
        order,
        name: node.name,
        status: "pending",
      },
    });
    const graphTask = await db.graphTask.create({
      data: {
        key: node.key,
        workflowId: input.workflowId,
        executionId: input.executionId,
        agentId: agent.id,
        stepId: step.id,
        name: node.name,
        action: node.action,
        instruction: node.instruction ?? null,
        input: inputText,
        dependencies: "[]",
        status: "pending",
        approvalRequired: node.requiresApproval,
        order,
      },
    });
    created.push({ key: node.key, id: graphTask.id });
  }

  const idByKey = Object.fromEntries(created.map((row) => [row.key, row.id]));
  for (const node of ordered) {
    const id = idByKey[node.key];
    const deps = node.dependsOn.map((key) => idByKey[key]).filter(Boolean);
    await db.graphTask.update({
      where: { id },
      data: { dependencies: JSON.stringify(deps) },
    });
  }
}

export function readyGraphTasks<T extends GraphTask>(nodes: T[]): T[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes
    .filter((node) => node.status === "pending")
    .filter((node) => {
      const deps = parseJson<string[]>(node.dependencies, []);
      return deps.every((id) => byId.get(id)?.status === "completed");
    })
    .sort((a, b) => a.order - b.order);
}

export function blockedReason<T extends GraphTask>(nodes: T[]): string | null {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const halted = nodes.find((node) => ["denied", "failed"].includes(node.status));
  if (halted) return halted.status;
  const waiting = nodes.find((node) =>
    ["awaiting_approval", "awaiting_gateway"].includes(node.status),
  );
  if (waiting) return waiting.status;
  const pending = nodes.filter((node) => node.status === "pending");
  const blocked = pending.find((node) => {
    const deps = parseJson<string[]>(node.dependencies, []);
    return deps.some((id) => {
      const dep = byId.get(id);
      return dep && dep.status !== "completed";
    });
  });
  if (blocked) return "blocked";
  if (nodes.every((node) => node.status === "completed")) return "completed";
  return null;
}

export async function mirrorGraphTask(stepId: string) {
  const step = await db.executionStep.findUnique({
    where: { id: stepId },
    include: { gatewayEvents: true, graphTask: true },
  });
  if (!step?.graphTask) return;
  const tools = [...new Set(step.gatewayEvents.map((event) => event.toolName))];
  const risk = step.gatewayEvents.reduce((max, event) => Math.max(max, event.riskScore), 0);
  await db.graphTask.update({
    where: { id: step.graphTask.id },
    data: {
      status: step.status,
      output: step.output,
      toolsUsed: JSON.stringify(tools),
      risk,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
    },
  });
}

export async function refreshGraphInput(
  graphTask: GraphTask,
  task: Task,
  intent: string,
  nodes: GraphTask[],
) {
  const deps = parseJson<string[]>(graphTask.dependencies, []);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const upstream = deps
    .map((id) => byId.get(id))
    .filter((node): node is GraphTask => Boolean(node && node.output))
    .map((node) => ({ name: node.name, output: node.output as string }));
  const input = nodeInput({
    name: graphTask.name,
    intent,
    task,
    upstream,
  });
  await db.graphTask.update({
    where: { id: graphTask.id },
    data: { input },
  });
}
