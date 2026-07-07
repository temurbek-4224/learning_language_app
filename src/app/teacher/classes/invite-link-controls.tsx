"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";

type InviteLinkControlsProps = {
  inviteLink: string | null;
};

export function InviteLinkControls({ inviteLink }: InviteLinkControlsProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!inviteLink) {
      return;
    }

    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
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
        {copied ? <Check /> : <Copy />}
        {copied ? "Link nusxalandi" : "Copy Link"}
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
