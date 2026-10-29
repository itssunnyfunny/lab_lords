/** Keep the selected synthetic plan while reviewing real components across routes.
 * This module is confined to the Vite preview; production never reads this query.
 */
export function withPreviewPlan(href: string): string {
    if (!href.startsWith("/") || href.startsWith("//")) return href;
    const current = new URLSearchParams(window.location.search);
    if (current.get("journey") === "org" || (current.get("plan") === "BASIC" && current.get("legacy") !== "1")) {
        const destination = new URL(href, window.location.origin);
        destination.searchParams.set("journey", "org");
        destination.searchParams.delete("plan");
        for (const key of ["lang", "role", "identity", "case"]) if (!destination.searchParams.has(key) && current.has(key)) destination.searchParams.set(key, current.get(key)!);
        return destination.pathname + destination.search + destination.hash;
    }
    const plan = current.get("plan");
    if (!plan) return href;
    const destination = new URL(href, window.location.origin);
    if (!destination.searchParams.has("plan")) destination.searchParams.set("plan", plan);
    const legacy = new URLSearchParams(window.location.search).get("legacy");
    if (legacy && !destination.searchParams.has("legacy")) destination.searchParams.set("legacy", legacy);
    return `${destination.pathname}${destination.search}${destination.hash}`;
}
