import { db } from "@/lib/db";
import {
  mergeTools,
  recordStepSpan,
  rollupExecution,
  toolsFromGatewayEvents,
  type ToolTrace,
} from "@/lib/observability";
import { runSpecialist } from "@/lib/orchestrator/agents";
import {
  requestTool,
  type GatewayDecision,
} from "@/lib/orchestrator/gateway";
import {
  materializeTaskGraph,
  mirrorGraphTask,
  readyGraphTasks,
  refreshGraphInput,
} from "@/lib/orchestrator/graph";
import {
  approvalKindFor,
  hitlLabel,
  isExplicitHumanGate,
} from "@/lib/hitl";
import { parseJson } from "@/lib/utils";

function priorHumanGateApproved(
  steps: Array<{ name: string; status: string; approvals?: Array<{ status: string }> }>,
) {
  return steps.some((step) => {
    if (!isExplicitHumanGate({ name: step.name, action: "review" })) return false;
    if (step.status === "completed") return true;
    return (step.approvals || []).some((row) => row.status === "approved");
  });
}

async function addEvent(
  executionId: string,
  type: string,
  message: string,
  payload?: unknown,
) {
  await db.executionEvent.create({
    data: {
      executionId,
      type,
      message,
      payload: payload ? JSON.stringify(payload) : null,
    },
  });
}

async function traceApprovalStep(stepId: string, result: string) {
  const step = await db.executionStep.findUnique({
    where: { id: stepId },
    include: {
      agent: true,
      gatewayEvents: true,
      execution: { include: { task: { include: { project: true } } } },
    },
  });
  if (!step) return;
  await recordStepSpan({
    executionId: step.executionId,
    stepId: step.id,
    agent: step.agent,
    action: "run",
    order: step.order,
    task: step.execution.task,
    project: step.execution.task.project,
    priorOutputs: [],
    tools: toolsFromGatewayEvents(step.gatewayEvents),
    output: step.output,
    riskScore: step.gatewayEvents.reduce(
      (max, event) => Math.max(max, event.riskScore),
      0,
    ),
    result,
    startedAt: step.startedAt,
  });
}

export async function startExecution(taskId: string, workflowId: string) {
  const [task, workflow] = await Promise.all([
    db.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    }),
    db.workflow.findUnique({
      where: { id: workflowId },
      include: {
        steps: { include: { agent: true }, orderBy: { order: "asc" } },
      },
    }),
  ]);

  if (!task) throw new Error("Task not found.");
  if (!workflow) throw new Error("Workflow not found.");
  if (workflow.steps.length === 0) {
    throw new Error("Workflow has no steps.");
  }
  if (workflow.steps.some((step) => !step.agent.enabled)) {
    throw new Error("Workflow references a disabled agent.");
  }

  const execution = await db.execution.create({
    data: {
      projectId: task.projectId,
      taskId: task.id,
      workflowId: workflow.id,
      status: "running",
      startedAt: new Date(),
    },
  });

  await db.task.update({
    where: { id: task.id },
    data: { status: "in_progress" },
  });

  await addEvent(
    execution.id,
    "started",
    `Started “${workflow.name}” for task “${task.title}”.`,
  );

  await materializeTaskGraph({
    executionId: execution.id,
    workflowId: workflow.id,
    workflowName: workflow.name,
    steps: workflow.steps,
    task,
    intent: task.title,
  });
  await addEvent(execution.id, "graph", `Task graph materialized for “${workflow.name}”.`);

  return runUntilPause(execution.id);
}

