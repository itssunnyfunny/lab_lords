import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface DashboardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "quiet";
    size?: "sm" | "md";
    icon?: LucideIcon;
    rightIcon?: LucideIcon;
}

const variantClasses = {
    primary:
        "border-cyan-200/60 bg-cyan-300 text-[#061014] shadow-[inset_0_-2px_0_rgba(0,0,0,0.18),0_10px_26px_rgba(34,211,238,0.14)] hover:border-cyan-100 hover:bg-cyan-200",
    secondary:
        "border-white/12 bg-[#121a24] text-gray-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-white/20 hover:bg-[#182332]",
    quiet:
        "border-white/10 bg-transparent text-gray-300 hover:border-white/20 hover:bg-white/[0.04] hover:text-white",
};

const sizeClasses = {
    sm: "h-8 px-2.5 text-xs",
    md: "h-10 px-3 text-sm",
};

export const DashboardButton = forwardRef<HTMLButtonElement, DashboardButtonProps>(
    (
        {
            children,
            className,
            variant = "secondary",
            size = "md",
            icon: Icon,
            rightIcon: RightIcon,
            type = "button",
            ...props
        },
        ref
    ) => {
        return (
            <button
                ref={ref}
                type={type}
                className={cn(
                    "group inline-flex items-center justify-center gap-2 rounded-[8px] border font-semibold tracking-[0.01em] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-50",
                    variantClasses[variant],
                    sizeClasses[size],
                    className
                )}
                {...props}
            >
                {Icon && <Icon size={size === "sm" ? 14 : 15} className="shrink-0" />}
                <span className="min-w-0 truncate">{children}</span>
                {RightIcon && (
                    <RightIcon
                        size={size === "sm" ? 14 : 15}
                        className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                )}
            </button>
        );
    }
);

DashboardButton.displayName = "DashboardButton";
