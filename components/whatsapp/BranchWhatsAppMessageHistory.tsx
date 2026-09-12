"use client";
import { OwnedLabel, LocalizedError } from "@/components/settings/LocalizedText";
import { useTranslation } from "@/components/settings/LocalizedText";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, History } from "lucide-react";
import { AppButton } from "@/components/ui/AppButton";
import { Badge } from "@/components/ui/Badge";
import { SettingsCard, SettingsEmptyState } from "@/components/settings/SettingsWorkspace";
import {
  whatsapp,
  type WhatsAppMessageHistoryItem,
  type WhatsAppMessageHistoryResponse,
} from "@/lib/api/whatsapp";

function titleCase(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/^./, first => first.toUpperCase());
}

function statusVariant(status: string) {
  if (status === "DELIVERED" || status === "READ" || status === "SENT") return "success" as const;
  if (status === "FAILED" || status === "CANCELLED" || status === "SUPPRESSED") return "danger" as const;
  if (status === "UNKNOWN") return "warning" as const;
  return "default" as const;
}

function safeDate(value: string | null) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

function estimatedCost(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return "Unavailable";
  const rupees = Number(value) / 1_000_000;
  return Number.isFinite(rupees) ? `₹${rupees.toFixed(4)}` : "Unavailable";
}

function paymentAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function BranchWhatsAppMessageHistoryList({
  items,
}: {
  items: readonly WhatsAppMessageHistoryItem[];
}) {
    const t = useTranslation();
  const hasUnknown = items.some(item => item.status === "UNKNOWN");
  return (
    <div className="space-y-3">
      {hasUnknown ? (
        <div className="flex items-start gap-3 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-warning-border)] bg-[color:var(--ui-form-warning-bg)] p-3 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {t("Provider acceptance could not be confirmed. Lab Lords will not retry automatically because that could send a duplicate message; operator review is required before any manual follow-up.")}</span>
        </div>
      ) : null}

      {items.map(item => (
        <SettingsCard key={item.id} className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-medium text-[color:var(--text-primary)]">
                {item.student?.name ?? t("Grouped recipient")}
              </p>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                {item.maskedPhone} · {item.managedTemplateKey ? t.owned(titleCase(item.managedTemplateKey)) : t("Template unavailable")}
              </p>
            </div>
            <Badge variant={statusVariant(item.status)}><OwnedLabel text={titleCase(item.status)} /></Badge>
          </div>
          <dl className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[color:var(--text-muted)]">{t("Purpose")}</dt>
              <dd className="mt-1 font-medium text-[color:var(--text-primary)]"><OwnedLabel text={titleCase(item.purpose)} /></dd>
            </div>
            <div>
              <dt className="text-[color:var(--text-muted)]">{t("Trigger")}</dt>
              <dd className="mt-1 font-medium text-[color:var(--text-primary)]">
                <OwnedLabel text={titleCase(item.trigger)} />{item.automationStage ? ` · ${t.owned(titleCase(item.automationStage))}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[color:var(--text-muted)]">{t("Template")}</dt>
              <dd className="mt-1 font-medium text-[color:var(--text-primary)]">
                {item.template ? `${item.template.name} · ${item.template.language}` : t("Unavailable")}
              </dd>
            </div>
            <div>
              <dt className="text-[color:var(--text-muted)]">{t("Scheduled")}</dt>
              <dd className="mt-1 font-medium text-[color:var(--text-primary)]">{safeDate(item.scheduledFor)}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--text-muted)]">{t("Estimated usage")}</dt>
              <dd className="mt-1 font-medium text-[color:var(--text-primary)]">{estimatedCost(item.estimatedCostMicros)}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--text-muted)]">{t("Submitted")}</dt>
              <dd className="mt-1 font-medium text-[color:var(--text-primary)]">{safeDate(item.submissionStartedAt)}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--text-muted)]">{t("Accepted")}</dt>
              <dd className="mt-1 font-medium text-[color:var(--text-primary)]">{safeDate(item.acceptedAt)}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--text-muted)]">{t("Sent")}</dt>
              <dd className="mt-1 font-medium text-[color:var(--text-primary)]">{safeDate(item.sentAt)}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--text-muted)]">{t("Delivered")}</dt>
              <dd className="mt-1 font-medium text-[color:var(--text-primary)]">{safeDate(item.deliveredAt)}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--text-muted)]">{t("Read")}</dt>
              <dd className="mt-1 font-medium text-[color:var(--text-primary)]">{safeDate(item.readAt)}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--text-muted)]">{t("Failed")}</dt>
              <dd className="mt-1 font-medium text-[color:var(--text-primary)]">{safeDate(item.failedAt)}</dd>
            </div>
            <div>
              <dt className="text-[color:var(--text-muted)]">{t("Provider billing metadata")}</dt>
              <dd className="mt-1 font-medium text-[color:var(--text-primary)]">
                {item.providerBillable === null ? t("Not supplied") : item.providerBillable ? t("Billable") : t("Not billable")}
                {item.providerPricingCategory ? ` · ${t.owned(titleCase(item.providerPricingCategory))}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-[color:var(--text-muted)]">{t("Queued by")}</dt>
              <dd className="mt-1 font-medium text-[color:var(--text-primary)]">{item.createdBy?.name ?? (item.trigger === "AUTOMATION" ? t("Automation") : t("Unavailable"))}</dd>
            </div>
          </dl>
          {item.payments && item.payments.length > 0 ? (
            <div className="rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] p-3 text-xs">
              <p className="font-medium text-[color:var(--text-primary)]">{t("Payment context")}</p>
              <ul className="mt-2 space-y-1 text-[color:var(--text-secondary)]">
                {item.payments.map(payment => (
                  <li key={payment.id}>{t("{status} · {amount} · due {date}", { status: t.owned(titleCase(payment.status)), amount: paymentAmount(payment.amount), date: t.owned(safeDate(payment.dueDate)) })}</li>
                ))}
              </ul>
              {item.paymentResolutionEvent ? (
                <p className="mt-2 text-[color:var(--text-muted)]">
                  {t("Resolution: {from} → {to} · {time}", { from: t.owned(titleCase(item.paymentResolutionEvent.fromStatus)), to: t.owned(titleCase(item.paymentResolutionEvent.toStatus)), time: t.owned(safeDate(item.paymentResolutionEvent.occurredAt)) })}
                </p>
              ) : null}
            </div>
          ) : null}
          {item.safeFailureCode ? (
            <p className="text-xs text-[color:var(--ui-form-error-text)]">
              {t("Safe failure code: {code}", { code: item.safeFailureCode })}
            </p>
          ) : null}
        </SettingsCard>
      ))}
    </div>
  );
}

export function BranchWhatsAppMessageHistory({ branchId }: { branchId: string }) {
    const t = useTranslation();
  const [page, setPage] = useState<WhatsAppMessageHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(false);

  const load = useCallback(async (cursor?: string | null) => {
    if (requestRef.current) return;
    requestRef.current = true;
    const more = Boolean(cursor);
    if (more) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const next = await whatsapp.getMessageHistory(branchId, { cursor, limit: 20 });
      setPage(current => more && current
        ? { ...next, items: [...current.items, ...next.items] }
        : next);
    } catch {
      setError("Message history is unavailable right now.");
    } finally {
      requestRef.current = false;
      if (more) setLoadingMore(false);
      else setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p role="status" className="text-sm text-[color:var(--text-secondary)]">{t("Loading message history…")}</p>;
  }
  if (error && !page) {
    return <p role="alert" className="text-sm text-[color:var(--ui-form-error-text)]"><LocalizedError error={error} /></p>;
  }
  if (!page || page.items.length === 0) {
    return <SettingsEmptyState>{t("No WhatsApp messages have been queued for this branch.")}</SettingsEmptyState>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm text-[color:var(--text-secondary)]">
        <span className="inline-flex items-center gap-2"><History className="h-4 w-4" aria-hidden="true" /> {t("{count} message(s)", { count: page.total })}</span>
        <span>{t("Estimated usage only; Meta determines final charges.")}</span>
      </div>
      <BranchWhatsAppMessageHistoryList items={page.items} />
      {error ? <p role="alert" className="text-sm text-[color:var(--ui-form-error-text)]"><LocalizedError error={error} /></p> : null}
      {page.nextCursor ? (
        <div className="flex justify-center">
          <AppButton
            variant="secondary"
            size="sm"
            onClick={() => void load(page.nextCursor)}
            disabled={loadingMore}
            isLoading={loadingMore}
          >
            {t("Load more history")}</AppButton>
        </div>
      ) : null}
    </div>
  );
}
