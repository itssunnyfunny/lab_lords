import type { IncomingMessage, ServerResponse } from "node:http";

type PilotRequest = IncomingMessage & { originalUrl?: string };
type Next = () => void;

const BRANCH_ID = "pilot";
const NOW = "2026-09-22T08:30:00.000Z";

const shifts = [
    {
        id: "shift-morning",
        branchId: BRANCH_ID,
        name: "Morning",
        startTime: "06:00",
        endTime: "12:00",
        price: 1400,
        isReserved: false,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: NOW,
    },
    {
        id: "shift-evening",
        branchId: BRANCH_ID,
        name: "Evening",
        startTime: "14:00",
        endTime: "21:00",
        price: 1500,
        isReserved: false,
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: NOW,
    },
];

const multiShifts = [
    {
        id: "multi-full-day",
        name: "Full day",
        price: 2500,
        createdAt: "2026-01-01T00:00:00.000Z",
        components: shifts.map((shift, order) => ({
            shiftId: shift.id,
            shiftName: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            order,
        })),
    },
];

const allocationOne = {
    id: "allocation-1",
    branchId: BRANCH_ID,
    studentId: "student-aarav",
    seatId: "seat-a1",
    shiftId: "shift-morning",
    multiShiftId: null,
    startDate: "2026-08-03T00:00:00.000Z",
    endDate: null,
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: NOW,
    seat: { id: "seat-a1", label: "A1" },
    shift: { id: "shift-morning", name: "Morning", startTime: "06:00", endTime: "12:00", isReserved: false },
    multiShift: null,
    student: { id: "student-aarav", name: "Aarav Mehta", phone: "+91 98765 43210", status: "ACTIVE", monthlyFee: 1400 },
};

const allocationTwo = {
    id: "allocation-2",
    branchId: BRANCH_ID,
    studentId: "student-nisha",
    seatId: "seat-b2",
    shiftId: "shift-evening",
    multiShiftId: null,
    startDate: "2026-07-15T00:00:00.000Z",
    endDate: null,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: NOW,
    seat: { id: "seat-b2", label: "B2" },
    shift: { id: "shift-evening", name: "Evening", startTime: "14:00", endTime: "21:00", isReserved: false },
    multiShift: null,
    student: { id: "student-nisha", name: "Nisha Verma", phone: "+91 98111 22334", status: "ACTIVE", monthlyFee: 1500 },
};

const students = [
    {
        id: "student-aarav",
        branchId: BRANCH_ID,
        name: "Aarav Mehta",
        phone: "+91 98765 43210",
        status: "ACTIVE",
        monthlyFee: 1400,
        joinedAt: "2026-08-03T00:00:00.000Z",
        feeLinkedShiftId: "shift-morning",
        feeLinkedMultiShiftId: null,
        createdAt: "2026-08-03T00:00:00.000Z",
        updatedAt: NOW,
        seatAllocations: [allocationOne],
    },
    {
        id: "student-nisha",
        branchId: BRANCH_ID,
        name: "Nisha Verma",
        phone: "+91 98111 22334",
        status: "ACTIVE",
        monthlyFee: 1500,
        joinedAt: "2026-07-15T00:00:00.000Z",
        feeLinkedShiftId: "shift-evening",
        feeLinkedMultiShiftId: null,
        createdAt: "2026-07-15T00:00:00.000Z",
        updatedAt: NOW,
        seatAllocations: [allocationTwo],
    },
    {
        id: "student-meera",
        branchId: BRANCH_ID,
        name: "Meera Singh",
        phone: "+91 99999 00112",
        status: "ACTIVE",
        monthlyFee: 1400,
        joinedAt: "2026-09-18T00:00:00.000Z",
        feeLinkedShiftId: null,
        feeLinkedMultiShiftId: null,
        createdAt: "2026-09-18T00:00:00.000Z",
        updatedAt: NOW,
        seatAllocations: [],
    },
    {
        id: "student-ravi",
        branchId: BRANCH_ID,
        name: "Ravi Kumar",
        phone: "+91 97777 66554",
        status: "INACTIVE",
        monthlyFee: 1200,
        joinedAt: "2026-02-12T00:00:00.000Z",
        feeLinkedShiftId: null,
        feeLinkedMultiShiftId: null,
        createdAt: "2026-02-12T00:00:00.000Z",
        updatedAt: NOW,
        seatAllocations: [],
    },
];

