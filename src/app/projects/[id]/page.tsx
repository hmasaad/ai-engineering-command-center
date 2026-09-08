import Link from "next/link";
import { notFound } from "next/navigation";
import { SyncGithubButton } from "@/components/sync-github-button";
import {
  GhostLink,
  PageHeader,
  PrimaryLink,
  StatusBadge,
} from "@/components/ui";
import { db } from "@/lib/db";
import { projectGithubMeta } from "@/lib/queries";
import { formatRelative } from "@/lib/utils";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: {
      tasks: { orderBy: { createdAt: "desc" }, take: 8 },
      executions: {
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { task: true, workflow: true },
      },
    },
  });
  if (!project) notFound();
  const meta = projectGithubMeta(project);

  return (
    <div>
      <PageHeader
        kicker="Project"
        title={project.name}
        description={project.description || "No description yet."}
        actions={
          <>
            <GhostLink href="/projects">All projects</GhostLink>
            <PrimaryLink href="/development">Development</PrimaryLink>
            <PrimaryLink href="/operations">Operations</PrimaryLink>
            <PrimaryLink href="/security">Security</PrimaryLink>
            <PrimaryLink href={`/tasks/new?projectId=${project.id}`}>
              New task
            </PrimaryLink>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium">GitHub</h2>
            {project.githubUrl ? <SyncGithubButton projectId={project.id} /> : null}
          </div>
          {!project.githubUrl ? (
            <p className="text-sm text-muted">
              This project has no repository linked. Register another project with a
              GitHub URL, or treat this as a logical system only.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <a
                  href={project.githubUrl}
                  className="text-live hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {project.githubOwner}/{project.githubRepo}
                </a>
                <p className="mt-1 text-sm text-muted">
                  {meta?.description || "Synced repository"}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-muted">
                  <span>{meta?.visibility}</span>
                  <span>{meta?.language || "n/a"}</span>
                  <span>★ {meta?.stars ?? 0}</span>
                  <span>default {project.defaultBranch}</span>
                  <span>synced {formatRelative(project.lastSyncedAt)}</span>
                </div>
              </div>
              <div>
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Recent commits
                </h3>
                <ul className="space-y-2">
                  {(meta?.commits || []).length === 0 ? (
                    <li className="text-sm text-muted">No commits returned.</li>
                  ) : (
                    meta?.commits.map((commit) => (
                      <li key={commit.sha} className="text-sm">
                        <a href={commit.url} className="hover:text-live" target="_blank" rel="noreferrer">
                          <span className="font-mono text-xs text-muted">{commit.sha}</span>{" "}
                          {commit.message}
                        </a>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Open pull requests
                </h3>
                <ul className="space-y-2">
                  {(meta?.pullRequests || []).length === 0 ? (
                    <li className="text-sm text-muted">No open PRs.</li>
                  ) : (
                    meta?.pullRequests.map((pr) => (
                      <li key={pr.number} className="text-sm">
                        <a href={pr.url} className="hover:text-live" target="_blank" rel="noreferrer">
                          #{pr.number} {pr.title}
                        </a>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                  Open issues
                </h3>
                <ul className="space-y-2">
                  {(meta?.issues || []).length === 0 ? (
                    <li className="text-sm text-muted">No open issues in the last sync.</li>
                  ) : (
                    meta?.issues.map((issue) => (
                      <li key={issue.number} className="text-sm">
                        <a href={issue.url} className="hover:text-live" target="_blank" rel="noreferrer">
                          #{issue.number} {issue.title}
                        </a>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-panel/80 p-5">
            <h2 className="mb-3 text-sm font-medium">Tasks</h2>
            {project.tasks.length === 0 ? (
              <p className="text-sm text-muted">No tasks on this project yet.</p>
            ) : (
              <ul className="space-y-2">
                {project.tasks.map((task) => (
                  <li key={task.id}>
                    <Link href={`/tasks/${task.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-live">
                      {task.title}
                      <StatusBadge status={task.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="rounded-xl border border-line bg-panel/80 p-5">
            <h2 className="mb-3 text-sm font-medium">Executions</h2>
            {project.executions.length === 0 ? (
              <p className="text-sm text-muted">No workflow runs yet.</p>
            ) : (
              <ul className="space-y-2">
                {project.executions.map((execution) => (
                  <li key={execution.id}>
                    <Link href={`/history/${execution.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-live">
                      <span>
                        {execution.task.title}
                        <span className="block text-xs text-muted">{execution.workflow.name}</span>
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
    </div>
  );
}
