import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { UserService } from "@/services/user.service";
import { AppShell } from "@/components/layout/AppShell";
import { AccountSidebar } from "@/components/account/AccountSidebar";

export const metadata: Metadata = { title: "Account settings", robots: { index: false, follow: false } };
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();
    if (!user) redirect("/sign-in");
    const directory = await UserService.getWorkspaceDirectory(user.id);
    return <AppShell designPilot sidebar={<Suspense><AccountSidebar directory={directory} /></Suspense>}>{children}</AppShell>;
}
