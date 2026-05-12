"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
    formControlClass,
    formDialogFooterClass,
    formDialogHeaderClass,
    formDialogPanelClass,
    formErrorBannerClass,
    formHelpTextClass,
    formLabelClass,
    formRequiredClass,
} from "@/components/ui/formSurface";
import { FieldError, fieldErrorClass, fieldErrorProps, useInlineFieldErrors } from "@/components/ui/InlineFieldError";
import { branches } from "@/lib/api/branches";
import { FORM_LIMITS, validateSeatLabel } from "@/lib/formValidation";
import { cn } from "@/lib/utils";

interface AddSeatDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    branchId: string;
}

function getErrorMessage(err: unknown) {
    const response = (err as { response?: { data?: { error?: unknown; message?: unknown } } }).response;
    if (typeof response?.data?.error === "string") return response.data.error;
    if (typeof response?.data?.message === "string") return response.data.message;
    if (err instanceof Error) return err.message;
    return "Failed to create seat.";
}

export function AddSeatDialog({ isOpen, onClose, onSuccess, branchId }: AddSeatDialogProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [label, setLabel] = useState("");
    const { markTouched, markSubmitted, resetFieldErrors, visibleError } = useInlineFieldErrors<"label">();

    useEffect(() => {
        if (!isOpen) {
            setError(null);
            setLabel("");
            resetFieldErrors();
        }
    }, [isOpen, resetFieldErrors]);

    if (!isOpen) return null;

    const validateForm = () => {
        const errors: Partial<Record<"label", string>> = {};
        const labelResult = validateSeatLabel(label);
        if (!labelResult.ok) errors.label = labelResult.error;
        return { errors, labelResult };
    };
    const validation = validateForm();
    const labelError = visibleError("label", validation.errors);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        markSubmitted();
        setError(null);

        const { errors, labelResult } = validateForm();
        if (Object.values(errors).some(Boolean) || !labelResult.ok) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            await branches.createSeat(branchId, labelResult.value);
            onSuccess();
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color:var(--ui-form-overlay-bg)] p-3 backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-4">
            <div
                className={cn("flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col animate-in zoom-in-95 duration-200", formDialogPanelClass)}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={cn("flex flex-shrink-0 items-center justify-between px-4 py-4 sm:px-6", formDialogHeaderClass)}>
                    <h2 className="text-lg font-semibold text-[color:var(--ui-dialog-title)]">Add New Seat</h2>
                    <button onClick={onClose} className={cn("transition-colors hover:text-[color:var(--ui-table-text)]", formHelpTextClass)}>
                        <X size={20} />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
                    <form id="add-seat-form" onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className={cn("p-3 text-sm", formErrorBannerClass)}>
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label htmlFor="label" className={formLabelClass}>
                                Seat Label <span className={formRequiredClass}>*</span>
                            </label>
                            <input
                                id="label"
                                type="text"
                                disabled={isLoading}
                                value={label}
                                onChange={(e) => { setLabel(e.target.value); setError(null); }}
                                onBlur={() => markTouched("label")}
                                className={cn(formControlClass, "px-3 py-2", fieldErrorClass(labelError))}
                                placeholder="e.g. S-01, Row A - 12"
                                autoFocus
                                maxLength={FORM_LIMITS.seatLabelMax}
                                {...fieldErrorProps("add-seat-label-error", labelError)}
                            />
                            <FieldError id="add-seat-label-error" error={labelError} />
                            <p className={cn("text-xs", formHelpTextClass)}>
                                Provide a unique identifier for this seat to distinguish it in the study hall.
                            </p>
                        </div>
                    </form>
                </div>

                <div className={cn("flex flex-shrink-0 flex-col-reverse gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6", formDialogFooterClass)}>
                    <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button type="submit" form="add-seat-form" disabled={isLoading} className="min-w-[120px]">
                        {isLoading ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                        ) : (
                            "Create Seat"
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
