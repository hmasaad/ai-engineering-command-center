import { PermissionRow } from "@/components/permission-row";
import { PolicyToggle } from "@/components/policy-toggle";
import { GhostLink, PageHeader, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";

export default async function ToolPermissionsPage() {
  const [permissions, policies] = await Promise.all([
    db.toolPermission.findMany({
      orderBy: [{ toolName: "asc" }, { agentSlug: "asc" }],
    }),
    db.securityPolicy.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Gateway policy"
        title="Tool Permission Manager"
        description="The Security Gateway reads this table on every tool request. Allow, deny, or hold for approval — per tool, globally or per agent."
        actions={
          <>
            <GhostLink href="/security/gateway">Security Gateway</GhostLink>
            <GhostLink href="/security/tools">Tool Layer</GhostLink>
            <GhostLink href="/security">Back to Security</GhostLink>
          </>
        }
      />

      <section className="mb-8 rounded-xl border border-line bg-panel/80 p-5">
        <h2 className="mb-3 text-sm font-medium">Detectors</h2>
        <div className="space-y-3">
          {policies.map((policy) => (
            <div
              key={policy.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-background px-4 py-3"
            >
              <div>
                <div className="text-sm font-medium">{policy.name}</div>
                <p className="mt-1 text-xs text-muted">{policy.description}</p>
                <div className="mt-1 font-mono text-[11px] text-muted">
                  weight {policy.weight}
                </div>
              </div>
              <PolicyToggle id={policy.id} enabled={policy.enabled} />
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-line bg-panel/80">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            <tr>
              <th className="px-4 py-3">Tool</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-mono text-xs">{row.toolName}</td>
                <td className="px-4 py-3">
                  {row.agentSlug === "*" ? (
                    <span className="text-muted">All agents</span>
                  ) : (
                    row.agentSlug
                  )}
                </td>
                <td className="px-4 py-3 w-48">
                  <PermissionRow id={row.id} mode={row.mode} />
                </td>
                <td className="px-4 py-3 text-xs text-muted">
                  <div className="mb-1">
                    <StatusBadge
                      status={
                        row.mode === "deny"
                          ? "denied"
                          : row.mode === "require_approval"
                            ? "awaiting_gateway"
                            : "allowed"
                      }
                    />
                  </div>
                  {row.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
