import {
  OBSERVABILITY_CHAIN_ASCII,
  OBSERVABILITY_EXAMPLE_LOG,
  OBSERVABILITY_QUESTIONS,
  OBSERVABILITY_TREE_ASCII,
  OBSERVABILITY_VS_SECURITY,
} from "@/lib/debug-log";

export function ObservabilityAscii() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="overflow-x-auto rounded-xl border border-warn/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(232,176,80,0.08)]">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Security
        </div>
        <pre className="font-mono text-[12px] leading-6 text-warn sm:text-[13px]">
          {`Should this action be allowed?`}
        </pre>
        <p className="mt-3 text-xs text-muted">
          Authentication, authorization, policy, risk, prompt injection, tool validation. Allow, deny, or hold for a human.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Observability
        </div>
        <pre className="font-mono text-[12px] leading-6 text-live sm:text-[13px]">
          {`What is the AI system actually doing?`}
        </pre>
        <p className="mt-3 text-xs text-muted">
          Which agent ran, which tools it called, what the model received and emitted, tokens, cost, duration, and why.
        </p>
      </div>
    </div>
  );
}

export function ObservabilityQuestions() {
  return (
    <section className="rounded-xl border border-line bg-panel/80 p-5">
      <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Something failed. You need to know
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {OBSERVABILITY_QUESTIONS.map((question) => (
          <li key={question} className="font-mono text-xs text-foreground">
            {question}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ObservabilityCaptureTree() {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="overflow-x-auto rounded-xl border border-line bg-[#070d14] p-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Multi-agent chain
        </div>
        <pre className="font-mono text-[12px] leading-6 text-live sm:text-[13px]">
          {OBSERVABILITY_CHAIN_ASCII}
        </pre>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-[#070d14] p-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Capture tree
        </div>
        <pre className="font-mono text-[11px] leading-5 text-foreground sm:text-[12px]">
          {OBSERVABILITY_TREE_ASCII}
        </pre>
      </div>
    </div>
  );
}

export function ObservabilityExampleLog() {
  return (
    <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Debug log
      </div>
      <pre className="font-mono text-[11px] leading-5 text-live sm:text-[12px] whitespace-pre">
        {OBSERVABILITY_EXAMPLE_LOG}
      </pre>
    </div>
  );
}

export function ObservabilityContrast() {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-[#070d14] p-5">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        Two questions
      </div>
      <pre className="font-mono text-[12px] leading-6 text-foreground sm:text-[13px] whitespace-pre-wrap">
        {OBSERVABILITY_VS_SECURITY}
      </pre>
    </div>
  );
}
