"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { UserProfile, useUser } from "@clerk/nextjs";
import { PersonalSettings } from "./PersonalSettings";
import { workspaceAccountProfileClerkAppearance } from "@/components/ui/entrySurface";
import { useTranslation } from "@/components/settings/LocalizedText";

const appearance = {
    ...workspaceAccountProfileClerkAppearance,
    elements: {
        ...workspaceAccountProfileClerkAppearance.elements,
        rootBox: "w-full max-w-none",
        cardBox: "w-full max-w-none shadow-none !border-0",
        card: "w-full max-w-none shadow-none !border-0",
        header: "!hidden",
        navbar: "!hidden",
        navbarMobileMenuButton: "!hidden",
        pageScrollBox: "!h-auto !max-h-none !overflow-visible !rounded-none !bg-transparent !p-0",
        page: "!w-full !max-w-none !p-4 sm:!p-6",
    },
};
export function ProfileSecurity() {
    const t = useTranslation();
    const pathname = usePathname();
    const search = useSearchParams();
    const { isLoaded, isSignedIn } = useUser();
    const security = pathname.startsWith("/account/profile/security");
    const suffix = search.size ? `?${search}` : "";
    // Clerk clears the user before the sign-out redirect finishes.
    if (!isLoaded || !isSignedIn) return null;
    return <div data-account-profile className="mx-auto max-w-5xl space-y-5">
        <header className="ui-record-header"><div><h1>{t.owned("Profile & security")}</h1><p className="ui-record-description">{t.owned("Manage your personal details, sign-in methods and account security.")}</p></div></header>
        <nav aria-label={t.owned("Profile and security sections")} className="flex gap-2 border-b border-[color:var(--ui-panel-border)] pb-3">
            <Link className="ui-account-tab" aria-current={!security ? "page" : undefined} href={"/account/profile" + suffix}>{t("Profile")}</Link>
            <Link className="ui-account-tab" aria-current={security ? "page" : undefined} href={"/account/profile/security" + suffix}>{t.owned("Sign-in & security")}</Link>
        </nav>
        {!security && <PersonalSettings section="profile" />}
        <section className="ui-account-provider" aria-label={t.owned(security ? "Sign-in & security" : "Sign-in details")}>
            <h2 className="px-5 pt-5 text-lg font-semibold">{t.owned(security ? "Sign-in & security" : "Sign-in details")}</h2>
            <UserProfile routing="path" path="/account/profile" appearance={appearance} />
        </section>
    </div>;
}
