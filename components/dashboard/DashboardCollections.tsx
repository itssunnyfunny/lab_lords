"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { AppPanel } from "@/components/ui";
import { useTranslation } from "@/components/settings/LocalizedText";
import { useUserPreferences } from "@/components/settings/UserPreferencesApplier";
import { dailyDashboardCollections } from "@/lib/dashboardPresentation";
import type { BranchDashboardSources } from "@/lib/branchDashboard";
import { DashboardSourceNote } from "./DashboardPanels";

export function DashboardCollections({ data, onRetry }: { data: BranchDashboardSources; onRetry: () => void }) {
    const t = useTranslation();
    const { formatNumber, formatDate } = useUserPreferences();
    const [periodDays, setPeriodDays] = useState<7 | 14>(14);
    const allDaily = dailyDashboardCollections(data.collectionsTrend).slice(-14);
    const lastDate = allDaily.at(-1)?.date;
    const cutoff = lastDate ? Date.parse(lastDate) - (periodDays - 1) * 24 * 60 * 60 * 1000 : 0;
    const daily = periodDays === 14 ? allDaily : allDaily.filter(point => Date.parse(point.date) >= cutoff);
    const money = (amount: number) => formatNumber(amount, { style: "currency", currency: "INR", maximumFractionDigits: 0 });
    const shortDate = (date: string) => formatDate(date, { day: "numeric", month: "short" });
    const maximum = Math.max(100, ...daily.map(point => point.amount));
    const rawStep = maximum / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalizedStep = rawStep / magnitude;
    const tickStep = (normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 2.5 ? 2.5 : normalizedStep <= 5 ? 5 : 10) * magnitude;
    const ceiling = tickStep * 4;
    const range = daily.length ? `${shortDate(daily[0].date)} – ${shortDate(daily[daily.length - 1].date)}` : periodDays === 14 ? t("Last 14 days") : t("Last 7 days");
    const dateLabelIndexes = Array.from(new Set([0, Math.floor((daily.length - 1) / 4), Math.floor((daily.length - 1) / 2), Math.floor((daily.length - 1) * 3 / 4), daily.length - 1]));
    return <AppPanel
        title={<span className="dashboard-panel-title"><BarChart3 size={19} aria-hidden="true" />{t("Collections & Revenue")}</span>}
        description={t("Recorded collections and independent fee measures.")}
        action={<label className="dashboard-period"><span className="sr-only">{t("Collection period")}</span><select value={periodDays} onChange={event => setPeriodDays(Number(event.target.value) === 7 ? 7 : 14)}>
            <option value={14}>{t("Last 14 days")}</option><option value={7}>{t("Last 7 days")}</option>
        </select></label>}
        className="dashboard-collections">
        {data.resources.collectionsTrend === "success" && daily.length ? <figure className="dashboard-collection-chart">
            <figcaption><span className="dashboard-chart-key" />{t("Daily collections")}<span>{range}</span></figcaption>
            <div className="dashboard-chart-body" role="img" aria-label={t("Daily collections from {from} to {to}: {amount}. Full values below.", {
                from: shortDate(daily[0].date), to: shortDate(daily[daily.length - 1].date), amount: money(daily.reduce((sum, point) => sum + point.amount, 0)),
            })}>
                <div className="dashboard-chart-axis" aria-hidden="true">{[1, .75, .5, .25, 0].map(ratio => <span key={ratio}>{formatNumber(ceiling * ratio, { notation: "compact", maximumFractionDigits: 1 })}</span>)}</div>
                <div className="dashboard-chart-plot" aria-hidden="true">
                    <div className="dashboard-chart-bars">{daily.map(point => <div key={point.date}>
                        <span style={{ height: `${point.amount / ceiling * 100}%` }} />
                    </div>)}</div>
                    {!daily.some(point => point.amount > 0) && <p className="dashboard-chart-empty">{t("No collections in this period")}</p>}
                </div>
            </div>
            <div className="dashboard-chart-dates" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${daily.length}, minmax(0, 1fr))` }}>
                {dateLabelIndexes.map(index => <span key={daily[index].date} style={{ gridColumn: index + 1 }}>{shortDate(daily[index].date)}</span>)}
            </div>
        </figure> : data.resources.collectionsTrend === "success"
            ? <p className="dashboard-chart-unavailable">{t("Daily collection history is unavailable.")}</p>
            : <DashboardSourceNote status={data.resources.collectionsTrend} label={t("Daily collections")} onRetry={onRetry} />}
        {data.snapshot ? <dl className="dashboard-financial-facts">
            <div><dt>{t("Billed this month")}</dt><dd>{money(data.snapshot.monthlyRevenue)}</dd></div>
            <div><dt>{t("Collected this month")}</dt><dd>{money(data.snapshot.paidAmount)}</dd></div>
            <div><dt>{t("Outstanding today")}</dt><dd>{money(data.snapshot.dueAmount)}</dd></div>
        </dl> : <DashboardSourceNote status={data.resources.analytics} label={t("Collections")} onRetry={onRetry} />}
        <details className="dashboard-details">
            <summary>{t("Amounts & daily breakdown")}</summary>
            <p>{t("Collections can settle older fees. These amounts are not parts of one monthly total.")}</p>
            <p>{t("Billed: fees due this month. Outstanding: unpaid balances due through today.")}</p>
            {daily.length > 0 && <table><caption>{t("Daily collections")} · {range}</caption><thead><tr><th>{t("Date")}</th><th>{t("Amount")}</th></tr></thead>
                <tbody>{daily.map(point => <tr key={point.date}><td>{shortDate(point.date)}</td><td>{money(point.amount)}</td></tr>)}</tbody></table>}
        </details>
    </AppPanel>;
}
