import type { Prisma } from "@/app/generated/prisma/client";
import { projectWhatsAppStatus } from "@/lib/whatsappMessageState";

export type AttachedWebhookEvent = Readonly<{
  id: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  providerTimestamp: Date | null;
  receivedAt: Date;
  providerRecipientWaId: string | null;
  providerBillable: boolean | null;
  providerPricingCategory: string | null;
  safeErrorCode: string | null;
}>;

export function projectAttachedWhatsAppWebhookEvents(
  events: readonly AttachedWebhookEvent[]
) {
  const ordered = [...events].sort((left, right) => {
    const timeDifference = (left.providerTimestamp ?? left.receivedAt).getTime()
      - (right.providerTimestamp ?? right.receivedAt).getTime();
    return timeDifference || left.id.localeCompare(right.id);
  });
  const projection = projectWhatsAppStatus(
    { status: "ACCEPTED", providerStatusTimestamp: null },
    ordered.map(event => ({
      status: event.status,
      providerTimestamp: event.providerTimestamp,
      stableOrder: event.id,
    }))
  );
  const firstOf = (...statuses: AttachedWebhookEvent["status"][]) =>
    ordered.find(event => statuses.includes(event.status));
  const occurredAt = (event: AttachedWebhookEvent | undefined) =>
    event ? event.providerTimestamp ?? event.receivedAt : null;
  const latestWith = <K extends keyof AttachedWebhookEvent>(key: K) =>
    [...ordered].reverse().find(event => event[key] !== null)?.[key] ?? null;
  const projectedFailure = projection.status === "FAILED"
    ? [...ordered].reverse().find(event => event.status === "FAILED")
    : undefined;

  return {
    status: projection.status,
    providerStatusTimestamp: projection.providerStatusTimestamp,
    providerRecipientWaId: latestWith("providerRecipientWaId") as string | null,
    providerBillable: latestWith("providerBillable") as boolean | null,
    providerPricingCategory: latestWith("providerPricingCategory") as string | null,
    sentAt: occurredAt(firstOf("SENT", "DELIVERED", "READ")),
    deliveredAt: occurredAt(firstOf("DELIVERED", "READ")),
    readAt: occurredAt(firstOf("READ")),
    failedAt: projection.status === "FAILED" ? occurredAt(projectedFailure) : null,
    failureCode: projection.status === "FAILED"
      ? projectedFailure?.safeErrorCode ?? "META_FAILED"
      : null,
    safeFailureMessage: null,
  } satisfies Prisma.WhatsAppMessageUpdateInput;
}
