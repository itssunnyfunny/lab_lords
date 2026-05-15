"use client";

import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { AppLogo } from "@/components/brand/AppLogo";
import { Badge } from "@/components/ui/Badge";
import { Building2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { organizations } from "@/lib/api/organizations";
import type { Organization } from "@/app/generated/prisma/browser";
import { cn } from "@/lib/utils";
import { formErrorBannerClass } from "@/components/ui/formSurface";
import {
    entryContentClass,
    entryIconFrameClass,
    entryInlineInfoClass,
    entryRootClass,
    entrySubtitleClass,
    entryTitleClass,
} from "@/components/ui/entrySurface";
import {
    pageEmptyStateClass,
    pageGridCardClass,
    pageGridCardHoverClass,
    pageLoadingStateClass,
    pageMutedTextClass,
} from "@/components/ui/pageSurface";

export default function OrgSelectionPage() {
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
        <div className={entryRootClass}>
            <AmbientBackground />

            <div className={cn(entryContentClass, "max-w-4xl")}>
                <div className="mb-8 text-center sm:mb-12">
                    <AppLogo className="mb-5 justify-center" subtitle="Workspace" />
                    <h1 className={cn(entryTitleClass, "mb-2")}>Select workspace</h1>
                    <p className={entrySubtitleClass}>Choose the organization you want to work in.</p>
                </div>

                {loading ? (
                    <div className={pageLoadingStateClass}>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Loading workspaces...
                    </div>
                ) : error ? (
                    <div className={cn("p-4 text-center text-sm", formErrorBannerClass)}>
                        {error}
                    </div>
                ) : orgs.length === 0 ? (
                    <div className={pageEmptyStateClass}>
                        No organizations found. Please check your data.
                    </div>
                ) : (
                    <div className="grid gap-4 sm:gap-6 md:grid-cols-2 md:gap-8">
                        {orgs.map(org => (
                            <button key={org.id} onClick={() => handleSelect(org.id)} className="group text-left h-full w-full">
                                <div className={cn(pageGridCardClass, pageGridCardHoverClass, "h-full p-5 transition-transform duration-200 group-hover:-translate-y-0.5")}>
                                    <div className="flex items-start justify-between mb-6">
                                        <div className={cn(entryIconFrameClass, "h-14 w-14 transition-colors group-hover:border-[color:var(--ui-form-input-border)] sm:h-16 sm:w-16")}>
                                            <Building2 size={32} />
                                        </div>
                                        <Badge variant="cyan">Active</Badge>
                                    </div>
                                    <h3 className="mb-2 text-xl font-semibold text-[color:var(--text-primary)] transition-colors sm:text-2xl">{org.name}</h3>
                                    <div className={cn("flex min-w-0 items-center gap-2 text-sm", pageMutedTextClass)}>
                                        <span className="shrink-0">ID:</span>
                                        <span className={cn(entryInlineInfoClass, "truncate px-2 py-0.5 font-medium text-[color:var(--text-primary)]")}>{org.id}</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
