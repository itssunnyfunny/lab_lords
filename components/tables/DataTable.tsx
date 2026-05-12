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
                <div className="col-span-full rounded-[var(--ui-table-radius)] border border-dashed border-[color:var(--ui-table-empty-border)] py-12 text-center text-[color:var(--ui-table-subtle)]">
                    {emptyMessage}
                </div>
            )}
        </div>
    ) : null;

    const tableMinWidth = `${Math.max(44, columns.length * 10 + (actions ? 8 : 0))}rem`;
    const tableView = (
        <div className="w-full overflow-x-auto overflow-y-hidden rounded-[var(--ui-table-radius)] border border-[color:var(--ui-table-border)] bg-[color:var(--ui-table-bg)] shadow-[var(--ui-table-shadow)] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <table className="w-full text-left text-sm" style={{ minWidth: tableMinWidth }}>
                <thead className="bg-[color:var(--ui-table-head-bg)]">
                    <tr>
                        {columns.map((col, idx) => (
                            <th
                                key={idx}
                                className={cn(
                                    "px-6 py-4 text-xs font-medium uppercase tracking-wider text-[color:var(--ui-table-muted)]",
                                    col.className
                                )}
                            >
                                {col.header}
                            </th>
                        ))}
                        {actions && <th className="px-6 py-4 text-right text-xs uppercase text-[color:var(--ui-table-muted)]">Actions</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--ui-table-divider)]">
                    {data.map((item) => (
                        <tr
                            key={item.id}
                            className="group transition-colors duration-150 hover:bg-[color:var(--ui-table-row-hover-bg)]"
                        >
                            {columns.map((col, idx) => (
                                <td key={idx} className={cn("px-6 py-4 text-[color:var(--ui-table-text)]", col.className)}>
                                    {typeof col.accessor === "function" ? col.accessor(item) : (item[col.accessor] as ReactNode)}
                                </td>
                            ))}
                            {actions && (
                                <td className="px-6 py-4 text-right">
                                    {actions(item)}
                                </td>
                            )}
                        </tr>
                    ))}
                    {data.length === 0 && (
                        <tr>
                            <td colSpan={columns.length + (actions ? 1 : 0)} className="py-12 text-center text-[color:var(--ui-table-subtle)]">
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
