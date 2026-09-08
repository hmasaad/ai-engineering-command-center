import Link from "next/link";
import { OperationsRunForm } from "@/components/operations-run-form";
import { ProductionAlertFlow } from "@/components/production-alert-flow";
import { EmptyState, PageHeader, PrimaryLink, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { OPERATIONS_SERVICES } from "@/lib/operations";
import { formatRelative } from "@/lib/utils";

export default async function OperationsPage() {
  const [projects, playbooks, recent] = await Promise.all([
    db.project.findMany({ orderBy: { name: "asc" } }),
    db.workflow.findMany({
      where: { domain: "operations", kind: "playbook", isTemplate: true },
      orderBy: { name: "asc" },
    }),
    db.execution.findMany({
      where: { workflow: { domain: "operations" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { project: true, task: true, workflow: true },
    }),
  ]);

  const orderedPlaybooks = [...playbooks].sort((a, b) => {
    if (a.name === "Production alert") return -1;
    if (b.name === "Production alert") return 1;
    return a.name.localeCompare(b.name);
  });
  const productionAlert = orderedPlaybooks.find((item) => item.name === "Production alert");

  return (
    <div>
      <PageHeader
        kicker="Phase 4"
        title="Operations"
        description="Monitoring, incident, logs, RCA, deploy, rollback, performance, and recovery are Command Center services. A production alert still pauses at human approval before deploy — and every tool request still hits the security gateway."
        actions={<PrimaryLink href="/workflows">Playbooks</PrimaryLink>}
      />

      <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <ProductionAlertFlow />
        <div className="rounded-xl border border-line bg-panel/80 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Operations
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {OPERATIONS_SERVICES.map((service) => (
              <Link
                key={service.slug}
                href={`/operations/${service.slug}`}
                className="rounded-lg border border-line bg-background px-4 py-3 hover:border-live/40"
              >
                <div className="text-sm font-medium">{service.name}</div>
                <p className="mt-1 text-xs text-muted">{service.description}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <h2 className="mb-3 text-sm font-medium">Run a service or playbook</h2>
          {projects.length === 0 ? (
            <EmptyState
              title="Register a project first"
              body="Operations is a layer on Command Center projects, not a standalone pager."
              action={<PrimaryLink href="/projects/new">Register project</PrimaryLink>}
            />
          ) : (
            <OperationsRunForm
              defaultPlaybookId={productionAlert?.id}
              projects={projects.map((project) => ({ id: project.id, name: project.name }))}
              services={OPERATIONS_SERVICES.map((service) => ({
                slug: service.slug,
                name: service.name,
              }))}
              playbooks={orderedPlaybooks}
            />
          )}
        </div>
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <h2 className="mb-3 text-sm font-medium">Recent operations runs</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">
              No operations executions yet. Paste an alert and run Production alert.
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
