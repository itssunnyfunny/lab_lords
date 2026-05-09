"use client";

import { ReactNode, useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, Loader2, LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FieldError, fieldErrorClass, fieldErrorProps } from "@/components/ui/InlineFieldError";
import { cn } from "@/lib/utils";

export interface SettingsSection {
    id: string;
    label: string;
    icon: LucideIcon;
}

export function SettingsWorkspace({
    title,
    subtitle,
    sections,
    activeSection,
    onSectionChange,
    children,
}: {
    title: string;
    subtitle: string;
    sections: SettingsSection[];
    activeSection: string;
    onSectionChange: (section: string) => void;
    children: ReactNode;
}) {
    const clickedSectionRef = useRef<string | null>(null);

    useEffect(() => {
        const panels = sections
            .map(section => document.getElementById(section.id))
            .filter((panel): panel is HTMLElement => Boolean(panel));

        if (panels.length === 0) return;

        const observer = new IntersectionObserver(
            entries => {
                const visible = entries
                    .filter(entry => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

                if (!visible?.target.id) return;
                if (clickedSectionRef.current === visible.target.id) {
                    clickedSectionRef.current = null;
                }
                onSectionChange(visible.target.id);
            },
            {
                root: null,
                rootMargin: "-20% 0px -55% 0px",
                threshold: [0.15, 0.3, 0.6],
            }
        );

        panels.forEach(panel => observer.observe(panel));
        return () => observer.disconnect();
    }, [onSectionChange, sections]);

    const handleSectionClick = (sectionId: string) => {
        clickedSectionRef.current = sectionId;
        onSectionChange(sectionId);
        document.getElementById(sectionId)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    return (
        <div className="mx-auto max-w-6xl p-4 md:p-8 text-white">
            <div className="mb-6">
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                <nav className="lg:sticky lg:top-6 h-max rounded-xl border border-white/8 bg-white/[0.03] p-2">
                    {sections.map(section => {
                        const Icon = section.icon;
                        const active = activeSection === section.id;
                        return (
                            <button
                                key={section.id}
                                onClick={() => handleSectionClick(section.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                                    active
                                        ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                                        : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                                )}
                            >
                                <Icon size={15} />
                                <span className="font-medium">{section.label}</span>
                            </button>
                        );
                    })}
                </nav>
                <div className="min-w-0 space-y-5 pb-24">{children}</div>
            </div>
        </div>
    );
}

export function SettingsPanel({
    id,
    title,
    description,
    icon: Icon,
    children,
}: {
    id: string;
    title: string;
    description?: string;
    icon: LucideIcon;
    children: ReactNode;
}) {
    return (
        <section id={id} className="scroll-mt-6 rounded-xl border border-white/8 bg-[#0f111a]/70">
            <div className="flex items-start gap-3 border-b border-white/8 px-5 py-4">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-cyan-300">
                    <Icon size={16} />
                </div>
                <div>
                    <h2 className="text-base font-semibold">{title}</h2>
                    {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
                </div>
            </div>
            <div className="divide-y divide-white/[0.06]">{children}</div>
        </section>
    );
}

export function SettingsField({
    label,
    description,
    error,
    errorId,
    children,
}: {
    label: string;
    description?: string;
    error?: string | null;
    errorId?: string;
    children: ReactNode;
}) {
    return (
        <div className="grid gap-3 px-5 py-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
            <div>
                <label className="text-sm font-medium text-gray-200">{label}</label>
                {description && <p className="mt-1 text-xs leading-relaxed text-gray-500">{description}</p>}
            </div>
            <div className="min-w-0">
                {children}
                <FieldError id={errorId} error={error} />
            </div>
        </div>
    );
}

export function SettingsInput({
    error,
    errorId,
    className,
    ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string | null; errorId?: string }) {
    return (
        <input
            {...props}
            {...(errorId ? fieldErrorProps(errorId, error) : {})}
            className={cn(
                "w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-cyan-500/50 disabled:cursor-not-allowed disabled:opacity-50",
                fieldErrorClass(error),
                className
            )}
        />
    );
}

export function SettingsTextArea({
    error,
    errorId,
    className,
    ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string | null; errorId?: string }) {
    return (
        <textarea
            {...props}
            {...(errorId ? fieldErrorProps(errorId, error) : {})}
            className={cn(
                "min-h-24 w-full resize-y rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-cyan-500/50",
                fieldErrorClass(error),
                className
            )}
        />
    );
}

export function SettingsSelect({
    error,
    errorId,
    className,
    ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { error?: string | null; errorId?: string }) {
    return (
        <select
            {...props}
            {...(errorId ? fieldErrorProps(errorId, error) : {})}
            className={cn(
                "w-full rounded-lg border border-white/10 bg-[#0f111a] px-3 py-2 text-sm text-white outline-none transition-colors focus:border-cyan-500/50",
                fieldErrorClass(error),
                className
            )}
        />
    );
}

export function SettingsToggle({
    checked,
    onChange,
    label,
    description,
}: {
    checked: boolean;
    onChange: (value: boolean) => void;
    label: string;
    description?: string;
}) {
    return (
        <button
            type="button"
            onClick={() => onChange(!checked)}
            className="flex w-full items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-left"
        >
            <span>
                <span className="block text-sm font-medium text-white">{label}</span>
                {description && <span className="mt-0.5 block text-xs text-gray-500">{description}</span>}
            </span>
            <span className={cn("relative h-5 w-10 rounded-full transition-colors", checked ? "bg-cyan-500" : "bg-white/10")}>
                <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", checked ? "translate-x-5" : "translate-x-0.5")} />
            </span>
        </button>
    );
}

export function SegmentedControl<T extends string>({
    value,
    options,
    onChange,
}: {
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {options.map(option => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                        value === option.value
                            ? "bg-cyan-500/15 text-cyan-300"
                            : "text-gray-400 hover:bg-white/5 hover:text-white"
                    )}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

export function ReadOnlyRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="min-w-0 truncate text-right font-medium text-gray-300">{value}</span>
        </div>
    );
}

export function SettingsSaveBar({
    visible,
    saving,
    status,
    error,
    onSave,
    onReset,
}: {
    visible: boolean;
    saving: boolean;
    status: "idle" | "success" | "error";
    error?: string;
    onSave: () => void;
    onReset: () => void;
}) {
    if (!visible && status === "idle") return null;

    return (
        <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 rounded-xl border border-white/10 bg-[#0f111a]/95 p-3 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                    {status === "success" ? (
                        <span className="flex items-center gap-2 text-emerald-400"><CheckCircle2 size={15} /> Settings saved.</span>
                    ) : status === "error" ? (
                        <span className="flex items-center gap-2 text-red-400"><AlertCircle size={15} /> {error || "Save failed."}</span>
                    ) : (
                        <span className="text-gray-400">You have unsaved settings changes.</span>
                    )}
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
                        Reset
                    </Button>
                    <Button size="sm" onClick={onSave} disabled={!visible || saving} className="min-w-[110px]">
                        {saving ? <><Loader2 size={13} className="animate-spin" /> Saving</> : "Save Changes"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
