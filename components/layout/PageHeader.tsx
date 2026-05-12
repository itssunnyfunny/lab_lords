"use client";

import { Search, Filter, Plus, Download } from "lucide-react";
import { AppButton } from "@/components/ui";

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    onSearch?: (term: string) => void;
    onFilter?: () => void;
    onAdd?: () => void;
    onExport?: () => void;
    actionLabel?: string;
}

export function PageHeader({ title, subtitle, onSearch, onFilter, onAdd, onExport, actionLabel = "Add New" }: PageHeaderProps) {
    return (
        <div className="mb-6 flex flex-col justify-between gap-4 md:mb-8 md:flex-row md:items-end fade-in">
            <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--text-primary)] md:text-3xl">{title}</h1>
                {subtitle && <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--text-secondary)]">{subtitle}</p>}
            </div>

            <div className="flex w-full flex-wrap items-center gap-3 md:w-auto md:justify-end">
                {onSearch && (
                    <div className="relative group w-full md:w-auto">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-muted)] transition-colors group-focus-within:text-[color:var(--ui-form-accent)]" />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="h-10 w-full rounded-[var(--ui-radius-control)] border border-[color:var(--ui-form-input-border)] bg-[color:var(--ui-form-input-bg)] pl-9 pr-4 text-sm text-[color:var(--ui-form-input-text)] outline-none transition-colors placeholder:text-[color:var(--ui-form-input-placeholder)] focus:border-[color:var(--ui-form-input-focus-border)] focus:ring-2 focus:ring-[color:var(--ui-form-input-focus-ring)] md:w-64"
                            onChange={(e) => onSearch(e.target.value)}
                        />
                    </div>
                )}

                {onFilter && (
                    <AppButton variant="secondary" size="icon" icon={Filter} onClick={onFilter} aria-label="Filter" />
                )}

                {onExport && (
                    <AppButton variant="secondary" size="icon" icon={Download} onClick={onExport} aria-label="Export" />
                )}

                {onAdd && (
                    <AppButton onClick={onAdd} variant="primary" icon={Plus} className="flex-shrink-0 whitespace-nowrap">
                        {actionLabel}
                    </AppButton>
                )}
            </div>
        </div>
    );
}
