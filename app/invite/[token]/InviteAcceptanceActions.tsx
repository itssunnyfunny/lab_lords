"use client";
import { LocalizedError } from "@/components/settings/LocalizedText";
import { useTranslation } from "@/components/settings/LocalizedText";

import { useClerk } from "@clerk/nextjs";
import { ArrowRight, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppButton } from "@/components/ui";
import { appActionClassName } from "@/components/ui/AppButton";
import { formErrorBannerClass } from "@/components/ui/formSurface";
import {
    entryInlineInfoClass,
    entryMutedTextClass,
} from "@/components/ui/entrySurface";
import { cn } from "@/lib/utils";

type InviteAcceptanceActionsProps = {
    token: string;
    invitePath: string;
    signedInEmail: string;
};

export function InviteAcceptanceActions({
    token,
    invitePath,
    signedInEmail,
}: InviteAcceptanceActionsProps) {
    const t = useTranslation();
    const router = useRouter();
    const { signOut } = useClerk();
    const [accepting, setAccepting] = useState(false);
    const [switching, setSwitching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const acceptInvite = async () => {
        setAccepting(true);
        setError(null);

        try {
            const response = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
                method: "POST",
                headers: { accept: "application/json" },
            });
            const body = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(typeof body.error === "string" ? body.error : "Could not accept invite.");
            }

            router.replace("/app");
        } catch (acceptError) {
            setError(acceptError instanceof Error ? acceptError.message : "Could not accept invite.");
            setAccepting(false);
        }
    };

    const switchAccount = async () => {
        setSwitching(true);
        setError(null);
        const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(invitePath)}`;

        try {
            await signOut({ redirectUrl: signInUrl });
        } catch {
            setError("Could not switch accounts. Return to your workspaces and sign out, then open this invite again.");
            setSwitching(false);
        }
    };

    return (
        <div className="mt-6 space-y-4">
            <div className={cn(entryInlineInfoClass, "p-4 text-sm", entryMutedTextClass)}>
                <p className="font-medium text-[color:var(--text-primary)]">{t("Signed in as")}</p>
                <p className="mt-1 break-all">{signedInEmail}</p>
                <p className="mt-3 text-xs leading-5">
                    {t("This invite is restricted to its intended account. Confirm only if you recognize this workspace and role.")}</p>
            </div>

            {error && (
                <div
                    role="alert"
                    className={cn(formErrorBannerClass, "px-4 py-3 text-sm")}
                >
                    <LocalizedError error={error} />
                </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
                <AppButton
                    density="compact"
                    variant="primary"
                    onClick={acceptInvite}
                    disabled={accepting || switching}
                    className="w-full"
                >
                    <ArrowRight size={16} />
                    {accepting ? t("Accepting invite...") : t("Accept invite")}
                </AppButton>
                <AppButton
                    density="compact"
                    variant="secondary"
                    onClick={switchAccount}
                    disabled={accepting || switching}
                    className="w-full"
                >
                    <LogOut size={16} />
                    {switching ? t("Switching...") : t("Switch account")}
                </AppButton>
            </div>

            <Link href="/app" className={cn(appActionClassName("quiet"), "min-h-11 w-full")}>
                {t("Decline invite and return to workspaces")}</Link>
        </div>
    );
}
