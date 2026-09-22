import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string | { pathname?: string; query?: Record<string, string> };
    children: ReactNode;
    replace?: boolean;
};

function resolveHref(href: LinkProps["href"]) {
    if (typeof href === "string") return href;
    const search = new URLSearchParams(href.query);
    return `${href.pathname ?? ""}${search.size > 0 ? `?${search.toString()}` : ""}`;
}

export default function Link({ href, replace, children, onClick, ...props }: LinkProps) {
    const resolvedHref = resolveHref(href);

    const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(event);
        if (
            event.defaultPrevented
            || event.button !== 0
            || event.metaKey
            || event.ctrlKey
            || event.shiftKey
            || event.altKey
            || props.target === "_blank"
            || !resolvedHref.startsWith("/")
        ) return;

        event.preventDefault();
        window.history[replace ? "replaceState" : "pushState"]({}, "", resolvedHref);
        window.dispatchEvent(new Event("pilot:navigation"));
    };

    return <a {...props} href={resolvedHref} onClick={navigate}>{children}</a>;
}
