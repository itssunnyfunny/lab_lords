import { getSessionUser } from "@/lib/auth";
import { StaffInviteService } from "@/services/staffInvite.service";
import { InvitePreviewSurface, InviteStateSurface } from "./InvitePreviewSurface";

export const dynamic = "force-dynamic";

export default async function StaffInvitePage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;

    let invite;
    try {
        invite = await StaffInviteService.getInvitePreview(token);
    } catch {
        return (
            <InviteStateSurface
                title="Invite not found"
                message="This invite link is invalid, has been removed, or uses an older format. Ask the branch owner to send a fresh link."
                variant="danger"
            />
        );
    }

    if (invite.acceptedAt) {
        return (
            <InviteStateSurface
                title="Invite already used"
                message="This invite link has already been accepted. Ask the branch owner for a new link if another staff member needs access."
                variant="danger"
            />
        );
    }

    if (invite.isExpired) {
        return (
            <InviteStateSurface
                title="Invite expired"
                message="This invite link has expired. Ask the branch owner to generate a new one from Staff Management."
                variant="danger"
            />
        );
    }

    const user = await getSessionUser();

    return (
        <InvitePreviewSurface
            token={token}
            branchName={invite.branch.name}
            organizationName={invite.branch.organization.name}
            role={invite.role}
            expiresAt={invite.expiresAt}
            signedInEmail={user ? user.email ?? "Current account" : null}
        />
    );
}
