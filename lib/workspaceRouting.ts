export const LAST_ACTIVE_BRANCH_COOKIE = "lab_lords_last_branch";
export const LAST_ACTIVE_BRANCH_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

type DateLike = Date | string | null | undefined;

export type WorkspaceRoutingBranch = {
    id: string;
    createdAt?: DateLike;
};

export type WorkspaceRoutingOrganization = {
    id: string;
    createdAt?: DateLike;
    branches: WorkspaceRoutingBranch[];
};

export type WorkspaceRoutingState = {
    ownedOrganizations: WorkspaceRoutingOrganization[];
    staffBranches: WorkspaceRoutingBranch[];
    lastBranchId?: string | null;
};

function normalizeLastBranchHint(value: string | null | undefined) {
    const trimmed = value?.trim();
    if (!trimmed || !/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
    return trimmed;
}

function timeValue(value: DateLike) {
    if (!value) return 0;
    return new Date(value).getTime() || 0;
}

function collectStaffBranches(state: WorkspaceRoutingState) {
    const branchesById = new Map<string, WorkspaceRoutingBranch>();

    for (const branch of state.staffBranches) {
        const existing = branchesById.get(branch.id);
        if (!existing || timeValue(branch.createdAt) > timeValue(existing.createdAt)) {
            branchesById.set(branch.id, branch);
        }
    }

    return [...branchesById.values()].sort(
        (left, right) => timeValue(right.createdAt) - timeValue(left.createdAt)
    );
}

export function resolveWorkspacePath(state: WorkspaceRoutingState) {
    if (state.ownedOrganizations.length > 1) {
        return "/org";
    }

    if (state.ownedOrganizations.length === 1) {
        const organization = state.ownedOrganizations[0];

        if (organization.branches.length === 1) {
            return `/branch/${organization.branches[0].id}`;
        }

        return `/org/${organization.id}`;
    }

    const staffBranches = collectStaffBranches(state);
    if (staffBranches.length === 0) {
        return "/onboarding";
    }

    const staffBranchIds = new Set(staffBranches.map(branch => branch.id));
    const lastBranchId = normalizeLastBranchHint(state.lastBranchId);
    if (lastBranchId && staffBranchIds.has(lastBranchId)) {
        return `/branch/${lastBranchId}`;
    }

    return `/branch/${staffBranches[0].id}`;
}
