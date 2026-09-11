"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const isAttendance = (pathname: string) => /^\/branch\/[^/]+\/attendance\/?$/.test(pathname);

/** Permissions-Policy belongs to the document, not a client-side route.
 * Keep this in the root layout so entering AND leaving Attendance reloads it,
 * including router navigation and browser history. Never mount the destination
 * controls under the previous document's camera policy. */
export function AttendanceCameraBoundary({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const attendance = isAttendance(pathname);
    const [documentAttendance] = useState(attendance);
    const changed = attendance !== documentAttendance;

    useEffect(() => {
        if (changed) window.location.replace(window.location.href);
    }, [changed]);

    useEffect(() => {
        const navigate = (event: MouseEvent) => {
            if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
            if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
            const destination = new URL(link.href);
            if (destination.origin !== window.location.origin || isAttendance(destination.pathname) === isAttendance(window.location.pathname)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            window.location.assign(destination.href);
        };
        document.addEventListener("click", navigate, true);
        return () => document.removeEventListener("click", navigate, true);
    }, []);

    return changed ? null : children;
}
