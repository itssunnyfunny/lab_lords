"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable } from "@/components/tables/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MOCK_STUDENTS } from "@/lib/mock-data";
import { Edit2, MoreHorizontal, Trash2 } from "lucide-react";
import Image from "next/image";

export default function StudentsPage() {
    return (
        <div className="p-8">
            <PageHeader
                title="Student List"
                subtitle="Manage admissions, active students, and history."
                onSearch={() => { }}
                onFilter={() => { }}
                onExport={() => { }}
                onAdd={() => { }}
                actionLabel="Add Student"
            />

            <DataTable
                data={MOCK_STUDENTS}
                columns={[
                    {
                        header: "Student Name",
                        accessor: (item) => (
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-surface border border-white/5 overflow-hidden flex-shrink-0">
                                    <img src={`https://ui-avatars.com/api/?name=${item.name}&background=random`} alt={item.name} />
                                </div>
                                <div>
                                    <p className="font-medium text-white">{item.name}</p>
                                    <p className="text-xs text-textmuted">{item.course}</p>
                                </div>
                            </div>
                        )
                    },
                    { header: "Joined", accessor: "joined" },
                    { header: "Fee Breakdown", accessor: (item) => `$${item.fee}` },
                    {
                        header: "Attendance",
                        accessor: (item) => (
                            <div className="flex items-center gap-2">
                                <span className={item.attendance === "12%" ? "text-danger" : "text-success font-medium"}>
                                    {item.attendance}
                                </span>
                            </div>
                        )
                    },
                    {
                        header: "Status",
                        accessor: (item) => (
                            <Badge variant={item.status === "Active" ? "success" : "neutral"}>
                                {item.status}
                            </Badge>
                        )
                    },
                ]}
                actions={() => (
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10">
                            <Edit2 size={14} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10">
                            <Trash2 size={14} className="text-danger" />
                        </Button>
                    </div>
                )}
            />
        </div>
    );
}
