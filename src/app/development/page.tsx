import Link from "next/link";
import { DevelopmentRunForm } from "@/components/development-run-form";
import { EmptyState, PageHeader, PrimaryLink, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { DEVELOPMENT_SERVICES } from "@/lib/development";
import { projectGithubMeta } from "@/lib/queries";
import { formatRelative } from "@/lib/utils";

export default async function DevelopmentPage() {
  const [projects, playbooks, recent] = await Promise.all([
    db.project.findMany({ orderBy: { name: "asc" } }),
    db.workflow.findMany({
      where: {
        kind: "playbook",
        isTemplate: true,
        OR: [{ domain: "development" }, { name: "AI PR Resolution" }],
      },
      orderBy: { name: "asc" },
    }),
    db.execution.findMany({
      where: { workflow: { domain: "development" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { project: true, task: true, workflow: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Phase 2"
        title="Development Intelligence"
        description="Architect, Developer, PR Reviewer, Bug Investigation, tests, refactoring, debt, and docs are Command Center services — not independent products. Low-risk reads and tests run automatically. Create PR is review recommended. High-risk actions still require a human."
        actions={<PrimaryLink href="/workflows">Playbooks</PrimaryLink>}
      />

      <div className="mb-8 rounded-xl border border-line bg-panel/80 p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Development
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {DEVELOPMENT_SERVICES.map((service) => (
            <Link
              key={service.slug}
              href={`/development/${service.slug}`}
              className="rounded-lg border border-line bg-background px-4 py-3 hover:border-live/40"
            >
              <div className="text-sm font-medium">{service.name}</div>
              <p className="mt-1 text-xs text-muted">{service.description}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <h2 className="mb-3 text-sm font-medium">Run a service</h2>
          {projects.length === 0 ? (
            <EmptyState
              title="Register a project first"
              body="Development Intelligence is a layer on Command Center projects."
              action={<PrimaryLink href="/projects/new">Register project</PrimaryLink>}
            />
          ) : (
            <DevelopmentRunForm
              projects={projects.map((project) => {
                const meta = projectGithubMeta(project);
                return {
                  id: project.id,
                  name: project.name,
                  pullRequests: meta?.pullRequests || [],
                  issues: meta?.issues || [],
                };
              })}
              services={DEVELOPMENT_SERVICES.map((service) => ({
                slug: service.slug,
                name: service.name,
              }))}
              playbooks={playbooks}
            />
          )}
        </div>
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <h2 className="mb-3 text-sm font-medium">Recent development runs</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">
              No development executions yet. Run a service or a playbook.
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((execution) => (
                <li key={execution.id}>
                  <Link
                    href={`/history/${execution.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line bg-background px-3 py-2 text-sm hover:border-live/40"
                  >
                    <span>
                      {execution.task.title}
                      <span className="block text-xs text-muted">
                        {execution.workflow.name} · {formatRelative(execution.createdAt)}
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
