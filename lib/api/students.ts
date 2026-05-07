import { apiClient } from "./core";
import type { Student } from "@/app/generated/prisma/browser";
import { CreateStudentDto, StudentStatus } from "@/types";

export const students = {
    // List students for a branch
    list: async (branchId: string, shiftId?: string): Promise<Student[]> => {
        return apiClient.get(`/branches/${branchId}/students`, {
            params: {
                shiftId,
                _t: new Date().getTime() // Prevent caching
            }
        });
    },

    // Create a new student in a branch
    create: async (branchId: string, data: CreateStudentDto): Promise<Student> => {
        return apiClient.post(`/branches/${branchId}/students`, data);
    },

    // Get a single student (if endpoint exists, otherwise we might rely on list)
    // Looking at routes, we have `students/[studentId]/status/route.ts` but maybe not get by ID yet.

    // Update student status
    updateStatus: async (studentId: string, status: StudentStatus): Promise<Student> => {
        return apiClient.patch(`/students/${studentId}/status`, { status });
    }
};
