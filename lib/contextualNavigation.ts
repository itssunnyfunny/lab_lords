export type ContextualParent = {
    href: string;
    label: string;
};

// Return hints only select an internal workspace page. Destinations still enforce
// their normal server-side membership and permission checks.
export function workspaceReturnPath(value: string | null): string | null {
    return value && /^\/(?:branch|org)\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_/-]+)?\/?$/.test(value)
        ? value : null;
}

export function resolveContextualParent(pathname: string | null): ContextualParent | null {
    if (!pathname) return null;

    const branchMatch = pathname.match(/^\/branch\/([^/]+)(?:\/(.+))?\/?$/);
    if (branchMatch) {
        const branchId = branchMatch[1];
        const childPath = branchMatch[2]?.replace(/\/$/, "");
        if (!childPath) return null;

        if (/^onboarding\/import\/[^/]+/.test(childPath)) {
            return {
                href: `/branch/${branchId}/onboarding/import`,
                label: "Back to import history",
            };
        }

        return {
            href: `/branch/${branchId}`,
            label: "Back to branch dashboard",
        };
    }

    const organizationMatch = pathname.match(/^\/org\/([^/]+)(?:\/(.+))?\/?$/);
    if (organizationMatch) {
        const organizationId = organizationMatch[1];
        const childPath = organizationMatch[2]?.replace(/\/$/, "");
        if (!childPath) return null;

        if (/^billing\/processing\/[^/]+/.test(childPath)) {
            return {
                href: `/org/${organizationId}/settings#billing`,
                label: "Back to billing settings",
            };
        }

        return {
            href: `/org/${organizationId}`,
            label: "Back to organization dashboard",
        };
    }

    return null;
}
