"use client";

import { useEffect, useRef, useState } from "react";
import { AppButton, AppSelect, Dialog } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import type { DashboardTerm, DashboardTermRevision } from "@/lib/dashboardContracts";
import { dashboardRequest, inputClass, ResourceError } from "./shared";

type Action = "HISTORY" | "CORRECT" | "VOID" | "END_EARLY" | "CANCEL";
type History = { items: DashboardTermRevision[]; nextRevision: number | null };
const titles = { HISTORY: "Membership history", CORRECT: "Correct term", VOID: "Void incorrect term", END_EARLY: "End membership early", CANCEL: "Cancel upcoming membership" } as const;
const historyLabels: Record<string, string> = { BASELINE: "Original recorded term", CREATED: "Term recorded", CORRECTED: "Term corrected", VOIDED: "Term voided", ENDED_EARLY: "Membership ended early", CANCELLED: "Membership cancelled" };
function snapshot(value: unknown) {
    if (!value || typeof value !== "object") return null;
    const row = value as Record<string, unknown>;
    return typeof row.label === "string" && typeof row.startDate === "string" && typeof row.endDate === "string"
        ? `${row.label}: ${row.startDate} – ${row.endDate}` : null;
}

export function MembershipTermActions({ branchId, term, writable, onSaved }: {
    branchId: string; term: DashboardTerm; writable: boolean; onSaved: () => Promise<void>;
}) {
    const { ownerKey } = useUserPreferences();
    return <MembershipTermActionsContent key={`${ownerKey}:${branchId}:${term.id}`} branchId={branchId} term={term} writable={writable} onSaved={onSaved} />;
}
function MembershipTermActionsContent({ branchId, term, writable, onSaved }: {
    branchId: string; term: DashboardTerm; writable: boolean; onSaved: () => Promise<void>;
}) {
    const t = useTranslation();
    const { formatDateTime } = useUserPreferences();
    const [action, setAction] = useState<Action | null>(null);
    const [label, setLabel] = useState(term.label);
    const [startDate, setStart] = useState(term.startDate);
    const [endDate, setEnd] = useState(term.endDate);
    const [reason, setReason] = useState("");
    const [expectedRevision, setExpectedRevision] = useState(term.revision);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<History | null>(null);
    const historyButton = useRef<HTMLButtonElement>(null);
    const manageButton = useRef<HTMLButtonElement>(null);
    const restoreTerminalFocus = useRef(false);
    const url = `/api/branches/${encodeURIComponent(branchId)}/dashboard/terms`;
    useEffect(() => {
        if (action || !restoreTerminalFocus.current) return;
        restoreTerminalFocus.current = false;
        let cancelled = false;
        // Dialog cleanup first removes background inertness and queues its
        // normal return focus. A frame callback can run before that cleanup.
        queueMicrotask(() => {
            if (!cancelled && !manageButton.current && document.activeElement === document.body) historyButton.current?.focus();
        });
        return () => { cancelled = true; };
    }, [action]);
    function close() {
        restoreTerminalFocus.current = true;
        setAction(null);
    }
    async function loadHistory(before?: number) {
        setBusy(true); setError(null);
        try {
            const page = await dashboardRequest<History>(`${url}?history=${encodeURIComponent(term.id)}${before ? `&before=${before}` : ""}`);
            setHistory(previous => ({ ...page, items: before && previous ? [...new Map([...previous.items, ...page.items].map(row => [row.id, row])).values()] : page.items }));
        } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to load history"); }
        finally { setBusy(false); }
    }
    function open(next: Action) {
        setAction(next); setError(null); setReason(""); setLabel(term.label); setStart(term.startDate); setEnd(term.endDate); setHistory(null); setExpectedRevision(term.revision);
        if (next === "HISTORY") void loadHistory();
    }
    async function save() {
        if (busy || !action || action === "HISTORY") return;
        setBusy(true); setError(null);
        try {
            await dashboardRequest(url, "PATCH", { termId: term.id, expectedRevision, action, reason,
                ...(action === "CORRECT" ? { label, startDate, endDate } : action === "END_EARLY" ? { endDate } : {}) });
            await onSaved(); close();
        } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to save term"); }
        finally { setBusy(false); }
    }
    return <>
        <div className="flex flex-wrap gap-2">
            <AppButton ref={historyButton} density="compact" variant="quiet" disabled={busy} onClick={() => open("HISTORY")}>{t("History")}</AppButton>
            {writable && term.status === "ACTIVE" && <AppButton ref={manageButton} density="compact" variant="secondary" disabled={busy} onClick={() => open("CORRECT")}>{t("Manage term")}</AppButton>}
        </div>
        {action && <Dialog open onClose={close} closeDisabled={busy} title={t(titles[action])} density="compact" languagePlacement="header"
            footer={action === "HISTORY" ? <AppButton variant="secondary" disabled={busy} onClick={close}>{t("Close")}</AppButton> : <>
                <AppButton variant="secondary" disabled={busy} onClick={close}>{t("Cancel")}</AppButton>
                <AppButton onClick={() => void save()} isLoading={busy} disabled={!writable || reason.trim().length < 3 || ((action === "CORRECT" || action === "END_EARLY") && (!endDate || endDate < startDate)) || (action === "CORRECT" && !label.trim()) || (action === "END_EARLY" && endDate >= term.endDate)}>{t("Save change")}</AppButton>
            </>}>
            <div className="space-y-4">
                <ResourceError error={error} retry={action === "HISTORY" ? () => void loadHistory() : () => void onSaved().then(close)} />
                <p className="text-sm">{term.studentName} · {term.label}</p>
                {action === "HISTORY" ? <>
                    {busy && !history && <p role="status">{t("Loading…")}</p>}
                    {history?.items.map(row => <article key={row.id} className="space-y-1 border-b border-[color:var(--ui-panel-border)] py-3 text-sm">
                        <p className="font-semibold">{t.owned(historyLabels[row.action] ?? row.action)} · {formatDateTime(row.recordedAt)}</p>
                        {row.actorName && <p>{row.actorName}</p>}
                        {snapshot(row.before) && <p>{t("Before")}: {snapshot(row.before)}</p>}
                        <p>{t("Recorded dates")}: {snapshot(row.after)}</p><p>{row.reason}</p>
                    </article>)}
                    {history && history.items.length === 0 && <p>{t("No history available.")}</p>}
                    {history?.nextRevision && <AppButton variant="secondary" disabled={busy} onClick={() => void loadHistory(history.nextRevision!)}>{t("Older changes")}</AppButton>}
                </> : <>
                    <p className="text-sm">{t("Term changes never change fees, seat allocations, attendance or student status.")}</p>
                    <AppSelect label={t("Change type")} value={action} disabled={busy} onValueChange={value => setAction(value as Action)} options={[
                        { value: "CORRECT", label: t("Correct mistaken details") }, { value: "END_EARLY", label: t("Record a genuine early end") }, { value: "VOID", label: t("Void an erroneous term") },
                        { value: "CANCEL", label: t("Cancel upcoming membership") },
                    ]} />
                    <p className="text-sm">{t(action === "VOID" ? "Void only a term recorded in error. Its dates stay in history and stop blocking a replacement."
                        : action === "CANCEL" ? "Cancel a genuine membership before it starts. Its original dates stay in history."
                            : action === "END_EARLY" ? "Record the actual earlier end of a genuine membership. Its original dates stay in history."
                            : "Correct a recording mistake. The previous details stay in history.")}</p>
                    {action === "CORRECT" && <>
                        <label className="block text-sm">{t("Membership label")}<input className={inputClass} value={label} maxLength={80} disabled={busy} onChange={event => setLabel(event.target.value)} /></label>
                        <label className="block text-sm">{t("Start date")}<input className={inputClass} type="date" value={startDate} disabled={busy} onChange={event => setStart(event.target.value)} /></label>
                    </>}
                    {(action === "CORRECT" || action === "END_EARLY") && <label className="block text-sm">{t("End date")}<input className={inputClass} type="date" value={endDate} min={startDate} max={action === "END_EARLY" ? term.endDate : undefined} disabled={busy} onChange={event => setEnd(event.target.value)} /></label>}
                    <label className="block text-sm">{t("Reason for change")}<textarea className={inputClass} value={reason} maxLength={500} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
                </>}
            </div>
        </Dialog>}
    </>;
}
