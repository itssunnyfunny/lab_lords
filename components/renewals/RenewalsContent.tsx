"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { AppButton, AppPanel, AppSelect, Dialog, PageShell } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { formControlClass } from "@/components/ui/formSurface";
import { pageDescriptionClass, pageTitleClass } from "@/components/ui/pageSurface";
import { MarkPaidDialog, type PayMethod } from "@/components/payments/MarkPaidDialog";
import { ApprovedPaymentReminderReview } from "@/components/whatsapp/ApprovedPaymentReminderReview";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import { getOverdueStudentHref } from "@/lib/overdueQueue";
import { MANUAL_REMINDER_COPIED, paymentReminderDraft } from "@/lib/paymentReminderDraft";
import { payments } from "@/lib/api/payments";
import { renewals } from "@/lib/api/renewals";
import { followUpOutcomes, renewalFilters, type FollowUpOutcome, type RenewalFilter,
    type RenewalPage, type RenewalRow } from "@/lib/renewals";
import type { BranchAccess } from "@/types";

export function RenewalsContent({ branchId, access }: { branchId: string; access: BranchAccess }) {
    const { formatDate, formatDateTime, formatNumber } = useUserPreferences();
    const money = (amount: number) => formatNumber(amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
    const record = getBranchCapabilityDecision(access, "paymentsRecord");
    const send = getBranchCapabilityDecision(access, "whatsappSend");
    const [filter, setFilter] = useState<RenewalFilter>("ALL");
    const [days, setDays] = useState<3 | 7>(7);
    const [search, setSearch] = useState("");
    const [querySearch, setQuerySearch] = useState("");
    const [page, setPage] = useState<RenewalPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const requestId = useRef(0);
    const [collect, setCollect] = useState<RenewalRow | null>(null);
    const [method, setMethod] = useState<PayMethod>("CASH");
    const [reference, setReference] = useState("");
    const [collecting, setCollecting] = useState(false);
    const [collectionError, setCollectionError] = useState<string | null>(null);
    const mutationBusy = useRef(false);
    const [editing, setEditing] = useState<RenewalRow | null>(null);
    const [reminder, setReminder] = useState<RenewalRow | null>(null);
    const labels: Record<RenewalFilter, string> = { ALL: "All fees", TODAY: "Due today",
        UPCOMING: `Next ${days} days`, OUTSTANDING: "Outstanding dues", OVERDUE: "Overdue" };

    useEffect(() => {
        const timer = setTimeout(() => setQuerySearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    const load = useCallback(async (cursor?: string) => {
        const id = ++requestId.current;
        setLoading(true);
        setError(null);
        try {
            const result = await renewals.list(branchId, { filter, days, search: querySearch, limit: 25, cursor });
            if (id === requestId.current) setPage(result);
        } catch (err) {
            if (id === requestId.current) setError(err instanceof Error ? err.message : "Unable to load renewals.");
        } finally { if (id === requestId.current) setLoading(false); }
    }, [branchId, filter, days, querySearch]);
    useEffect(() => {
        const requestCounter = requestId;
        void load();
        return () => { requestCounter.current++; };
    }, [load]);
    // A returned collection/profile visit should refresh financial truth, including bfcache restores.
    useEffect(() => {
        const refresh = () => { if (!mutationBusy.current) void load(); };
        window.addEventListener("focus", refresh);
        window.addEventListener("pageshow", refresh);
        return () => { window.removeEventListener("focus", refresh); window.removeEventListener("pageshow", refresh); };
    }, [load]);

    async function confirmCollection() {
        if (!collect?.paymentId || !record.allowed || mutationBusy.current) return;
        mutationBusy.current = true;
        setCollecting(true);
        setCollectionError(null);
        try {
            await payments.markAsPaid(collect.paymentId, method, method === "CASH" ? undefined : reference.trim() || undefined);
            setCollect(null);
            setReminder(null);
            setPage(null);
            setNotice("Payment recorded.");
            await load();
        } catch (err) { setCollectionError(err instanceof Error ? err.message : "Unable to record payment."); }
        finally { mutationBusy.current = false; setCollecting(false); }
    }

    return <PageShell>
        <div className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div><h1 className={pageTitleClass}>Renewals &amp; dues</h1>
                    <p className={pageDescriptionClass}>Upcoming fees, unpaid periods and your latest follow-ups.</p></div>
                <AppButton variant="secondary" onClick={() => void load()} disabled={loading}>Refresh</AppButton>
            </header>
            <p className="text-sm text-[color:var(--text-muted)]">Expected fees are estimates, not confirmed debt. Fee dates do not indicate membership expiry.</p>
            <div className="grid gap-3 sm:grid-cols-2">
                <AppPanel title="Outstanding recorded dues"><p className="text-2xl font-semibold">{page ? money(page.outstandingAmount) : "—"}</p></AppPanel>
                <AppPanel title={`Expected fees · today through next ${days} days`}><p className="text-2xl font-semibold">{page ? money(page.expectedAmount) : "—"}</p></AppPanel>
            </div>
            <div className="flex flex-wrap gap-2" aria-label="Fee filters">
                {renewalFilters.map(value => <AppButton key={value} variant={filter === value ? "primary" : "secondary"}
                    aria-pressed={filter === value} onClick={() => setFilter(value)}>
                    {labels[value]}{page ? ` (${page.counts[value]})` : ""}
                </AppButton>)}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                <label className="space-y-1 text-sm">Search by name or phone
                    <input className={`${formControlClass} min-h-11 px-3 py-2`} type="search" maxLength={100} value={search}
                        onChange={event => setSearch(event.target.value)} placeholder="Student name or phone" /></label>
                <AppSelect label="Upcoming window" value={String(days)} onValueChange={value => setDays(value === "3" ? 3 : 7)}
                    options={[{ value: "3", label: "Next 3 days" }, { value: "7", label: "Next 7 days" }]} />
            </div>
            <p className="text-xs text-[color:var(--text-muted)]">Oldest fee date first. Counts reflect your search; overdue means more than 7 days late. Each period appears separately.</p>
            {notice && <p role="status" className="text-sm">{notice}</p>}
            {error && <div role="alert" className="text-sm text-[color:var(--ui-form-error-text)]">{error} <AppButton variant="secondary" onClick={() => void load()}>Retry</AppButton></div>}
            {loading ? <p role="status" className="py-10 text-center">Loading renewals &amp; dues…</p>
                : !error && page?.items.length === 0 ? <AppPanel title="No fees in this view"><p>Try another filter or search.</p></AppPanel>
                : !error && page?.items.map(row => <AppPanel key={row.key} title={row.studentName}
                    action={<Badge variant={row.expected ? "warning" : "cyan"}>{row.expected ? "Expected fee" : "Recorded due"}</Badge>}>
                    <div className="space-y-4">
                        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                            <div><p className="text-[color:var(--text-muted)]">Contact</p><p>{row.phone || "No phone recorded"}</p>
                                {row.studentStatus !== "ACTIVE" && <p>Inactive · existing debt</p>}</div>
                            <div><p className="text-[color:var(--text-muted)]">{row.type === "ADMISSION" ? "Admission period" : "Billing period"}</p>
                                <p>{formatDate(row.periodStart)} – {formatDate(row.periodEnd)}</p></div>
                            <div><p className="text-[color:var(--text-muted)]">Fee date</p><p>{formatDate(row.dueDate)}</p></div>
                            <div><p className="text-[color:var(--text-muted)]">{row.expected ? "Expected amount" : "Amount due"}</p><p className="text-lg font-semibold">{money(row.amount)}</p></div>
                        </div>
                        {row.allocations.length > 0 && <p className="text-sm">Seat / shift: {row.allocations.map(a => `${a.seat} · ${a.shift}`).join(", ")}</p>}
                        <div className="rounded-lg border border-[color:var(--ui-form-surface-border)] p-3 text-sm">
                            <p className="font-medium">{followUpOutcomes[row.followUp?.outcome ?? "NOT_CONTACTED"]}</p>
                            {row.followUp && <><p className="whitespace-pre-wrap break-words">{row.followUp.note || "No note"}</p>
                                <p className="mt-2 text-[color:var(--text-muted)]">Latest: {row.followUp.author?.name || "Team member"} · {formatDateTime(row.followUp.updatedAt)}</p></>}
                            <p className="mt-1">Next follow-up: {row.followUp?.nextFollowUpAt ? formatDate(row.followUp.nextFollowUpAt) : "Not scheduled"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {access.permissions.students && <Link className="inline-flex min-h-11 items-center px-3 text-sm underline" href={getOverdueStudentHref(branchId, row.studentId)}>Open student profile</Link>}
                            {row.paymentId && <AppButton variant="primary" disabled={!record.allowed} title={record.reason ?? undefined}
                                onClick={() => { setCollect(row); setMethod("CASH"); setReference(""); setCollectionError(null); }}>Record collection</AppButton>}
                            <AppButton variant="secondary" disabled={!record.allowed} title={record.reason ?? undefined} onClick={() => setEditing(row)}>Update follow-up</AppButton>
                            <AppButton variant="secondary" onClick={() => setReminder(row)}>Reminder options</AppButton>
                        </div>
                        {!record.allowed && <p className="text-xs text-[color:var(--text-muted)]">{record.reason}</p>}
                    </div>
                </AppPanel>)}
            {page && !loading && !error && <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">Showing {page.items.length} of {page.counts[filter]} periods</p>
                <div className="flex gap-2"><AppButton variant="secondary" onClick={() => void load()}>First page</AppButton>
                    <AppButton variant="secondary" disabled={!page.nextCursor} onClick={() => void load(page.nextCursor ?? undefined)}>Next page</AppButton></div>
            </div>}
        </div>
        <MarkPaidDialog isOpen={!!collect} onClose={() => setCollect(null)} onConfirm={() => void confirmCollection()}
            error={collectionError} summary={collect ? `${collect.studentName} · ${money(collect.amount)} · ${formatDate(collect.periodStart)} – ${formatDate(collect.periodEnd)}` : undefined}
            loading={collecting} method={method} onMethodChange={setMethod} referenceId={reference} onReferenceIdChange={setReference} />
        {editing && <FollowUpDialog key={editing.key} row={editing} branchId={branchId} onClose={() => setEditing(null)} onSaved={followUp => {
            requestId.current++;
            setLoading(false);
            setPage(current => current ? { ...current, items: current.items.map(row => row.key === editing.key ? { ...row, followUp } : row) } : current);
            setEditing(null); setNotice("Follow-up saved. The fee date is unchanged.");
        }} />}
        {reminder && <ReminderDialog row={reminder} branchId={branchId} canSend={send.allowed} blockedReason={send.reason ?? undefined}
            onClose={() => setReminder(null)} />}
    </PageShell>;
}

function FollowUpDialog({ row, branchId, onClose, onSaved }: {
    row: RenewalRow; branchId: string; onClose: () => void; onSaved: (followUp: NonNullable<RenewalRow["followUp"]>) => void;
}) {
    const [note, setNote] = useState(row.followUp?.note ?? "");
    const [outcome, setOutcome] = useState<FollowUpOutcome>(row.followUp?.outcome ?? "NOT_CONTACTED");
    const [nextDate, setNextDate] = useState(row.followUp?.nextFollowUpAt ? format(new Date(row.followUp.nextFollowUpAt), "yyyy-MM-dd") : "");
    const [busy, setBusy] = useState(false);
    const saving = useRef(false);
    const [error, setError] = useState<string | null>(null);
    async function save() {
        if (saving.current) return;
        saving.current = true; setBusy(true); setError(null);
        try { onSaved(await renewals.saveFollowUp(branchId, { studentId: row.studentId, type: row.type,
            periodStart: row.periodStart, note, outcome, nextFollowUpAt: nextDate || null })); }
        catch (err) { setError(err instanceof Error ? err.message : "Unable to save follow-up."); }
        finally { saving.current = false; setBusy(false); }
    }
    return <Dialog open onClose={onClose} closeDisabled={busy} title={`Follow-up · ${row.studentName}`}
        description="Record the latest contact outcome. Scheduling a follow-up does not change the fee date."
        footer={<><AppButton variant="quiet" onClick={onClose} disabled={busy}>Cancel</AppButton><AppButton onClick={() => void save()} isLoading={busy}>Save follow-up</AppButton></>}>
        <div className="space-y-4">
            {error && <p role="alert">{error}</p>}
            <AppSelect label="Contact outcome" value={outcome} disabled={busy} onValueChange={value => setOutcome(value as FollowUpOutcome)}
                options={Object.entries(followUpOutcomes).map(([value, label]) => ({ value, label }))} />
            <label className="block space-y-1 text-sm">Follow-up note<textarea className={`${formControlClass} px-3 py-2`} rows={4} maxLength={2000} value={note}
                disabled={busy} onChange={event => setNote(event.target.value)} /></label>
            <label className="block space-y-1 text-sm">Next follow-up date<input className={`${formControlClass} min-h-11 px-3 py-2`} type="date" value={nextDate}
                disabled={busy} onChange={event => setNextDate(event.target.value)} /></label>
            <AppButton variant="quiet" onClick={() => setNextDate("")} disabled={busy || !nextDate}>Clear follow-up date</AppButton>
        </div>
    </Dialog>;
}

function ReminderDialog({ row, branchId, canSend, blockedReason, onClose }: {
    row: RenewalRow; branchId: string; canSend: boolean; blockedReason?: string; onClose: () => void;
}) {
    const { formatDate, formatNumber } = useUserPreferences();
    const [language, setLanguage] = useState<"EN" | "HI">("EN");
    const [notice, setNotice] = useState<string | null>(null);
    const text = paymentReminderDraft({ studentName: row.studentName, expected: row.expected, language,
        amount: formatNumber(row.amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 }), date: formatDate(row.dueDate) });
    async function copy() {
        try { await navigator.clipboard.writeText(text); setNotice(MANUAL_REMINDER_COPIED); }
        catch { setNotice("Copy failed. Select the message text and copy it manually."); }
    }
    return <Dialog open onClose={onClose} title={`Reminder · ${row.studentName}`} className="max-w-3xl">
        <div className="space-y-5">
            {row.paymentId && <ApprovedPaymentReminderReview branchId={branchId} paymentIds={[row.paymentId]} canSend={canSend} blockedReason={blockedReason} />}
            <AppPanel title="Manual reminder" description="When automated delivery is unavailable, review and copy for your normal contact channel. Copying does not send a message.">
                <div className="space-y-3">
                    {row.expected && <p className="text-sm">This fee is expected. Automated payment reminders require an actual payment record.</p>}
                    <AppSelect label="Message language" value={language} onValueChange={value => { setLanguage(value === "HI" ? "HI" : "EN"); setNotice(null); }}
                        options={[{ value: "EN", label: "English" }, { value: "HI", label: "Hindi" }]} />
                    <p className="whitespace-pre-wrap rounded-lg border border-[color:var(--ui-form-surface-border)] p-3 text-sm">{text}</p>
                    <AppButton variant="secondary" onClick={() => void copy()}>Copy reminder</AppButton>
                    {notice && <p role="status" className="text-sm">{notice}</p>}
                </div>
            </AppPanel>
        </div>
    </Dialog>;
}
