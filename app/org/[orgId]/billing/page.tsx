"use client";

import { Suspense, use } from "react";
import { useTranslation } from "@/components/settings/LocalizedText";
import { PageLoadingSkeleton } from "@/components/ui";
import { OrganizationBillingContent } from "@/components/billing/OrganizationBillingContent";

export default function OrganizationBillingPage({ params }: { params: Promise<{ orgId: string }> }) {
    const { orgId } = use(params);
    const t = useTranslation();
    return <Suspense fallback={<PageLoadingSkeleton label={t("Loading billing plans...")} variant="settings" maxWidth="content" />}>
        <OrganizationBillingContent key={orgId} orgId={orgId} />
    </Suspense>;
}
