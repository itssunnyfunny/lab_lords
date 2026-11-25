"use client";
import { useTranslation } from "@/components/settings/LocalizedText";

import Link from "next/link";
import { LockKeyhole, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { BILLING_FEATURE_POLICIES, hasFeatureEntitlement, type BillingFeatureKey } from "@/lib/billingPolicy";
import type { BillingExperienceView } from "@/types/billingExperience";
import { isFullBillingExperience } from "@/lib/billingExperienceView";
import { usePathname } from "next/navigation";

import { getOrganizationBillingPath } from "@/lib/billingFlow";

export function FeatureUpgradeGate({
  feature,
  experience,
  children,
}: {
  feature: BillingFeatureKey;
  experience: BillingExperienceView | null | undefined;
  children: ReactNode;
}) {
    const t = useTranslation();
  const pathname = usePathname();
  if (!experience) return <p role="status">{t.owned("Checking access...")}</p>;
  if (hasFeatureEntitlement(experience.entitlements, feature)) return <>{children}</>;
  const policy = BILLING_FEATURE_POLICIES[feature];
  const owner = experience.viewer.isOwner;
  const returnPath = pathname || `/org/${encodeURIComponent(experience.organizationId)}`;
  const upgradeHref = getOrganizationBillingPath(experience.organizationId, "STANDARD", returnPath);

  return (
    <div className="mx-auto flex min-h-96 max-w-xl flex-col items-center justify-center gap-5 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-500">
        {owner ? <Sparkles className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-amber-600">{t("Standard feature")}</p>
        <h1 className="mt-2 text-xl font-bold text-[color:var(--ui-text)]">{t.owned(policy.label)}{experience.branch && "name" in experience.branch ? ` · ${experience.branch.name}` : ""}</h1>
        <p className="mt-2 text-sm text-[color:var(--ui-text-muted)]">{owner ? policy.benefit : t("Your role allows this feature, but the organization owner needs to enable the Standard plan.")}</p>
      </div>
      {owner && isFullBillingExperience(experience) ? (
        <div className="space-y-3">
          <Link className="inline-flex h-10 items-center rounded-[var(--ui-radius-control)] bg-[color:var(--ui-button-primary-bg)] px-4 text-sm font-semibold text-[color:var(--ui-button-primary-text)]" href={upgradeHref}>{t("Upgrade to Standard")}</Link>
        </div>
      ) : (
        <p className="text-sm font-semibold text-[color:var(--ui-text)]">{t("Ask your organization owner to upgrade.")}</p>
      )}
      <Link className="text-sm underline" href={experience.branch ? `/branch/${experience.branch.id}` : `/org/${experience.organizationId}`}>{t("Back to dashboard")}</Link>
    </div>
  );
}
