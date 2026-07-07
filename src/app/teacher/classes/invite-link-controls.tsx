"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

type InviteLinkControlsProps = {
  inviteLink: string | null;
  startCommand: string;
};

export function InviteLinkControls({
  inviteLink,
  startCommand,
}: InviteLinkControlsProps) {
  const [copied, setCopied] = useState<"link" | "command" | null>(null);

  function markCopied(type: "link" | "command") {
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1800);
  }

  async function copyLink() {
    if (!inviteLink) {
      return;
    }

    await navigator.clipboard.writeText(inviteLink);
    markCopied("link");
  }

  async function copyStartCommand() {
    await navigator.clipboard.writeText(startCommand);
    markCopied("command");
  }

  function openLink() {
    if (!inviteLink) {
      return;
    }

    window.open(inviteLink, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copyLink}
        disabled={!inviteLink}
      >
        {copied === "link" ? <Check /> : <Copy />}
        {copied === "link" ? "Link nusxalandi" : "Copy Link"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={copyStartCommand}
      >
        {copied === "command" ? <Check /> : <Copy />}
        {copied === "command" ? "Command nusxalandi" : "Copy Start Command"}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={openLink}
        disabled={!inviteLink}
      >
        <ExternalLink />
        Open in Telegram
      </Button>
    </div>
  );
}
