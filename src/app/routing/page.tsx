import Link from "next/link";
import {
  ModelRouterAscii,
  ModelRouterExamples,
  ModelRouterLanes,
  ModelRouterLive,
  ModelRouterUnsafeAscii,
} from "@/components/model-router";
import { GhostLink, PageHeader, PrimaryLink, StatusBadge } from "@/components/ui";
import { getModelRouteLedger, getRecentModelRoutes } from "@/lib/model-router";

export default async function ModelRoutingPage() {
  const [ledger, recent] = await Promise.all([
    getModelRouteLedger(),
    getRecentModelRoutes(),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Control plane"
        title="Model Routing"
        description="Once multiple agents exist, do not make every agent use the same model. The runtime routes the task: cheap/fast for simple work, reasoning for architecture and RCA, specialized for security — optimizing cost, latency, and quality."
        actions={
          <>
            <GhostLink href="/runtime">Agent Runtime</GhostLink>
            <GhostLink href="/evals">Agent Evals</GhostLink>
            <GhostLink href="/state">Agent State</GhostLink>
            <PrimaryLink href="/observability">Traces</PrimaryLink>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <ModelRouterAscii />
        <ModelRouterUnsafeAscii />
      </div>
      <p className="mt-3 max-w-3xl text-xs text-muted">
        The Agent Runtime still binds identity, context, memory, and tools. The Model Router is the decision that picks which model that bound run actually calls.
      </p>

      <div className="mt-8">
        <ModelRouterLanes />
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        <ModelRouterExamples />
        {ledger ? (
          <ModelRouterLive ledger={ledger} />
        ) : (
          <p className="self-center text-sm text-muted">
            Run Production alert to see fast, reasoning, and specialized lanes on one workflow.
          </p>
        )}
      </div>

      <section className="mt-8 rounded-xl border border-line bg-panel/80 p-5">
        <h2 className="mb-3 text-sm font-medium">Recent routes</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">
            No bound runs yet. Start a workflow; the router picks a lane before the specialist executes.
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-background px-3 py-2 text-sm hover:border-live/40"
                >
                  <span>
                    {row.agent} · {row.stepName}
                    <span className="block text-xs text-muted">
                      {row.project} · {row.title} · {row.model} · {row.reason}
                    </span>
                  </span>
                  <StatusBadge status={row.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
