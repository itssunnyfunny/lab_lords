import { apiClient } from "./core";
import { Student } from "@prisma/client";
import { CreateStudentDto, StudentStatus } from "@/types";

export const students = {
    // List students for a branch
    list: async (branchId: string): Promise<Student[]> => {
        return apiClient.get(`/branches/${branchId}/students`);
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
