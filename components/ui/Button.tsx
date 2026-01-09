import { cn } from "@/lib/utils";
import { Loader2, LucideIcon } from "lucide-react";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "glow" | "cyan";
    size?: "sm" | "md" | "lg" | "icon";
    isLoading?: boolean;
    icon?: LucideIcon;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", isLoading, icon: Icon, children, ...props }, ref) => {

        return (
            <button
                ref={ref}
                disabled={isLoading || props.disabled}
                className={cn(
                    "relative inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all duration-300 active:scale-95 overflow-hidden group outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",

                    // Variants
                    variant === "primary" && "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] border border-white/10 hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:border-white/20",
                    variant === "secondary" && "bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 hover:border-white/20 backdrop-blur-sm",
                    variant === "outline" && "bg-transparent border border-white/10 text-gray-400 hover:text-white hover:border-white/30",
                    variant === "ghost" && "bg-transparent hover:bg-white/5 text-gray-400 hover:text-white",
                    variant === "danger" && "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/20",
                    variant === "glow" && "bg-cyan-900/20 text-cyan-300 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:bg-cyan-900/30 hover:shadow-[0_0_25px_rgba(6,182,212,0.4)]",
                    variant === "cyan" && "bg-cyan-600 text-white border border-cyan-400/20 hover:bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]",

                    // Sizes
                    size === "sm" && "h-8 px-3 text-xs",
                    size === "md" && "px-5 py-2.5 text-sm",
                    size === "lg" && "px-6 py-3.5 text-base",
                    size === "icon" && "h-10 w-10 p-0",

                    className
                )}
                {...props}
            >
                {/* Shine effect on hover */}
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none" />

                {isLoading && <Loader2 className="h-4 w-4 animate-spin relative z-10" />}
                {!isLoading && Icon && <Icon size={16} className="relative z-10" />}
                <span className="relative z-10">{children}</span>
            </button>
        );
    }
);

Button.displayName = "Button";
