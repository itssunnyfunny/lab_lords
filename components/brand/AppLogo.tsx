import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

type LogoMarkProps = SVGProps<SVGSVGElement> & {
    title?: string;
};

export function LogoMark({ className, title = "Lab Lords", ...props }: LogoMarkProps) {
    return (
        <svg
            viewBox="0 0 64 64"
            role={title ? "img" : undefined}
            aria-hidden={title ? undefined : true}
            className={cn("shrink-0", className)}
            {...props}
        >
            {title && <title>{title}</title>}
            <rect x="5" y="5" width="54" height="54" rx="14" fill="#07131d" />
            <path
                d="M16.5 24L24.5 16.5L32 24L39.5 16.5L47.5 24"
                fill="none"
                stroke="#67e8f9"
                strokeWidth="4.25"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M20 27V43.5H31"
                fill="none"
                stroke="#67e8f9"
                strokeWidth="4.25"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M36 27V43.5H47"
                fill="none"
                stroke="#f8fafc"
                strokeWidth="4.25"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path d="M21 49H43" fill="none" stroke="#f59e0b" strokeWidth="4" strokeLinecap="round" />
            <rect x="5" y="5" width="54" height="54" rx="14" fill="none" stroke="#ffffff" opacity="0.14" />
        </svg>
    );
}

type AppLogoProps = {
    subtitle?: string;
    showSubtitle?: boolean;
    className?: string;
    markClassName?: string;
    titleClassName?: string;
    subtitleClassName?: string;
};

export function AppLogo({
    subtitle = "Branch OS",
    showSubtitle = true,
    className,
    markClassName,
    titleClassName,
    subtitleClassName,
}: AppLogoProps) {
    return (
        <div className={cn("flex min-w-0 items-center gap-3", className)}>
            <LogoMark className={cn("h-9 w-9", markClassName)} title="Lab Lords logo" />
            <div className="min-w-0">
                <span className={cn("block truncate text-base font-semibold tracking-tight text-[color:var(--text-primary)] sm:text-lg", titleClassName)}>
                    Lab Lords
                </span>
                {showSubtitle && (
                    <span className={cn("block truncate text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]", subtitleClassName)}>
                        {subtitle}
                    </span>
                )}
            </div>
        </div>
    );
}
