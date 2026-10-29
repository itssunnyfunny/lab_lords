import type { Branch, Shift } from "@/app/generated/prisma/browser";
import type { BranchAccess } from "@/types";
import { branches } from "@/lib/api/branches";
import { students, type StudentListItem, type StudentSeatAllocation } from "@/lib/api/students";
import { payments, type PaymentListItem } from "@/lib/api/payments";
import { seats } from "@/lib/api/seats";
import { apiClient } from "@/lib/api/core";
import { hasBranchCapability } from "@/lib/branchCapabilities";
export type BasicSummary = { branchId: string; today: string; activeStudents: number | null; money: { collectedThisMonth: number; pendingDues: number } | null };
export type BasicData = { branch: Branch; students: StudentListItem[]; allocationStudents: {id:string;name:string;seatAllocations?:StudentSeatAllocation[]}[]; shifts: Shift[]; payments: PaymentListItem[]; summary: BasicSummary };
export type SeatMap = { totalSeats: number; availableCount: number; seats: { seatId: string; label: string; occupied: boolean; occupiedBy: string | null }[] };
export async function loadBasicData(access: BranchAccess): Promise<BasicData> {
    const id = access.branchId;
    const [branch, roster, shifts, fees, summary] = await Promise.all([
        branches.getDetails(id),
        hasBranchCapability(access, "studentsView") ? students.listAll(id) : Promise.resolve([]),
        hasBranchCapability(access, "shiftsView") ? branches.getShifts(id) : Promise.resolve([]),
        hasBranchCapability(access, "paymentsView") ? payments.listAll(id) : Promise.resolve([]),
        apiClient.get<never, BasicSummary>("/branches/" + id + "/basic-overview"),
    ]);
    if (branch.id !== id || summary.branchId !== id) throw new Error("Branch access is unavailable.");
    let allocationStudents: BasicData["allocationStudents"]=roster.filter(s=>s.status==="ACTIVE");
    if(!hasBranchCapability(access,"studentsView")&&hasBranchCapability(access,"allocationsView")){
        const [options,rows]=await Promise.all([apiClient.get<never,{items:{id:string;name:string}[]}>("/branches/"+id+"/seat-allocations/students"),seats.listAllAllocations<StudentSeatAllocation&{studentId:string}>(id,{activeOnly:true})]);
        allocationStudents=options.items.map(student=>({...student,seatAllocations:rows.filter(row=>row.studentId===student.id)}));
    }
    return { branch, students: roster, allocationStudents, shifts, payments: fees, summary };
}
export const activeAllocations = (student?: {seatAllocations?: StudentSeatAllocation[]}) => student?.seatAllocations?.filter(a => !a.endDate) ?? [];
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("");
export const seatLabel = (label: string) => /^\d$/.test(label) ? label.padStart(2, "0") : label;
