"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BarChart3, CalendarCheck, CalendarDays, CreditCard, IndianRupee, MapPin, Plus, RefreshCw, TriangleAlert, Users } from "lucide-react";
import { PageLoadingSkeleton, PageShell } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { useBranchAccess } from "@/hooks/useBranchAccess";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import type { DashboardOverview, DashboardSource } from "@/lib/dashboardContracts";
import { ReferenceCollections } from "./ReferenceCollections";
import { ReferenceSeating } from "./ReferenceSeating";
import { ActionCenter, DashboardActivity, DashboardQuickActions, DashboardWorklists } from "./ReferenceWorklists";

export function SourceState({ source, retry }: { source: DashboardSource<unknown>; retry?: () => void }) {
    const t = useTranslation();
    return <div className="rd-source" role="status"><span>{t.owned(source.status === "restricted" ? "Not included in your access" : source.status === "locked" ? "Available on Standard" : "This source could not be refreshed.")}</span>
        {source.status === "error" && retry && <button type="button" onClick={retry}><RefreshCw size={13} />{t("Retry")}</button>}</div>;
}

export function ReferenceDashboard({ branchId }: { branchId: string }) {
    const t = useTranslation();
    const { access, loading } = useBranchAccess(branchId);
    const { formatNumber, formatDateTime } = useUserPreferences();
    const [data, setData] = useState<DashboardOverview | null>(null);
    const [error, setError] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const request = useRef(0);
    const controller = useRef<AbortController | null>(null);
    const base = `/branch/${encodeURIComponent(branchId)}`;
    const refresh = useCallback(async () => {
        if (!access) return;
        const identity = ++request.current;
        controller.current?.abort();
        const pending = new AbortController(); controller.current = pending;
        setRefreshing(true);
        try {
            const response = await fetch(`/api/branches/${encodeURIComponent(branchId)}/dashboard`, { cache: "no-store", signal: pending.signal });
            if (!response.ok) throw new Error("Dashboard unavailable");
            const next = await response.json() as DashboardOverview;
            if (identity === request.current && !pending.signal.aborted && next.branchId === branchId) { setData(next); setError(false); }
        } catch { if (identity === request.current && !pending.signal.aborted) setError(true); }
        finally { if (identity === request.current && !pending.signal.aborted) setRefreshing(false); }
    }, [access, branchId]);
    useEffect(() => {
        const requestSequence = request;
        const activeController = controller;
        void refresh();
        return () => { requestSequence.current++; activeController.current?.abort(); };
    }, [refresh]);
    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === "visible" && !document.querySelector('[data-dialog-overlay="true"]')) void refresh(); };
        const timer = window.setInterval(onVisible, 60_000);
        window.addEventListener("focus", onVisible); window.addEventListener("pageshow", onVisible);
        document.addEventListener("visibilitychange", onVisible);
        return () => { clearInterval(timer); window.removeEventListener("focus", onVisible); window.removeEventListener("pageshow", onVisible); document.removeEventListener("visibilitychange", onVisible); };
    }, [refresh]);
    useEffect(() => {
        if (!access || !getBranchCapabilityDecision(access, "allocationsManage").allowed) return;
        const abort = new AbortController();
        // Prospective observation only; the server deduplicates branch/day/shift.
        void fetch(`/api/branches/${encodeURIComponent(branchId)}/dashboard`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "CAPTURE_OCCUPANCY" }), signal: abort.signal }).catch(() => undefined);
        return () => abort.abort();
    }, [access, branchId]);
    if (loading || (!data && !error && access)) return <PageShell data-reference-dashboard="true"><PageLoadingSkeleton label={t("Loading branch dashboard")} variant="dashboard" /></PageShell>;
    if (!access) return <PageShell><p role="alert">{t("You do not have access to this branch.")}</p></PageShell>;
    if (!data) return <PageShell data-reference-dashboard="true"><SourceState source={{ status: "error", data: null }} retry={refresh} /></PageShell>;
    const money = (n: number) => formatNumber(n, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
    const value = <T,>(source: DashboardSource<T>, get: (v: T) => string) => source.data ? get(source.data) : "—";
    const note = (source: DashboardSource<unknown>, normal: string) => source.status === "success" ? t.owned(normal) : t.owned(source.status === "restricted" ? "Not included in your access" : source.status === "locked" ? "Available on Standard" : "Source unavailable");
    const seat = data.seating.data;
    const metrics = [
        { label: "Collected this month", value: value(data.money, m => money(m.collectedThisMonth)), note: data.money.data?.comparisonPercent != null ? `${formatNumber(data.money.data.comparisonPercent)}% ${t.owned("vs last month")}` : note(data.money, "By collection date"), icon: IndianRupee, tone: "green" },
        { label: "Pending dues", value: value(data.money, m => money(m.pendingDues)), note: note(data.money, "Recorded remaining balances"), icon: TriangleAlert, tone: "red" },
        { label: "Active students", value: value(data.students, m => formatNumber(m.active)), note: note(data.students, "Active student profiles"), icon: Users, tone: "blue" },
        { label: "Shift slot utilization", value: value(data.seating, m => m.utilizationPercent == null ? "—" : `${formatNumber(m.utilizationPercent, { maximumFractionDigits: 0 })}%`), note: seat ? t("{used} of {total} shift slots", { used: formatNumber(seat.occupied), total: formatNumber(seat.capacity) }) : note(data.seating, "No capacity"), icon: BarChart3, tone: "purple" },
        { label: "Attendance today", value: value(data.attendance, m => formatNumber(m.attendedToday)), note: data.attendance.data?.configured ? t.owned("{count} expected today", { count: formatNumber(data.attendance.data.expectedToday) }) : note(data.attendance, "Expectations not configured"), icon: CalendarDays, tone: "blue" },
        { label: "Follow-ups pending", value: value(data.followUps, m => formatNumber(m.pending)), note: note(data.followUps, data.followUps.data?.dueToday ? "Needs attention" : "No contacts due today"), icon: Users, tone: "amber" },
    ];
    return <PageShell data-reference-dashboard="true" className="reference-dashboard" aria-busy={refreshing}>
        <header className="rd-heading">
            <div className="rd-illustration"><Image src="/images/dashboard/study-library.png" alt={t.owned("Illustration of a peaceful study library")} width={110} height={128} priority /><div><span>{t.owned("Good focus.")}<br />{t.owned("Brighter tomorrows.")}</span><Image src="/images/dashboard/botanical-sprig.png" alt="" width={65} height={70} /></div></div>
            <div className="rd-heading-main"><h1>{access.branchName}</h1><div className="rd-meta"><span><MapPin size={12} />{t("Branch overview")}</span><i /><button type="button" onClick={refresh} title={t("Refresh")}><RefreshCw size={11} className={refreshing ? "rd-spinning" : ""} />{t("Updated {time}", { time: formatDateTime(data.updatedAt) })}</button></div><p>{t.owned("Monitor collections, occupancy, follow-ups and student movement — all in one place.")}</p></div>
            <div className="rd-heading-aside"><blockquote>“{t.owned("A well-managed space helps dreams take shape.")}”<Image src="/images/dashboard/botanical-sprig.png" alt="" width={70} height={72} /></blockquote><Image className="rd-header-leaves" src="/images/dashboard/botanical-sprig.png" alt="" width={120} height={120} /><div className="rd-primary-actions">
                {getBranchCapabilityDecision(access, "studentsManage").allowed && <Link className="rd-button rd-primary" href={`${base}/students?action=add`}><Plus size={17} />{t("Add student")}</Link>}
                {getBranchCapabilityDecision(access, "paymentsRecord").allowed && <Link className="rd-button" href={`${base}/payments?action=collect`}><CreditCard size={16} />{t.owned("Record payment")}</Link>}
                {access.permissions.view_payments && <Link className="rd-button" href={`${base}/renewals?filter=OVERDUE`}><CalendarCheck size={16} />{t.owned("Review dues")}</Link>}
            </div></div>
        </header>
        {error && <div className="rd-error" role="status">{t("Previously loaded values may be stale.")} <button onClick={refresh}>{t("Retry")}</button></div>}
        <ActionCenter data={data} base={base} refresh={refresh} />
        <section className="rd-metrics" aria-label={t("Current branch summary")}>{metrics.map(metric => <article key={metric.label} data-tone={metric.tone}><div><strong>{metric.value}</strong><metric.icon size={21} aria-hidden="true" /></div><h2>{t.owned(metric.label)}</h2><p>{metric.note}</p></article>)}</section>
        <div className="rd-grid"><ReferenceCollections source={data.collections} branchId={branchId} retry={refresh} /><ReferenceSeating seating={data.seating} attendance={data.attendance} base={base} retry={refresh} /><aside className="rd-rail"><DashboardActivity data={data} base={base} /><DashboardQuickActions access={access} base={base} /></aside><DashboardWorklists data={data} base={base} retry={refresh} /></div>
    </PageShell>;
}