const payments = [
    {
        id: "payment-july",
        branchId: BRANCH_ID,
        studentId: "student-aarav",
        type: "MONTHLY",
        status: "DUE",
        amount: 1400,
        collectedAmount: 400,
        waivedAmount: 0,
        ledgerBacked: true,
        periodStart: "2026-07-01T00:00:00.000Z",
        periodEnd: "2026-07-31T00:00:00.000Z",
        dueDate: "2026-07-05T00:00:00.000Z",
        paidAt: null,
        method: null,
        referenceId: null,
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: NOW,
        student: { id: "student-aarav", name: "Aarav Mehta", phone: "+91 98765 43210", joinedAt: "2026-08-03T00:00:00.000Z" },
    },
    {
        id: "payment-august",
        branchId: BRANCH_ID,
        studentId: "student-aarav",
        type: "MONTHLY",
        status: "DUE",
        amount: 1400,
        collectedAmount: 0,
        waivedAmount: 0,
        ledgerBacked: true,
        periodStart: "2026-08-01T00:00:00.000Z",
        periodEnd: "2026-08-31T00:00:00.000Z",
        dueDate: "2026-08-05T00:00:00.000Z",
        paidAt: null,
        method: null,
        referenceId: null,
        createdAt: "2026-08-01T00:00:00.000Z",
        updatedAt: NOW,
        student: { id: "student-aarav", name: "Aarav Mehta", phone: "+91 98765 43210", joinedAt: "2026-08-03T00:00:00.000Z" },
    },
    {
        id: "payment-nisha-paid",
        branchId: BRANCH_ID,
        studentId: "student-nisha",
        type: "MONTHLY",
        status: "PAID",
        amount: 1500,
        collectedAmount: 1500,
        waivedAmount: 0,
        ledgerBacked: true,
        periodStart: "2026-09-01T00:00:00.000Z",
        periodEnd: "2026-09-30T00:00:00.000Z",
        dueDate: "2026-09-05T00:00:00.000Z",
        paidAt: "2026-09-04T08:00:00.000Z",
        method: "UPI",
        referenceId: "SYNTHETIC-UPI-42",
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-04T08:00:00.000Z",
        student: { id: "student-nisha", name: "Nisha Verma", phone: "+91 98111 22334", joinedAt: "2026-07-15T00:00:00.000Z" },
    },
];

const seats = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4"].map((label) => ({
    id: `seat-${label.toLowerCase()}`,
    branchId: BRANCH_ID,
    label,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: NOW,
    seatAllocations: label === "A1" ? [allocationOne] : label === "B2" ? [allocationTwo] : [],
}));

type CollectionInput = {
    studentId: string;
    paymentIds: string[];
    amount: number;
    method: string;
    reference: string;
    note: string;
    idempotencyKey: string;
};

type CollectionView = {
    id: string;
    receiptNumber: string;
    amount: number;
    collectedAt: string;
    method: string;
    reference: string | null;
    voidedAt: null;
    voidReason: null;
    snapshot: {
        version: 1;
        branchName: string;
        organizationName: string;
        address: string;
        contactPhone: string;
        studentName: string;
        studentId: string;
        recordedBy: string;
        recordedById: string;
        collectedAt: string;
        amount: number;
        method: string;
        reference: string;
        note: string;
        remainingBalance: number;
        allocations: Array<{
            paymentId: string;
            type: string;
            periodStart: string;
            periodEnd: string;
            amount: number;
            remaining: number;
        }>;
    };
};
const collectionsByKey = new Map<string, CollectionView>();
const collectionsById = new Map<string, CollectionView>();
const uncertainKeys = new Set<string>();

