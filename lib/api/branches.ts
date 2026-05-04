import { apiClient } from "./core";
import { Student, Seat, Payment, Staff, Shift, Branch } from "@prisma/client";

export const branches = {
    getDetails: async (branchId: string): Promise<Branch> => {
        return apiClient.get(`/branches/${branchId}`);
    },

    getStudents: async (branchId: string, shiftId?: string): Promise<Student[]> => {
        const query = shiftId ? `?shiftId=${shiftId}` : "";
        return apiClient.get(`/branches/${branchId}/students${query}`);
    },

    createStudent: async (branchId: string, data: { name: string; phone?: string }): Promise<Student> => {
        return apiClient.post(`/branches/${branchId}/students`, data);
    },

    getSeats: async (branchId: string, shiftId?: string): Promise<Seat[]> => {
        const query = shiftId ? `?shiftId=${shiftId}` : "";
        return apiClient.get(`/branches/${branchId}/seats${query}`);
    },

    createSeat: async (branchId: string, label: string): Promise<Seat> => {
        return apiClient.post(`/branches/${branchId}/seats`, { label });
    },

    getPayments: async (branchId: string, status?: string): Promise<Payment[]> => {
        const params = new URLSearchParams();
        if (status) params.append("status", status);
        return apiClient.get(`/branches/${branchId}/payments?${params.toString()}`);
    },

    getStaff: async (branchId: string): Promise<Staff[]> => {
        return apiClient.get(`/branches/${branchId}/staff`);
    },

    addStaff: async (branchId: string, data: { userId: string; role: string }): Promise<Staff> => {
        return apiClient.post(`/branches/${branchId}/staff`, data);
    },

    getShifts: async (branchId: string): Promise<Shift[]> => {
        return apiClient.get(`/branches/${branchId}/shifts`);
    },

    createShift: async (branchId: string, data: { name: string; startTime?: string; endTime?: string }): Promise<Shift> => {
        return apiClient.post(`/branches/${branchId}/shifts`, data);
    }
};
