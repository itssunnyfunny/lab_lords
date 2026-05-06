import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, CheckCircle2, Clock, ShieldAlert, UserPlus } from "lucide-react";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { Badge } from "@/components/ui/Badge";
import { getSessionUser } from "@/lib/auth";
import { StaffInviteService } from "@/services/staffInvite.service";

export const dynamic = "force-dynamic";

type InvitePageProps = {
    params: Promise<{ token: string }>;
};

function AuthLinks({ invitePath }: { invitePath: string }) {
    const encodedRedirect = encodeURIComponent(invitePath);
    const primaryLinkClass = "inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-medium text-white shadow-lg shadow-violet-900/20 transition-all hover:border-white/20";
    const secondaryLinkClass = "inline-flex h-10 w-full items-center justify-center rounded-xl border border-white/10 bg-transparent px-5 text-sm font-medium text-gray-400 transition-all hover:border-white/30 hover:text-white";

    return (
        <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={`/sign-in?redirect_url=${encodedRedirect}`} className={primaryLinkClass}>
                <UserPlus size={16} />
                Sign in to join
            </Link>
            <Link href={`/sign-up?redirect_url=${encodedRedirect}`} className={secondaryLinkClass}>
                Create account
            </Link>
        </div>
    );
}

function InviteState({
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
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050508] p-6 text-white">
            <AmbientBackground />
            <section className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f111a]/85 p-8 shadow-2xl backdrop-blur-3xl">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                    <Icon size={24} className={variant === "danger" ? "text-rose-300" : "text-cyan-300"} />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                <p className="mt-3 text-sm leading-6 text-gray-400">{message}</p>
                <Link
                    href="/org"
                    className="mt-6 inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-transparent px-5 text-sm font-medium text-gray-400 transition-all hover:border-white/30 hover:text-white"
                >
                    Go to workspaces
                </Link>
            </section>
        </main>
    );
}

export default async function StaffInvitePage({ params }: InvitePageProps) {
    const { token } = await params;
    const invitePath = `/invite/${token}`;

    let invite;
    try {
        invite = await StaffInviteService.getInvitePreview(token);
    } catch {
        return (
            <InviteState
                title="Invite not found"
                message="This invite link is invalid or has been removed. Ask the branch owner to send a fresh link."
                variant="danger"
            />
        );
    }

    if (invite.acceptedAt) {
        return (
            <InviteState
                title="Invite already used"
                message="This invite link has already been accepted. Ask the branch owner for a new link if another staff member needs access."
                variant="danger"
            />
        );
    }

    if (invite.isExpired) {
        return (
            <InviteState
                title="Invite expired"
                message="This invite link has expired. Ask the branch owner to generate a new one from Staff Management."
                variant="danger"
            />
        );
    }

    const user = await getSessionUser();
    if (user) {
        let accepted;
        try {
            accepted = await StaffInviteService.acceptInvite(user.id, token);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Could not accept invite";
            return (
                <InviteState
                    title="Could not accept invite"
                    message={message}
                    variant="danger"
                />
            );
        }

        redirect(`/branch/${accepted.branchId}`);
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050508] p-6 text-white">
            <AmbientBackground />
            <section className="relative z-10 w-full max-w-xl rounded-2xl border border-white/10 bg-[#0f111a]/85 p-8 shadow-2xl backdrop-blur-3xl">
                <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-violet-500/20">
                    <Building2 size={28} className="text-white" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold tracking-tight">Join {invite.branch.name}</h1>
                    <Badge variant={invite.role === "MANAGER" ? "cyan" : "default"}>
                        {invite.role === "MANAGER" ? "Manager" : "Staff"}
                    </Badge>
                </div>
                <p className="mt-2 text-sm text-gray-500">{invite.branch.organization.name}</p>
                <p className="mt-5 text-sm leading-6 text-gray-400">
                    Sign in or create an account to accept this branch invite. Once you are authenticated, your access will be created automatically and you will land inside the branch workspace.
                </p>
                <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-400">
                    <span className="font-medium text-gray-300">Expires:</span>{" "}
                    {invite.expiresAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </div>
                <div className="mt-6">
                    <AuthLinks invitePath={invitePath} />
                </div>
            </section>
        </main>
    );
}
