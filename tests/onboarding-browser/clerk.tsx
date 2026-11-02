import { useSyncExternalStore } from "react";
let account = "onboarding-owner-A";
const event = "onboarding-fixture-account";
export function switchFixtureAccount() {
    account = account === "onboarding-owner-A" ? "onboarding-owner-B" : "onboarding-owner-A";
    window.dispatchEvent(new Event(event));
}
export function useUser() {
    const id = useSyncExternalStore(listener => {
        window.addEventListener(event, listener);
        return () => window.removeEventListener(event, listener);
    }, () => account, () => "onboarding-owner-A");
    return { isLoaded: true, isSignedIn: true, user: { id, firstName: "Fixture owner", primaryPhoneNumber: null } };
}
export function UserButton() { return null; }
