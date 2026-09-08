import { notFound } from "next/navigation";
import { GhostLink, PageHeader, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const workflow = await db.workflow.findUnique({
    where: { id },
    include: {
      project: true,
      steps: { include: { agent: true }, orderBy: { order: "asc" } },
      executions: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { task: true },
      },
    },
  });
  if (!workflow) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader
        kicker={workflow.isTemplate ? "Template" : "Project workflow"}
        title={workflow.name}
        description={workflow.description}
        actions={<GhostLink href="/workflows">All workflows</GhostLink>}
      />
      <p className="mb-6 text-sm text-muted">
        {workflow.project ? `Scoped to ${workflow.project.name}` : "Reusable across projects"}
      </p>
      <ol className="space-y-3">
        {workflow.steps.map((step, index) => (
          <li
            key={step.id}
            className="rounded-xl border border-line bg-panel/80 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Step {index + 1} · {step.action}
                </div>
                <div className="mt-1 font-medium">
                  {step.agent.name} · {step.name}
                </div>
                {step.instruction ? (
                  <p className="mt-1 text-sm text-muted">{step.instruction}</p>
                ) : null}
              </div>
              {step.requiresApproval ? (
                <StatusBadge status="awaiting_approval" />
              ) : (
                <StatusBadge status="active" />
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
