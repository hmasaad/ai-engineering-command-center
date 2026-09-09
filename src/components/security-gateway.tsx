import { cx } from "@/lib/utils";
import {
  SECURITY_GATEWAY_ASCII,
  SECURITY_GATEWAY_CHECK_DEFS,
  SECURITY_GATEWAY_EXAMPLE_ASCII,
  SECURITY_GATEWAY_LAYERS,
  SECURITY_GATEWAY_UNSAFE_ASCII,
  layerStatus,
  securityGatewayExamples,
  type GatewayCheck,
  type GatewayCheckStatus,
  type SecurityGatewayLayer,
} from "@/lib/security-gateway";

function statusTone(status?: GatewayCheckStatus | string) {
  if (status === "fail" || status === "deny") return "danger";
  if (status === "hold" || status === "human") return "warn";
  if (status === "pass" || status === "allow") return "live";
  return "muted";
}

function StatusDot({ tone }: { tone: string }) {
  return (
    <span
      className={cx(
        "h-2.5 w-2.5 rounded-full",
        tone === "danger" ? "bg-danger" : tone === "warn" ? "bg-warn" : tone === "live" ? "bg-live" : "bg-line",
      )}
    />
  );
}

export function SecurityGatewayAscii() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="overflow-x-auto rounded-xl border border-danger/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(232,80,80,0.08)]">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Without a gateway
        </div>
        <pre className="font-mono text-[12px] leading-6 text-danger sm:text-[13px]">
          {SECURITY_GATEWAY_UNSAFE_ASCII}
        </pre>
      </div>
      <div className="overflow-x-auto rounded-xl border border-warn/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(232,176,80,0.08)]">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Security Gateway
        </div>
        <pre className="font-mono text-[11px] leading-5 text-warn sm:text-[12px]">
          {SECURITY_GATEWAY_ASCII}
        </pre>
      </div>
    </div>
  );
}

export function SecurityGatewayExampleAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Allow / Deny / Human Approval
      </div>
      <pre className="font-mono text-[12px] leading-6 text-live sm:text-[13px]">
        {SECURITY_GATEWAY_EXAMPLE_ASCII}
      </pre>
    </div>
  );
}

export function SecurityGatewayExamples() {
  const examples = securityGatewayExamples();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {examples.map((example) => {
        const tone =
          example.verdict === "BLOCK"
            ? "border-danger/40"
            : example.verdict === "ALLOW"
              ? "border-live/40"
              : "border-warn/40";
        const label =
          example.verdict === "BLOCK"
            ? "text-danger"
            : example.verdict === "ALLOW"
              ? "text-live"
              : "text-warn";
        return (
          <section key={example.tool} className={cx("rounded-xl border bg-panel/80 p-5", tone)}>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
              {example.risk}
            </div>
            <div className="mt-2 font-mono text-sm">{example.tool}</div>
            <div className={cx("mt-2 font-mono text-[11px] uppercase tracking-wider", label)}>
              {example.verdict}
            </div>
            <p className="mt-2 text-xs text-muted">{example.why}</p>
          </section>
        );
      })}
    </div>
  );
}

export function SecurityGatewayChecks({ checks }: { checks?: GatewayCheck[] }) {
  const rows = SECURITY_GATEWAY_CHECK_DEFS.map((def) => {
    const live = checks?.find((item) => item.id === def.id);
    return {
      ...def,
      status: live?.status,
      detail: live?.detail,
    };
  });
  return (
    <section className="overflow-x-auto rounded-xl border border-line bg-panel/80">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          <tr>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">The gateway asks</th>
            <th className="px-4 py-3">Layer</th>
            <th className="px-4 py-3">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-mono text-xs text-muted">{row.id}</td>
              <td className="px-4 py-3">
                {row.question}
                {row.detail ? (
                  <span className="mt-1 block text-xs text-muted">{row.detail}</span>
                ) : null}
              </td>
              <td className="px-4 py-3 font-mono text-[11px] text-muted">{row.layer}</td>
              <td className="px-4 py-3">
                {row.status ? (
                  <span
                    className={cx(
                      "font-mono text-[11px] uppercase tracking-wider",
                      row.status === "fail"
                        ? "text-danger"
                        : row.status === "hold"
                          ? "text-warn"
                          : "text-live",
                    )}
                  >
                    {row.status === "fail" ? "block" : row.status === "hold" ? "hold" : "pass"}
                  </span>
                ) : (
                  <span className="font-mono text-[11px] text-muted">evaluated live</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function GatewayPipeline({
  verdict,
  riskScore,
  toolName,
  hitlLabel,
  checks,
}: {
  verdict?: "allow" | "deny" | "human" | string;
  riskScore?: number;
  toolName?: string;
  hitlLabel?: string;
  checks?: GatewayCheck[];
}) {
  const verdictTone = statusTone(verdict);
  const verdictLabel =
    verdict === "human"
      ? "human approval"
      : verdict === "allow"
        ? "allow"
        : verdict === "deny"
          ? "deny"
          : verdict;

  return (
    <div className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Security Gateway
      </div>
      <div className="flex flex-col gap-2">
        <Stage label="Agent" />
        <Stage
          label="Tool Request"
          detail={toolName}
        />
        <div className="rounded-lg border border-warn/30 bg-background px-3 py-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-warn">
            Inspect
          </div>
          <div className="flex flex-col gap-2">
            {SECURITY_GATEWAY_LAYERS.map((layer) => {
              const status = checks?.length ? layerStatus(checks, layer as SecurityGatewayLayer) : undefined;
              return (
                <Stage
                  key={layer}
                  label={layer}
                  tone={status ? statusTone(status) : "muted"}
                  detail={
                    layer === "Risk Analysis" && typeof riskScore === "number"
                      ? `risk ${riskScore}/100`
                      : status
                  }
                />
              );
            })}
          </div>
        </div>
        <Stage
          label="Allow / Deny / Human Approval"
          tone={verdict ? verdictTone : "muted"}
          detail={
            verdict
              ? `${verdictLabel}${hitlLabel ? ` · ${hitlLabel}` : ""}`
              : undefined
          }
        />
        <Stage label="Tool" />
      </div>
    </div>
  );
}

function Stage({
  label,
  detail,
  tone = "muted",
}: {
  label: string;
  detail?: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <StatusDot tone={tone} />
      <div className="text-sm">
        {label}
        {detail ? (
          <span
            className={cx(
              "ml-2 font-mono text-[11px] uppercase",
              tone === "danger" ? "text-danger" : tone === "warn" ? "text-warn" : tone === "live" ? "text-live" : "text-muted",
            )}
          >
            {detail}
          </span>
        ) : null}
      </div>
    </div>
  );
}
