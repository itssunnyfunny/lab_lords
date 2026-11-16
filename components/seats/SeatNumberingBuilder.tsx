"use client";
import { LocalizedError } from "@/components/settings/LocalizedText";
import { useTranslation } from "@/components/settings/LocalizedText";

import { Hash, Plus, Trash2 } from "lucide-react";
import { AppButton, AppSelect, FormField } from "@/components/ui";
import {
    formControlClass,
    formHelpTextClass,
    formSurfaceClass,
} from "@/components/ui/formSurface";
import {
    FORM_LIMITS,
    parseIntegerField,
} from "@/lib/formValidation";
import {
    generateSeatLabels,
    type SeatNumberingConfig,
    type SeatNumberingRange,
    type SeatNumberingSeparator,
} from "@/lib/seatNumbering";
import { cn } from "@/lib/utils";

interface SeatNumberingBuilderProps {
    value: SeatNumberingConfig;
    onChange: (value: SeatNumberingConfig) => void;
    expectedCount?: number;
    disabled?: boolean;
    className?: string;
}

const SEPARATOR_OPTIONS: Array<{ value: SeatNumberingSeparator; label: string }> = [
    { value: "", label: "None" },
    { value: "-", label: "-" },
    { value: " ", label: "Space" },
    { value: "/", label: "/" },
];

export function createSimpleSeatNumbering(count = 0): SeatNumberingConfig {
    return { mode: "SIMPLE", count };
}

export function createRangeSeatNumbering(count = 10): SeatNumberingConfig {
    return {
        mode: "RANGE",
        ranges: [{
            prefix: "A",
            start: 1,
            end: Math.max(1, count),
            separator: "",
        }],
    };
}

export function resolveSeatNumberingForCount(value: SeatNumberingConfig, count: number): SeatNumberingConfig {
    return value.mode === "SIMPLE" ? { mode: "SIMPLE", count } : value;
}

function createNextRange(existingCount: number): SeatNumberingRange {
    const prefixIndex = existingCount % 26;
    return {
        prefix: String.fromCharCode(65 + prefixIndex),
        start: 1,
        end: 10,
        separator: "",
    };
}

function rangeCount(range: SeatNumberingRange) {
    return Math.max(0, range.end - range.start + 1);
}

function formatPreview(labels: string[]) {
    const sample = labels.slice(0, 12);
    return labels.length > sample.length ? [...sample, "..."] : sample;
}

