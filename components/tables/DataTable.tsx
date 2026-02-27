"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface DataTableProps<T> {
    columns: { header: string; accessor: keyof T | ((item: T) => ReactNode); className?: string }[];
    data: T[];
    actions?: (item: T) => ReactNode;
}

export function DataTable<T extends { id: string | number }>({ columns, data, actions }: DataTableProps<T>) {
    return (
        <div className="w-full overflow-visible rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-card shadow-card">
            <table className="w-full text-left text-sm">
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
                                No data available.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
