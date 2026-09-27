"use client";
import { useEffect, useRef, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import type { DashboardOverview } from "@/lib/dashboardContracts";
import { SourceState } from "./ReferenceDashboard";

export function ReferenceCollections({ source, branchId, retry }: { source: DashboardOverview["collections"]; branchId: string; retry: () => void }) {
    const t = useTranslation(); const { formatNumber, formatDate } = useUserPreferences();
    const [selected, setSelected] = useState<string | null>(null);
    const [history, setHistory] = useState<{ source: DashboardOverview["collections"]; month: string; version: number; result: DashboardOverview["collections"] } | null>(null);
    const seq = useRef(0);
    const [retryVersion, setRetryVersion] = useState(0);
    const currentMonth = source.data?.month;
    useEffect(() => {
        const current = ++seq.current;
        if (source.status !== "success" || !selected || selected === currentMonth) return;
        const abort = new AbortController();
        const accept = (result: DashboardOverview["collections"]) => {
            if (!abort.signal.aborted && current === seq.current) setHistory({ source, month: selected, version: retryVersion, result });
        };
        fetch(`/api/branches/${encodeURIComponent(branchId)}/dashboard?month=${selected}`, { cache: "no-store", signal: abort.signal })
            .then(r => { if (!r.ok) throw new Error("Unavailable"); return r.json() as Promise<DashboardOverview>; })
            .then(result => { if (result.branchId !== branchId) throw new Error("Unavailable"); accept(result.collections); })
            .catch(() => accept({ status: "error", data: null }));
        return () => abort.abort();
    }, [selected, currentMonth, branchId, retryVersion, source]);
    const historical = source.status === "success" && selected && selected !== currentMonth;
    const result = history?.source === source && history.month === selected && history.version === retryVersion ? history.result : null;
    const busy = Boolean(historical && !result);
    const retrySelected = () => { if (historical) setRetryVersion(value => value + 1); else retry(); };
    const active = historical ? result : source;
    const data = active?.data;
    const points = data?.points ?? [];
    const money = (amount: number) => formatNumber(amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
    const rawMax = Math.max(100, ...points.map(point => point.collected + point.pending));
    const step = 10 ** Math.floor(Math.log10(rawMax / 4));
    const maximum = Math.ceil(rawMax / 4 / step) * step * 4;
    const x = (index: number) => 40 + (index + .5) * 470 / Math.max(points.length, 1);
    const y = (amount: number) => 151 - amount / maximum * 132;
    const rateY = (rate: number) => 151 - rate / 100 * 132;
    const width = Math.max(2, 470 / Math.max(points.length, 1) * .65);
    const months = Array.from({ length: 6 }, (_, i) => { const date = new Date(`${currentMonth ?? new Date().toISOString().slice(0,7)}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth() - i); return date.toISOString().slice(0, 7); });
    let ratePath = ""; let inPath = false;
    points.forEach((point, i) => { if (point.collectionRate == null) { inPath = false; return; } ratePath += `${inPath ? "L" : "M"}${x(i)} ${rateY(point.collectionRate)} `; inPath = true; });
    return <section className="rd-panel rd-collections" aria-busy={busy}><div className="rd-panel-heading"><div><BarChart3 size={20} /><div><h2>{t("Collections & Revenue")}</h2><p>{t.owned("Fees due in selected month · current settlement")}</p></div></div><label className="rd-period"><span className="sr-only">{t("Collection period")}</span><select value={selected ?? currentMonth ?? ""} onChange={event => { setHistory(null); setSelected(event.target.value); }}>{months.map((month, i) => <option key={month} value={month}>{i === 0 ? t.owned("This month") : formatDate(`${month}-01T12:00:00Z`, { month: "short", year: "numeric", timeZone: "UTC" })}</option>)}</select></label></div>
        {busy ? <div className="rd-chart-loading" role="status">{t.owned("Loading collections…")}</div> : data ? <>
            <div className="rd-chart-top"><div className="rd-legend"><span><i className="rd-key-collected" />{t.owned("Collected")}</span><span><i className="rd-key-pending" />{t.owned("Pending")}</span><span><i className="rd-key-line" />{t.owned("Collection rate")}</span></div><div className="rd-rate"><strong>{data.rate == null ? "—" : `${formatNumber(data.rate, { maximumFractionDigits: 0 })}%`}</strong><span>{t.owned("Collection rate")}</span></div></div>
            <svg className="rd-chart" viewBox="0 0 544 180" preserveAspectRatio="none" role="img" aria-label={t.owned("Recorded fee settlement by due date. Rupees on left axis; collection rate on right. Full data below.")}>
                {[0, 1, 2, 3, 4].map(i => <g key={i}><line x1="40" x2="510" y1={19 + i * 33} y2={19 + i * 33} stroke="#e6ede9" /><text x="29" y={23 + i * 33} textAnchor="end">{formatNumber(maximum * (1 - i / 4), { notation: "compact", maximumFractionDigits: 1 })}</text><text x="518" y={23 + i * 33}>{100 - i * 25}%</text></g>)}
                {points.map((point, i) => <g key={point.date}><title>{`${point.date}: ${t.owned("Collected")} ${money(point.collected)}, ${t.owned("Pending")} ${money(point.pending)}`}</title><rect x={x(i) - width / 2} y={y(point.collected + point.pending)} width={width} height={(point.collected + point.pending) / maximum * 132} fill="#d8e6df" /><rect x={x(i) - width / 2} y={y(point.collected)} width={width} height={point.collected / maximum * 132} fill="#35a66b" />{(i === 0 || (i + 1) % 5 === 0 || i === points.length - 1) && <><line x1={x(i)} x2={x(i)} y1="19" y2="151" stroke="#eef2ef" /><text x={x(i)} y="173" textAnchor="middle">{formatDate(`${point.date}T12:00:00Z`, { day: "numeric", month: "short", timeZone: "UTC" })}</text></>}</g>)}
                <path d={ratePath} fill="none" stroke="#07533c" strokeWidth="1.8" />{points.filter((p, i) => p.collectionRate != null && (i % 2 === 0 || i === points.length - 1)).map(point => <circle key={point.date} cx={x(points.indexOf(point))} cy={rateY(point.collectionRate!)} r="2.6" fill="#07533c" />)}
            </svg>
            <dl className="rd-chart-summary"><div><dd>{money(data.billed)}</dd><dt>{t.owned("Billed in period")}</dt></div><div><dd>{money(data.collected)}</dd><dt>{t.owned("Collected for these fees")}</dt></div><div><dd>{money(data.pending)}</dd><dt>{t.owned("Remaining balance")}</dt></div></dl>
            <details className="rd-chart-details"><summary>{t.owned("Definitions & daily values")}</summary><p>{t.owned("Current settlement grouped by fee due date. The line uses collected ÷ (billed − waived) for the same cumulative fee cohort; it is not historical cash flow.")}</p><p>{t.owned("Waived in this period")}: {money(data.waived)}</p><table><thead><tr>{["Date", "Billed", "Collected", "Pending"].map(label => <th key={label}>{t.owned(label)}</th>)}</tr></thead><tbody>{points.map(point => <tr key={point.date}><td>{point.date}</td><td>{money(point.billed)}</td><td>{money(point.collected)}</td><td>{money(point.pending)}</td></tr>)}</tbody></table></details>
        </> : <SourceState source={active ?? { status: "error", data: null }} retry={retrySelected} />}
    </section>;
}
