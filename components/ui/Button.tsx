import { cn } from "@/lib/utils";
import { Loader2, LucideIcon } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "glow" | "cyan";
    size?: "sm" | "md" | "lg" | "icon";
    isLoading?: boolean;
    icon?: LucideIcon;
}

const variantClasses = {
    primary:
        "border border-[color:var(--ui-button-legacy-primary-border)] bg-[image:var(--ui-button-legacy-primary-bg)] text-[color:var(--ui-button-legacy-primary-text)] shadow-[var(--ui-button-legacy-primary-shadow)] hover:border-[color:var(--ui-button-legacy-primary-hover-border)] hover:shadow-[var(--ui-button-legacy-primary-hover-shadow)]",
    secondary:
        "border border-[color:var(--ui-button-legacy-secondary-border)] bg-[color:var(--ui-button-legacy-secondary-bg)] text-[color:var(--ui-button-legacy-secondary-text)] backdrop-blur-sm hover:border-[color:var(--ui-button-legacy-secondary-hover-border)] hover:bg-[color:var(--ui-button-legacy-secondary-hover-bg)]",
    outline:
        "border border-[color:var(--ui-button-legacy-outline-border)] bg-[color:var(--ui-button-legacy-outline-bg)] text-[color:var(--ui-button-legacy-outline-text)] hover:border-[color:var(--ui-button-legacy-outline-hover-border)] hover:text-[color:var(--ui-button-legacy-outline-hover-text)]",
    ghost:
        "bg-[color:var(--ui-button-legacy-ghost-bg)] text-[color:var(--ui-button-legacy-ghost-text)] hover:bg-[color:var(--ui-button-legacy-ghost-hover-bg)] hover:text-[color:var(--ui-button-legacy-ghost-hover-text)]",
    danger:
        "border border-[color:var(--ui-button-legacy-danger-border)] bg-[color:var(--ui-button-legacy-danger-bg)] text-[color:var(--ui-button-legacy-danger-text)] hover:bg-[color:var(--ui-button-legacy-danger-hover-bg)]",
    glow:
        "border border-[color:var(--ui-button-legacy-glow-border)] bg-[color:var(--ui-button-legacy-glow-bg)] text-[color:var(--ui-button-legacy-glow-text)] shadow-[var(--ui-button-legacy-glow-shadow)] hover:bg-[color:var(--ui-button-legacy-glow-hover-bg)] hover:shadow-[var(--ui-button-legacy-glow-hover-shadow)]",
    cyan:
        "border border-[color:var(--ui-button-legacy-cyan-border)] bg-[color:var(--ui-button-legacy-cyan-bg)] text-[color:var(--ui-button-legacy-cyan-text)] shadow-[var(--ui-button-legacy-cyan-shadow)] hover:bg-[color:var(--ui-button-legacy-cyan-hover-bg)] hover:shadow-[var(--ui-button-legacy-cyan-hover-shadow)]",
};

const sizeClasses = {
    sm: "h-8 px-3 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-base",
    icon: "h-10 w-10 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", isLoading, icon: Icon, children, ...props }, ref) => {

        return (
            <button
                ref={ref}
                disabled={isLoading || props.disabled}
                className={cn(
                    "group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[var(--ui-button-legacy-radius)] text-sm font-medium outline-none transition-all duration-300 active:scale-95 focus-visible:ring-2 focus-visible:ring-[color:var(--ui-focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-app)] disabled:cursor-not-allowed disabled:opacity-[var(--ui-control-disabled-opacity)]",
                    variantClasses[variant],
                    sizeClasses[size],
                    className
                )}
                {...props}
            >
                {/* Shine effect on hover */}
                <div className="pointer-events-none absolute inset-0 h-full w-full -translate-x-full bg-[image:linear-gradient(to_right,transparent,var(--ui-button-shine),transparent)] group-hover:animate-shimmer" />

                {isLoading && <Loader2 className="relative z-10 h-4 w-4 animate-spin" />}
                {!isLoading && Icon && <Icon size={16} className="relative z-10" />}
                {children && <span className="relative z-10 inline-flex items-center gap-2">{children}</span>}
            </button>
        );
    }
);

Button.displayName = "Button";
