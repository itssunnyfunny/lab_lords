export function useRouter() {
    return { push: (href: string) => window.dispatchEvent(new CustomEvent("onboarding-fixture-navigation", { detail: href })),
        replace: (href: string) => window.dispatchEvent(new CustomEvent("onboarding-fixture-navigation", { detail: href })),
        refresh() {}, back: () => history.back(), prefetch: async () => undefined };
}
export function usePathname() { return window.location.pathname; }
export function useSearchParams() { return new URLSearchParams(window.location.search); }
export function useParams() { return {}; }
