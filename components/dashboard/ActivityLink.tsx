import Link from "next/link";
import type { ReactNode } from "react";

/** Attendance owns a document-scoped camera policy; never enter it via client routing. */
export function ActivityLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
    return /^\/branch\/[^/]+\/attendance(?:[/?#]|$)/.test(href)
        ? <a href={href} className={className}>{children}</a>
        : <Link href={href} className={className}>{children}</Link>;
}
