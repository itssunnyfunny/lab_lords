"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import { AppPanel } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import { pageInsetMetricClass } from "@/components/ui/pageSurface";
import {
  WhatsAppDailyReportActions,
  type WhatsAppDailyReportHistoryItemView,
  type WhatsAppDailyReportPreviewView,
  type WhatsAppDailyReportQueueResultView,
  type WhatsAppReportSettingsSummaryView,
} from "@/components/whatsapp/OrganizationWhatsAppReports";

export interface BranchWhatsAppReportsProps {
  branchName: string;
  settings: WhatsAppReportSettingsSummaryView;
  canQueue: boolean;
  blockedReason?: string;
  recentReports: readonly WhatsAppDailyReportHistoryItemView[];
  onPreview: () => Promise<WhatsAppDailyReportPreviewView>;
  onQueue: (idempotencyKey: string) => Promise<WhatsAppDailyReportQueueResultView>;
}

export function BranchWhatsAppReports({
  branchName,
  settings,
  canQueue,
  blockedReason,
  recentReports,
  onPreview,
  onQueue,
}: BranchWhatsAppReportsProps) {
    const t = useTranslation();

  return (
    <div className="space-y-4">
      <AppPanel
        title={t("Branch report setup")}
        description={t("Permission-bound branch reports use deterministic aggregate metrics, shift-slot occupancy, and the existing branch WhatsApp budget.")}
        action={<Badge variant={settings.enabled ? "success" : "default"}>{settings.enabled ? t.owned("Branch delivery on") : t.owned("Branch delivery off")}</Badge>}
        contentClassName="space-y-4"
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className={pageInsetMetricClass}>
            <dt className="text-xs text-[color:var(--text-muted)]">{t("Connected sender")}</dt>
            <dd className="mt-1 font-medium">{settings.senderLabel || "Not assigned"}</dd>
          </div>
          <div className={pageInsetMetricClass}>
            <dt className="text-xs text-[color:var(--text-muted)]">{t("Budget source")}</dt>
            <dd className="mt-1 font-medium">{t("Existing branch WhatsApp budget")}</dd>
          </div>
        </dl>
        <p className="text-sm text-[color:var(--text-secondary)]">
          {t.owned("Pause only your daily reports in the recipient section above. Resuming requires phone confirmation. The branch delivery switch above stops future sends and cancels queued work across the branch.")}
        </p>
      </AppPanel>

      <WhatsAppDailyReportActions
        scope="BRANCH"
        scopeName={branchName}
        canQueue={canQueue}
        blockedReason={blockedReason}
        recentReports={recentReports}
        onPreview={onPreview}
        onQueue={onQueue}
      />
    </div>
  );
}
