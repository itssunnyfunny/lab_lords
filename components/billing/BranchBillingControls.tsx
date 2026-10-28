"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppButton, Dialog } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";

type RemovalResult = { action?: "NONE" | "PROCESSING" | "CHECKOUT_REQUIRED"; change?: { id: string; effectiveAt: string | null } };

/** The server owns effective dates, provider actions, replay and undo eligibility. */
export function BranchBillingControls({ organizationId, branchId, branchName, billingStatus, canChange, finalBranch, onChanged }: {
    organizationId: string; branchId: string; branchName: string; billingStatus: string; canChange: boolean; finalBranch: boolean;
    onChanged: (status: string) => void;
}) {
    const t = useTranslation(); const router = useRouter(); const { ownerKey, formatDate } = useUserPreferences();
    const storageKey = `branch-billing-removal:${ownerKey}:${organizationId}:${branchId}`;
    const [pendingKey, setPendingKey] = useState<string | null>(null);
    const [ready, setReady] = useState(false); const [review, setReview] = useState(false);
    const [busy, setBusy] = useState(false); const inFlight = useRef(false);
    const [error, setError] = useState(""); const [notice, setNotice] = useState("");
    const [existingChangeId, setExistingChangeId] = useState<string | null>(null);
    useEffect(() => {
        setReady(false); setReview(false); setError(""); setNotice(""); setExistingChangeId(null);
        try { setPendingKey(sessionStorage.getItem(storageKey)); setReady(true); }
        catch { setError("Unable to prepare a safe billing request. Allow session storage and reload."); }
    }, [storageKey]);
    const undo = billingStatus === "REMOVAL_SCHEDULED" && !pendingKey;
    const available = ready && !busy && (Boolean(pendingKey) || undo || canChange && billingStatus === "ACTIVE" && !finalBranch);
    async function confirm() {
        if (inFlight.current || !available) return;
        inFlight.current = true; setBusy(true); setError(""); setExistingChangeId(null);
        try {
            let key = pendingKey;
            if (!undo && !key) {
                key = crypto.randomUUID();
                sessionStorage.setItem(storageKey, key); setPendingKey(key);
            }
            const response = await fetch(`/api/branches/${encodeURIComponent(branchId)}/billing-removal`, {
                method: undo ? "DELETE" : "POST", headers: { ...(key ? { "Idempotency-Key": key } : {}) },
            });
            const result = await response.json();
            if (!response.ok) {
                if (typeof result.existingChangeId === "string") setExistingChangeId(result.existingChangeId);
                // Any uncertain or conflicted POST retains its exact persisted key.
                throw new Error(result.error || "Unable to confirm the branch billing change. Retry the same request.");
            }
            const saved = result as RemovalResult;
            sessionStorage.removeItem(storageKey); setPendingKey(null); setReview(false);
            onChanged(undo ? "ACTIVE" : "REMOVAL_SCHEDULED");
            if (!undo && saved.change?.id && saved.action !== "NONE") {
                router.push(`/org/${encodeURIComponent(organizationId)}/billing/processing/${encodeURIComponent(saved.change.id)}`);
            } else {
                setNotice(undo ? t.owned("Branch removal cancelled.") : saved.change?.effectiveAt
                    ? t.owned("Branch removal scheduled for {date}.", { date: formatDate(saved.change.effectiveAt) })
                    : t.owned("Branch removal scheduled."));
            }
        } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to confirm the branch billing change. Retry the same request."); }
        finally { inFlight.current = false; setBusy(false); }
    }
    return <div className="space-y-2 border-t border-[color:var(--ui-panel-border)] p-3">
        <p className="text-xs text-[color:var(--text-muted)]">{t.owned(billingStatus.replaceAll("_", " "))}</p>
        {(billingStatus === "ACTIVE" || undo || pendingKey) && <AppButton density="compact" variant="secondary" disabled={!available} onClick={() => setReview(true)}>{t.owned(pendingKey ? "Resume branch removal" : undo ? "Undo branch removal" : "Schedule branch removal")}</AppButton>}
        {finalBranch && !undo && !pendingKey && <p className="text-xs">{t.owned("The final billable branch cannot be removed.")}</p>}
        {notice && <p role="status" className="text-sm">{notice}</p>}
        {error && !review && <p role="alert" className="text-sm">{t.owned(error)}</p>}
        <Dialog density="compact" open={review} title={t.owned(undo ? "Undo branch removal" : "Schedule branch removal")} onClose={() => setReview(false)} closeDisabled={busy}
            footer={<><AppButton variant="secondary" disabled={busy} onClick={() => setReview(false)}>{t("Close")}</AppButton><AppButton variant="primary" disabled={!available} isLoading={busy} onClick={() => void confirm()}>{t.owned(pendingKey ? "Retry same request" : undo ? "Undo branch removal" : "Confirm branch removal")}</AppButton></>}>
            <div className="space-y-3"><p className="break-words font-semibold">{branchName}</p><p>{t.owned(undo ? "Restore the scheduled branch to active billing. The server checks whether undo is still available." : "Schedule this branch to leave billing at the server-confirmed cycle boundary. Its records are retained. Provider confirmation or authorization may still be required.")}</p>
                {pendingKey && <p role="status">{t.owned("A request may already be recorded. Retry the same request to confirm its result. Closing this dialog does not cancel it.")}</p>}
                {error && <p role="alert">{t.owned(error)}</p>}
                {existingChangeId && <Link className="inline-flex min-h-11 items-center underline" href={`/org/${encodeURIComponent(organizationId)}/billing/processing/${encodeURIComponent(existingChangeId)}`}>{t.owned("Review existing billing change")}</Link>}
            </div>
        </Dialog>
    </div>;
}
