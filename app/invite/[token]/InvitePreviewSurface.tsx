import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Clock, ShieldAlert, UserPlus } from "lucide-react";
import { LocalizedText, OwnedLabel } from "@/components/settings/LocalizedText";
import { Badge } from "@/components/ui/Badge";
import { appActionClassName } from "@/components/ui/AppButton";
import {
    entryContentClass,
    entryIconFrameClass,
    entryInlineInfoClass,
    entryMutedTextClass,
    entryPanelClass,
    entryRootClass,
    entrySubtitleClass,
    entryTitleClass,
} from "@/components/ui/entrySurface";
import { cn } from "@/lib/utils";
import { InviteAcceptanceActions } from "./InviteAcceptanceActions";

export function InviteStateSurface({
    title,
    message,
    variant = "default",
}: {
    title: string;
    message: string;
    variant?: "default" | "success" | "danger";
}) {
    const Icon = variant === "success" ? CheckCircle2 : variant === "danger" ? ShieldAlert : Clock;

    return (
        <main data-app-design-pilot="workspace" className={entryRootClass}>
            <section className={cn(entryContentClass, entryPanelClass, "max-w-lg p-5 sm:p-8")}>
                <div className={cn(entryIconFrameClass, "mb-5 flex h-12 w-12", variant === "danger" && "text-[color:var(--ui-badge-danger-text)]")}>
                    <Icon size={24} />
                </div>
                <h1 className={entryTitleClass}><OwnedLabel text={title} /></h1>
                <p className={cn("mt-3", entrySubtitleClass)}><OwnedLabel text={message} /></p>
                <Link href="/app" className={cn(appActionClassName("secondary"), "mt-6 min-h-11")}>
                    <LocalizedText text="Return to workspaces" />
                </Link>
            </section>
        </main>
    );
}

export function InvitePreviewSurface({
    token,
    branchName,
    organizationName,
    role,
    expiresAt,
    signedInEmail,
}: {
    token: string;
    branchName: string;
    organizationName: string;
    role: string;
    expiresAt: Date;
    signedInEmail: string | null;
}) {
    const invitePath = `/invite/${token}`;
    const encodedRedirect = encodeURIComponent(invitePath);

    return (
        <main data-app-design-pilot="workspace" className={entryRootClass}>
            <section className={cn(entryContentClass, entryPanelClass, "max-w-xl p-5 sm:p-8")}>
                <div className={cn(entryIconFrameClass, "mb-6 h-14 w-14")}>
                    <Image src="/brand-reference/open-book-leaf.svg" width={44} height={44} alt="Lab Lords logo" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className={entryTitleClass}><LocalizedText text="Join {name}" params={{ name: branchName }} /></h1>
                    <Badge variant={role === "MANAGER" ? "cyan" : "default"}>
                        <LocalizedText text={role === "MANAGER" ? "Manager" : "Staff"} />
                    </Badge>
                </div>
                <p className={cn("mt-2 text-sm", entryMutedTextClass)}>{organizationName}</p>
                <p className={cn("mt-5", entrySubtitleClass)}>
                    <LocalizedText text={signedInEmail !== null
                        ? "Review the workspace and role below, then explicitly accept when you are ready. No access is created until you confirm."
                        : "Sign in or create an account to review and accept this branch invite. This link only works for the intended email address."} />
                </p>
                <div className={cn(entryInlineInfoClass, "mt-6 p-4 text-sm", entryMutedTextClass)}>
                    <dl className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <dt className="text-xs uppercase tracking-wide text-[color:var(--text-muted)]"><LocalizedText text="Role" /></dt>
                            <dd className="mt-1 font-medium text-[color:var(--text-primary)]">
                                <LocalizedText text={role === "MANAGER" ? "Manager" : "Staff"} />
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs uppercase tracking-wide text-[color:var(--text-muted)]"><LocalizedText text="Expires" /></dt>
                            <dd className="mt-1 font-medium text-[color:var(--text-primary)]">
                                {expiresAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </dd>
                        </div>
                    </dl>
                </div>
                {signedInEmail !== null ? (
                    <InviteAcceptanceActions token={token} invitePath={invitePath} signedInEmail={signedInEmail} />
                ) : (
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <Link href={`/sign-in?redirect_url=${encodedRedirect}`} className={cn(appActionClassName("primary"), "min-h-11 w-full")}>
                            <UserPlus size={16} />
                            <LocalizedText text="Sign in to join" />
                        </Link>
                        <Link href={`/sign-up?redirect_url=${encodedRedirect}`} className={cn(appActionClassName("secondary"), "min-h-11 w-full")}>
                            <LocalizedText text="Create account" />
                        </Link>
                    </div>
                )}
            </section>
        </main>
    );
}
