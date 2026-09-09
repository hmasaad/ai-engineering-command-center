import { db } from "@/lib/db";
import { displayToolName } from "@/lib/debug-log";
import { parseJson, slugify, truncate } from "@/lib/utils";

export const AGENT_STATE_ASCII = `Workflow
│
├── Goal
├── Plan
├── Tasks
├── Current task
├── Agent states
├── Tool results
├── Decisions
├── Errors
├── Approvals
└── Final result`;

export const AGENT_STATE_UNSAFE_ASCII = `Stateless chatbot
      │
      ↓
Turn ends
      │
      ↓
Everything forgotten`;

export const AGENT_STATE_EXAMPLE = {
  workflow: "incident-9821",
  status: "investigating",
  current_task: "root_cause_analysis",
  completed_tasks: ["collect_logs", "inspect_deployment", "analyze_metrics"],
  pending_tasks: ["generate_fix", "run_tests"],
  risk: "medium",
  approval_required: false,
} as const;

const TASK_KEYS: Record<string, string> = {
  "ingest production alert": "ingest_alert",
  "incident response agent": "inspect_deployment",
  "collect evidence": "collect_logs",
  "analyze": "analyze_metrics",
  "find root cause": "root_cause_analysis",
  "generate remediation plan": "generate_remediation",
  "security review": "security_review",
  "generate the fix": "generate_fix",
  "test the fix": "run_tests",
  "human approval": "human_approval",
  "deploy the fix": "deploy",
  "watch the window": "monitor",
};

const INVESTIGATING = new Set([
  "ingest_alert",
  "inspect_deployment",
  "collect_logs",
  "analyze_metrics",
  "root_cause_analysis",
]);
const REMEDIATING = new Set([
  "generate_remediation",
  "security_review",
  "generate_fix",
  "run_tests",
]);

export type WorkflowStateDocument = {
  workflow: string;
  goal: string;
  plan: string[];
  status: string;
  current_task: string | null;
  completed_tasks: string[];
  pending_tasks: string[];
  tasks: Array<{
    id: string;
    name: string;
    status: string;
    agent: string;
  }>;
  agent_states: Array<{
    agent: string;
    status: string;
    task: string;
  }>;
  tool_results: Array<{
    tool: string;
    verdict: string;
    risk: number;
    agent: string;
  }>;
  decisions: Array<{
    kind: string;
    summary: string;
  }>;
  errors: Array<{
    step: string;
    message: string;
  }>;
  approvals: Array<{
    kind: string;
    status: string;
    summary: string;
  }>;
  risk: "low" | "medium" | "high" | "critical";
  approval_required: boolean;
  final_result: string | null;
};

export type CompactWorkflowState = {
  workflow: string;
  status: string;
  current_task: string | null;
  completed_tasks: string[];
  pending_tasks: string[];
  risk: WorkflowStateDocument["risk"];
  approval_required: boolean;
};

export function compactWorkflowState(
  doc: WorkflowStateDocument,
): CompactWorkflowState {
  return {
    workflow: doc.workflow,
    status: doc.status,
    current_task: doc.current_task,
    completed_tasks: doc.completed_tasks,
    pending_tasks: doc.pending_tasks,
    risk: doc.risk,
    approval_required: doc.approval_required,
  };
}

export function taskStateKey(name: string) {
  const normalized = name.trim().toLowerCase();
  if (TASK_KEYS[normalized]) return TASK_KEYS[normalized];
  return slugify(name).replace(/-/g, "_");
}

