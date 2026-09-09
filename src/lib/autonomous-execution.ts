import { db } from "@/lib/db";
import { displayToolName } from "@/lib/debug-log";
import { hitlForTool, type HitlMode, type RiskBand } from "@/lib/hitl";

export type AutonomyLane = "automatic" | "approval" | "mandatory";

export const AUTONOMY_INITIAL_ASCII = `AI suggests
      ↓
Human approves
      ↓
System executes`;

export const AUTONOMY_CONTROLLED_ASCII = `AI detects
      ↓
AI investigates
      ↓
AI plans
      ↓
Risk evaluation
      ↓
┌─────────────────────┐
│                     │
│ LOW RISK            │
│ → Automatic         │
│                     │
│ MEDIUM RISK         │
│ → Approval          │
│                     │
│ HIGH RISK           │
│ → Mandatory human   │
│                     │
└─────────────────────┘`;

export const AUTONOMY_UNSAFE_ASCII = `Let the AI do everything.`;

export const AUTONOMY_EXAMPLES: Array<{
  tool: string;
  band: RiskBand;
  lane: AutonomyLane;
  why: string;
}> = [
  {
    tool: "github.read_file",
    band: "low",
    lane: "automatic",
    why: "Read-only. The specialist can fetch the file without waking a human.",
  },
  {
    tool: "github.create_pr",
    band: "medium",
    lane: "approval",
    why: "A pull request is a side effect. Review recommended before it opens.",
  },
  {
    tool: "deploy.apply",
    band: "high",
    lane: "mandatory",
    why: "Production apply is never automatic. A human must clear the gate.",
  },
];

export function autonomyLane(mode: HitlMode | string): AutonomyLane {
  if (mode === "automatic") return "automatic";
  if (mode === "recommended") return "approval";
  return "mandatory";
}

export function autonomyLaneLabel(lane: AutonomyLane) {
  if (lane === "automatic") return "Automatic";
  if (lane === "approval") return "Approval";
  return "Mandatory human";
}

export async function getAutonomyLedger() {
  const [events, pending] = await Promise.all([
    db.gatewayEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 36,
      include: {
        agent: true,
        execution: { include: { task: true } },
      },
    }),
    db.approval.findMany({
      where: { status: "pending" },
      select: { kind: true },
    }),
  ]);

  const seen = new Set<string>();
  const rows = events
    .filter((event) => event.toolName !== "artifact.write")
    .flatMap((event) => {
      const key = `${event.executionId}:${event.toolName}`;
      if (seen.has(key)) return [];
      seen.add(key);
      const hitl = hitlForTool(event.toolName);
      const lane = autonomyLane(hitl.mode);
      return [
        {
          id: event.id,
          tool: displayToolName(event.toolName),
          toolName: event.toolName,
          agent: event.agent.name,
          title: event.execution.task.title,
          href: `/history/${event.executionId}`,
          verdict: event.verdict,
          band: hitl.band,
          lane,
          label: autonomyLaneLabel(lane),
        },
      ];
    });

  const pick = (lane: AutonomyLane) => rows.filter((row) => row.lane === lane).slice(0, 4);

  return {
    automatic: pick("automatic"),
    approval: pick("approval"),
    mandatory: pick("mandatory"),
    pending: {
      approval: pending.filter((row) => row.kind === "recommended").length,
      mandatory: pending.filter(
        (row) => row.kind === "mandatory" || row.kind === "gateway" || row.kind === "workflow",
      ).length,
    },
  };
}