function gatewayArtifact(decision: GatewayDecision) {
  const detectors =
    decision.detectors.length > 0
      ? decision.detectors
          .map((hit) => `- **${hit.name}** (+${hit.score}) — ${hit.detail}`)
          .join("\n")
      : "- No detector hits.";
  const checks = (decision.checks || [])
    .map((item) => {
      const mark = item.status === "fail" ? "BLOCK" : item.status === "hold" ? "HOLD" : "PASS";
      return `${item.id}. **${item.question}** \`${mark}\` — ${item.detail}`;
    })
    .join("\n");
  const next =
    decision.verdict === "deny"
      ? "The specialist did not run. This tool request is denied."
      : decision.hitl.mode === "mandatory"
        ? "Mandatory approval. The specialist has not run yet. Approve to allow this tool request; reject to halt."
        : "Review recommended. The specialist has not run yet. Approve to continue; reject to halt.";
  return `# Agent Security Gateway

Agent → Tool Request → Security Gateway → Allow / Deny / Human Approval

**Phase:** ${decision.phase}
**Tool request:** \`${decision.tool.name}\` / ${decision.tool.action}
**HITL:** ${decision.hitl.band} · ${hitlLabel(decision.hitl)}
**Permission:** ${decision.permissionMode}
**Risk score:** ${decision.riskScore}
**Verdict:** ${decision.verdict}

## Checks
${checks || "- Checks were not recorded on this event."}

## Policy evaluation
${decision.reasons.map((reason) => `- ${reason}`).join("\n")}

## Detectors
${detectors}

${next}
`;
}

async function persistGatewayEvent(input: {
  executionId: string;
  stepId: string;
  agentId: string;
  decision: GatewayDecision;
}) {
  const status =
    input.decision.verdict === "allow"
      ? "allowed"
      : input.decision.verdict === "deny"
        ? "denied"
        : "awaiting_approval";

  return db.gatewayEvent.create({
    data: {
      executionId: input.executionId,
      stepId: input.stepId,
      agentId: input.agentId,
      phase: input.decision.phase,
      toolName: input.decision.tool.name,
      toolAction: input.decision.tool.action,
      arguments: JSON.stringify(input.decision.tool.arguments),
      riskScore: input.decision.riskScore,
      verdict: input.decision.verdict,
      status,
      reasons: JSON.stringify(input.decision.reasons),
      detectors: JSON.stringify(input.decision.detectors),
      checks: JSON.stringify(input.decision.checks || []),
      summary: input.decision.summary,
    },
  });
}

async function haltDenied(input: {
  executionId: string;
  taskId: string;
  stepId: string;
  agentName: string;
  decision: GatewayDecision;
}) {
  await db.executionStep.update({
    where: { id: input.stepId },
    data: {
      status: "denied",
      output: gatewayArtifact(input.decision),
      completedAt: new Date(),
    },
  });
  await db.execution.update({
    where: { id: input.executionId },
    data: { status: "denied", completedAt: new Date() },
  });
  await db.task.update({
    where: { id: input.taskId },
    data: { status: "failed" },
  });
  await addEvent(
    input.executionId,
    "gateway_denied",
    `Agent Security Gateway denied ${input.agentName} (${input.decision.tool.name}, risk ${input.decision.riskScore}).`,
    { verdict: input.decision.verdict, riskScore: input.decision.riskScore },
  );
  await mirrorGraphTask(input.stepId);
  await rollupExecution(input.executionId);
}

async function holdForGateway(input: {
  executionId: string;
  taskId: string;
  stepId: string;
  agentName: string;
  stepName: string;
  eventId: string;
  decision: GatewayDecision;
}) {
  await db.executionStep.update({
    where: { id: input.stepId },
    data: {
      status: "awaiting_gateway",
      output: gatewayArtifact(input.decision),
    },
  });
  await db.approval.create({
    data: {
      executionId: input.executionId,
      stepId: input.stepId,
      gatewayEventId: input.eventId,
      kind: approvalKindFor(input.decision.hitl),
      status: "pending",
      summary: `HITL ${hitlLabel(input.decision.hitl).toLowerCase()} — ${input.agentName} requested \`${input.decision.tool.name}\` (${input.decision.hitl.band} risk). ${input.decision.reasons[0] || ""}`,
    },
  });
  await db.execution.update({
    where: { id: input.executionId },
    data: { status: "awaiting_approval" },
  });
  await db.task.update({
    where: { id: input.taskId },
    data: { status: "awaiting_approval" },
  });
  await addEvent(
    input.executionId,
    "gateway_hold",
    `HITL ${hitlLabel(input.decision.hitl).toLowerCase()} paused “${input.stepName}” (${input.decision.tool.name}, ${input.decision.hitl.band}).`,
  );
  await mirrorGraphTask(input.stepId);
}

