"use client";

import { Search, Filter, Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 fade-in">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
                {subtitle && <p className="text-textSecondary text-sm mt-1">{subtitle}</p>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {onSearch && (
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-4 h-4 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="h-10 pl-9 pr-4 bg-surface border border-[var(--border-subtle)] rounded-[var(--radius-sm)] text-sm text-textPrimary focus:outline-none focus:border-primary/50 transition-all w-full md:w-64"
                            onChange={(e) => onSearch(e.target.value)}
                        />
                    </div>
                )}

                {onFilter && (
                    <Button variant="outline" size="icon" onClick={onFilter}>
                        <Filter size={16} />
                    </Button>
                )}

                {onExport && (
                    <Button variant="outline" size="icon" onClick={onExport}>
                        <Download size={16} />
                    </Button>
                )}

                {onAdd && (
                    <Button onClick={onAdd} className="gap-2 shadow-lg shadow-primary/20 whitespace-nowrap flex-shrink-0">
                        <Plus size={16} />
                        {actionLabel}
                    </Button>
                )}
            </div>
        </div>
    );
}
