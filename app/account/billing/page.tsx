export const metadata = { title: { absolute: "Account billing | Lab Lords" } };
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { UserService } from "@/services/user.service";
import { accountBillingContext, type AccountBillingQuery } from "@/lib/accountNavigation";
import { AccountBilling } from "@/components/account/AccountBilling";

export default async function BillingPage({ searchParams }: { searchParams: Promise<AccountBillingQuery> }) {
    const user = await getSessionUser();
    if (!user) redirect("/sign-in");
    const requested = await searchParams;
    const directory = await UserService.getWorkspaceDirectory(user.id);
    const selected = accountBillingContext(directory.organizations, requested);
    if (!selected) notFound();
    return <Suspense><AccountBilling organizations={directory.organizations} organizationId={selected.organization.id} branchId={selected.branch?.id} /></Suspense>;
}
