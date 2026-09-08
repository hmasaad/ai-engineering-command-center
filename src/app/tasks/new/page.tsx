import { TaskForm } from "@/components/task-form";
import { EmptyState, GhostLink, PageHeader, PrimaryLink } from "@/components/ui";
import { db } from "@/lib/db";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const query = await searchParams;
  const projectId =
    typeof query.projectId === "string" ? query.projectId : undefined;
  const [projects, workflows] = await Promise.all([
    db.project.findMany({ orderBy: { name: "asc" } }),
    db.workflow.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl">
      <PageHeader
        kicker="Tasks"
        title="Create a task"
        description="Attach work to a project. Optionally pick a workflow and send it through the orchestrator immediately."
        actions={<GhostLink href="/tasks">Back</GhostLink>}
      />
      {projects.length === 0 ? (
        <EmptyState
          title="Register a project first"
          body="Tasks belong to projects. Add a system, then come back."
          action={<PrimaryLink href="/projects/new">Register project</PrimaryLink>}
        />
      ) : (
        <TaskForm
          projects={projects}
          workflows={workflows}
          defaultProjectId={projectId}
        />
      )}
    </div>
  );
}