function buildCollection(input: CollectionInput): CollectionView {
    let remainingAmount = input.amount;
    const allocations = payments
        .filter((payment) => input.paymentIds.includes(payment.id))
        .map((payment) => {
            const outstanding = Math.max(payment.amount - payment.collectedAmount - payment.waivedAmount, 0);
            const applied = Math.min(outstanding, remainingAmount);
            remainingAmount -= applied;
            return {
                paymentId: payment.id,
                type: payment.type,
                periodStart: payment.periodStart,
                periodEnd: payment.periodEnd,
                amount: applied,
                remaining: outstanding - applied,
            };
        })
        .filter((allocation) => allocation.amount > 0);
    const id: string = `collection-${collectionsByKey.size + 1}`;

    return {
        id,
        receiptNumber: `LL-PILOT-${String(collectionsByKey.size + 1).padStart(4, "0")}`,
        amount: input.amount,
        collectedAt: NOW,
        method: input.method,
        reference: input.reference || null,
        voidedAt: null,
        voidReason: null,
        snapshot: {
            version: 1 as const,
            branchName: "Shanti Study Library",
            organizationName: "Shanti Learning Spaces",
            address: "Vijay Nagar, Indore, Madhya Pradesh",
            contactPhone: "+91 70000 12345",
            studentName: "Aarav Mehta",
            studentId: input.studentId,
            recordedBy: "Ananya Sharma",
            recordedById: "pilot-owner",
            collectedAt: NOW,
            amount: input.amount,
            method: input.method,
            reference: input.reference,
            note: input.note,
            remainingBalance: allocations.reduce((sum, allocation) => sum + allocation.remaining, 0),
            allocations,
        },
    };
}

function contextFor(request: PilotRequest) {
    try {
        const referer = new URL(request.headers.referer ?? "http://127.0.0.1/branch/pilot");
        return {
            language: referer.searchParams.get("lang") ?? "en",
            role: referer.searchParams.get("role") ?? "owner",
            state: referer.searchParams.get("state") ?? "populated",
            scenario: referer.searchParams.get("scenario") ?? "normal",
        };
    } catch {
        return { language: "en", role: "owner", state: "populated", scenario: "normal" };
    }
}

function billingExperience(readOnly: boolean) {
    return {
        organizationId: "org-pilot",
        accessMode: readOnly ? "READ_ONLY" : "FULL",
        effectivePlan: "STANDARD",
        selectedPostTrialPlan: "STANDARD",
        providerStatus: "active",
        customerState: readOnly ? "ACCESS_ENDED" : "STANDARD_ACTIVE",
        customerMessage: readOnly
            ? "Synthetic review mode: changes are unavailable."
            : "Standard workspace is active.",
        trialEndsAt: null,
        trialDaysRemaining: null,
        paidThrough: "2026-10-01T00:00:00.000Z",
        confirmedQuantity: 1,
        projectedQuantity: 1,
        currentUnitAmount: 499,
        currentMonthlyTotal: 499,
        projectedUnitAmount: 499,
        projectedMonthlyTotal: 499,
        authorizationStatus: "AUTHORIZED",
        planFeeDueToday: 0,
        nextChargeAt: "2026-10-01T00:00:00.000Z",
        paymentAction: "NONE",
        entitlements: ["STAFF_MANAGEMENT", "ADVANCED_ANALYTICS", "AI_ACCESS", "WHATSAPP_AUTOMATION"],
        latestOperation: null,
        activeOperation: null,
        scheduledChanges: [],
        branch: { id: BRANCH_ID, name: "Shanti Study Library", billingStatus: "ACTIVE" },
        viewer: { isOwner: true, canManageBilling: true },
        hasActiveOperation: false,
    };
}

function branchAccess(role: string) {
    const restricted = role === "restricted";
    const readOnly = role === "readonly";
    const permissions = {
        manage_org: !restricted,
        manage_branch: !restricted,
        students: true,
        seat_allocation: !restricted,
        view_payments: !restricted,
        generate_payments: !restricted,
        mark_payment_paid: !restricted,
        waive_payments: !restricted,
        analytics: !restricted,
        view_whatsapp: !restricted,
        send_whatsapp: !restricted,
        manage_whatsapp: !restricted,
        receive_whatsapp_reports: !restricted,
        staff_management: !restricted,
    };

    return {
        branchId: BRANCH_ID,
        branchName: "Shanti Study Library",
        organizationId: "org-pilot",
        isOwner: !restricted,
        role: restricted ? "STAFF" : "OWNER",
        staffId: restricted ? "staff-pilot" : undefined,
        permissions,
        effectivePlan: restricted ? "BASIC" : "PRO",
        entitlements: restricted ? [] : ["STAFF_MANAGEMENT", "ADVANCED_ANALYTICS", "AI_ACCESS", "WHATSAPP_AUTOMATION"],
        billingExperience: billingExperience(readOnly),
    };
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
    response.statusCode = status;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify(payload));
}

