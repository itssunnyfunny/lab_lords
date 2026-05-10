"use client";

import { DashboardPanel } from "@/components/dashboard/DashboardPanel";
import { DashboardButton } from "@/components/dashboard/DashboardButton";
import { Badge } from "@/components/ui/Badge";
import { ArrowRight, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

interface Student {
    id: string;
    name: string;
    status: string;
    createdAt?: Date | string;
    joinedAt?: Date | string | null;
}

interface RecentStudentsProps {
    students: Student[];
    branchId: string;
}

function getInitials(name: string) {
    return name
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();
}

export function RecentStudents({ students, branchId }: RecentStudentsProps) {
    const router = useRouter();
    const visibleStudents = students.slice(0, 6);

    return (
        <DashboardPanel
            title="New enrollments"
            description="Recently added student profiles."
            action={
                <DashboardButton
                    onClick={() => router.push(`/branch/${branchId}/students`)}
                    variant="quiet"
                    size="sm"
                    rightIcon={ArrowRight}
                >
                    Students
                </DashboardButton>
            }
            contentClassName="p-0"
            className="h-full"
        >
            {visibleStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.03]">
                        <Users size={18} className="text-gray-500" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-white">No students yet</p>
                        <p className="mt-1 text-xs text-gray-500">Enroll students to start tracking occupancy and payments.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => router.push(`/branch/${branchId}/students`)}
                        className="text-xs font-medium text-cyan-300 transition-colors hover:text-cyan-200"
                    >
                        Add first student
                    </button>
                </div>
            ) : (
                <div className="divide-y divide-white/10">
                    {visibleStudents.map((student) => {
                        const dateValue = student.joinedAt ?? student.createdAt;
                        const joined = dateValue
                            ? formatDistanceToNow(new Date(dateValue), { addSuffix: true })
                            : "Date unavailable";

                        return (
                            <div key={student.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-white/[0.05] text-xs font-semibold text-gray-300">
                                    {getInitials(student.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-white">{student.name}</p>
                                    <p className="mt-1 text-xs text-gray-500">{joined}</p>
                                </div>
                                <Badge variant={student.status === "ACTIVE" ? "success" : "default"} className="shrink-0 text-[9px]">
                                    {student.status}
                                </Badge>
                            </div>
                        );
                    })}
                </div>
            )}
        </DashboardPanel>
    );
}
