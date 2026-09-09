import type { Agent, Project, Task } from "@prisma/client";
import { db } from "@/lib/db";
import { routeModel, type ModelLane, type ModelRoute } from "@/lib/model-router";
import { runSpecialist } from "@/lib/orchestrator/agents";
import { requestTool } from "@/lib/orchestrator/gateway";
import { toAgentRecord } from "@/lib/registry";
import { parseJson, truncate } from "@/lib/utils";

export const AGENT_TIMEOUT_MS = 20_000;
export const AGENT_MAX_ATTEMPTS = 2;

export type AgentMemoryItem = {
  source: string;
  excerpt: string;
};

export type RuntimeSession = {
  identity: {
    id: string;
    slug: string;
    name: string;
    role: string;
    domain: string;
    riskLevel: string;
    enabled: boolean;
  };
  systemInstructions: string;
  context: {
    project: string;
    task: string;
    action: string;
    instruction: string | null;
  };
  memory: AgentMemoryItem[];
  model: string;
  lane: ModelLane;
  routeReason: string;
  tools: string[];
  timeoutMs: number;
  maxAttempts: number;
};

export type BoundAgentInput = {
  agent: Agent;
  action: string;
  instruction?: string | null;
  project: Project;
  task: Task & { focusKind?: string | null; focusRef?: string | null };
  priorOutputs: Array<{ agent: string; output: string }>;
  executionId: string;
  stepName?: string;
};

export type BoundAgentResult = {
  output: string;
  attempts: number;
  durationMs: number;
  timedOut: boolean;
  retried: boolean;
  retryReason: string | null;
  memory: AgentMemoryItem[];
  session: RuntimeSession;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export async function retrieveMemory(input: {
  projectId: string;
  agentId: string;
  executionId: string;
  priorOutputs: Array<{ agent: string; output: string }>;
}): Promise<AgentMemoryItem[]> {
  const items: AgentMemoryItem[] = [];
  const stored = await db.execution.findUnique({
    where: { id: input.executionId },
    select: { state: true },
  });
  const state = parseJson<{
    workflow?: string;
    status?: string;
    current_task?: string | null;
    completed_tasks?: string[];
    pending_tasks?: string[];
    risk?: string;
    approval_required?: boolean;
  } | null>(stored?.state, null);
  if (state?.workflow) {
    items.push({
      source: "Workflow state",
      excerpt: JSON.stringify({
        workflow: state.workflow,
        status: state.status,
        current_task: state.current_task,
        completed_tasks: state.completed_tasks || [],
        pending_tasks: state.pending_tasks || [],
        risk: state.risk,
        approval_required: Boolean(state.approval_required),
      }),
    });
  }

  for (const item of input.priorOutputs) {
    items.push({
      source: `Workflow · ${item.agent}`,
      excerpt: truncate(item.output.replace(/^# .+\n/, ""), 420),
    });
  }

  const recent = await db.executionStep.findMany({
    where: {
      agentId: input.agentId,
      status: "completed",
      output: { not: null },
      execution: { projectId: input.projectId, id: { not: input.executionId } },
    },
    orderBy: { completedAt: "desc" },
    take: 2,
    include: { execution: { include: { task: true } } },
  });

  for (const step of recent) {
    if (!step.output) continue;
    items.push({
      source: `Memory · ${step.execution.task.title}`,
      excerpt: truncate(step.output.replace(/^# .+\n/, ""), 280),
    });
  }

  return items;
}

export function routeBoundAgent(input: {
  agent: { role: string; domain: string };
  action?: string | null;
  instruction?: string | null;
  stepName?: string | null;
  taskTitle?: string | null;
}): ModelRoute {
  return routeModel({
    role: input.agent.role,
    domain: input.agent.domain,
    action: input.action,
    instruction: input.instruction,
    stepName: input.stepName,
    taskTitle: input.taskTitle,
  });
}

export function assembleRuntimeSession(
  input: BoundAgentInput,
  memory: AgentMemoryItem[],
): RuntimeSession {
  const spec = toAgentRecord(input.agent);
  const route = routeBoundAgent({
    agent: input.agent,
    action: input.action,
    instruction: input.instruction,
    stepName: input.stepName,
    taskTitle: input.task.title,
  });
  return {
    identity: {
      id: spec.id,
      slug: input.agent.slug,
      name: spec.name,
      role: spec.role,
      domain: spec.domain,
      riskLevel: spec.riskLevel,
      enabled: spec.enabled,
    },
    systemInstructions: spec.systemPrompt,
    context: {
      project: input.project.name,
      task: input.task.title,
      action: input.action,
      instruction: input.instruction ?? null,
    },
    memory,
    model: route.model,
    lane: route.lane,
    routeReason: route.reason,
    tools: spec.tools,
    timeoutMs: AGENT_TIMEOUT_MS,
    maxAttempts: AGENT_MAX_ATTEMPTS,
  };
}

/** Tool calls never leave the runtime without this intercept. */
export async function interceptToolCall(
  input: Parameters<typeof requestTool>[0],
) {
  return requestTool(input);
}

export async function executeBoundAgent(
  input: BoundAgentInput,
): Promise<BoundAgentResult> {
  if (!input.agent.enabled) {
    throw new Error(`${input.agent.name} is disabled in the registry.`);
  }

  const started = Date.now();
  const memory = await retrieveMemory({
    projectId: input.project.id,
    agentId: input.agent.id,
    executionId: input.executionId,
    priorOutputs: input.priorOutputs,
  });
  const session = assembleRuntimeSession(input, memory);

  let lastError: unknown;
  let timedOut = false;
  let retryReason: string | null = null;

  for (let attempt = 1; attempt <= AGENT_MAX_ATTEMPTS; attempt++) {
    try {
      const output = await withTimeout(
        runSpecialist({ ...input, memory, model: session.model }),
        AGENT_TIMEOUT_MS,
        session.identity.name,
      );
      if (!output.trim()) {
        throw new Error(`${session.identity.name} produced an empty result.`);
      }
      return {
        output,
        attempts: attempt,
        durationMs: Date.now() - started,
        timedOut: false,
        retried: attempt > 1,
        retryReason: attempt > 1 ? retryReason : null,
        memory,
        session,
      };
    } catch (error) {
      lastError = error;
      timedOut =
        error instanceof Error && /timed out/i.test(error.message);
      retryReason =
        error instanceof Error ? error.message : "Agent runtime failed.";
      if (attempt >= AGENT_MAX_ATTEMPTS) break;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(timedOut ? "Agent runtime timed out." : "Agent runtime failed.");
}