export function SeatNumberingBuilder({
    value,
    onChange,
    expectedCount,
    disabled = false,
    className,
}: SeatNumberingBuilderProps) {
    const t = useTranslation();
    const effectiveValue = expectedCount !== undefined
        ? resolveSeatNumberingForCount(value, expectedCount)
        : value;
    const labelsResult = generateSeatLabels(effectiveValue);
    const labels = labelsResult.ok ? labelsResult.value : [];
    const previewError = !labelsResult.ok
        ? labelsResult.error
        : expectedCount !== undefined && labels.length !== expectedCount
            ? `Custom ranges create ${labels.length} labels, but total seats is ${expectedCount}.`
            : null;

    const switchMode = (mode: SeatNumberingConfig["mode"]) => {
        if (mode === value.mode) return;
        if (mode === "SIMPLE") {
            onChange(createSimpleSeatNumbering(expectedCount ?? 0));
            return;
        }
        onChange(createRangeSeatNumbering(expectedCount ?? 10));
    };

    const updateSimpleCount = (rawValue: string) => {
        const countResult = parseIntegerField(rawValue, "Seat count", {
            min: 0,
            max: FORM_LIMITS.seatsMax,
        });
        onChange(createSimpleSeatNumbering(countResult.ok ? countResult.value ?? 0 : 0));
    };

    const updateRange = (index: number, patch: Partial<SeatNumberingRange>) => {
        if (value.mode !== "RANGE") return;
        onChange({
            mode: "RANGE",
            ranges: value.ranges.map((range, rangeIndex) => rangeIndex === index ? { ...range, ...patch } : range),
        });
    };

    const addRange = () => {
        if (value.mode !== "RANGE") return;
        onChange({
            mode: "RANGE",
            ranges: [...value.ranges, createNextRange(value.ranges.length)],
        });
    };

    const removeRange = (index: number) => {
        if (value.mode !== "RANGE" || value.ranges.length <= 1) return;
        onChange({
            mode: "RANGE",
            ranges: value.ranges.filter((_, rangeIndex) => rangeIndex !== index),
        });
    };

    return (
        <div className={cn("space-y-3", className)}>
            <div className="flex flex-wrap gap-2">
                <AppButton
                    type="button"
                    density="compact"
                    variant={value.mode === "SIMPLE" ? "primary" : "secondary"}
                    icon={Hash}
                    disabled={disabled}
                    onClick={() => switchMode("SIMPLE")}
                    aria-pressed={value.mode === "SIMPLE"}
                >
                    {t("Default")}</AppButton>
                <AppButton
                    type="button"
                    density="compact"
                    variant={value.mode === "RANGE" ? "primary" : "secondary"}
                    icon={Hash}
                    disabled={disabled}
                    onClick={() => switchMode("RANGE")}
                    aria-pressed={value.mode === "RANGE"}
                >
                    {t("Custom ranges")}</AppButton>
            </div>

            {value.mode === "SIMPLE" && expectedCount === undefined && (
                <FormField label={t("Seat count")} className="min-w-0 max-w-xs">
                    <input
                        aria-label={t("Seat count")}
                        type="number"
                        min="1"
                        max={FORM_LIMITS.seatsMax}
                        step="1"
                        inputMode="numeric"
                        disabled={disabled}
                        value={value.count}
                        onChange={(event) => updateSimpleCount(event.target.value)}
                        className={cn(formControlClass, "min-h-11 min-w-0 px-3 py-2 text-base sm:text-sm")}
                    />
                </FormField>
            )}

            {value.mode === "RANGE" && (
                <div className="space-y-3">
                    {value.ranges.map((range, index) => (
                        <div key={index} className={cn("space-y-3 p-3", formSurfaceClass)}>
                            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
                                <FormField label={t("Prefix")} className="col-span-2 min-w-0 sm:col-span-1">
                                    <input
                                        aria-label={t("Range {number} prefix", { number: index + 1 })}
                                        type="text"
                                        disabled={disabled}
                                        value={range.prefix}
                                        maxLength={16}
                                        onChange={(event) => updateRange(index, { prefix: event.target.value })}
                                        className={cn(formControlClass, "min-h-11 min-w-0 px-3 py-2 text-base sm:text-sm")}
                                        placeholder="A"
                                    />
                                </FormField>
                                <FormField label={t("Start")} className="min-w-0">
                                    <input
                                        aria-label={t("Range {number} start", { number: index + 1 })}
                                        type="number"
                                        disabled={disabled}
                                        value={range.start}
                                        min={0}
                                        max={FORM_LIMITS.seatsMax}
                                        step={1}
                                        onChange={(event) => updateRange(index, { start: Number(event.target.value) || 0 })}
                                        className={cn(formControlClass, "min-h-11 min-w-0 px-3 py-2 text-base sm:text-sm")}
                                    />
                                </FormField>
                                <FormField label={t("End")} className="min-w-0">
                                    <input
                                        aria-label={t("Range {number} end", { number: index + 1 })}
                                        type="number"
                                        disabled={disabled}
                                        value={range.end}
                                        min={0}
                                        max={FORM_LIMITS.seatsMax}
                                        step={1}
                                        onChange={(event) => updateRange(index, { end: Number(event.target.value) || 0 })}
                                        className={cn(formControlClass, "min-h-11 min-w-0 px-3 py-2 text-base sm:text-sm")}
                                    />
                                </FormField>
                                <FormField label={t("Padding")} className="min-w-0">
                                    <input
                                        aria-label={t("Range {number} padding", { number: index + 1 })}
                                        type="number"
                                        disabled={disabled}
                                        value={range.padTo ?? 0}
                                        min={0}
                                        max={FORM_LIMITS.seatLabelMax}
                                        step={1}
                                        onChange={(event) => updateRange(index, { padTo: Number(event.target.value) || undefined })}
                                        className={cn(formControlClass, "min-h-11 min-w-0 px-3 py-2 text-base sm:text-sm")}
                                    />
                                </FormField>
                                <FormField label={t("Separator")} className="min-w-0">
                                    <AppSelect
                                        aria-label={t("Range {number} separator", { number: index + 1 })}
                                        disabled={disabled}
                                        value={range.separator ?? ""}
                                        onValueChange={value => updateRange(index, { separator: value as SeatNumberingSeparator })}
                                        options={SEPARATOR_OPTIONS}
                                        className="min-h-11 min-w-0 text-base sm:text-sm"
                                    />
                                </FormField>
                                <div className="col-span-2 flex justify-end sm:col-span-1">
                                    <AppButton
                                        type="button"
                                        variant="quiet"
                                        size="icon"
                                        disabled={disabled || value.ranges.length <= 1}
                                        onClick={() => removeRange(index)}
                                        className="sm:h-11 sm:w-11"
                                        aria-label={t("Remove range")}
                                    >
                                        <Trash2 size={14} />
                                    </AppButton>
                                </div>
                            </div>
                            <div className={cn("text-xs", formHelpTextClass)}>{t("{rangeCount} seats", { rangeCount: rangeCount(range) })}</div>
                        </div>
                    ))}
                    <AppButton
                        type="button"
                        variant="secondary"
                        density="compact"
                        icon={Plus}
                        disabled={disabled}
                        onClick={addRange}
                    >
                        {t("Add range")}</AppButton>
                </div>
            )}

            <div className={cn("space-y-2 rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-muted-surface-bg)] p-3")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={cn("text-xs font-semibold uppercase", formHelpTextClass)}>{t("Preview")}</span>
                    <span className={cn("text-xs", previewError ? "text-[color:var(--ui-form-error-text)]" : formHelpTextClass)}>{t("{count} seat(s)", { count: labels.length })}</span>
                </div>
                {previewError ? (
                    <p className="text-xs text-[color:var(--ui-form-error-text)]"><LocalizedError error={previewError} /></p>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
                        {formatPreview(labels).map((label, index) => (
                            <span
                                key={`${label}-${index}`}
                                className="rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-surface-border)] bg-[color:var(--ui-form-bg)] px-2 py-1 font-mono text-xs text-[color:var(--text-primary)]"
                            >
                                {label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
