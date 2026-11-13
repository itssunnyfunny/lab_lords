import { withPreviewPlan } from "../application-design-pilot/preview-location";
import { useMemo, useSyncExternalStore } from "react";

const NAVIGATION_EVENT = "pilot:navigation";

// Match Next's committed router context. Reading location in getSnapshot
// would expose a cancelled popstate destination during any unrelated React render.
let committedLocation: string | undefined;
function subscribe(listener: () => void) {
    const update = () => {
        committedLocation = `${window.location.pathname}${window.location.search}`;
        listener();
    };
    window.addEventListener(NAVIGATION_EVENT, update);
    window.addEventListener("popstate", update);
    return () => {
        window.removeEventListener(NAVIGATION_EVENT, update);
        window.removeEventListener("popstate", update);
    };
}
function snapshot() {
    return committedLocation ??= `${window.location.pathname}${window.location.search}`;
}

function serverSnapshot() {
    return "/branch/pilot";
}

export function navigate(href: string, replace = false) {
    const previewIndex = (window.history.state?.previewIndex ?? 0) + (replace ? 0 : 1);
    window.history[replace ? "replaceState" : "pushState"]({ previewIndex }, "", withPreviewPlan(href));
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
    if (!replace) window.scrollTo(0, 0);
}

export function usePathname() {
    const location = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
    return location.split("?", 1)[0] || "/";
}

export function useSearchParams() {
    const location = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
    const search = location.includes("?") ? location.slice(location.indexOf("?") + 1) : "";
    return useMemo(() => new URLSearchParams(search), [search]);
}

export function useParams() {
    const pathname = usePathname();
    const branchMatch = pathname.match(/^\/branch\/([^/]+)/);
    const organizationMatch = pathname.match(/^\/org\/([^/]+)/);
    return {
        ...(branchMatch ? { branchId: decodeURIComponent(branchMatch[1]) } : {}),
        ...(organizationMatch ? { orgId: decodeURIComponent(organizationMatch[1]) } : {}),
    };
}

export function useRouter() {
    return useMemo(() => ({
        push: (href: string) => navigate(href),
        replace: (href: string) => navigate(href, true),
        back: () => window.history.back(),
        forward: () => window.history.forward(),
        refresh: () => window.dispatchEvent(new Event(NAVIGATION_EVENT)),
        prefetch: async () => undefined,
    }), []);
}

export function redirect(href: string): never {
    navigate(href, true);
    throw new Error(`Pilot navigation redirected to ${href}`);
}

export function notFound(): never {
    throw new Error("Pilot route not found");
}
