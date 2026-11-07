import { redirect } from "next/navigation";
import { accountBillingProcessingHref } from "@/lib/accountNavigation";
export default async function LegacyProcessingPage({ params }: { params: Promise<{ orgId: string; changeId: string }> }) {
    const { orgId, changeId } = await params;
    redirect(accountBillingProcessingHref(orgId, changeId));
}
