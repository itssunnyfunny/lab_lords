interface BadgeProps {
    variant: "success" | "warning" | "danger"
    children: React.ReactNode
}

export function Badge({ variant, children }: BadgeProps) {
    const map: Record<BadgeProps["variant"], string> = {
        success: "bg-success/20 text-success",
        warning: "bg-warning/20 text-warning",
        danger: "bg-danger/20 text-danger",
    }
    return (
        <span className={`px-2 py-1 rounded-sm text-xs ${map[variant]}`}>
            {children}
        </span>
    )
}
