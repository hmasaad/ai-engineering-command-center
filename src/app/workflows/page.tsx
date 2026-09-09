import Link from "next/link";
import {
  EmptyState,
  PageHeader,
  PrimaryLink,
  StatusBadge,
} from "@/components/ui";
import { db } from "@/lib/db";

export default async function WorkflowsPage() {
  const workflows = await db.workflow.findMany({
    orderBy: { name: "asc" },
    include: {
      project: true,
      steps: { include: { agent: true }, orderBy: { order: "asc" } },
      _count: { select: { executions: true } },
    },
  });

  return (
    <div>
      <PageHeader
        kicker="Orchestration"
        title="Workflows"
        description="A workflow is a task graph of specialists — including parallel waves and human gates — not a single unconstrained agent."
        actions={<PrimaryLink href="/workflows/new">Create workflow</PrimaryLink>}
      />
      {workflows.length === 0 ? (
        <EmptyState
          title="No workflows"
          body="Seed templates with npm run setup, or create your own chain."
          action={<PrimaryLink href="/workflows/new">Create workflow</PrimaryLink>}
        />
      ) : (
        <div className="space-y-3">
          {workflows.map((workflow) => (
            <Link
              key={workflow.id}
              href={`/workflows/${workflow.id}`}
              className="block rounded-xl border border-line bg-panel/80 p-5 hover:border-live/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{workflow.name}</h2>
                  <p className="mt-1 text-sm text-muted">{workflow.description}</p>
                </div>
                <StatusBadge status={workflow.isTemplate ? "active" : "in_progress"} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {workflow.steps.map((step, index) => (
                  <span
                    key={step.id}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-background px-3 py-1 text-xs"
                  >
                    <span className="font-mono text-[10px] text-muted">{index + 1}</span>
                    {step.agent.name}
                    {step.requiresApproval ? (
                      <span className="text-warn">gate</span>
                    ) : null}
                  </span>
                ))}
              </div>
              <div className="mt-3 font-mono text-[11px] text-muted">
                {workflow.kind === "service" ? "Service run" : workflow.domain} ·{" "}
                {workflow.project ? workflow.project.name : "Global template"} ·{" "}
                {workflow._count.executions} runs
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
