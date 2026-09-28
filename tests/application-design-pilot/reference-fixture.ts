import type { DashboardOverview, DashboardSource } from "../../lib/dashboardContracts";

/** Isolated synthetic records only. None of this data is used by application services. */
export function referenceDashboardFixture(state = "populated", branchId = "pilot", month = "2026-09"): DashboardOverview {
    const now = `${month}-22T10:21:00.000Z`;
    const success = <T,>(data: T): DashboardSource<T> => ({ status: "success", data });
    const names = ["Rahul Verma", "Priya Singh", "Aman Khan", "Rohit Mehta", "Sneha Yadav", "Karan Patel", "Neha Sharma", "Arjun Kumar", "Meera Singh", "Kabir Shah", "Anjali Rao", "Dev Patel"];
    const empty = state === "empty";
    const calm = state === "calm";
    const count = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0).getDate();
    const weights = Array.from({ length: count }, (_, i) => [2,3,2,5,4,7,5,6,4,8,3,5,6,9,7,12,8,6,9,15,8,12,10,16,9,11,14,16,20,24,7][i]);
    const total = weights.reduce((sum, n) => sum + n, 0);
    let billed = 0; let paid = 0;
    const points = weights.map((weight, i) => {
        const cumulativeWeight = weights.slice(0, i + 1).reduce((sum, n) => sum + n, 0);
        const targetBill = empty ? 0 : Math.round(cumulativeWeight / total * 4300);
        const targetPaid = empty ? 0 : calm ? targetBill : Math.round(Math.pow(cumulativeWeight / total, 1.8) * 1900);
        const point = { date: `${month}-${String(i + 1).padStart(2, "0")}`, billed: targetBill - billed, collected: targetPaid - paid, pending: targetBill - billed - (targetPaid - paid), collectionRate: targetBill ? targetPaid / targetBill * 100 : null };
        billed = targetBill; paid = targetPaid; return point;
    });
    const days = Array.from({ length: 7 }, (_, i) => `${month}-${String(16 + i).padStart(2,"0")}`);
    const followUps = empty || calm ? [] : names.slice(3, 7).map((name, i) => ({ id: `follow-${i}`, studentId: `student-${i + 3}`, studentName: name, phone: null, type: "MONTHLY" as const, periodStart: `${month}-01`, note: "", outcome: i === 0 ? "PROMISED_PAYMENT" : "NOT_CONTACTED", nextFollowUpAt: `${month}-${i < 2 ? "22" : "21"}T00:00:00.000Z`, completedAt: null, updatedAt: now }));
    const data: DashboardOverview = {
        branchId, timezone: "Asia/Kolkata", today: `${month}-22`, updatedAt: now,
        // Synthetic fees can have future due dates/prepayments. Apply the same
        // through-today and more-than-seven-days rules as the real service.
        money: success({ collectedThisMonth: paid,
            pendingDues: points.filter(point => point.date <= `${month}-22`).reduce((sum, point) => sum + point.pending, 0),
            overdueAmount: points.filter(point => point.date < `${month}-15`).reduce((sum, point) => sum + point.pending, 0),
            overdueStudents: empty || calm ? 0 : 4, comparisonPercent: null }),
        students: success({ active: empty ? 0 : 12, comparison: null }),
        followUps: success({ pending: followUps.length, dueToday: followUps.length, items: followUps }),
        terms: success({ configured: state !== "unconfigured", renewalsThisWeek: empty ? 0 : 3, items: empty ? [] : names.slice(0,3).map((name, i) => ({ id: `term-${i}`, studentId: `student-${i}`, studentName: name, label: "Monthly", startDate: `${month}-01`, endDate: `${month}-${25 + i}`, daysLeft: 3 + i })) }),
        collections: success({ month, billed, collected: paid, pending: billed - paid, waived: 0, rate: billed ? paid / billed * 100 : null, points }),
        seating: success({ seats: 16, shifts: 3, capacity: 48, occupied: empty ? 0 : 10, physicalSeatsInUse: empty ? 0 : 8, utilizationPercent: empty ? 0 : 10 / 48 * 100, threshold: 35, lowUtilization: true, coverageStartedAt: state === "unconfigured" ? null : `${month}-16T00:00:00.000Z`, days,
            rows: ["Morning", "Afternoon", "Evening"].map((name, i) => ({ id: `shift-${i}`, name, startTime: ["06:00","12:00","18:00"][i], endTime: ["12:00","18:00","23:00"][i], cells: days.map((date, j) => ({ date, capacity: state === "unconfigured" && j < 6 ? null : 16, occupied: state === "unconfigured" && j < 6 ? null : empty ? 0 : [[14,5,0,9,12,4,4],[3,0,12,0,5,14,3],[5,14,11,0,10,0,3]][i][j], recordedAt: state === "unconfigured" && j < 6 ? null : `${date}T10:00:00Z` })) })),
            seatsPreview: Array.from({length:16},(_,i) => ({id:`seat-${i}`,label:`A${i+1}`,occupiedShifts:empty ? 0 : i < 2 ? 2 : i < 8 ? 1 : 0})) }),
        attendance: success({ configured: state !== "unconfigured", expectedToday: empty ? 0 : 8, attendedToday: empty ? 0 : 5, gaps: empty ? 0 : 3, gapsStudents: empty ? [] : names.slice(5,8).map((name,i) => ({id:`student-${i+5}`,name,expectedBy:"10:00"})) }),
        activity: empty ? [] : (["COLLECTION","STUDENT","ATTENDANCE","FOLLOW_UP","ALLOCATION"] as const).map((kind,i) => ({id:`event-${i}`,kind,occurredAt:new Date(Date.parse(now)-(i ? i*60 : 10)*60_000).toISOString(),studentName:names[i],...(i===0?{amount:500}:{}),href:`/branch/${branchId}/${["payments","students","attendance","follow-ups","allocations"][i]}`})),
    };
    if (calm) {
        data.terms.data = { configured: true, renewalsThisWeek: 0, items: [] };
        Object.assign(data.seating.data!, { occupied: 48, physicalSeatsInUse: 16, utilizationPercent: 100, lowUtilization: false });
        data.seating.data!.rows.forEach(row => row.cells.forEach(cell => { cell.occupied = 16; }));
        data.seating.data!.seatsPreview.forEach(seat => { seat.occupiedShifts = 3; });
        Object.assign(data.attendance.data!, { attendedToday: 8, gaps: 0, gapsStudents: [] });
    }
    if (state === "unconfigured") {
        data.terms.data = { configured: false, renewalsThisWeek: 0, items: [] };
        Object.assign(data.attendance.data!, { expectedToday: 0, gaps: 0, gapsStudents: [] });
    }
    if (state === "sparse") {
        data.seating.data!.coverageStartedAt = `${month}-21T00:00:00.000Z`;
        data.seating.data!.rows.forEach(row => row.cells.slice(0, 5).forEach(cell => Object.assign(cell, { capacity: null, occupied: null, recordedAt: null })));
        data.activity = data.activity.slice(0, 1);
    }
    if (state === "locked") data.collections = { status: "locked", data: null };
    if (state === "restricted") { for (const key of ["money","followUps","terms","collections","seating"] as const) data[key] = { status: "restricted", data: null }; data.activity = []; }
    if (state === "source-error") { data.collections = {status:"error",data:null}; data.attendance = {status:"error",data:null}; }
    return data;
}