export function workflowStateId(input: { title: string; workflowName: string }) {
  const incident = input.title.match(/incident\s*#?\s*(\d+)/i);
  if (incident?.[1]) return `incident-${incident[1]}`;
  return slugify(input.title) || slugify(input.workflowName);
}

function riskBand(score: number): WorkflowStateDocument["risk"] {
  if (score >= 70) return "critical";
  if (score >= 50) return "high";
  if (score >= 30) return "medium";
  return "low";
}

function phaseStatus(
  executionStatus: string,
  current: string | null,
): string {
  if (executionStatus === "completed") return "completed";
  if (executionStatus === "failed") return "failed";
  if (executionStatus === "denied") return "denied";
  if (executionStatus === "awaiting_approval" || executionStatus === "awaiting_gateway") {
    return "awaiting_approval";
  }
  if (current && INVESTIGATING.has(current)) return "investigating";
  if (current && REMEDIATING.has(current)) return "remediating";
  if (current === "deploy" || current === "monitor") return "verifying";
  return executionStatus === "running" ? "running" : executionStatus;
}

const STATE_INCLUDE = {
  task: true,
  workflow: true,
  steps: {
    include: { agent: true, approvals: true, gatewayEvents: true },
    orderBy: { order: "asc" as const },
  },
  graphTasks: { include: { agent: true }, orderBy: { order: "asc" as const } },
  approvals: { orderBy: { requestedAt: "asc" as const } },
  gatewayEvents: { include: { agent: true }, orderBy: { createdAt: "asc" as const } },
  events: { orderBy: { createdAt: "asc" as const } },
};

export function documentFromExecution(
  execution: Awaited<ReturnType<typeof loadExecutionForState>>,
): WorkflowStateDocument | null {
  if (!execution) return null;

  const rows =
    execution.graphTasks.length > 0
      ? execution.graphTasks.map((row) => ({
          id: taskStateKey(row.name),
          name: row.name,
          status: row.status,
          agent: row.agent.name,
          output: row.output,
        }))
      : execution.steps.map((row) => ({
          id: taskStateKey(row.name),
          name: row.name,
          status: row.status,
          agent: row.agent.name,
          output: row.output,
        }));

  const completed = rows.filter((row) => row.status === "completed");
  const current =
    rows.find((row) =>
      ["running", "awaiting_approval", "awaiting_gateway"].includes(row.status),
    ) || rows.find((row) => row.status === "pending");
  const pending = rows.filter(
    (row) =>
      row.status === "pending" ||
      row.status === "running" ||
      row.status === "awaiting_approval" ||
      row.status === "awaiting_gateway",
  );

  const agentMap = new Map<string, { agent: string; status: string; task: string }>();
  for (const row of rows) {
    const prev = agentMap.get(row.agent);
    if (prev && row.status === "pending" && prev.status !== "pending") continue;
    agentMap.set(row.agent, {
      agent: row.agent,
      status: row.status,
      task: row.id,
    });
  }

  const seenTools = new Set<string>();
  const tool_results: WorkflowStateDocument["tool_results"] = [];
  for (const event of execution.gatewayEvents) {
    if (event.toolName === "artifact.write") continue;
    const key = `${event.agentId}:${event.toolName}`;
    if (seenTools.has(key)) continue;
    seenTools.add(key);
    tool_results.push({
      tool: displayToolName(event.toolName),
      verdict: event.verdict,
      risk: event.riskScore,
      agent: event.agent.name,
    });
  }

  const decisions: WorkflowStateDocument["decisions"] = [];
  for (const event of execution.gatewayEvents) {
    if (event.toolName === "artifact.write") continue;
    decisions.push({
      kind: `gateway_${event.verdict}`,
      summary: `${event.agent.name} · ${displayToolName(event.toolName)} · ${event.verdict} · risk ${event.riskScore}`,
    });
  }
  for (const approval of execution.approvals) {
    if (approval.status === "pending") continue;
    decisions.push({
      kind: `hitl_${approval.status}`,
      summary: approval.summary,
    });
  }

  const errors: WorkflowStateDocument["errors"] = [];
  for (const step of execution.steps) {
    if (step.status !== "failed" && step.status !== "denied") continue;
    errors.push({
      step: taskStateKey(step.name),
      message: truncate(step.output || `${step.name} ${step.status}`, 180),
    });
  }
  for (const event of execution.events) {
    if (event.type !== "agent_failed" && event.type !== "failed") continue;
    errors.push({ step: event.type, message: event.message });
  }

  const maxRisk = Math.max(
    execution.maxRisk,
    ...execution.gatewayEvents.map((event) => event.riskScore),
    0,
  );
  const lastCompleted = [...completed].reverse()[0];
  const currentKey = current?.id ?? null;
  const approval_required = execution.approvals.some((row) => row.status === "pending");

  return {
    workflow: workflowStateId({
      title: execution.task.title,
      workflowName: execution.workflow.name,
    }),
    goal: execution.task.title,
    plan: rows.map((row) => row.id),
    status: phaseStatus(execution.status, currentKey),
    current_task: currentKey,
    completed_tasks: completed.map((row) => row.id),
    pending_tasks: pending
      .filter((row) => row.id !== currentKey)
      .map((row) => row.id),
    tasks: rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      agent: row.agent,
    })),
    agent_states: [...agentMap.values()],
    tool_results,
    decisions: decisions.slice(-8),
    errors,
    approvals: execution.approvals.map((row) => ({
      kind: row.kind,
      status: row.status,
      summary: truncate(row.summary, 160),
    })),
    risk: riskBand(maxRisk),
    approval_required,
    final_result:
      execution.status === "completed" && lastCompleted?.output
        ? truncate(lastCompleted.output.replace(/^# .+\n/, ""), 280)
        : execution.status === "completed"
          ? "Workflow finished."
          : null,
  };
}

