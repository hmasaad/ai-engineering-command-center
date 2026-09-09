import Link from "next/link";
import { ApprovalActions } from "@/components/approval-actions";
import { HitlAscii, HitlBandBadge, HitlTable } from "@/components/hitl";
import { EmptyState, PageHeader, PrimaryLink, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { formatRelative } from "@/lib/utils";

function kindLabel(kind: string) {
  if (kind === "recommended") return "Review recommended";
  if (kind === "mandatory") return "Mandatory approval";
  if (kind === "gateway") return "Gateway hold";
  if (kind === "workflow") return "Workflow gate";
  return kind;
}

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

  const mandatory = approvals.filter(
    (row) => row.kind === "mandatory" || row.kind === "gateway" || row.kind === "workflow",
  );
  const recommended = approvals.filter((row) => row.kind === "recommended");

  return (
    <div>
      <PageHeader
        kicker="Human-in-the-loop"
        title="Approval queue"
        description="The first version is not fully autonomous. Low risk runs automatically. Medium risk asks for a review. High and critical risk wait here."
        actions={<PrimaryLink href="/security/tools">Tool Layer</PrimaryLink>}
      />

      <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <HitlAscii />
        <p className="self-center text-sm text-muted">
          This is what turns the Command Center from a chatbot into an engineering control plane. Agents can request tools. They cannot skip the human when the action is medium, high, or critical.
        </p>
      </div>

      <div className="mb-8">
        <HitlTable />
      </div>

      {approvals.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          body="Low-risk reads, tests, and branches continue automatically. Create PR, config changes, deploys, and database deletes still stop for a human."
          action={<PrimaryLink href="/tasks">Open tasks</PrimaryLink>}
        />
      ) : (
        <div className="space-y-8">
          {mandatory.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-sm font-medium text-danger">Mandatory</h2>
              {mandatory.map((approval) => (
                <ApprovalCard key={approval.id} approval={approval} />
              ))}
            </section>
          ) : null}
          {recommended.length > 0 ? (
            <section className="space-y-4">
              <h2 className="text-sm font-medium text-warn">Review recommended</h2>
              {recommended.map((approval) => (
                <ApprovalCard key={approval.id} approval={approval} />
              ))}
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ApprovalCard({
  approval,
}: {
  approval: {
    id: string;
    kind: string;
    status: string;
    summary: string;
    requestedAt: Date;
    executionId: string;
    execution: {
      task: { title: string };
      project: { name: string };
      workflow: { name: string };
    };
    step: {
      name: string;
      output: string | null;
      agent: { name: string };
    };
  };
}) {
  return (
    <section className="rounded-xl border border-warn/30 bg-panel/80 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-warn">
            {kindLabel(approval.kind)} · {approval.step.agent.name} · {approval.step.name}
          </div>
          <h2 className="mt-1 text-lg font-medium">{approval.execution.task.title}</h2>
          <p className="mt-1 text-sm text-muted">
            {approval.execution.project.name} · {approval.execution.workflow.name} ·{" "}
            {formatRelative(approval.requestedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {approval.kind === "recommended" ? (
            <HitlBandBadge band="medium" />
          ) : (
            <HitlBandBadge band="high" />
          )}
          <StatusBadge status={approval.status} />
        </div>
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
  );
}
