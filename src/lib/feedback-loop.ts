import { db } from "@/lib/db";

export const FEEDBACK_LOOP_ASCII = `        ┌──────────────────────────┐
        │                          ↓
        │                    OBSERVABILITY
        │                          │
        │                          ↓
SECURITY GATEWAY ←──────── ORCHESTRATOR
        ↑                       │
        │                       ↓
        │                AGENT EXECUTION
        │                       │
        │                       ↓
        └────────────── INCIDENT RESPONSE
                                │
                                ↓
                           REMEDIATION
                                │
                                ↓
                           VERIFICATION`;

export const FEEDBACK_LOOP_WALK_ASCII = `Observability detects abnormal behavior
       ↓
Incident Response investigates
       ↓
Orchestrator creates remediation workflow
       ↓
Security Gateway evaluates actions
       ↓
Agents execute
       ↓
Observability verifies the result`;

export type FeedbackLoopStageId =
  | "detect"
  | "investigate"
  | "orchestrate"
  | "gateway"
  | "execute"
  | "verify";

export const FEEDBACK_LOOP_STAGES: Array<{
  id: FeedbackLoopStageId;
  label: string;
  href: string;
  pick: (steps: Array<{ name: string; agent: { slug: string; name: string } }>) => number;
}> = [
  {
    id: "detect",
    label: "Observability detects abnormal behavior",
    href: "/observability",
    pick: (steps) => steps.findIndex((step) => /ingest production alert/i.test(step.name)),
  },
  {
    id: "investigate",
    label: "Incident Response investigates",
    href: "/operations",
    pick: (steps) =>
      steps.findIndex((step) =>
        /incident response|collect evidence|find root cause/i.test(step.name),
      ),
  },
  {
    id: "orchestrate",
    label: "Orchestrator creates remediation workflow",
    href: "/autonomous",
    pick: (steps) => steps.findIndex((step) => /remediation/i.test(step.name)),
  },
  {
    id: "gateway",
    label: "Security Gateway evaluates actions",
    href: "/security/gateway",
    pick: (steps) =>
      steps.findIndex((step) => /security review|human approval/i.test(step.name)),
  },
  {
    id: "execute",
    label: "Agents execute",
    href: "/history",
    pick: (steps) => steps.findIndex((step) => /generate the fix|deploy the fix/i.test(step.name)),
  },
  {
    id: "verify",
    label: "Observability verifies the result",
    href: "/observability",
    pick: (steps) => {
      const indexes = steps
        .map((step, index) => (/watch the window|verify/i.test(step.name) ? index : -1))
        .filter((index) => index >= 0);
      return indexes.length ? indexes[indexes.length - 1] : -1;
    },
  },
];

export async function getFeedbackLoopLive() {
  const execution = await db.execution.findFirst({
    where: {
      OR: [
        { workflow: { name: "Production alert" } },
        { task: { title: { contains: "INCIDENT" } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      workflow: true,
      task: true,
      steps: { include: { agent: true }, orderBy: { order: "asc" } },
    },
  });

  if (!execution) return null;

  return {
    id: execution.id,
    title: execution.task.title,
    status: execution.status,
    href: `/observability/${execution.id}`,
    historyHref: `/history/${execution.id}`,
    stages: FEEDBACK_LOOP_STAGES.map((stage) => {
      const index = stage.pick(execution.steps);
      const step = index >= 0 ? execution.steps[index] : null;
      return {
        id: stage.id,
        label: stage.label,
        href: stage.href,
        stepName: step?.name ?? null,
        agent: step?.agent.name ?? null,
        status: step?.status ?? "pending",
      };
    }),
  };
}
