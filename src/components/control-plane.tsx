import Link from "next/link";
import { Fragment } from "react";
import { CONTROL_PLANE, CONTROL_PLANE_ASCII } from "@/lib/control-plane";
import { cx } from "@/lib/utils";

export function ControlPlaneAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <pre className="min-w-[22rem] text-center font-mono text-[12px] leading-6 text-live sm:text-[13px]">
        {CONTROL_PLANE_ASCII}
      </pre>
    </div>
  );
}

export function ControlPlaneLayers({
  approvals,
}: {
  approvals?: number;
}) {
  const tools = CONTROL_PLANE.find((layer) => layer.id === "tools");
  const agents = CONTROL_PLANE.find((layer) => layer.id === "agents");
  const rest = CONTROL_PLANE.filter(
    (layer) => layer.id !== "tools" && layer.id !== "agents",
  );
  const beforeSplit = rest.slice(0, 6);
  const afterSplit = rest.slice(6);

  return (
    <div className="flex flex-col items-center gap-2">
      {beforeSplit.map((layer, index) => (
        <Fragment key={layer.id}>
          <LayerChip layer={layer} />
          {index < beforeSplit.length - 1 ? <Pipe /> : null}
        </Fragment>
      ))}
      <Pipe />
      <div className="grid w-full max-w-md gap-2 sm:grid-cols-2">
        {tools ? <LayerChip layer={tools} /> : null}
        {agents ? <LayerChip layer={agents} /> : null}
      </div>
      <Pipe />
      {afterSplit.map((layer, index) => (
        <Fragment key={layer.id}>
          <LayerChip
            layer={layer}
            count={layer.id === "risk" ? approvals : undefined}
          />
          {index < afterSplit.length - 1 ? <Pipe /> : null}
        </Fragment>
      ))}
    </div>
  );
}

function Pipe() {
  return <div className="h-3 w-px bg-line" />;
}

function LayerChip({
  layer,
  count,
}: {
  layer: (typeof CONTROL_PLANE)[number];
  count?: number;
}) {
  const tone =
    layer.tone === "warn"
      ? "border-warn/40 text-warn"
      : layer.tone === "live"
        ? "border-live/40 text-live"
        : "border-line text-foreground";
  return (
    <Link
      href={layer.href}
      className={cx(
        "flex w-full items-center justify-between rounded-lg border bg-panel-2 px-4 py-2.5 text-sm sm:max-w-md",
        tone,
      )}
    >
      <span className="font-medium">{layer.label}</span>
      {typeof count === "number" ? (
        <span className="font-mono text-xs text-muted">{count}</span>
      ) : null}
    </Link>
  );
}