async function readJson(request: IncomingMessage) {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (chunks.length === 0) return {};
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function paged<T>(items: T[]) {
    return { items, nextCursor: null, total: items.length };
}

function seatMap(shiftId: string) {
    const shift = shifts.find((item) => item.id === shiftId) ?? shifts[0];
    const cells = seats.map((seat) => {
        const allocation = seat.seatAllocations.find((item) => item.shiftId === shift.id);
        return {
            seatId: seat.id,
            label: seat.label,
            occupied: Boolean(allocation),
            occupiedBy: allocation?.student?.name ?? null,
        };
    });
    return {
        shiftId: shift.id,
        shiftName: shift.name,
        isReserved: false,
        totalSeats: cells.length,
        occupiedCount: cells.filter((seat) => seat.occupied).length,
        availableCount: cells.filter((seat) => !seat.occupied).length,
        seats: cells,
    };
}

function multiShiftMap() {
    const cells = seats.map((seat) => {
        const allocation = seat.seatAllocations[0];
        return {
            seatId: seat.id,
            label: seat.label,
            status: allocation ? "BLOCKED" : "AVAILABLE",
            occupied: Boolean(allocation),
            occupiedBy: allocation?.student?.name ?? null,
        };
    });
    return {
        multiShiftId: "multi-full-day",
        name: "Full day",
        totalSeats: cells.length,
        assignedCount: 0,
        blockedCount: cells.filter((seat) => seat.status === "BLOCKED").length,
        occupiedCount: cells.filter((seat) => seat.occupied).length,
        availableCount: cells.filter((seat) => seat.status === "AVAILABLE").length,
        seats: cells,
    };
}

function overdueRows() {
    return payments
        .filter((payment) => payment.status === "DUE")
        .map((payment) => ({
            paymentId: payment.id,
            studentId: payment.studentId,
            studentName: payment.student.name,
            phone: payment.student.phone,
            dueDate: payment.dueDate,
            amount: payment.amount - payment.collectedAmount - payment.waivedAmount,
            daysOverdue: 48,
        }));
}

export function createSyntheticApiMiddleware() {
    return async function syntheticApi(request: PilotRequest, response: ServerResponse, next: Next) {
        const requestUrl = request.originalUrl ?? request.url ?? "/";
        if (!requestUrl.startsWith("/api/")) {
            next();
            return;
        }

        const url = new URL(requestUrl, "http://127.0.0.1");
        const path = url.pathname;
        const method = request.method ?? "GET";
        const context = contextFor(request);
        const empty = context.state === "empty";
        const fail = context.state === "error";

        try {
            if (path === "/api/users/me") {
                if (method === "PATCH") {
                    sendJson(response, 200, await readJson(request));
                    return;
                }
                sendJson(response, 200, {
                    name: "Ananya Sharma",
                    interfaceLanguage: ["en", "hi", "hinglish"].includes(context.language) ? context.language : "en",
                    documentLanguage: "en",
                    densityPreference: "comfortable",
                    locale: "en-IN",
                    timezone: "Asia/Kolkata",
                    dateFormat: "dd MMM yyyy",
                });
                return;
            }

            if (path === "/api/workspaces") {
                sendJson(response, 200, {
                    organizations: [{
                        id: "org-pilot",
                        name: "Shanti Learning Spaces",
                        role: "OWNER",
                        href: "/org/org-pilot",
                        branches: [{
                            id: BRANCH_ID,
                            name: "Shanti Study Library",
                            organizationId: "org-pilot",
                            organizationName: "Shanti Learning Spaces",
                            role: "OWNER",
                            permissions: branchAccess(context.role).permissions,
                            entitlements: branchAccess(context.role).entitlements,
                            href: `/branch/${BRANCH_ID}`,
                        }],
                    }],
                    staffBranches: [],
                    defaultHref: `/branch/${BRANCH_ID}`,
                });
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/access`) {
                sendJson(response, 200, branchAccess(context.role));
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/search`) {
                sendJson(response, 200, [{
                    id: "students",
                    label: "Students",
                    results: students.slice(0, 3).map((student) => ({
                        id: student.id,
                        type: "student",
                        title: student.name,
                        subtitle: student.phone,
                        href: `/branch/${BRANCH_ID}/students?studentId=${student.id}&status=${student.status}`,
                    })),
                }]);
                return;
            }

            if (path === `/api/analytics/branch/${BRANCH_ID}/snapshot`) {
                if (fail) {
                    sendJson(response, 503, { error: "Synthetic analytics failure" });
                    return;
                }
                sendJson(response, 200, empty ? {
                    totalStudents: 0, activeStudents: 0, assignedSeats: 0, totalSeats: 0,
                    occupancyRate: 0, monthlyRevenue: 0, dueAmount: 0, paidAmount: 0, collectionRate: 0,
                    seatDetails: { totalUsedSlots: 0, totalShiftCapacity: 0, shifts: [] },
                } : {
                    period: "month",
                    totalStudents: 4,
                    activeStudents: 3,
                    assignedSeats: 2,
                    totalSeats: 16,
                    occupancyRate: 13,
                    monthlyRevenue: 4300,
                    dueAmount: 2400,
                    paidAmount: 1900,
                    collectionRate: 44,
                    seatDetails: {
                        totalUsedSlots: 2,
                        totalShiftCapacity: 16,
                        shifts: [
                            { shiftId: "shift-morning", shiftName: "Morning", used: 1, capacity: 8, occupancyPercent: 13 },
                            { shiftId: "shift-evening", shiftName: "Evening", used: 1, capacity: 8, occupancyPercent: 13 },
                        ],
                    },
                });
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/students`) {
                if (method === "PATCH") {
                    const body = await readJson(request);
                    const original = students.find((student) => student.id === body.id) ?? students[0];
                    sendJson(response, 200, { ...original, ...body, updatedAt: NOW });
                    return;
                }
                if (method === "POST") {
                    const body = await readJson(request);
                    sendJson(response, 201, { ...students[2], ...body, id: "student-new", createdAt: NOW, updatedAt: NOW });
                    return;
                }
                if (fail) {
                    sendJson(response, 503, { error: "Synthetic student list failure" });
                    return;
                }
                const status = url.searchParams.get("status");
                const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
                const result = empty ? [] : students.filter((student) => (
                    (!status || student.status === status)
                    && (!query || `${student.name} ${student.phone}`.toLowerCase().includes(query))
                ));
                sendJson(response, 200, paged(result));
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/shifts`) {
                sendJson(response, fail ? 503 : 200, fail ? { error: "Synthetic shift failure" } : empty ? [] : shifts);
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/multi-shifts`) {
                sendJson(response, fail ? 503 : 200, fail ? { error: "Synthetic multi-shift failure" } : empty ? [] : multiShifts);
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/shifts/capacity`) {
                const capacities: Array<{
                    type: "PRIMARY" | "MULTISHIFT";
                    shiftId: string;
                    multiShiftId?: string;
                    name: string;
                    startTime: string;
                    endTime: string;
                    price: number;
                    isReserved: boolean;
                    totalSeats: number;
                    used: number;
                    available: number;
                    occupancyPercent: number;
                    isFull: boolean;
                    studentAlreadyAllocated: boolean;
                    componentShiftIds?: string[];
                    componentShiftNames?: string[];
                }> = shifts.map((shift) => {
                    const used = seats.filter((seat) => seat.seatAllocations.some((allocation) => allocation.shiftId === shift.id)).length;
                    return {
                        type: "PRIMARY",
                        shiftId: shift.id,
                        name: shift.name,
                        startTime: shift.startTime,
                        endTime: shift.endTime,
                        price: shift.price,
                        isReserved: false,
                        totalSeats: seats.length,
                        used,
                        available: seats.length - used,
                        occupancyPercent: Math.round((used / seats.length) * 100),
                        isFull: false,
                        studentAlreadyAllocated: false,
                    };
                });
                capacities.push({
                    type: "MULTISHIFT",
                    shiftId: "multi-full-day",
                    multiShiftId: "multi-full-day",
                    name: "Full day",
                    startTime: "06:00",
                    endTime: "21:00",
                    price: 2500,
                    isReserved: false,
                    totalSeats: seats.length,
                    used: 2,
                    available: seats.length - 2,
                    occupancyPercent: 25,
                    isFull: false,
                    studentAlreadyAllocated: false,
                    componentShiftIds: ["shift-morning", "shift-evening"],
                    componentShiftNames: ["Morning", "Evening"],
                });
                sendJson(response, 200, empty ? [] : capacities);
                return;
            }

            if (path.match(new RegExp(`^/api/branches/${BRANCH_ID}/shifts/[^/]+/seat-map$`))) {
                const shiftId = path.split("/").at(-2) ?? "shift-morning";
                sendJson(response, 200, empty ? { ...seatMap(shiftId), totalSeats: 0, occupiedCount: 0, availableCount: 0, seats: [] } : seatMap(shiftId));
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/multi-shifts/multi-full-day/seat-map`) {
                sendJson(response, 200, multiShiftMap());
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/seats`) {
                if (method === "POST") {
                    const body = await readJson(request);
                    sendJson(response, 201, { ...seats[2], ...body, id: "seat-new" });
                    return;
                }
                if (fail) {
                    sendJson(response, 503, { error: "Synthetic seat map failure" });
                    return;
                }
                sendJson(response, 200, paged(empty ? [] : seats));
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/seat-allocations`) {
                if (method === "POST") {
                    const body = await readJson(request);
                    sendJson(response, 201, { id: "allocation-new", branchId: BRANCH_ID, ...body, startDate: NOW, endDate: null });
                    return;
                }
                sendJson(response, 200, paged(empty ? [] : [allocationOne, allocationTwo]));
                return;
            }

            if (path.match(/^\/api\/seat-allocations\/[^/]+$/) && method === "PUT") {
                sendJson(response, 200, { success: true });
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/payments/overdue`) {
                if (fail) {
                    sendJson(response, 503, { error: "Synthetic overdue list failure" });
                    return;
                }
                sendJson(response, 200, paged(empty ? [] : overdueRows()));
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/payments`) {
                if (fail) {
                    sendJson(response, 503, { error: "Synthetic payment list failure" });
                    return;
                }
                const status = url.searchParams.get("status");
                const rows = empty ? [] : payments.filter((payment) => !status || payment.status === status);
                sendJson(response, 200, paged(rows));
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/staff-invites`) {
                sendJson(response, 200, []);
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/collections` && method === "GET") {
                if (url.searchParams.get("dues") !== "true") {
                    sendJson(response, 200, paged(Array.from(collectionsById.values())));
                    return;
                }
                sendJson(response, 200, {
                    student: { id: "student-aarav", name: "Aarav Mehta" },
                    payments: empty ? [] : payments.filter((payment) => payment.studentId === "student-aarav" && payment.status === "DUE"),
                });
                return;
            }

            if (path === `/api/branches/${BRANCH_ID}/collections` && method === "POST") {
                const input = await readJson(request) as unknown as CollectionInput;
                let collection = collectionsByKey.get(input.idempotencyKey);
                if (!collection) {
                    collection = buildCollection(input);
                    collectionsByKey.set(input.idempotencyKey, collection);
                    collectionsById.set(collection.id, collection);
                }
                if (context.scenario === "uncertain" && !uncertainKeys.has(input.idempotencyKey)) {
                    uncertainKeys.add(input.idempotencyKey);
                    sendJson(response, 503, { error: "The result is uncertain. Retry the same collection to retrieve its receipt." });
                    return;
                }
                sendJson(response, 200, collection);
                return;
            }

            const collectionMatch = path.match(new RegExp(`^/api/branches/${BRANCH_ID}/collections/([^/]+)$`));
            if (collectionMatch && method === "GET") {
                const collection = collectionsById.get(collectionMatch[1]);
                sendJson(response, collection ? 200 : 404, collection ?? { error: "Collection not found" });
                return;
            }

            sendJson(response, 404, { error: `Synthetic pilot has no adapter for ${method} ${path}` });
        } catch (error) {
            sendJson(response, 500, { error: error instanceof Error ? error.message : "Synthetic adapter failed" });
        }
    };
}
