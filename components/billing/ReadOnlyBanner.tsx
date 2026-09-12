"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import type { BillingExperience } from "@/types/billingExperience";

export function ReadOnlyBanner({ experience }: { experience: BillingExperience }) {
    const t = useTranslation();
  if (experience.accessMode !== "READ_ONLY") return null;
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-[var(--ui-radius-control)] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between" role="alert">
      <div className="flex items-start gap-3">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        <div>
          <p className="font-semibold text-[color:var(--ui-text)]">{t("Workspace is read-only")}</p>
          <p className="mt-0.5 text-xs text-[color:var(--ui-text-muted)]">{experience.customerMessage}  {t("Your data remains available and unchanged.")}</p>
        </div>
      </div>
      {experience.viewer.canManageBilling && <Link className="shrink-0 font-semibold text-red-600 hover:underline" href={`/org/${encodeURIComponent(experience.organizationId)}/settings#billing`}>{t("Restore access")}</Link>}
    </div>
  );
}
