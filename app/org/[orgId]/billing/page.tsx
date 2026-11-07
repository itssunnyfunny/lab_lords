"use client";
import { Suspense, use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { accountBillingDestination } from "@/lib/accountNavigation";
import { PageLoadingSkeleton } from "@/components/ui";

function BillingRedirect({ orgId }: { orgId: string }) {
    const router = useRouter(), search = useSearchParams();
    useEffect(() => {
        router.replace(accountBillingDestination(`/org/${encodeURIComponent(orgId)}/billing${search.size ? `?${search}` : ""}${window.location.hash}`));
    }, [orgId, router, search]);
    return <PageLoadingSkeleton label="Opening billing" variant="settings" maxWidth="content" />;
}
export default function LegacyBillingPage({ params }: { params: Promise<{ orgId: string }> }) {
    const { orgId } = use(params);
    return <Suspense><BillingRedirect orgId={orgId} /></Suspense>;
}
