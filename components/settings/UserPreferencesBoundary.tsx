"use client";
import { useUser } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { publicRoute } from "@/lib/public-i18n/routes";
import { UserPreferencesProvider } from "./UserPreferencesApplier";

/** Remount only on identity changes, never on language, branch or route changes. */
export function UserPreferencesBoundary({ children }: { children: ReactNode }) {
    const { user } = useUser();
    const locale = publicRoute(usePathname())?.locale;
    return <UserPreferencesProvider key={user?.id ?? "signed-out"} ownerKey={user?.id ?? "signed-out"} signedIn={!!user} publicLocale={locale}>{children}</UserPreferencesProvider>;
}
