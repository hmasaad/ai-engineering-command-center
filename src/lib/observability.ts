import type { Agent, ExecutionStep, GatewayEvent, Project, Task } from "@prisma/client";
import { db } from "@/lib/db";
import {
  parseActionEvent,
  toActionEvent,
  type ActionEvent,
} from "@/lib/action-event";
import {
  MODEL_LANES,
  laneForModel,
  routeModel,
  routedModelLine,
  type ModelLane,
  type ModelRoute,
} from "@/lib/model-router";
import type { ProposedTool } from "@/lib/orchestrator/gateway";
import { parseJson, truncate } from "@/lib/utils";

/** Fallback rates when a span has no routed lane (legacy command-center.v1). */
export const TOKEN_RATES = {
  inputPerMillion: MODEL_LANES.reasoning.inputPerMillion,
  outputPerMillion: MODEL_LANES.reasoning.outputPerMillion,
  charsPerToken: 4,
} as const;

export type ToolTrace = {
  name: string;
  action: string;
  arguments: Record<string, unknown>;
};

export function estimateTokens(text: string) {
  const chars = Math.max(0, text.length);
  return Math.max(1, Math.ceil(chars / TOKEN_RATES.charsPerToken));
}

export function estimateCostUsd(
  tokenInput: number,
  tokenOutput: number,
  lane?: ModelLane | null,
) {
  const rates = lane ? MODEL_LANES[lane] : TOKEN_RATES;
  return (
    (tokenInput / 1_000_000) * rates.inputPerMillion +
    (tokenOutput / 1_000_000) * rates.outputPerMillion
  );
}

