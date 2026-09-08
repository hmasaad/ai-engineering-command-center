"use client";

import { toggleAgentStatus } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";

export function ToggleAgentButton({
  agentId,
  enabled,
}: {
  agentId: string;
  enabled: boolean;
}) {
  return (
    <form
      action={async () => {
        await toggleAgentStatus(agentId);
      }}
    >
      <SubmitButton variant="ghost">{enabled ? "Disable" : "Enable"}</SubmitButton>
    </form>
  );
}
