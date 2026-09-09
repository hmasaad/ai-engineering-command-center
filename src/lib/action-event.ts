import { hitlForTool, type RiskBand } from "@/lib/hitl";

export type ActionEventStatus = "success" | "running" | "waiting" | "failed";

export type ActionEvent = {
  workflow_id: string;
  agent: string;
  action: string;
  tool: string;
  risk: RiskBand;
  duration_ms: number;
  tokens: number;
  status: ActionEventStatus;
};

export function eventStatus(result: string): ActionEventStatus {
  if (result === "completed" || result === "allowed" || result === "approved" || result === "success") {
    return "success";
  }
  if (result === "running") return "running";
  if (
    result === "awaiting_approval" ||
    result === "awaiting_gateway" ||
    result === "pending" ||
    result === "waiting"
  ) {
    return "waiting";
  }
  return "failed";
}

export function eventRisk(tool: string, score?: number): RiskBand {
  const fromTool = hitlForTool(tool).band;
  if (score == null) return fromTool;
  const fromScore: RiskBand =
    score >= 70 ? "critical" : score >= 50 ? "high" : score >= 30 ? "medium" : "low";
  const rank = { low: 0, medium: 1, high: 2, critical: 3 };
  return rank[fromScore] > rank[fromTool] ? fromScore : fromTool;
}

export function toActionEvent(input: {
  workflowId: string;
  agent: string;
  action: string;
  tool?: string | null;
  riskScore?: number;
  durationMs?: number | null;
  tokens?: number | null;
  status: string;
}): ActionEvent {
  const tool = input.tool || "artifact.write";
  return {
    workflow_id: input.workflowId,
    agent: input.agent,
    action: input.action,
    tool,
    risk: eventRisk(tool, input.riskScore),
    duration_ms: Math.max(0, Math.round(input.durationMs || 0)),
    tokens: Math.max(0, Math.round(input.tokens || 0)),
    status: eventStatus(input.status),
  };
}

export function parseActionEvent(payload: string | null): ActionEvent | null {
  if (!payload) return null;
  try {
    const value = JSON.parse(payload) as Partial<ActionEvent>;
    if (!value.workflow_id || !value.agent || !value.action || !value.tool) return null;
    const event = toActionEvent({
      workflowId: value.workflow_id,
      agent: value.agent,
      action: value.action,
      tool: value.tool,
      durationMs: value.duration_ms,
      tokens: value.tokens,
      status: value.status || "running",
    });
    if (value.risk === "low" || value.risk === "medium" || value.risk === "high" || value.risk === "critical") {
      event.risk = value.risk;
    }
    return event;
  } catch {
    return null;
  }
}

export function workflowBoardStatus(status: string) {
  if (status === "completed") return "Completed";
  if (status === "awaiting_approval" || status === "awaiting_gateway") return "Waiting";
  if (status === "failed" || status === "denied") return "Failed";
  if (status === "running") return "Running";
  return "Pending";
}
