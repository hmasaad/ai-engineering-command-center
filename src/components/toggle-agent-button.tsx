"use client";

import { toggleAgentStatus } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

export function ToggleAgentButton({
  agentId,
  status,
}: {
  agentId: string;
  status: string;
}) {
  return (
    <form
      action={async () => {
        await toggleAgentStatus(agentId);
      }}
    >
      <SubmitButton variant="ghost">
        {status === "active" ? "Deactivate" : "Activate"}
      </SubmitButton>
    </form>
  );
}
