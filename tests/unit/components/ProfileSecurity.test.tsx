import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileSecurity } from "@/components/account/ProfileSecurity";

const auth = vi.hoisted(() => ({ isLoaded: true, isSignedIn: true }));
vi.mock("@clerk/nextjs", () => ({
    useUser: () => auth,
    UserProfile: () => {
        if (!auth.isLoaded || !auth.isSignedIn) throw new Error("Profile requires a signed-in user");
        return <div>Provider profile controls</div>;
    },
}));
vi.mock("next/navigation", () => ({
    usePathname: () => "/account/profile",
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/account/PersonalSettings", () => ({
    PersonalSettings: () => <div>Personal profile settings</div>,
}));
vi.mock("@/components/settings/LocalizedText", () => ({
    useTranslation: () => Object.assign((value: string) => value, { owned: (value: string) => value }),
}));

beforeEach(() => { auth.isLoaded = true; auth.isSignedIn = true; });

describe("Account profile authentication transitions", () => {
    it("renders the personal and provider controls for a signed-in user", () => {
        const html = renderToStaticMarkup(<ProfileSecurity />);
        expect(html).toContain("Personal profile settings");
        expect(html).toContain("Provider profile controls");
    });

    it("does not mount profile controls while authentication loads", () => {
        auth.isLoaded = false;
        expect(renderToStaticMarkup(<ProfileSecurity />)).toBe("");
    });

    it("removes profile controls when sign-out clears the user before redirecting", () => {
        expect(renderToStaticMarkup(<ProfileSecurity />)).toContain("Provider profile controls");
        auth.isSignedIn = false;
        expect(renderToStaticMarkup(<ProfileSecurity />)).toBe("");
    });
});
