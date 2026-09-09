import {
  INCIDENT_CAUSE_ASCII,
  INCIDENT_EVIDENCE_ASCII,
  INCIDENT_RESPONSE_ASCII,
  INCIDENT_RCA_ASCII,
} from "@/lib/operations";

export function IncidentResponseAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-danger/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(232,80,80,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Incident response
      </div>
      <pre className="text-center font-mono text-[12px] leading-6 text-danger sm:text-[13px]">
        {INCIDENT_RESPONSE_ASCII}
      </pre>
    </div>
  );
}

export function IncidentEvidenceAscii() {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-[#070d14] p-5">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Collect evidence
      </div>
      <pre className="font-mono text-[12px] leading-6 text-foreground sm:text-[13px]">
        {INCIDENT_EVIDENCE_ASCII}
      </pre>
    </div>
  );
}

export function IncidentCauseAscii() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="overflow-x-auto rounded-xl border border-warn/35 bg-[#070d14] p-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Chain
        </div>
        <pre className="text-center font-mono text-[12px] leading-6 text-warn sm:text-[13px]">
          {INCIDENT_CAUSE_ASCII}
        </pre>
      </div>
      <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Structured RCA
        </div>
        <pre className="font-mono text-[12px] leading-6 text-live sm:text-[13px] whitespace-pre-wrap">
          {INCIDENT_RCA_ASCII}
        </pre>
      </div>
    </div>
  );
}

export function IncidentCard() {
  const pct = 18;
  return (
    <section className="rounded-xl border border-danger/40 bg-panel/80 p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-danger">
        INCIDENT #9821
      </div>
      <div className="mt-3 text-sm font-medium">API Error Rate</div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-panel-2">
        <div className="h-full rounded-full bg-danger" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-xs">
        <span className="text-danger">██████████████████ {pct}%</span>
        <span className="uppercase tracking-wider text-danger">Status: CRITICAL</span>
      </div>
      <p className="mt-3 text-xs text-muted">
        Version 2.8.1 landed five minutes ago. 500s, latency, and database connections are up. The Command Center starts the Production alert playbook instead of a human grepping everything by hand.
      </p>
    </section>
  );
}
