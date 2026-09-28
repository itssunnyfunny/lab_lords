"use client";
import { LocalizedError } from "@/components/settings/LocalizedText";
import { useTranslation } from "@/components/settings/LocalizedText";

import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { AppLogo } from "@/components/brand/AppLogo";
import { Badge } from "@/components/ui/Badge";
import { EntryLoadingSkeleton } from "@/components/ui";
import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { organizations } from "@/lib/api/organizations";
import type { Organization } from "@/app/generated/prisma/browser";
import { cn } from "@/lib/utils";
import { formErrorBannerClass } from "@/components/ui/formSurface";
import {
    entryContentClass,
    entryIconFrameClass,
    entryRootClass,
    entrySubtitleClass,
    entryTitleClass,
} from "@/components/ui/entrySurface";
import {
    pageEmptyStateClass,
    pageMutedTextClass,
} from "@/components/ui/pageSurface";

export default function OrgSelectionPage() {
    const t = useTranslation();
    const router = useRouter();
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrgs = async () => {
            try {
                const data = await organizations.getAll();
                if (data.length === 0) {
                    router.replace("/onboarding");
                    return;
                }
                setOrgs(data);
            } catch (err) {
                console.error("Failed to fetch organizations", err);
                setError("Failed to load organizations");
            } finally {
                setLoading(false);
            }
        };

        fetchOrgs();
    }, [router]);

    const handleSelect = (orgId: string) => {
        router.push(`/org/${orgId}`);
    };

    return (
        <div className={entryRootClass} data-app-design-pilot="workspace">
            <AmbientBackground />

            <div className={cn(entryContentClass, "max-w-4xl")}>
                <div className="mb-6 text-center sm:mb-8">
                    <AppLogo className="mb-5 justify-center" subtitle={t("Workspace")} />
                    <h1 className={cn(entryTitleClass, "mb-2")}>{t("Select workspace")}</h1>
                    <p className={entrySubtitleClass}>{t("Choose the organization you want to work in.")}</p>
                </div>

                {loading ? (
                    <EntryLoadingSkeleton label={t("Loading workspaces")} />
                ) : error ? (
                    <div className={cn("p-4 text-center text-sm", formErrorBannerClass)}>
                        <LocalizedError error={error} />
                    </div>
                ) : orgs.length === 0 ? (
                    <div className={pageEmptyStateClass}>
                        {t("No organizations found. Please check your data.")}</div>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                        {orgs.map(org => (
                            <button key={org.id} onClick={() => handleSelect(org.id)} className={cn("ui-panel--compact ui-record-card group flex min-h-20 w-full min-w-0 flex-col text-left transition-colors hover:border-[color:var(--ui-card-hover-border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ui-focus-ring)]")}>
                                <span className="flex min-w-0 items-start gap-3">
                                    <span className={cn(entryIconFrameClass, "h-11 w-11 shrink-0 transition-colors group-hover:border-[color:var(--ui-form-input-border)]")}><Building2 size={21} aria-hidden="true" /></span>
                                    <span className="min-w-0 flex-1"><span className="block break-words text-base font-semibold text-[color:var(--text-primary)]">{org.name}</span>
                                        <span className={cn("mt-2 flex min-w-0 items-center gap-2 text-xs", pageMutedTextClass)}><span className="shrink-0">{t("ID:")}</span><span className="truncate">{org.id}</span></span></span>
                                    <Badge variant="cyan" className="shrink-0">{t("Active")}</Badge>
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
