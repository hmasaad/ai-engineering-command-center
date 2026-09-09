import { cx } from "@/lib/utils";
import { HITL_ACTIONS, HITL_ASCII, type HitlMode, type RiskBand } from "@/lib/hitl";

export function HitlAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-warn/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(232,176,80,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Human-in-the-loop
      </div>
      <pre className="text-center font-mono text-[12px] leading-6 text-warn sm:text-[13px]">
        {HITL_ASCII}
      </pre>
    </div>
  );
}

export function HitlTable() {
  return (
    <section className="overflow-x-auto rounded-xl border border-line bg-panel/80">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="border-b border-line font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          <tr>
            <th className="px-4 py-3">Action</th>
            <th className="px-4 py-3">Risk</th>
            <th className="px-4 py-3">Approval</th>
          </tr>
        </thead>
        <tbody>
          {HITL_ACTIONS.map((row) => (
            <tr key={row.action} className="border-b border-line last:border-0">
              <td className="px-4 py-3">{row.action}</td>
              <td className="px-4 py-3">
                <HitlBandBadge band={row.band} />
              </td>
              <td className="px-4 py-3">
                <HitlModeBadge mode={row.mode} approval={row.approval} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function HitlBandBadge({ band }: { band: RiskBand | string }) {
  const tone =
    band === "critical" || band === "high"
      ? "text-danger"
      : band === "medium"
        ? "text-warn"
        : "text-live";
  return (
    <span className={cx("font-mono text-[11px] uppercase tracking-wider", tone)}>{band}</span>
  );
}

export function HitlModeBadge({
  mode,
  approval,
}: {
  mode: HitlMode | string;
  approval?: string;
}) {
  const label =
    approval ||
    (mode === "automatic" ? "No" : mode === "recommended" ? "Optional" : "Yes");
  const tone =
    mode === "mandatory" ? "text-danger" : mode === "recommended" ? "text-warn" : "text-live";
  return (
    <span className={cx("font-mono text-[11px] uppercase tracking-wider", tone)}>{label}</span>
  );
}
