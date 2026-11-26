import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { OrganizationService } from "@/services/organization.service";
import BillingProcessingContent from "@/components/billing/BillingProcessingContent";
export default async function ProcessingPage({ params, searchParams }: { params: Promise<{ orgId: string; changeId: string }>; searchParams?: Promise<{ branchId?: string; returnTo?: string }> }) {
    const { orgId, changeId } = await params;
    const user = await getSessionUser();
    if (!user) redirect("/sign-in");
    if (!(await OrganizationService.isOwner(orgId, user.id))) notFound();
    const { branchId, returnTo } = (await searchParams) ?? {};
    if (!branchId) notFound();
    return <BillingProcessingContent key={`${orgId}:${branchId}:${changeId}`} branchId={branchId} returnTo={returnTo} orgId={orgId} changeId={changeId} />;
}
