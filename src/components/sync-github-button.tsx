"use client";

import { useState } from "react";
import { syncProjectGithub } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

export function SyncGithubButton({ projectId }: { projectId: string }) {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async () => {
        setError(null);
        const result = await syncProjectGithub(projectId);
        if (result?.error) setError(result.error);
      }}
    >
      <SubmitButton variant="ghost">Sync GitHub</SubmitButton>
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </form>
  );
}
