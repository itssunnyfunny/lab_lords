export const metadata = { title: { absolute: "Account billing | Lab Lords" } };
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { UserService } from "@/services/user.service";
import { AccountBilling } from "@/components/account/AccountBilling";

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ organizationId?: string; branchId?: string }> }) {
    const user = await getSessionUser();
    if (!user) redirect("/sign-in");
    const requested = await searchParams;
    const directory = await UserService.getWorkspaceDirectory(user.id);
    const organization = requested.organizationId
        ? directory.organizations.find(org => org.id === requested.organizationId)
        : requested.branchId ? directory.organizations.find(org => org.branches.some(branch => branch.id === requested.branchId)) : directory.organizations[0];
    if (!organization || (requested.branchId && !organization.branches.some(branch => branch.id === requested.branchId))) notFound();
    return <Suspense><AccountBilling organizations={directory.organizations} organizationId={organization.id} branchId={requested.branchId} /></Suspense>;
}
