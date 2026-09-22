import { useMemo, useSyncExternalStore } from "react";

const NAVIGATION_EVENT = "pilot:navigation";

function subscribe(listener: () => void) {
    window.addEventListener(NAVIGATION_EVENT, listener);
    window.addEventListener("popstate", listener);
    return () => {
        window.removeEventListener(NAVIGATION_EVENT, listener);
        window.removeEventListener("popstate", listener);
    };
}

function snapshot() {
    return `${window.location.pathname}${window.location.search}`;
}

function serverSnapshot() {
    return "/branch/pilot";
}

function navigate(href: string, replace = false) {
    window.history[replace ? "replaceState" : "pushState"]({}, "", href);
    window.dispatchEvent(new Event(NAVIGATION_EVENT));
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
