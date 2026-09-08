import Link from "next/link";
import {
  EmptyState,
  PageHeader,
  PrimaryLink,
  StatusBadge,
} from "@/components/ui";
import { db } from "@/lib/db";
import { formatRelative } from "@/lib/utils";

export default async function TasksPage() {
  const tasks = await db.task.findMany({
    orderBy: { createdAt: "desc" },
    include: { project: true },
  });

  return (
    <div>
      <PageHeader
        kicker="Registry"
        title="Tasks"
        description="Work items bound to a project. A task becomes real when a workflow runs it through the orchestrator."
        actions={<PrimaryLink href="/tasks/new">Create task</PrimaryLink>}
      />
      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks"
          body="Create a task on a registered project, then choose a workflow."
          action={<PrimaryLink href="/tasks/new">Create task</PrimaryLink>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              <tr>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="bg-panel/60">
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link href={`/tasks/${task.id}`} className="hover:text-live">
                      {task.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <Link href={`/projects/${task.projectId}`} className="hover:text-foreground">
                      {task.project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{task.type}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={task.priority} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {formatRelative(task.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
