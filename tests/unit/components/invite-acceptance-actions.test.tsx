import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { InviteAcceptanceActions } from "@/app/invite/[token]/InviteAcceptanceActions";

vi.mock("@clerk/nextjs", () => ({ useClerk: () => ({ signOut: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

it("labels the workspace link as navigation while leaving the invitation open for acceptance", () => {
    const html = renderToStaticMarkup(<InviteAcceptanceActions token="invite" invitePath="/invite/invite" signedInEmail="reader@example.test" />);
    expect(html).toMatch(/<a\b[^>]*href="\/app"[^>]*>Return to workspaces<\/a>/);
    expect(html).toContain("Accept invite");
    expect(html).not.toContain("Decline invite");
});
