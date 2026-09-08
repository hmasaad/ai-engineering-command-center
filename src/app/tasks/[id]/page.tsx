import Link from "next/link";
import { notFound } from "next/navigation";
import { RunExecutionForm } from "@/components/run-execution-form";
import { GhostLink, PageHeader, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { formatRelative } from "@/lib/utils";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = await db.task.findUnique({
    where: { id },
    include: {
      project: true,
      executions: {
        orderBy: { createdAt: "desc" },
        include: { workflow: true },
      },
    },
  });
  if (!task) notFound();

  const workflows = await db.workflow.findMany({
    orderBy: { name: "asc" },
    where: { OR: [{ projectId: null }, { projectId: task.projectId }] },
  });

  return (
    <div>
      <PageHeader
        kicker={task.project.name}
        title={task.title}
        description={task.description}
        actions={<GhostLink href="/tasks">All tasks</GhostLink>}
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge status={task.status} />
        <StatusBadge status={task.priority} />
        <span className="rounded-full bg-panel px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          {task.type}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <h2 className="mb-3 text-sm font-medium">Run workflow</h2>
          <RunExecutionForm taskId={task.id} workflows={workflows} />
        </section>
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <h2 className="mb-3 text-sm font-medium">Execution history</h2>
          {task.executions.length === 0 ? (
            <p className="text-sm text-muted">This task has not been orchestrated yet.</p>
          ) : (
            <ul className="space-y-2">
              {task.executions.map((execution) => (
                <li key={execution.id}>
                  <Link
                    href={`/history/${execution.id}`}
                    className="flex items-center justify-between gap-2 text-sm hover:text-live"
                  >
                    <span>
                      {execution.workflow.name}
                      <span className="block text-xs text-muted">
                        {formatRelative(execution.createdAt)}
                      </span>
                    </span>
                    <StatusBadge status={execution.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