async function loadExecutionForState(executionId: string) {
  return db.execution.findUnique({
    where: { id: executionId },
    include: STATE_INCLUDE,
  });
}

export async function buildWorkflowState(executionId: string) {
  const execution = await loadExecutionForState(executionId);
  return documentFromExecution(execution);
}

export async function persistWorkflowState(executionId: string) {
  const doc = await buildWorkflowState(executionId);
  if (!doc) return null;
  await db.execution.update({
    where: { id: executionId },
    data: { state: JSON.stringify(doc) },
  });
  return doc;
}

export async function readWorkflowState(executionId: string) {
  return persistWorkflowState(executionId);
}

export async function getLiveWorkflowState() {
  const incident = await db.execution.findFirst({
    where: { task: { title: { contains: "INCIDENT" } } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const fallback = incident
    ? null
    : await db.execution.findFirst({
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
  const id = incident?.id || fallback?.id;
  if (!id) return null;
  const doc = await readWorkflowState(id);
  if (!doc) return null;
  const execution = await db.execution.findUnique({
    where: { id },
    include: { task: true, project: true, workflow: true },
  });
  if (!execution) return null;
  return {
    id,
    title: execution.task.title,
    project: execution.project.name,
    workflowName: execution.workflow.name,
    executionStatus: execution.status,
    href: `/state/${id}`,
    historyHref: `/history/${id}`,
    observabilityHref: `/observability/${id}`,
    document: doc,
    compact: compactWorkflowState(doc),
  };
}

export async function getRecentWorkflowStates() {
  const rows = await db.execution.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { task: true, project: true, workflow: true },
  });
  return rows.map((row) => {
    const stored = parseJson<WorkflowStateDocument | null>(row.state, null);
    const compact = stored
      ? compactWorkflowState(stored)
      : {
          workflow: workflowStateId({
            title: row.task.title,
            workflowName: row.workflow.name,
          }),
          status: row.status,
          current_task: null,
          completed_tasks: [] as string[],
          pending_tasks: [] as string[],
          risk: riskBand(row.maxRisk),
          approval_required: row.status === "awaiting_approval",
        };
    return {
      id: row.id,
      title: row.task.title,
      project: row.project.name,
      href: `/state/${row.id}`,
      compact,
    };
  });
}
