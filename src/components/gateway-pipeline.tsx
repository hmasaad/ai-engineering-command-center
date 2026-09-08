import { cx } from "@/lib/utils";

const STAGES = [
  { id: "agent", label: "Agent" },
  { id: "tool", label: "Tool Request" },
  { id: "gateway", label: "Tool Gateway" },
  { id: "policy", label: "Policy Engine" },
  { id: "verdict", label: "Allow / Deny / Approval" },
] as const;

export function GatewayPipeline({
  verdict,
  riskScore,
  toolName,
}: {
  verdict?: "allow" | "deny" | "human" | string;
  riskScore?: number;
  toolName?: string;
}) {
  const tone =
    verdict === "deny"
      ? "danger"
      : verdict === "human"
        ? "warn"
        : verdict === "allow"
          ? "live"
          : "muted";

  const verdictLabel =
    verdict === "human" ? "approval" : verdict === "allow" ? "allow" : verdict === "deny" ? "deny" : verdict;

  return (
    <div className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Tool Gateway
      </div>
      <div className="flex flex-col gap-2">
        {STAGES.map((stage, index) => (
          <div key={stage.id} className="flex items-center gap-3">
            <div className="flex w-6 flex-col items-center">
              <span
                className={cx(
                  "h-2.5 w-2.5 rounded-full",
                  stage.id === "verdict" && tone === "danger"
                    ? "bg-danger"
                    : stage.id === "verdict" && tone === "warn"
                      ? "bg-warn"
                      : stage.id === "gateway" || stage.id === "verdict"
                        ? "bg-live"
                        : "bg-line",
                )}
              />
              {index < STAGES.length - 1 ? (
                <span className="mt-1 h-4 w-px bg-line" />
              ) : null}
            </div>
            <div className="text-sm">
              {stage.label}
              {stage.id === "tool" && toolName ? (
                <span className="ml-2 font-mono text-[11px] text-muted">
                  {toolName}
                </span>
              ) : null}
              {stage.id === "policy" && typeof riskScore === "number" ? (
                <span className="ml-2 font-mono text-[11px] text-muted">
                  risk {riskScore}/100
                </span>
              ) : null}
              {stage.id === "verdict" && verdict ? (
                <span
                  className={cx(
                    "ml-2 font-mono text-[11px] uppercase",
                    tone === "danger"
                      ? "text-danger"
                      : tone === "warn"
                        ? "text-warn"
                        : "text-live",
                  )}
                >
                  {verdictLabel}
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
