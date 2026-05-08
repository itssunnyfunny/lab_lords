"use client";

import { Button } from "@/components/ui/Button";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { ComponentProps } from "react";
import { createPortal } from "react-dom";

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
    variant?: "danger" | "warning" | "info" | "default";
}

export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    loading = false,
    variant = "default",
}: ConfirmDialogProps) {
    if (!isOpen || typeof document === "undefined") return null;

    const getIcon = () => {
        switch (variant) {
            case "danger":
                return <AlertCircle className="w-6 h-6 text-rose-400" />;
            case "warning":
                return <AlertTriangle className="w-6 h-6 text-amber-400" />;
            case "info":
                return <Info className="w-6 h-6 text-blue-400" />;
            default:
                return <Info className="w-6 h-6 text-cyan-400" />;
        }
    };

    const getIconBg = () => {
        switch (variant) {
            case "danger":
                return "bg-rose-500/10";
            case "warning":
                return "bg-amber-500/10";
            case "info":
                return "bg-blue-500/10";
            default:
                return "bg-cyan-500/10";
        }
    };

    const getButtonVariant = (): ComponentProps<typeof Button>["variant"] => {
        switch (variant) {
            case "danger":
                return "danger";
            case "warning":
            case "info":
            case "default":
                return "cyan";
        }
    };

    const dialogContent = (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center sm:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={!loading ? onClose : undefined}
            />

            {/* Dialog */}
            <div className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto bg-[#0f111a] border border-white/10 rounded-2xl shadow-2xl p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex gap-4 items-start">
                    <div className={`p-2 rounded-full shrink-0 ${getIconBg()}`}>
                        {getIcon()}
                    </div>
                    <div className="space-y-1.5 mt-0.5">
                        <h2 className="text-lg font-bold text-white leading-tight">{title}</h2>
                        <div className="text-sm text-gray-400">{description}</div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col-reverse gap-3 mt-8 sm:flex-row sm:justify-end">
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        {cancelText}
                    </Button>
                    <Button
                        variant={getButtonVariant()}
                        onClick={onConfirm}
                        isLoading={loading}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );

    return createPortal(dialogContent, document.body);
}
