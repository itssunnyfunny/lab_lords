import { cn } from "@/lib/utils";
import { Loader2, LucideIcon } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "quiet" | "danger";
    size?: "sm" | "md" | "icon";
    icon?: LucideIcon;
    rightIcon?: LucideIcon;
    isLoading?: boolean;
}

const variantClasses = {
    primary:
        "border-cyan-200/60 bg-cyan-300 text-[#061014] shadow-[inset_0_-2px_0_rgba(0,0,0,0.18),0_10px_26px_rgba(34,211,238,0.14)] hover:border-cyan-100 hover:bg-cyan-200",
    secondary:
        "border-white/12 bg-[#121a24] text-gray-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-white/20 hover:bg-[#182332]",
    quiet:
        "border-white/10 bg-transparent text-gray-300 hover:border-white/20 hover:bg-white/[0.04] hover:text-white",
    danger:
        "border-rose-400/25 bg-rose-400/10 text-rose-100 hover:border-rose-300/35 hover:bg-rose-400/15",
};

const sizeClasses = {
    sm: "h-8 px-2.5 text-xs",
    md: "h-10 px-3 text-sm",
    icon: "h-10 w-10 p-0",
};

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(
    (
        {
            children,
            className,
            variant = "secondary",
            size = "md",
            icon: Icon,
            rightIcon: RightIcon,
            isLoading,
            type = "button",
            disabled,
            ...props
        },
        ref
    ) => {
        const iconSize = size === "sm" ? 14 : 15;

        return (
            <button
                ref={ref}
                type={type}
                disabled={disabled || isLoading}
                className={cn(
                    "group inline-flex items-center justify-center gap-2 rounded-[8px] border font-semibold tracking-[0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-50",
                    variantClasses[variant],
                    sizeClasses[size],
                    className
                )}
                {...props}
            >
                {isLoading ? (
                    <Loader2 size={iconSize} className="shrink-0 animate-spin" />
                ) : (
                    Icon && <Icon size={iconSize} className="shrink-0" />
                )}
                {children && <span className="min-w-0 truncate">{children}</span>}
                {RightIcon && !isLoading && (
                    <RightIcon
                        size={iconSize}
                        className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                )}
            </button>
        );
    }
);

AppButton.displayName = "AppButton";
