import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

type LogoMarkProps = SVGProps<SVGSVGElement> & {
    title?: string;
    variant?: "legacy" | "botanical";
};

export function LogoMark({ className, title = "Lab Lords", variant = "legacy", ...props }: LogoMarkProps) {
    if (variant === "botanical") {
        return (
            <svg
                viewBox="0 0 180 116"
                role={title ? "img" : undefined}
                aria-hidden={title ? undefined : true}
                className={cn("shrink-0", className)}
                {...props}
            >
                {title && <title>{title}</title>}
                <path d="M91 5c-3.9 5.1-11 9.1-11 16.6 0 6.4 4.6 10.4 10.5 10.4S102 27.6 102 21.5C102 14.8 95.8 8.2 91 5Z" fill="#F4A261" />
                <path d="M91 7c-2 5.3-8.5 9.5-8.5 15 0 4.2 2.8 6.8 6.3 7.5-1.8-6.1 7.2-10.3 2.2-22.5Z" fill="#FFF8EE" fillOpacity=".3" />
                <path d="M86.7 86.7C84.9 68.9 76.1 53.5 58 44.2 47.9 39 44.1 33.8 40.2 24.5c-6.8 17.4-2.4 34.2 12.2 43.9 9.9 6.6 22.8 9.1 34.3 18.3Z" fill="#22A06B" />
                <path d="M40.2 24.5c-4.2 17.7 2.2 31.1 13.8 39.7 10.1 7.5 23.2 10.7 32.7 22.5C79 70.8 69.2 63.8 57 54.7c-8.6-6.5-13.5-15.4-16.8-30.2Z" fill="#164D3B" fillOpacity=".42" />
                <path d="M92.8 88.7c2-21 10.1-38.4 28.7-46.8 9.2-4.1 14.1-7.7 18.8-17.4 6.2 19.1.4 35.9-14.7 45.7-12 7.8-24.9 8.5-32.8 18.5Z" fill="#A7C957" />
                <path d="M140.3 24.5c-2.6 16.9-12.9 27.8-24.8 37.1-10.3 8.1-16.9 15.8-22.7 27.1 4.3-7.4 16.2-17.1 27.7-25.1 13-9 20.8-21 19.8-39.1Z" fill="#22A06B" fillOpacity=".34" />
                <path d="M51.5 45.6C69.8 57.5 84.1 74.6 90 99" stroke="#164D3B" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M129.6 46.5C111.9 59.4 98.4 76.4 90 99" stroke="#164D3B" strokeOpacity=".68" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M90 104.7c-18.6-15.2-45.9-22.9-72.4-24.5l-8.4 7.1c30.6.6 58.4 5.5 80.8 17.4Z" fill="#22A06B" />
                <path d="M90 104.7c18.6-15.2 45.9-22.9 72.4-24.5l8.4 7.1c-30.6.6-58.4 5.5-80.8 17.4Z" fill="#22A06B" />
                <path d="M90 111C65.4 95.9 35.7 91.5 8.3 91.5L3 101.8c33.1-.7 60.4 1.2 87 12.2 26.6-11 53.9-12.9 87-12.2l-5.3-10.3c-27.4 0-57.1 4.4-81.7 19.5Z" fill="#164D3B" />
            </svg>
        );
    }

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
    markVariant?: LogoMarkProps["variant"];
    className?: string;
    markClassName?: string;
    titleClassName?: string;
    subtitleClassName?: string;
};

export function AppLogo({
    subtitle = "Branch OS",
    showSubtitle = true,
    markVariant = "legacy",
    className,
    markClassName,
    titleClassName,
    subtitleClassName,
}: AppLogoProps) {
    return (
        <div className={cn("flex min-w-0 items-center gap-3", className)}>
            <LogoMark
                className={cn(markVariant === "botanical" ? "h-9 w-[56px]" : "h-9 w-9", markClassName)}
                title="Lab Lords logo"
                variant={markVariant}
            />
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
