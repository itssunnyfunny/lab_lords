"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { AppButton } from "@/components/ui/AppButton";
import { Badge } from "@/components/ui/Badge";
import { pageInsetSurfaceClass } from "@/components/ui/pageSurface";
import { cn } from "@/lib/utils";
import { whatsapp, type WhatsAppDailyReportHistoryItem } from "@/lib/api/whatsapp";

type HistoryState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; reports: readonly WhatsAppDailyReportHistoryItem[] };

export async function fetchWhatsAppDailyReportHistory(
  scope: "BRANCH" | "ORGANIZATION",
  scopeId: string,
  api: Pick<typeof whatsapp, "getBranchDailyReportHistory" | "getOrganizationDailyReportHistory"> = whatsapp
) {
  return scope === "BRANCH"
    ? api.getBranchDailyReportHistory(scopeId)
    : api.getOrganizationDailyReportHistory(scopeId);
}

function estimatedInr(value: string | null) {
  if (value === null || !/^\d+$/.test(value)) return "Unavailable";
  const amount = Number(value) / 1_000_000;
  return Number.isFinite(amount) ? `₹${amount.toFixed(4)}` : "Unavailable";
}

function statusVariant(status: WhatsAppDailyReportHistoryItem["status"]) {
  if (status === "DELIVERED" || status === "READ") return "success" as const;
  if (status === "FAILED" || status === "UNKNOWN") return "danger" as const;
  if (status === "CANCELLED" || status === "SUPPRESSED") return "warning" as const;
  return "default" as const;
}

export function WhatsAppDailyReportHistoryRows({ state }: { state: HistoryState }) {
  const t = useTranslation();
  if (state.status === "loading") {
    return <p role="status" className="text-sm text-[color:var(--text-muted)]">{t.owned("Loading daily report history…")}</p>;
  }
  if (state.status === "unavailable") {
    return <p role="status" className="text-sm text-[color:var(--text-muted)]">{t.owned("Daily report history is unavailable. Try refreshing.")}</p>;
  }
  if (state.reports.length === 0) {
    return <p className="text-sm text-[color:var(--text-muted)]">{t("No daily report history yet.")}</p>;
  }
  return <ul className="grid gap-2">
    {state.reports.map(report => (
      <li key={report.id} className={cn("flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between", pageInsetSurfaceClass)}>
        <div>
          <p className="text-sm font-medium">{report.localReportDate} · {report.maskedPhone}</p>
          <p className="mt-1 text-xs text-[color:var(--text-muted)]">{t("Scheduled {formatDateTime} · estimate {estimatedInr}", {
            formatDateTime: new Date(report.scheduledFor).toLocaleString("en-IN"),
            estimatedInr: estimatedInr(report.estimatedCostMicros),
          })}</p>
        </div>
        <Badge variant={statusVariant(report.status)}>{report.status.replaceAll("_", " ")}</Badge>
      </li>
    ))}
  </ul>;
}

export function WhatsAppDailyReportHistory({ scope, scopeId, refreshKey }: {
  scope: "BRANCH" | "ORGANIZATION";
  scopeId: string;
  refreshKey: number;
}) {
  const t = useTranslation();
  const [revision, setRevision] = useState(0);
  const requestKey = `${scope}:${scopeId}:${revision}:${refreshKey}`;
  const [loaded, setLoaded] = useState<{ requestKey: string; state: HistoryState }>({
    requestKey, state: { status: "loading" },
  });
  const state: HistoryState = loaded.requestKey === requestKey ? loaded.state : { status: "loading" };

  useEffect(() => {
    let cancelled = false;
    void fetchWhatsAppDailyReportHistory(scope, scopeId).then(response => {
      if (!cancelled) setLoaded({ requestKey, state: { status: "ready", reports: response.reports } });
    }).catch(() => {
      if (!cancelled) setLoaded({ requestKey, state: { status: "unavailable" } });
    });
    return () => { cancelled = true; };
  }, [scope, scopeId, requestKey]);

  return <section aria-labelledby={`${scope.toLowerCase()}-recent-report-heading`} className="space-y-3 border-t border-[color:var(--ui-form-section-divider)] pt-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id={`${scope.toLowerCase()}-recent-report-heading`} className="font-semibold">{t("Recent daily reports")}</h3>
      <AppButton size="sm" variant="secondary" icon={RefreshCw} disabled={state.status === "loading"} onClick={() => setRevision(current => current + 1)}>
        {t.owned("Refresh report history")}
      </AppButton>
    </div>
    <p className="text-xs text-[color:var(--text-muted)]">{t.owned("Your 20 most recent daily reports. Accepted means Meta accepted the request; delivery is confirmed separately.")}</p>
    <WhatsAppDailyReportHistoryRows state={state} />
  </section>;
}
