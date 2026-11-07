import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { OrganizationService } from "@/services/organization.service";
import BillingProcessingContent from "@/components/billing/BillingProcessingContent";
export default async function ProcessingPage({ params }: { params: Promise<{ orgId: string; changeId: string }> }) {
    const { orgId, changeId } = await params;
    const user = await getSessionUser();
    if (!user) redirect("/sign-in");
    if (!(await OrganizationService.isOwner(orgId, user.id))) notFound();
    return <BillingProcessingContent key={`${orgId}:${changeId}`} orgId={orgId} changeId={changeId} />;
}
