"use client";

import { AppButton, AppPanel } from "@/components/ui";
import { Badge } from "@/components/ui/Badge";
import {
    pageInsetSurfaceClass,
    pageSectionDividerClass,
    pageSubtleTextClass,
} from "@/components/ui/pageSurface";
import { cn } from "@/lib/utils";
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
        <AppPanel
            title="New enrollments"
            description="Recently added student profiles."
            action={
                <AppButton
                    onClick={() => router.push(`/branch/${branchId}/students`)}
                    variant="quiet"
                    size="sm"
                    rightIcon={ArrowRight}
                >
                    Students
                </AppButton>
            }
            contentClassName="p-0"
            className="h-full"
        >
            {visibleStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
                    <div className={cn("flex h-10 w-10 items-center justify-center", pageInsetSurfaceClass)}>
                        <Users size={18} className="text-[color:var(--text-muted)]" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-[color:var(--text-primary)]">No students yet</p>
                        <p className={cn("mt-1 text-xs", pageSubtleTextClass)}>Enroll students to start tracking occupancy and payments.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => router.push(`/branch/${branchId}/students`)}
                        className="text-xs font-medium text-[color:var(--ui-form-accent)] transition-colors hover:text-[color:var(--ui-form-accent-hover)]"
                    >
                        Add first student
                    </button>
                </div>
            ) : (
                <div className={cn("divide-y", pageSectionDividerClass)}>
                    {visibleStudents.map((student) => {
                        const dateValue = student.joinedAt ?? student.createdAt;
                        const joined = dateValue
                            ? formatDistanceToNow(new Date(dateValue), { addSuffix: true })
                            : "Date unavailable";

                        return (
                            <div key={student.id} className="flex items-center gap-3 px-4 py-3">
                                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center text-xs font-semibold text-[color:var(--text-secondary)]", pageInsetSurfaceClass)}>
                                    {getInitials(student.name)}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">{student.name}</p>
                                    <p className={cn("mt-1 text-xs", pageSubtleTextClass)}>{joined}</p>
                                </div>
                                <Badge variant={student.status === "ACTIVE" ? "success" : "default"} className="shrink-0 text-[9px]">
                                    {student.status}
                                </Badge>
                            </div>
                        );
                    })}
                </div>
            )}
        </AppPanel>
    );
}
