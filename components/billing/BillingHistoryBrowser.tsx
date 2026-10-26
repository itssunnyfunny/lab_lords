"use client";

import { useState } from "react";
import { AppButton, AppSelect, Dialog } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { ResourceError, useDashboardResource } from "@/components/dashboard-features/shared";

type Row = { id: string; createdAt: string; currency: string; amountSubunits: number; providerMode: "TEST" | "LIVE" | null;
    status?: string; plan?: string; fromStatus?: string | null; toStatus?: string; source?: string; razorpayInvoiceId?: string; razorpaySubscriptionId?: string };
type Page = { items: Row[]; nextCursor: string | null };
const sources: Record<string, string> = { CHECKOUT: "Checkout", VERIFICATION: "Provider verification", WEBHOOK: "Provider update", CUSTOMER_CANCELLATION: "Cancellation request", SYSTEM: "System update" };

export function BillingHistoryBrowser({ organizationId }: { organizationId: string }) {
    const t = useTranslation(); const [open, setOpen] = useState(false);
    const { ownerKey } = useUserPreferences();
    return <><AppButton density="compact" variant="secondary" onClick={() => setOpen(true)}>{t("View all invoices and history")}</AppButton>
        {open && <BillingHistoryDialog key={`${ownerKey}:${organizationId}`} organizationId={organizationId} onClose={() => setOpen(false)} />}</>;
}
function BillingHistoryDialog({ organizationId, onClose }: { organizationId: string; onClose: () => void }) {
    const t = useTranslation(); const { formatDateTime, formatNumber } = useUserPreferences();
    const [kind, setKind] = useState("invoices");
    const [cursor, setCursor] = useState<string | null>(null);
    const [trail, setTrail] = useState<Array<string | null>>([]);
    const url = `/api/organizations/${encodeURIComponent(organizationId)}/billing/${kind}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`;
    const resource = useDashboardResource<Page>(url);
    const page = resource.data;
    function changeKind(value: string) { setKind(value); setCursor(null); setTrail([]); }
    function older() { if (!page?.nextCursor || resource.loading) return; setTrail(previous => [...previous, cursor]); setCursor(page.nextCursor); }
    function newer() { if (!trail.length || resource.loading) return; setCursor(trail.at(-1) ?? null); setTrail(previous => previous.slice(0, -1)); }
    return <Dialog open onClose={onClose} title={t("Billing history")} density="compact" languagePlacement="header" className="max-w-2xl"
        footer={<AppButton variant="secondary" onClick={onClose}>{t("Close")}</AppButton>}>
        <div className="space-y-4">
            <AppSelect label={t("Records")} value={kind} onValueChange={changeKind} options={[
                { value: "invoices", label: t("Invoices") }, { value: "history", label: t("Subscription history") },
            ]} />
            <ResourceError error={resource.error} retry={() => void resource.reload()} />
            {resource.loading && !page && <p role="status">{t("Loading…")}</p>}
            {page && page.items.length === 0 && <p>{t("No billing records on this page.")}</p>}
            {page?.items.map(row => <article key={row.id} data-billing-record={row.id} className="space-y-1 border-b border-[color:var(--ui-panel-border)] py-3 text-sm">
                <p className="break-words font-semibold">{row.plan ? `${t.owned(row.plan === "PRO" ? "Standard" : row.plan)} · ` : ""}{row.status ? t.owned(row.status) : `${row.fromStatus ? `${t.owned(row.fromStatus)} → ` : ""}${t.owned(row.toStatus ?? "")}`}</p>
                <p>{row.currency} {formatNumber(row.amountSubunits / 100)} · {formatDateTime(row.createdAt)}</p>
                <p>{row.providerMode === "TEST" ? t("Test mode") : row.providerMode === "LIVE" ? t("Live mode") : t("Historical record")}</p>
                {row.source && <p>{t.owned(sources[row.source] ?? row.source.replaceAll("_", " "))}</p>}
                {(row.razorpayInvoiceId || row.razorpaySubscriptionId) && <p className="break-all">{t(row.razorpayInvoiceId ? "Invoice reference" : "Subscription reference")}: {row.razorpayInvoiceId ?? row.razorpaySubscriptionId}</p>}
            </article>)}
            <div className="flex flex-wrap items-center gap-2">
                <AppButton density="compact" variant="secondary" disabled={resource.loading || !trail.length} onClick={newer}>{t("Newer records")}</AppButton>
                <AppButton density="compact" variant="secondary" disabled={resource.loading || !page?.nextCursor || Boolean(resource.error)} onClick={older}>{t("Older records")}</AppButton>
            </div>
        </div>
    </Dialog>;
}
