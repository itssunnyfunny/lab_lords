import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface PageShellProps {
    children: ReactNode;
    className?: string;
    maxWidth?: "content" | "wide";
}

export function PageShell({ children, className, maxWidth = "wide" }: PageShellProps) {
    return (
        <div
            className={cn(
                "mx-auto w-full space-y-5 text-white",
                maxWidth === "wide" ? "max-w-[1600px]" : "max-w-7xl",
                className
            )}
        >
            {children}
        </div>
    );
}