export function formatUsd(value: number) {
  if (value < 0.01 && value > 0) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function formatDuration(ms: number | null | undefined) {
  if (ms == null || ms <= 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    const rem = seconds % 60;
    return rem ? `${minutes}m ${String(rem).padStart(2, "0")}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}

export function formatPct(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

export function toolsFromGatewayEvents(
  events: Array<{
    toolName: string;
    toolAction: string;
    arguments: string | null;
  }>,
): ToolTrace[] {
  const seen = new Set<string>();
  const tools: ToolTrace[] = [];
  for (const event of events) {
    const key = `${event.toolName}:${event.toolAction}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tools.push({
      name: event.toolName,
      action: event.toolAction,
      arguments: parseJson<Record<string, unknown>>(event.arguments, {}),
    });
  }
  return tools;
}

export function mergeTools(a: ToolTrace[], b: ToolTrace[]) {
  return toolsFromGatewayEvents(
    [...a, ...b].map((tool) => ({
      toolName: tool.name,
      toolAction: tool.action,
      arguments: JSON.stringify(tool.arguments),
    })),
  );
}

export function buildSpanInput(input: {
  agentName: string;
  action: string;
  instruction?: string | null;
  task: { title: string; description: string; type: string; priority: string };
}) {
  const extra = input.instruction ? `\nOperator instruction: ${input.instruction}` : "";
  return `${input.agentName} / ${input.action}
Task: ${input.task.title}
Type / priority: ${input.task.type} / ${input.task.priority}

${input.task.description.trim()}${extra}`;
}

export function buildSpanContext(input: {
  project: { name: string; githubOwner?: string | null; githubRepo?: string | null };
  priorOutputs: Array<{ agent: string; output: string }>;
  route?: Pick<ModelRoute, "model" | "lane"> | null;
}) {
  const repo =
    input.project.githubOwner && input.project.githubRepo
      ? `${input.project.githubOwner}/${input.project.githubRepo}`
      : "unlinked";
  const prior =
    input.priorOutputs.length === 0
      ? "No upstream specialist output."
      : input.priorOutputs
          .map((item) => `${item.agent}: ${truncate(item.output.replace(/^# .+\n/, ""), 180)}`)
          .join("\n");
  const modelLine = input.route ? `${routedModelLine(input.route)}\n` : "";
  return `${modelLine}Project: ${input.project.name} (${repo})
Upstream:
${prior}`;
}

export async function upsertAgentSpan(input: {
  executionId: string;
  stepId: string;
  agentId: string;
  order: number;
  inputText: string;
  context: string;
  tools: ToolTrace[] | ProposedTool[];
  output?: string | null;
  riskScore: number;
  result: string;
  startedAt: Date;
  endedAt?: Date;
  lane?: ModelLane | null;
}) {
  const ended = input.endedAt ?? new Date();
  const durationMs = Math.max(0, ended.getTime() - input.startedAt.getTime());
  const tokenInput = estimateTokens(input.inputText + "\n" + input.context);
  const tokenOutput = estimateTokens(input.output || "");
  const tokenTotal = tokenInput + tokenOutput;
  const costUsd = estimateCostUsd(tokenInput, tokenOutput, input.lane);
  const toolsJson = JSON.stringify(input.tools);

  await db.agentSpan.upsert({
    where: { stepId: input.stepId },
    create: {
      executionId: input.executionId,
      stepId: input.stepId,
      agentId: input.agentId,
      order: input.order,
      input: input.inputText,
      context: input.context,
      tools: toolsJson,
      output: input.output ?? null,
      tokenInput,
      tokenOutput,
      tokenTotal,
      costUsd,
      durationMs,
      riskScore: input.riskScore,
      result: input.result,
    },
    update: {
      input: input.inputText,
      context: input.context,
      tools: toolsJson,
      output: input.output ?? null,
      tokenInput,
      tokenOutput,
      tokenTotal,
      costUsd,
      durationMs,
      riskScore: input.riskScore,
      result: input.result,
    },
  });

  await rollupExecution(input.executionId);
}

export async function recordStepSpan(input: {
  executionId: string;
  stepId: string;
  agent: { id: string; name: string; slug?: string; role?: string };
  action: string;
  order: number;
  instruction?: string | null;
  task: { title: string; description: string; type: string; priority: string };
  project: { name: string; githubOwner?: string | null; githubRepo?: string | null };
  priorOutputs: Array<{ agent: string; output: string }>;
  tools: ToolTrace[] | ProposedTool[];
  output?: string | null;
  riskScore: number;
  result: string;
  startedAt?: Date | null;
  endedAt?: Date | null;
  model?: string | null;
  lane?: ModelLane | null;
}) {
  const startedAt = input.startedAt ?? new Date();
  const endedAt = input.endedAt ?? new Date();
  const durationMs = Math.max(0, endedAt.getTime() - startedAt.getTime());
  const lane = input.lane || (input.model ? laneForModel(input.model) : null);
  const route =
    input.model && lane
      ? { model: input.model, lane }
      : null;
  const tokenInput = estimateTokens(
    buildSpanInput({
      agentName: input.agent.name,
      action: input.action,
      instruction: input.instruction,
      task: input.task,
    }) +
      "\n" +
      buildSpanContext({
        project: input.project,
        priorOutputs: input.priorOutputs,
        route,
      }),
  );
  const tokenOutput = estimateTokens(input.output || "");

  await upsertAgentSpan({
    executionId: input.executionId,
    stepId: input.stepId,
    agentId: input.agent.id,
    order: input.order,
    inputText: buildSpanInput({
      agentName: input.agent.name,
      action: input.action,
      instruction: input.instruction,
      task: input.task,
    }),
    context: buildSpanContext({
      project: input.project,
      priorOutputs: input.priorOutputs,
      route,
    }),
    tools: input.tools,
    output: input.output,
    riskScore: input.riskScore,
    result: input.result,
    startedAt,
    endedAt,
    lane,
  });

  const tool = input.tools[0]?.name ?? "artifact.write";
  await emitActionEvent({
    executionId: input.executionId,
    event: toActionEvent({
      workflowId: input.executionId,
      agent: input.agent.slug || input.agent.role || input.agent.name,
      action: input.action,
      tool,
      riskScore: input.riskScore,
      durationMs,
      tokens: tokenInput + tokenOutput,
      status: input.result,
    }),
  });
}

export async function emitActionEvent(input: { executionId: string; event: ActionEvent }) {
  await db.executionEvent.create({
    data: {
      executionId: input.executionId,
      type: "action",
      message: `${input.event.agent} ${input.event.action} · ${input.event.tool} · ${input.event.status}`,
      payload: JSON.stringify(input.event),
    },
  });
}

export async function rollupExecution(executionId: string) {
  const [spans, execution] = await Promise.all([
    db.agentSpan.findMany({ where: { executionId } }),
    db.execution.findUnique({ where: { id: executionId } }),
  ]);
  if (!execution) return;

  const tokenTotal = spans.reduce((sum, span) => sum + span.tokenTotal, 0);
  const costUsd = spans.reduce((sum, span) => sum + span.costUsd, 0);
  const maxRisk = spans.reduce((max, span) => Math.max(max, span.riskScore), 0);
  const end = execution.completedAt ?? new Date();
  const durationMs = execution.startedAt
    ? Math.max(0, end.getTime() - execution.startedAt.getTime())
    : spans.reduce((sum, span) => sum + span.durationMs, 0);

  await db.execution.update({
    where: { id: executionId },
    data: { tokenTotal, costUsd, maxRisk, durationMs },
  });
}

type StepForHydrate = ExecutionStep & {
  agent: Agent;
  gatewayEvents: GatewayEvent[];
  execution: {
    startedAt: Date | null;
    task: Task & { project: Project };
  };
};

export async function hydrateMissingSpans() {
  const existing = await db.agentSpan.findMany({ select: { stepId: true } });
  const steps = await db.executionStep.findMany({
    where:
      existing.length === 0
        ? undefined
        : { id: { notIn: existing.map((span) => span.stepId) } },
    include: {
      agent: true,
      gatewayEvents: true,
      execution: { include: { task: { include: { project: true } } } },
    },
  });

  for (const step of steps as StepForHydrate[]) {
    const task = step.execution.task;
    const maxRisk = step.gatewayEvents.reduce(
      (max, event) => Math.max(max, event.riskScore),
      0,
    );
    const started = step.startedAt ?? step.execution.startedAt ?? new Date();
    const ended = step.completedAt ?? new Date();
    const routed = routeModel({
      role: step.agent.role,
      domain: step.agent.domain,
      stepName: step.name,
      taskTitle: task.title,
    });
    await upsertAgentSpan({
      executionId: step.executionId,
      stepId: step.id,
      agentId: step.agentId,
      order: step.order,
      inputText: buildSpanInput({
        agentName: step.agent.name,
        action: "run",
        task,
      }),
      context: buildSpanContext({
        project: task.project,
        priorOutputs: [],
        route: { model: routed.model, lane: routed.lane },
      }),
      tools: toolsFromGatewayEvents(step.gatewayEvents),
      output: step.output,
      riskScore: maxRisk,
      result: step.status,
      startedAt: started,
      endedAt: ended,
      lane: routed.lane,
    });
    const tool = step.gatewayEvents[0]?.toolName ?? "artifact.write";
    const durationMs = Math.max(0, ended.getTime() - started.getTime());
    await emitActionEvent({
      executionId: step.executionId,
      event: toActionEvent({
        workflowId: step.executionId,
        agent: step.agent.slug || step.agent.role,
        action: step.name.replace(/\s+/g, "_").toLowerCase(),
        tool,
        riskScore: maxRisk,
        durationMs,
        tokens: estimateTokens(step.output || step.name),
        status: step.status,
      }),
    });
  }

  const executionIds = [...new Set(steps.map((step) => step.executionId))];
  for (const id of executionIds) {
    await rollupExecution(id);
  }

  return steps.length;
}

export async function getObservabilityDashboard() {
  await hydrateMissingSpans();

  const [
    activeWorkflows,
    runningAgents,
    awaitingApproval,
    failedWorkflows,
    securityBlocks,
    executions,
    spans,
    approvals,
    recentSpans,
    agentRollup,
  ] = await Promise.all([
    db.execution.count({
      where: { status: { in: ["running", "awaiting_approval"] } },
    }),
    db.executionStep.count({
      where: { status: { in: ["running", "awaiting_gateway", "awaiting_approval"] } },
    }),
    db.approval.count({ where: { status: "pending" } }),
    db.execution.count({ where: { status: { in: ["failed", "denied"] } } }),
    db.gatewayEvent.count({ where: { verdict: "deny" } }),
    db.execution.findMany({
      include: {
        workflow: true,
        task: true,
        project: true,
        spans: {
          include: {
            agent: true,
            step: { include: { gatewayEvents: { orderBy: { createdAt: "asc" } } } },
          },
          orderBy: { order: "asc" },
        },
        _count: { select: { approvals: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.agentSpan.findMany(),
    db.approval.findMany({ select: { executionId: true } }),
    db.agentSpan.findMany({
      orderBy: { createdAt: "desc" },
      take: 16,
      include: {
        agent: true,
        execution: { include: { task: true, project: true, workflow: true } },
      },
    }),
    db.agentSpan.groupBy({
      by: ["agentId", "result"],
      _count: { _all: true },
      _sum: { costUsd: true, durationMs: true, tokenTotal: true },
      _avg: { riskScore: true },
    }),
  ]);

  const terminal = spans.filter((span) =>
    ["completed", "failed", "denied"].includes(span.result),
  );
  const succeeded = terminal.filter((span) => span.result === "completed").length;
  const agentSuccessRate =
    terminal.length === 0 ? 100 : (succeeded / terminal.length) * 100;

  const finished = executions.filter(
    (item) =>
      ["completed", "failed", "denied"].includes(item.status) &&
      item.durationMs != null &&
      item.durationMs > 0,
  );
  const avgWorkflowDuration =
    finished.length === 0
      ? 0
      : Math.round(
          finished.reduce((sum, item) => sum + (item.durationMs || 0), 0) /
            finished.length,
        );

  const agentCost = spans.reduce((sum, span) => sum + span.costUsd, 0);

  const withHuman = new Set(approvals.map((row) => row.executionId));
  const humanIntervention =
    executions.length === 0 ? 0 : (withHuman.size / executions.length) * 100;

  const agents = await db.agent.findMany();
  const byAgentId = Object.fromEntries(agents.map((agent) => [agent.id, agent]));

  const agentStatsMap = new Map<
    string,
    {
      name: string;
      domain: string;
      total: number;
      completed: number;
      failed: number;
      costUsd: number;
      durationMs: number;
      tokens: number;
      avgRisk: number;
    }
  >();

  for (const row of agentRollup) {
    const agent = byAgentId[row.agentId];
    if (!agent) continue;
    const current = agentStatsMap.get(row.agentId) ?? {
      name: agent.name,
      domain: agent.domain,
      total: 0,
      completed: 0,
      failed: 0,
      costUsd: 0,
      durationMs: 0,
      tokens: 0,
      avgRisk: 0,
    };
    current.total += row._count._all;
    if (row.result === "completed") current.completed += row._count._all;
    if (row.result === "failed" || row.result === "denied") current.failed += row._count._all;
    current.costUsd += row._sum.costUsd || 0;
    current.durationMs += row._sum.durationMs || 0;
    current.tokens += row._sum.tokenTotal || 0;
    current.avgRisk = row._avg.riskScore || current.avgRisk;
    agentStatsMap.set(row.agentId, current);
  }

  const agentStats = [...agentStatsMap.values()].sort((a, b) => b.total - a.total);

  return {
    kpis: {
      activeWorkflows,
      runningAgents,
      awaitingApproval,
      failedWorkflows,
      securityBlocks,
      agentSuccessRate,
      avgWorkflowDuration,
      agentCost,
      humanIntervention,
    },
    executions: executions.slice(0, 12),
    recentSpans,
    agentStats,
    totals: {
      spans: spans.length,
      tokens: spans.reduce((sum, span) => sum + span.tokenTotal, 0),
      costUsd: agentCost,
    },
  };
}

export async function getExecutionTrace(executionId: string) {
  await hydrateMissingSpans();
  return db.execution.findUnique({
    where: { id: executionId },
    include: {
      project: true,
      task: true,
      workflow: true,
      spans: {
        include: {
          agent: true,
          step: { include: { gatewayEvents: { orderBy: { createdAt: "asc" } } } },
        },
        orderBy: { order: "asc" },
      },
      steps: {
        include: { agent: true, gatewayEvents: { orderBy: { createdAt: "asc" } } },
        orderBy: { order: "asc" },
      },
      events: { orderBy: { createdAt: "asc" } },
    },
  });
}

const BOARD_AGENT_SLUGS = [
  "developer",
  "security",
  "qa",
  "pr-reviewer",
  "verification",
  "architect",
  "incident-response",
  "monitoring",
  "root-cause",
];

export async function getCommandCenterBoard() {
  const [
    executions,
    runningSteps,
    pendingApprovals,
    featuredAgents,
    statusGroups,
    costAll,
    finishedAgg,
    executionCount,
    approvalGroups,
    actionRows,
  ] = await Promise.all([
    db.execution.findMany({
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { workflow: true, task: true },
    }),
    db.executionStep.findMany({
      where: { status: { in: ["running", "awaiting_gateway", "awaiting_approval"] } },
      include: { agent: true },
    }),
    db.approval.findMany({
      where: { status: "pending" },
      orderBy: { requestedAt: "asc" },
      take: 4,
      include: {
        execution: { include: { task: true, workflow: true } },
        step: true,
      },
    }),
    db.agent.findMany({
      where: { slug: { in: BOARD_AGENT_SLUGS }, enabled: true },
    }),
    db.execution.groupBy({ by: ["status"], _count: { _all: true } }),
    db.execution.aggregate({ _sum: { costUsd: true } }),
    db.execution.aggregate({
      where: {
        status: { in: ["completed", "failed", "denied"] },
        durationMs: { gt: 0 },
      },
      _avg: { durationMs: true },
    }),
    db.execution.count(),
    db.approval.findMany({ select: { executionId: true } }),
    db.executionEvent.findMany({
      where: { type: "action" },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const countOf = (status: string) =>
    statusGroups.find((row) => row.status === status)?._count._all ?? 0;
  const terminal = countOf("completed") + countOf("failed") + countOf("denied");
  const successRate = terminal === 0 ? 100 : (countOf("completed") / terminal) * 100;
  const humanIds = new Set(approvalGroups.map((row) => row.executionId));
  const humanInterventions =
    executionCount === 0 ? 0 : (humanIds.size / executionCount) * 100;

  const runningBySlug = new Set(runningSteps.map((step) => step.agent.slug));
  const agentRows =
    featuredAgents.length > 0
      ? featuredAgents
          .slice()
          .sort((a, b) => BOARD_AGENT_SLUGS.indexOf(a.slug) - BOARD_AGENT_SLUGS.indexOf(b.slug))
          .map((agent) => ({
            name: agent.name.replace(/^AI /, ""),
            status: runningBySlug.has(agent.slug) ? "Running" : "Idle",
          }))
      : [...runningBySlug].map((slug) => ({
          name: slug,
          status: "Running",
        }));

  let events: ActionEvent[] = actionRows
    .map((row) => parseActionEvent(row.payload))
    .filter((row): row is ActionEvent => Boolean(row));

  if (events.length === 0) {
    const spans = await db.agentSpan.findMany({
      orderBy: { updatedAt: "desc" },
      take: 12,
      include: { agent: true, execution: true, step: true },
    });
    events = spans.map((span) => {
      const tools = parseJson<ToolTrace[]>(span.tools, []);
      return toActionEvent({
        workflowId: span.executionId,
        agent: span.agent.slug || span.agent.role,
        action: span.step?.name.replace(/\s+/g, "_").toLowerCase() || "run",
        tool: tools[0]?.name,
        riskScore: span.riskScore,
        durationMs: span.durationMs,
        tokens: span.tokenTotal,
        status: span.result,
      });
    });
  }

  return {
    workflows: executions.map((execution) => ({
      id: execution.id,
      name: execution.workflow.name.replace(/^Service: /, ""),
      status: execution.status,
      href: `/history/${execution.id}`,
    })),
    agents: agentRows,
    approvals: pendingApprovals.map((row) => ({
      id: row.id,
      title: row.execution.task.title,
      href: `/history/${row.executionId}`,
    })),
    metrics: {
      successRate,
      avgDuration: Math.round(finishedAgg._avg.durationMs || 0),
      agentCost: costAll._sum.costUsd || 0,
      humanInterventions,
    },
    events,
  };
}
