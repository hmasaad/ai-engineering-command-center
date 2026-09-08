import Link from "next/link";
import { ApprovalActions } from "@/components/approval-actions";
import { EmptyState, PageHeader, PrimaryLink, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { formatRelative } from "@/lib/utils";

export default async function ApprovalsPage() {
  const approvals = await db.approval.findMany({
    where: { status: "pending" },
    orderBy: { requestedAt: "asc" },
    include: {
      execution: {
        include: {
          project: true,
          task: true,
          workflow: true,
        },
      },
      step: { include: { agent: true } },
    },
  });

  return (
    <div>
      <PageHeader
        kicker="Human gate"
        title="Approval queue"
        description="The orchestrator and the Agent Security Gateway pause here. Approve to continue. Reject to halt."
      />
      {approvals.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          body="When a workflow step requires a human gate, it appears here with the specialist’s artifact."
          action={<PrimaryLink href="/tasks">Open tasks</PrimaryLink>}
        />
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <section
              key={approval.id}
              className="rounded-xl border border-warn/30 bg-panel/80 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-warn">
                    {approval.kind === "gateway" ? "Gateway" : "Workflow"} · {approval.step.agent.name} · {approval.step.name}
                  </div>
                  <h2 className="mt-1 text-lg font-medium">
                    {approval.execution.task.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {approval.execution.project.name} · {approval.execution.workflow.name} ·{" "}
                    {formatRelative(approval.requestedAt)}
                  </p>
                </div>
                <StatusBadge status={approval.status} />
              </div>
              <p className="mt-3 text-sm">{approval.summary}</p>
              {approval.step.output ? (
                <pre className="artifact mt-4 max-h-80 overflow-auto rounded-lg border border-line bg-background p-4">
                  {approval.step.output}
                </pre>
              ) : null}
              <div className="mt-4">
                <ApprovalActions approvalId={approval.id} />
              </div>
              <Link
                href={`/history/${approval.executionId}`}
                className="mt-3 inline-block text-xs text-muted hover:text-foreground"
              >
                Open full execution →
              </Link>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