export async function runUntilPause(executionId: string) {
  const execution = await db.execution.findUnique({
    where: { id: executionId },
    include: {
      task: { include: { project: true } },
      workflow: {
        include: {
          steps: { include: { agent: true }, orderBy: { order: "asc" } },
        },
      },
      steps: {
        include: { approvals: true, gatewayEvents: true },
        orderBy: { order: "asc" },
      },
      graphTasks: { include: { agent: true }, orderBy: { order: "asc" } },
    },
  });

  if (!execution) throw new Error("Execution not found.");

  const priorOutputs = execution.steps
    .filter((step) => step.status === "completed" && step.output)
    .map((step) => ({
      agent: step.name,
      output: step.output as string,
    }));

  const work = execution.graphTasks.length
    ? execution.graphTasks.map((graphTask) => ({
        graphTask,
        workflowStep: {
          id: execution.workflow.steps[graphTask.order]?.id ?? graphTask.id,
          order: graphTask.order,
          name: graphTask.name,
          action: graphTask.action,
          instruction: graphTask.instruction,
          requiresApproval: graphTask.approvalRequired,
          agentId: graphTask.agentId,
          agent: graphTask.agent,
        },
      }))
    : execution.workflow.steps.map((workflowStep) => ({
        graphTask: null,
        workflowStep,
      }));

  for (const { graphTask, workflowStep } of work) {
    if (graphTask) {
      const latest = await db.graphTask.findMany({ where: { executionId } });
      const self = latest.find((row) => row.id === graphTask.id);
      const deps = parseJson<string[]>(self?.dependencies ?? graphTask.dependencies, []);
      const depRows = latest.filter((row) => deps.includes(row.id));
      if (depRows.some((row) => ["awaiting_approval", "awaiting_gateway"].includes(row.status))) {
        continue;
      }
      if (depRows.some((row) => row.status === "denied" || row.status === "failed")) {
        const halted = depRows.find((row) => row.status === "denied" || row.status === "failed");
        return { executionId, status: (halted?.status ?? "failed") as "denied" | "failed" };
      }
      if (depRows.some((row) => row.status !== "completed")) {
        continue;
      }
      await refreshGraphInput(
        self ?? graphTask,
        execution.task,
        execution.task.title,
        latest,
      );
    }

    const existing = execution.steps.find(
      (step) => step.order === workflowStep.order,
    );

    if (existing?.status === "completed") continue;
    if (existing?.status === "denied" || existing?.status === "failed") {
      return { executionId, status: existing.status };
    }
    if (existing?.status === "awaiting_approval") {
      return { executionId, status: "awaiting_approval" as const };
    }
    if (existing?.status === "awaiting_gateway") {
      const pending = existing.approvals.find((approval) => approval.status === "pending");
      if (pending) {
        return { executionId, status: "awaiting_approval" as const };
      }
    }

    const step =
      existing ??
      (await db.executionStep.create({
        data: {
          executionId,
          workflowStepId: workflowStep.id,
          agentId: workflowStep.agentId,
          order: workflowStep.order,
          name: workflowStep.name,
          status: "running",
          startedAt: new Date(),
        },
      }));

    if (existing && existing.status !== "running") {
      await db.executionStep.update({
        where: { id: step.id },
        data: { status: "running", startedAt: existing.startedAt ?? new Date() },
      });
      await mirrorGraphTask(step.id);
    } else if (!existing) {
      await mirrorGraphTask(step.id);
    }

    await db.execution.update({
      where: { id: executionId },
      data: { status: "running", currentStep: workflowStep.order },
    });

    const runCtx = {
      agent: workflowStep.agent,
      action: workflowStep.action,
      instruction: workflowStep.instruction,
      project: execution.task.project,
      task: execution.task,
    };

    const startedAt = step.startedAt ?? existing?.startedAt ?? new Date();
    let tools: ToolTrace[] = toolsFromGatewayEvents(existing?.gatewayEvents || []);
    let riskScore = (existing?.gatewayEvents || []).reduce(
      (max, event) => Math.max(max, event.riskScore),
      0,
    );

    const trace = (
      result: string,
      extra?: { output?: string | null; risk?: number },
    ) =>
      recordStepSpan({
        executionId,
        stepId: step.id,
        agent: workflowStep.agent,
        action: workflowStep.action,
        order: workflowStep.order,
        instruction: workflowStep.instruction,
        task: execution.task,
        project: execution.task.project,
        priorOutputs,
        tools,
        output: extra?.output,
        riskScore: extra?.risk ?? riskScore,
        result,
        startedAt,
      });

    await trace("running");

    const preflightDone = (existing?.gatewayEvents || []).some(
      (event) =>
        event.phase === "preflight" &&
        (event.status === "allowed" || event.status === "approved"),
    );

    if (!preflightDone) {
      await addEvent(
        executionId,
        "step_started",
        `${workflowStep.agent.name} requested tools for “${workflowStep.name}”.`,
      );

      const pre = await requestTool({ ...runCtx, phase: "preflight" });
      tools = mergeTools(tools, pre.tools);
      riskScore = Math.max(riskScore, pre.decision.riskScore);
      const preEvent = await persistGatewayEvent({
        executionId,
        stepId: step.id,
        agentId: workflowStep.agentId,
        decision: pre.decision,
      });
      await addEvent(
        executionId,
        "gateway_eval",
        `Security Gateway ${pre.decision.verdict} · ${pre.decision.tool.name} · risk ${pre.decision.riskScore}.`,
        {
          phase: "preflight",
          tools: pre.tools,
          verdict: pre.decision.verdict,
          riskScore: pre.decision.riskScore,
        },
      );

      if (pre.decision.verdict === "deny") {
        await haltDenied({
          executionId,
          taskId: execution.taskId,
          stepId: step.id,
          agentName: workflowStep.agent.name,
          decision: pre.decision,
        });
        await trace("denied", {
          output: gatewayArtifact(pre.decision),
          risk: pre.decision.riskScore,
        });
        return { executionId, status: "denied" as const };
      }

      if (pre.decision.verdict === "human") {
        if (
          pre.decision.hitl.mode === "recommended" &&
          priorHumanGateApproved(execution.steps)
        ) {
          await db.gatewayEvent.update({
            where: { id: preEvent.id },
            data: { verdict: "allow", status: "allowed", summary: `${pre.decision.summary} · human gate already cleared` },
          });
          await addEvent(
            executionId,
            "gateway_eval",
            `HITL review recommended skipped — Human Approval already cleared (${pre.decision.tool.name}).`,
          );
        } else {
        await holdForGateway({
          executionId,
          taskId: execution.taskId,
          stepId: step.id,
          agentName: workflowStep.agent.name,
          stepName: workflowStep.name,
          eventId: preEvent.id,
          decision: pre.decision,
        });
        await trace("awaiting_gateway", {
          output: gatewayArtifact(pre.decision),
          risk: pre.decision.riskScore,
        });
        return { executionId, status: "awaiting_approval" as const };
        }
      }
    }

    const alreadyRan = Boolean(
      existing?.output && !existing.output.startsWith("# Agent Security Gateway"),
    );
    const output = alreadyRan
      ? (existing?.output as string)
      : await runSpecialist({
          ...runCtx,
          priorOutputs,
        });

    const postflightDone = (existing?.gatewayEvents || []).some(
      (event) =>
        event.phase === "postflight" &&
        (event.status === "allowed" || event.status === "approved"),
    );

    if (!postflightDone) {
      const post = await requestTool({
        ...runCtx,
        phase: "postflight",
        extraText: output,
      });
      tools = mergeTools(tools, post.tools);
      riskScore = Math.max(riskScore, post.decision.riskScore);
      const postEvent = await persistGatewayEvent({
        executionId,
        stepId: step.id,
        agentId: workflowStep.agentId,
        decision: post.decision,
      });
      await addEvent(
        executionId,
        "gateway_eval",
        `Security Gateway postflight ${post.decision.verdict} · ${post.decision.tool.name} · risk ${post.decision.riskScore}.`,
        {
          phase: "postflight",
          verdict: post.decision.verdict,
          riskScore: post.decision.riskScore,
        },
      );

      if (post.decision.verdict === "deny") {
        await haltDenied({
          executionId,
          taskId: execution.taskId,
          stepId: step.id,
          agentName: workflowStep.agent.name,
          decision: post.decision,
        });
        await trace("denied", {
          output: gatewayArtifact(post.decision),
          risk: post.decision.riskScore,
        });
        return { executionId, status: "denied" as const };
      }

      if (post.decision.verdict === "human") {
        if (
          post.decision.hitl.mode === "recommended" &&
          priorHumanGateApproved(execution.steps)
        ) {
          await db.gatewayEvent.update({
            where: { id: postEvent.id },
            data: {
              verdict: "allow",
              status: "allowed",
              summary: `${post.decision.summary} · human gate already cleared`,
            },
          });
          await addEvent(
            executionId,
            "gateway_eval",
            `HITL review recommended skipped — Human Approval already cleared (${post.decision.tool.name}).`,
          );
        } else {
        await db.executionStep.update({
          where: { id: step.id },
          data: { status: "awaiting_gateway", output },
        });
        await db.approval.create({
          data: {
            executionId,
            stepId: step.id,
            gatewayEventId: postEvent.id,
            kind: approvalKindFor(post.decision.hitl),
            status: "pending",
            summary: `HITL ${hitlLabel(post.decision.hitl).toLowerCase()} after ${workflowStep.agent.name} (${post.decision.hitl.action}, ${post.decision.hitl.band} risk). Artifact is held until a human ${post.decision.hitl.mode === "mandatory" ? "approves" : "reviews"}.`,
          },
        });
        await db.execution.update({
          where: { id: executionId },
          data: { status: "awaiting_approval", currentStep: workflowStep.order },
        });
        await db.task.update({
          where: { id: execution.taskId },
          data: { status: "awaiting_approval" },
        });
        await addEvent(
          executionId,
          "gateway_hold",
          `Agent Security Gateway held the artifact from ${workflowStep.agent.name}.`,
        );
        await trace("awaiting_gateway", {
          output,
          risk: post.decision.riskScore,
        });
        await mirrorGraphTask(step.id);
        return { executionId, status: "awaiting_approval" as const };
        }
      }
    }

    if (isExplicitHumanGate(workflowStep)) {
      await db.executionStep.update({
        where: { id: step.id },
        data: { status: "awaiting_approval", output },
      });
      await db.approval.create({
        data: {
          executionId,
          stepId: step.id,
          kind: "mandatory",
          status: "pending",
          summary: `${workflowStep.agent.name} finished “${workflowStep.name}”. Mandatory human approval before the run continues.`,
        },
      });
      await db.execution.update({
        where: { id: executionId },
        data: { status: "awaiting_approval", currentStep: workflowStep.order },
      });
      await db.task.update({
        where: { id: execution.taskId },
        data: { status: "awaiting_approval" },
      });
      await addEvent(
        executionId,
        "approval_requested",
        `HITL mandatory approval after ${workflowStep.agent.name}.`,
      );
      await trace("awaiting_approval", { output });
      await mirrorGraphTask(step.id);
      return { executionId, status: "awaiting_approval" as const };
    }

    await db.executionStep.update({
      where: { id: step.id },
      data: { status: "completed", output, completedAt: new Date() },
    });
    await mirrorGraphTask(step.id);
    priorOutputs.push({ agent: workflowStep.agent.name, output });
    await addEvent(
      executionId,
      "step_completed",
      `${workflowStep.agent.name} completed “${workflowStep.name}”.`,
    );
    await trace("completed", { output });
  }

  const remaining = await db.graphTask.findMany({ where: { executionId } });
  if (remaining.length > 0) {
    if (remaining.some((node) => ["awaiting_approval", "awaiting_gateway"].includes(node.status))) {
      return { executionId, status: "awaiting_approval" as const };
    }
    if (remaining.some((node) => node.status === "denied" || node.status === "failed")) {
      const halted = remaining.find((node) => node.status === "denied" || node.status === "failed");
      return { executionId, status: (halted?.status ?? "failed") as "denied" | "failed" };
    }
    if (readyGraphTasks(remaining).length > 0) {
      return runUntilPause(executionId);
    }
    if (remaining.some((node) => node.status === "pending" || node.status === "running")) {
      return { executionId, status: "running" as const };
    }
  }

  await db.execution.update({
    where: { id: executionId },
    data: { status: "completed", completedAt: new Date() },
  });
  await db.task.update({
    where: { id: execution.taskId },
    data: { status: "completed" },
  });
  await addEvent(executionId, "completed", "Workflow finished.");
  await rollupExecution(executionId);
  return { executionId, status: "completed" as const };
}

