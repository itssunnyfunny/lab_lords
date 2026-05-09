"use client";

import { cn } from "@/lib/utils";
import { MoreVertical } from "lucide-react";
import { type CSSProperties, type ElementType, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface RowActionsMenuItem {
    label: string;
    icon: ElementType;
    onClick: () => void;
    variant?: "default" | "danger" | "warning";
    disabled?: boolean;
}

interface RowActionsMenuProps {
    actions: RowActionsMenuItem[];
    align?: "start" | "end";
    buttonClassName?: string;
    buttonIcon?: ElementType;
    buttonLabel?: string;
    menuClassName?: string;
    menuWidthClassName?: string;
}

export function RowActionsMenu({
    actions,
    align = "end",
    buttonClassName,
    buttonIcon: ButtonIcon = MoreVertical,
    buttonLabel = "Actions",
    menuClassName,
    menuWidthClassName = "w-44",
}: RowActionsMenuProps) {
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<CSSProperties>({
        position: "fixed",
        left: 0,
        top: 0,
        visibility: "hidden",
    });

    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const updatePosition = useCallback(() => {
        const trigger = triggerRef.current?.getBoundingClientRect();
        const menu = menuRef.current;

        if (!trigger || !menu) return;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const gap = 8;
        const margin = 8;
        const menuRect = menu.getBoundingClientRect();
        const menuWidth = menuRect.width;
        const menuHeight = menuRect.height;

        let left = align === "end" ? trigger.right - menuWidth : trigger.left;
        left = Math.min(Math.max(margin, left), Math.max(margin, viewportWidth - menuWidth - margin));

        const spaceBelow = viewportHeight - trigger.bottom - gap;
        const spaceAbove = trigger.top - gap;
        const shouldOpenAbove = menuHeight > spaceBelow && spaceAbove > spaceBelow;

        let top = shouldOpenAbove ? trigger.top - menuHeight - gap : trigger.bottom + gap;
        top = Math.min(Math.max(margin, top), Math.max(margin, viewportHeight - menuHeight - margin));

        setMenuStyle({
            position: "fixed",
            left,
            top,
            visibility: "visible",
        });
    }, [align]);

    useLayoutEffect(() => {
        if (!open) return;

        updatePosition();
        const frame = window.requestAnimationFrame(updatePosition);

        return () => window.cancelAnimationFrame(frame);
    }, [open, updatePosition]);

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as Node;

            if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
                return;
            }

            setOpen(false);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [open, updatePosition]);

    if (actions.length === 0) return null;

    const menu = open && typeof document !== "undefined"
        ? createPortal(
            <div
                ref={menuRef}
                style={menuStyle}
                className={cn(
                    "z-[120] max-h-[min(20rem,calc(100dvh-1rem))] overflow-y-auto rounded-xl border border-white/10 bg-[#0f111a] py-1 shadow-2xl shadow-black/40 animate-in fade-in zoom-in-95 duration-100",
                    menuWidthClassName,
                    menuClassName
                )}
                role="menu"
                aria-label={buttonLabel}
            >
                {actions.map((action, index) => {
                    const Icon = action.icon;

                    return (
                        <button
                            key={`${action.label}-${index}`}
                            type="button"
                            disabled={action.disabled}
                            role="menuitem"
                            onClick={() => {
                                if (action.disabled) return;
                                setOpen(false);
                                action.onClick();
                            }}
                            className={cn(
                                "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                                action.variant === "danger"
                                    ? "text-red-400 hover:bg-red-500/10"
                                    : action.variant === "warning"
                                        ? "text-amber-400 hover:bg-amber-500/10"
                                        : "text-gray-300 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            <Icon size={14} className="shrink-0" />
                            <span className="min-w-0 truncate">{action.label}</span>
                        </button>
                    );
                })}
            </div>,
            document.body
        )
        : null;

    return (
        <div ref={triggerRef} className="flex justify-end">
            <button
                type="button"
                onClick={() => setOpen(value => !value)}
                className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-all hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
                    open && "bg-white/10 text-white",
                    buttonClassName
                )}
                title={buttonLabel}
                aria-label={buttonLabel}
                aria-expanded={open}
                aria-haspopup="menu"
            >
                <ButtonIcon size={16} />
            </button>
            {menu}
        </div>
    );
}
