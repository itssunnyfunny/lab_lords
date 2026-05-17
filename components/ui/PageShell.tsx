import { cn } from "@/lib/utils";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

interface PageShellProps extends ComponentPropsWithoutRef<"div"> {
    children: ReactNode;
    className?: string;
    maxWidth?: "content" | "wide";
}

export function PageShell({ children, className, maxWidth = "wide", ...props }: PageShellProps) {
    return (
        <div
            {...props}
            className={cn(
                "mx-auto w-full space-y-[var(--ui-page-gap)] text-[color:var(--text-primary)]",
                maxWidth === "wide" ? "max-w-[var(--ui-page-wide)]" : "max-w-[var(--ui-page-content)]",
                className
            )}
        >
            {children}
        </div>
    );
}
