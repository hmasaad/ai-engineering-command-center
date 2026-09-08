"use client";

import { useState } from "react";
import { decideApproval } from "@/lib/actions";
import { Field, fieldClass } from "@/components/ui";

export function ApprovalActions({ approvalId }: { approvalId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setError(null);
    setPending(true);
    const result = await decideApproval(formData);
    setPending(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form action={submit} className="space-y-3">
      <input type="hidden" name="approvalId" value={approvalId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Operator">
          <input name="resolvedBy" placeholder="your name" className={fieldClass} />
        </Field>
        <Field label="Comment">
          <input name="comment" placeholder="Optional note" className={fieldClass} />
        </Field>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="approved"
          disabled={pending}
          className="inline-flex items-center rounded-lg bg-live px-3 py-2 text-sm font-medium text-background hover:bg-live/90 disabled:opacity-60"
        >
          {pending ? "Working…" : "Approve and continue"}
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending}
          className="inline-flex items-center rounded-lg bg-danger px-3 py-2 text-sm font-medium text-background hover:bg-danger/90 disabled:opacity-60"
        >
          Reject and halt
        </button>
      </div>
    </form>
  );
}
