"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

export type DataViewMode = "table" | "grid";

interface DataTableProps<T> {
    columns: { header: string; accessor: keyof T | ((item: T) => ReactNode); className?: string }[];
    data: T[];
    actions?: (item: T) => ReactNode;
    viewMode?: DataViewMode;
    renderGridCard?: (item: T, actions?: (item: T) => ReactNode) => ReactNode;
    gridClassName?: string;
    emptyMessage?: string;
}

export function DataTable<T extends { id: string | number }>({
    columns,
    data,
    actions,
    viewMode = "table",
    renderGridCard,
    gridClassName,
    emptyMessage = "No data available.",
}: DataTableProps<T>) {
    const cardGrid = renderGridCard ? (
        <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3", gridClassName)}>
            {data.map((item) => (
                <div key={item.id} className="min-w-0">
                    {renderGridCard(item, actions)}
                </div>
            ))}
            {data.length === 0 && (
                <div className="col-span-full rounded-lg border border-dashed border-white/10 py-12 text-center text-textMuted">
                    {emptyMessage}
                </div>
            )}
        </div>
    ) : null;

    const tableMinWidth = `${Math.max(44, columns.length * 10 + (actions ? 8 : 0))}rem`;
    const tableView = (
        <div className="w-full overflow-x-auto overflow-y-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-card shadow-card scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <table className="w-full text-left text-sm" style={{ minWidth: tableMinWidth }}>
                <thead className="bg-white/[0.02]">
                    <tr>
                        {columns.map((col, idx) => (
                            <th
                                key={idx}
                                className={cn(
                                    "py-4 px-6 font-medium text-textSecondary uppercase tracking-wider text-xs",
                                    col.className
                                )}
                            >
                                {col.header}
                            </th>
                        ))}
                        {actions && <th className="py-4 px-6 text-right text-textSecondary uppercase text-xs">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                    {data.map((item) => (
                        <tr
                            key={item.id}
                            className="group hover:bg-white/[0.02] transition-colors duration-150"
                        >
                            {columns.map((col, idx) => (
                                <td key={idx} className={cn("py-4 px-6 text-textPrimary", col.className)}>
                                    {typeof col.accessor === "function" ? col.accessor(item) : (item[col.accessor] as ReactNode)}
                                </td>
                            ))}
                            {actions && (
                                <td className="py-4 px-6 text-right">
                                    {actions(item)}
                                </td>
                            )}
                        </tr>
                    ))}
                    {data.length === 0 && (
                        <tr>
                            <td colSpan={columns.length + (actions ? 1 : 0)} className="py-12 text-center text-textMuted">
                                {emptyMessage}
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    if (viewMode === "grid" && cardGrid) {
        return cardGrid;
    }

    if (cardGrid) {
        return (
            <>
                <div className="md:hidden">{cardGrid}</div>
                <div className="hidden md:block">{tableView}</div>
            </>
        );
    }

    return tableView;
}
