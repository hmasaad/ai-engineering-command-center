import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AgentStateAscii,
  AgentStateLive,
  AgentStateTree,
} from "@/components/agent-state";
import { GhostLink, PageHeader, StatusBadge } from "@/components/ui";
import { compactWorkflowState, readWorkflowState } from "@/lib/agent-state";
import { db } from "@/lib/db";

export default async function WorkflowStateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const execution = await db.execution.findUnique({
    where: { id },
    include: { task: true, project: true, workflow: true },
  });
  if (!execution) notFound();
  const document = await readWorkflowState(id);
  if (!document) notFound();

  return (
    <div>
      <PageHeader
        kicker="Agent State"
        title={execution.task.title}
        description={`${execution.project.name} · ${execution.workflow.name}. This document is what the workflow still knows after each specialist returns.`}
        actions={
          <>
            <GhostLink href={`/history/${id}`}>History</GhostLink>
            <GhostLink href={`/observability/${id}`}>Trace</GhostLink>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge status={document.status} />
        <StatusBadge status={document.risk} />
        {document.approval_required ? <StatusBadge status="awaiting_approval" /> : null}
        <span className="rounded-full bg-panel px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          {document.workflow}
        </span>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-3">
          <AgentStateAscii />
          <AgentStateTree document={document} />
        </div>
        <div className="space-y-3">
          <AgentStateLive
            title={execution.task.title}
            status={document.status}
            href={`/state/${id}`}
            historyHref={`/history/${id}`}
            compact={compactWorkflowState(document)}
          />
          <section className="rounded-xl border border-line bg-panel/80 p-5">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
              Full state document
            </div>
            <pre className="overflow-x-auto rounded-lg border border-line bg-[#070d14] p-4 font-mono text-[12px] leading-6 text-live">
              {JSON.stringify(document, null, 2)}
            </pre>
            <Link
              href="/state"
              className="mt-3 inline-block text-xs text-muted hover:text-live"
            >
              All workflow state
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
