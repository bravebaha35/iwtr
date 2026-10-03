"use client";

import type { ConversationSummary } from "@iwtr/shared-types";
import { Avatar } from "@/components/Avatar";
import { CompanyLogo } from "@/components/CompanyLogo";

type Mode = "reviewer" | "company";
type Side = "REVIEWER" | "COMPANY";

/**
 * The picture for one side of a conversation: the company's logo, or the
 * review's public avatar (a randomized review's generic one, never the
 * account's own) - exactly what the published review already shows.
 */
export function SidePicture({ conversation, side }: { conversation: ConversationSummary; side: Side }) {
  if (side === "COMPANY") {
    return <CompanyLogo name={conversation.companyName} mainPhotoUrl={conversation.companyLogoUrl} size="sm" />;
  }
  return <Avatar avatarKey={conversation.reviewerAvatarKey} avatarGradient={conversation.reviewerAvatarGradient} size="sm" />;
}

/** The other side's picture, from the viewer's point of view. */
export function CounterpartPicture({ conversation, mode }: { conversation: ConversationSummary; mode: Mode }) {
  return <SidePicture conversation={conversation} side={mode === "reviewer" ? "COMPANY" : "REVIEWER"} />;
}

/**
 * "● Active · Name" / "● Ended · Name" under the company name. The name is
 * whoever the viewer is talking to: the answering owner's real name for a
 * reviewer (only once the company has replied - before that, no name), the
 * review's public name for the company.
 */
export function ConversationStatus({ conversation, mode }: { conversation: ConversationSummary; mode: Mode }) {
  const name = mode === "reviewer" ? conversation.ownerName : conversation.reviewerName;
  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className={`h-2 w-2 shrink-0 rounded-full ${conversation.ended ? "bg-red-500" : "bg-green-500"}`}
      />
      <span className="shrink-0 font-medium">{conversation.ended ? "Ended" : "Active"}</span>
      {name && (
        <>
          <span aria-hidden="true">·</span>
          <span className="truncate">{name}</span>
        </>
      )}
    </span>
  );
}
