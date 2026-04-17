"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ChevronRight, Users } from "lucide-react";
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
        .map((n) => n[0])
        .join("")
        .toUpperCase();
}

const avatarColors = [
    "bg-indigo-500/20 text-indigo-300",
    "bg-violet-500/20 text-violet-300",
    "bg-cyan-500/20 text-cyan-300",
    "bg-emerald-500/20 text-emerald-300",
    "bg-amber-500/20 text-amber-300",
];

export function RecentStudents({ students, branchId }: RecentStudentsProps) {
    const router = useRouter();

    return (
        <Card
            title="Recently Enrolled"
            action={
                <button
                    onClick={() => router.push(`/branch/${branchId}/students`)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 transition-colors"
                >
                    View all <ChevronRight size={12} />
                </button>
            }
        >
            {students.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center">
                        <Users size={20} className="text-gray-500" />
                    </div>
                    <p className="text-sm font-semibold text-white">No students yet</p>
                    <p className="text-xs text-gray-500">Enroll your first student to get started.</p>
                    <button
                        onClick={() => router.push(`/branch/${branchId}/students`)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                        Add a student →
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {students.map((student, i) => {
                        const dateStr = student.joinedAt ?? student.createdAt;
                        const joined = dateStr
                            ? formatDistanceToNow(new Date(dateStr), { addSuffix: true })
                            : "—";

                        return (
                            <div
                                key={student.id}
                                className="flex flex-col items-center text-center gap-2 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-200"
                            >
                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold ${avatarColors[i % avatarColors.length]}`}>
                                    {getInitials(student.name)}
                                </div>
                                <div className="min-w-0 w-full">
                                    <p className="text-sm font-semibold text-white truncate">{student.name}</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">{joined}</p>
                                </div>
                                <Badge variant={student.status === "ACTIVE" ? "purple" : "default"} className="text-[9px]">
                                    {student.status}
                                </Badge>
                            </div>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}
