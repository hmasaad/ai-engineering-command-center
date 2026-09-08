import { notFound } from "next/navigation";
import { OperationsRunForm } from "@/components/operations-run-form";
import { EmptyState, GhostLink, PageHeader, PrimaryLink } from "@/components/ui";
import { db } from "@/lib/db";
import { OPERATIONS_PLAYBOOKS, OPERATIONS_SERVICES } from "@/lib/operations";

export default async function OperationsServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = OPERATIONS_SERVICES.find((item) => item.slug === slug);
  if (!service) notFound();

  const [agent, projects, playbooks] = await Promise.all([
    db.agent.findUnique({ where: { slug } }),
    db.project.findMany({ orderBy: { name: "asc" } }),
    db.workflow.findMany({
      where: { domain: "operations", kind: "playbook", isTemplate: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const related = OPERATIONS_PLAYBOOKS.filter((playbook) =>
    playbook.steps.some((step) => step.agent === slug),
  );

  return (
    <div className="max-w-3xl">
      <PageHeader
        kicker="Operations service"
        title={service.name}
        description={service.description}
        actions={<GhostLink href="/operations">All services</GhostLink>}
      />
      <div className="mb-6 flex flex-wrap gap-1.5">
        {service.capabilities.map((cap) => (
          <span
            key={cap}
            className="rounded-full bg-panel-2 px-3 py-1 font-mono text-[10px] text-muted"
          >
            {cap}
          </span>
        ))}
      </div>
      <p className="mb-6 text-sm text-muted">{service.systemPrompt}</p>

      {related.length > 0 ? (
        <section className="mb-6 rounded-xl border border-line bg-panel/80 p-5">
          <h2 className="mb-2 text-sm font-medium">Playbooks that include this service</h2>
          <ul className="space-y-1 text-sm text-muted">
            {related.map((playbook) => (
              <li key={playbook.name}>
                {playbook.name} — {playbook.description}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {projects.length === 0 || !agent ? (
        <EmptyState
          title="Nothing to run against"
          body="Register a project, then run this service through the orchestrator and gateway."
          action={<PrimaryLink href="/projects/new">Register project</PrimaryLink>}
        />
      ) : (
        <OperationsRunForm
          defaultServiceSlug={slug}
          projects={projects.map((project) => ({ id: project.id, name: project.name }))}
          services={OPERATIONS_SERVICES.map((item) => ({
            slug: item.slug,
            name: item.name,
          }))}
          playbooks={playbooks}
        />
      )}
    </div>
  );
}