export async function resolveApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  comment: string,
  resolvedBy: string,
) {
  const approval = await db.approval.findUnique({
    where: { id: approvalId },
    include: { execution: true, gatewayEvent: true },
  });

  if (!approval) throw new Error("Approval not found.");
  if (approval.status !== "pending") {
    throw new Error("This approval was already resolved.");
  }

  const operator = resolvedBy.trim() || "operator";

  await db.approval.update({
    where: { id: approvalId },
    data: {
      status: decision,
      comment: comment.trim() || null,
      resolvedAt: new Date(),
      resolvedBy: operator,
    },
  });

  if (approval.gatewayEventId) {
    await db.gatewayEvent.update({
      where: { id: approval.gatewayEventId },
      data: {
        status: decision === "approved" ? "approved" : "denied",
        resolvedAt: new Date(),
        resolvedBy: operator,
      },
    });
  }

  if (decision === "rejected") {
    await db.executionStep.update({
      where: { id: approval.stepId },
      data: { status: "failed", completedAt: new Date() },
    });
    await db.execution.update({
      where: { id: approval.executionId },
      data: { status: "failed", completedAt: new Date() },
    });
    await db.task.update({
      where: { id: approval.execution.taskId },
      data: { status: "failed" },
    });
    await addEvent(
      approval.executionId,
      "rejected",
      comment.trim()
        ? `${operator} rejected the gate: ${comment.trim()}`
        : `${operator} rejected the gate.`,
    );
    await addEvent(
      approval.executionId,
      "failed",
      approval.kind === "gateway"
        ? "Execution halted after the gateway hold was denied."
        : "Execution halted after rejection.",
    );
    await traceApprovalStep(approval.stepId, "failed");
    await mirrorGraphTask(approval.stepId);
    return { executionId: approval.executionId, status: "failed" as const };
  }

  if (approval.gatewayEventId) {
    await addEvent(
      approval.executionId,
      "gateway_approved",
      comment.trim()
        ? `${operator} allowed the tool request: ${comment.trim()}`
        : `${operator} allowed the tool request through the Security Gateway.`,
    );
    await db.execution.update({
      where: { id: approval.executionId },
      data: { status: "running" },
    });
    await db.task.update({
      where: { id: approval.execution.taskId },
      data: { status: "in_progress" },
    });
    return runUntilPause(approval.executionId);
  }

  await db.executionStep.update({
    where: { id: approval.stepId },
    data: { status: "completed", completedAt: new Date() },
  });
  await mirrorGraphTask(approval.stepId);
  await addEvent(
    approval.executionId,
    "approved",
    comment.trim()
      ? `${operator} approved the gate: ${comment.trim()}`
      : `${operator} approved the gate.`,
  );
  await traceApprovalStep(approval.stepId, "completed");
  await db.execution.update({
    where: { id: approval.executionId },
    data: { status: "running" },
  });
  await db.task.update({
    where: { id: approval.execution.taskId },
    data: { status: "in_progress" },
  });

  return runUntilPause(approval.executionId);
}
