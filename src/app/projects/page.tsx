import Link from "next/link";
import {
  EmptyState,
  PageHeader,
  PrimaryLink,
  StatusBadge,
} from "@/components/ui";
import { db } from "@/lib/db";
import { formatRelative } from "@/lib/utils";

export default async function ProjectsPage() {
  const projects = await db.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { tasks: true, executions: true } } },
  });

  return (
    <div>
      <PageHeader
        kicker="Registry"
        title="Projects"
        description="Register engineering systems here. GitHub is a linked capability of the project, not a separate product."
        actions={<PrimaryLink href="/projects/new">Register project</PrimaryLink>}
      />
      {projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="Add a service or repo to start routing tasks through specialist agents."
          action={<PrimaryLink href="/projects/new">Register project</PrimaryLink>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-xl border border-line bg-panel/80 p-5 hover:border-live/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">{project.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {project.description || "No description"}
                  </p>
                </div>
                <StatusBadge status={project.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-3 font-mono text-[11px] text-muted">
                <span>
                  {project.githubOwner
                    ? `${project.githubOwner}/${project.githubRepo}`
                    : "No GitHub link"}
                </span>
                <span>{project._count.tasks} tasks</span>
                <span>{project._count.executions} runs</span>
                <span>{formatRelative(project.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
