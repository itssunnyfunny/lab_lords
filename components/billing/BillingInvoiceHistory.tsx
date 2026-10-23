"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Receipt } from "lucide-react";
import { format } from "date-fns";
import { AppButton } from "@/components/ui";
import { SettingsPanel } from "@/components/settings/SettingsWorkspace";
import { useTranslation } from "@/components/settings/LocalizedText";
import { billing, type BillingInvoiceDto } from "@/lib/api/billing";
import { formErrorBannerClass } from "@/components/ui/formSurface";
import { cn } from "@/lib/utils";

export function BillingInvoiceHistory({ organizationId, refreshKey }: { organizationId: string; refreshKey?: unknown }) {
    const t = useTranslation();
    const [items, setItems] = useState<BillingInvoiceDto[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const requestVersion = useRef(0);
    const busy = useRef(false);

    const load = useCallback(async (cursor?: string) => {
        const version = ++requestVersion.current;
        busy.current = true;
        setLoading(true);
        setError(null);
        try {
            const page = await billing.getInvoices(organizationId, cursor);
            if (version !== requestVersion.current) return;
            setItems(previous => {
                if (!cursor) return page.items;
                const seen = new Set(previous.map(invoice => invoice.id));
                return [...previous, ...page.items.filter(invoice => !seen.has(invoice.id))];
            });
            setNextCursor(page.nextCursor);
        } catch (cause) {
            if (version === requestVersion.current) {
                setError(cause instanceof Error ? cause.message : "Unable to load invoices.");
            }
        } finally {
            if (version === requestVersion.current) {
                busy.current = false;
                setLoading(false);
            }
        }
    }, [organizationId]);

    useEffect(() => {
        setItems([]);
        setNextCursor(null);
        void load();
        return () => { requestVersion.current += 1; };
    }, [load, refreshKey]);

    return <SettingsPanel id="invoices" title={t("Invoices")} description={t("Your workspace subscription invoices.")} icon={Receipt}>
        <div className="space-y-3 px-5 py-4" aria-busy={loading}>
            {error ? <div role="alert" className={cn(formErrorBannerClass, "space-y-2 px-3 py-3 text-sm")}>
                <p>{t.error(error, "Unable to load invoices.")}</p>
                <AppButton variant="secondary" size="sm" onClick={() => void load(items.length ? nextCursor ?? undefined : undefined)} disabled={loading}>{t("Retry")}</AppButton>
            </div> : null}
            {items.map(invoice => <article key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] px-3 py-3 text-sm">
                <div className="min-w-0">
                    <p className="font-medium text-[color:var(--text-primary)]">{new Intl.NumberFormat("en-IN", { style: "currency", currency: invoice.currency }).format(invoice.amountSubunits / 100)}</p>
                    <p className="mt-1 text-xs text-[color:var(--text-secondary)]">{format(new Date(invoice.paidAt ?? invoice.createdAt), "PP")}</p>
                </div>
                <div className="text-right text-xs text-[color:var(--text-secondary)]">
                    <p>{t.owned(invoice.status.toUpperCase())}{invoice.providerMode === "TEST" ? ` · ${t("Test mode")}` : ""}</p>
                    <p className="mt-1 break-all">{t("Invoice")} {invoice.id}</p>
                </div>
            </article>)}
            {!loading && !error && items.length === 0 ? <p className="text-sm text-[color:var(--text-secondary)]">{t("No invoices yet. Confirmed invoices will appear here.")}</p> : null}
            {loading ? <p role="status" className="text-sm text-[color:var(--text-secondary)]">{t("Loading invoices...")}</p> : null}
            {nextCursor ? <AppButton variant="secondary" size="sm" isLoading={loading} disabled={loading} onClick={() => { if (!busy.current) void load(nextCursor); }}>{t("Load more invoices")}</AppButton> : null}
        </div>
    </SettingsPanel>;
}
