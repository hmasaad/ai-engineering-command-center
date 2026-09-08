import Link from "next/link";
import { AutonomousIntentForm } from "@/components/autonomous-intent-form";
import { EmptyState, PageHeader, PrimaryLink, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { AUTONOMOUS_SERVICES } from "@/lib/autonomous";
import { formatRelative } from "@/lib/utils";

export default async function AutonomousPage() {
  const [projects, recent] = await Promise.all([
    db.project.findMany({ orderBy: { name: "asc" } }),
    db.execution.findMany({
      where: { workflow: { domain: "autonomous" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { project: true, task: true, workflow: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Phase 6"
        title="Autonomous Engineering"
        description="The developer states a goal. The orchestrator expands it into a task graph — agents, dependencies, risk, and a human gate — then runs it through the registry and the security gateway."
        actions={<PrimaryLink href="/observability">Traces</PrimaryLink>}
      />

      <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        {projects.length === 0 ? (
          <EmptyState
            title="Register a project first"
            body="Autonomous Engineering is a layer on Command Center projects, not a separate product."
            action={<PrimaryLink href="/projects/new">Register project</PrimaryLink>}
          />
        ) : (
          <AutonomousIntentForm
            projects={projects.map((project) => ({ id: project.id, name: project.name }))}
          />
        )}
        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-panel/80 p-5">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
              Specialists the intent may call
            </div>
            <ul className="space-y-2 text-sm">
              {AUTONOMOUS_SERVICES.map((service) => (
                <li key={service.slug} className="rounded-lg border border-line bg-background px-3 py-2">
                  <div className="font-medium">{service.name}</div>
                  <p className="mt-0.5 text-xs text-muted">{service.description}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Architecture, PR Reviewer, Security, Test Generation, Regression, Deployment, Monitoring, and Recovery already live in the platform. The intent layer composes them.
            </p>
          </section>
        </div>
      </div>

      <section className="rounded-xl border border-line bg-panel/80 p-5">
        <h2 className="mb-3 text-sm font-medium">Recent autonomous runs</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">
          No expanded intents yet. Type “Review this PR and prepare a fix.” and run it.
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
  );
}
