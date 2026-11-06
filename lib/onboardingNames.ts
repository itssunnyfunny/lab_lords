/** Suggestions apply only to new browser drafts. Retained commands keep their
 * exact orgName/branchName payload and request hash. */
export function suggestedWorkspaceName(signupName?: string | null) {
    const name = signupName?.trim().replace(/\s+/g, " ").slice(0, 100);
    return name ? `${name}’s workspace` : "My workspace";
}
