import type { ReactNode } from "react";

const syntheticUser = {
    id: "pilot-owner",
    fullName: "Ananya Sharma",
    firstName: "Ananya",
    primaryEmailAddress: { emailAddress: "owner@example.invalid" },
};

export function ClerkProvider({ children }: { children: ReactNode }) {
    return <>{children}</>;
}

export function SignedIn({ children }: { children: ReactNode }) {
    return <>{children}</>;
}

export function SignedOut() {
    return null;
}

export function UserButton() {
    return (
        <button
            type="button"
            aria-label="Synthetic account menu"
            title="Synthetic owner account"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-surface-bg)] text-xs font-bold text-[color:var(--text-primary)]"
        >
            AS
        </button>
    );
}

export function useUser() {
    return { isLoaded: true, isSignedIn: true, user: syntheticUser };
}

export function useAuth() {
    return {
        isLoaded: true,
        isSignedIn: true,
        userId: syntheticUser.id,
        getToken: async () => null,
    };
}

export function useClerk() {
    return { openUserProfile: () => undefined, signOut: async () => undefined };
}
