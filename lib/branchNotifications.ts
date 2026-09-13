import type { PagedResult, StaffAction } from "@/types";
import { translate, type MessageKey, type MessageParams } from "@/lib/i18n";
import type { InterfaceLanguage } from "@/lib/i18n/language";

export type BranchNotificationSeverity = "critical" | "warning" | "info";

export type BranchNotificationKind =
    | "overdue_payments"
    | "students_without_seats"
    | "shift_full"
    | "shift_near_full"
    | "active_invites";

export type BranchNotification = {
    id: string;
    readKey: string;
    kind: BranchNotificationKind;
    severity: BranchNotificationSeverity;
    title: string;
    message: string;
    href: string;
    count?: number;
    sort: number;
};

export type BranchNotificationAccess = {
    permissions: Partial<Record<StaffAction, boolean>>;
};

export type OverduePaymentNotificationRecord = {
    paymentId?: string | null;
    studentId?: string | null;
    studentName?: string | null;
    amount?: number | null;
    dueDate?: Date | string | null;
};

export type OverduePaymentNotificationData = PagedResult<OverduePaymentNotificationRecord>;

export type StudentNotificationRecord = {
    id: string;
    status?: string | null;
};

export type AllocationNotificationRecord = {
    id: string;
    studentId?: string | null;
    endDate?: Date | string | null;
};

export type ShiftCapacityNotificationRecord = {
    name?: string | null;
    type?: "PRIMARY" | "MULTISHIFT" | string | null;
    used?: number | null;
    available?: number | null;
    occupancyPercent?: number | null;
    isFull?: boolean | null;
};

export type StaffInviteNotificationRecord = {
    id: string;
    role?: string | null;
    expiresAt?: Date | string | null;
};

export type BuildBranchNotificationsInput = {
    branchId: string;
    access: BranchNotificationAccess | null | undefined;
    overdue?: OverduePaymentNotificationData | null;
    students?: StudentNotificationRecord[];
    allocations?: AllocationNotificationRecord[];
    shiftCapacities?: ShiftCapacityNotificationRecord[];
    staffInvites?: StaffInviteNotificationRecord[];
};

function can(access: BranchNotificationAccess | null | undefined, permission: StaffAction) {
    return access?.permissions[permission] ?? false;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
    return count === 1 ? singular : pluralForm;
}

function href(branchId: string, path: string) {
    return `/branch/${branchId}/${path}`;
}

type OverduePaymentRecord = OverduePaymentNotificationData["items"][number];

function paymentHref(branchId: string, payment: OverduePaymentRecord | undefined) {
    if (!payment?.paymentId) return href(branchId, "overdue");
    const params = new URLSearchParams({ paymentId: payment.paymentId });
    if (payment.studentId) params.set("studentId", payment.studentId);
    params.set("status", "DUE");
    return `${href(branchId, "payments")}?${params.toString()}`;
}

function formatMoney(value: number | null | undefined) {
    if (typeof value !== "number") return "INR 0";

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(value);
}

function formatDate(value: Date | string | null | undefined) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

function dateKey(value: Date | string | null | undefined) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString();
}

function compactKeyParts(parts: Array<string | number | null | undefined>) {
    return parts.map(part => String(part ?? "")).join(":");
}

function activeStudentsWithoutSeats(
    students: StudentNotificationRecord[] = [],
    allocations: AllocationNotificationRecord[] = []
) {
    const seatedStudentIds = new Set(
        allocations
            .filter(allocation => !allocation.endDate && allocation.studentId)
            .map(allocation => allocation.studentId)
    );

    return students.filter(student => student.status === "ACTIVE" && !seatedStudentIds.has(student.id));
}

function primaryShiftCapacities(shiftCapacities: ShiftCapacityNotificationRecord[] = []) {
    return shiftCapacities.filter(shift => shift.type !== "MULTISHIFT");
}

function nextExpiringInvite(invites: StaffInviteNotificationRecord[] = []) {
    return invites
        .map(invite => ({
            ...invite,
            expiresAtDate: invite.expiresAt ? new Date(invite.expiresAt) : null,
        }))
        .filter(invite => invite.expiresAtDate && !Number.isNaN(invite.expiresAtDate.getTime()))
        .sort((a, b) => a.expiresAtDate!.getTime() - b.expiresAtDate!.getTime())[0];
}

export function buildBranchNotifications(input: BuildBranchNotificationsInput, language: InterfaceLanguage = "en"): BranchNotification[] {
    const t = (key: MessageKey, params?: MessageParams) => translate(language, key, params);
    const notifications: BranchNotification[] = [];

    if (can(input.access, "view_payments") && input.overdue && input.overdue.total > 0) {
        const firstPayment = input.overdue.items[0];
        const overdueKey = input.overdue.items
            .map(payment => compactKeyParts([
                payment.paymentId,
                payment.studentName,
                payment.amount,
                dateKey(payment.dueDate),
            ]))
            .sort()
            .join("|");
        const dueDate = formatDate(firstPayment?.dueDate);
        const details = firstPayment?.studentName
            ? `Oldest: ${firstPayment.studentName}, ${formatMoney(firstPayment.amount)}${dueDate ? ` due ${dueDate}` : ""}.`
            : t("Review overdue students and follow up.");

        notifications.push({
            id: "overdue-payments",
            readKey: compactKeyParts(["overdue_payments", input.overdue.total, overdueKey]),
            kind: "overdue_payments",
            severity: input.overdue.total >= 5 ? "critical" : "warning",
            title: language === "en" ? `${input.overdue.total} overdue ${plural(input.overdue.total, "payment")}` : t("{count} overdue payments", { count: input.overdue.total }),
            message: language === "en" || !firstPayment?.studentName ? details : dueDate ? t("Oldest: {name}, {amount} due {date}.", { name: firstPayment.studentName, amount: formatMoney(firstPayment.amount), date: dueDate }) : t("Oldest: {name}, {amount}.", { name: firstPayment.studentName, amount: formatMoney(firstPayment.amount) }),
            href: paymentHref(input.branchId, firstPayment),
            count: input.overdue.total,
            sort: 100,
        });
    }

    if (can(input.access, "students") && can(input.access, "seat_allocation")) {
        const unseated = activeStudentsWithoutSeats(input.students, input.allocations);
        if (unseated.length > 0) {
            notifications.push({
                id: "students-without-seats",
                readKey: compactKeyParts([
                    "students_without_seats",
                    unseated.length,
                    unseated.map(student => student.id).sort().join("|"),
                ]),
                kind: "students_without_seats",
                severity: unseated.length >= 5 ? "warning" : "info",
                title: language !== "en" ? t("{count} active students without seats", { count: unseated.length }) : unseated.length === 1
                    ? "1 active student without a seat"
                    : `${unseated.length} active students without seats`,
                message: t("Assign seats to complete active student onboarding."),
                href: `${href(input.branchId, "allocations")}?studentId=${encodeURIComponent(unseated[0].id)}`,
                count: unseated.length,
                sort: 80,
            });
        }
    }

    if (can(input.access, "seat_allocation")) {
        const shifts = primaryShiftCapacities(input.shiftCapacities);
        const fullShifts = shifts.filter(shift => shift.isFull || (shift.occupancyPercent ?? 0) >= 100);
        const nearFullShifts = shifts.filter(shift => {
            const occupancy = shift.occupancyPercent ?? 0;
            return !shift.isFull && occupancy >= 90 && occupancy < 100;
        });

        if (fullShifts.length > 0) {
            const first = fullShifts[0];
            notifications.push({
                id: "full-shifts",
                readKey: compactKeyParts([
                    "shift_full",
                    fullShifts.map(shift => compactKeyParts([
                        shift.name,
                        shift.used,
                        shift.available,
                        Math.round(shift.occupancyPercent ?? 0),
                    ])).sort().join("|"),
                ]),
                kind: "shift_full",
                severity: "warning",
                title: language === "en" ? `${fullShifts.length} ${plural(fullShifts.length, "shift")} at full capacity` : t("{count} shifts at full capacity", { count: fullShifts.length }),
                message: t("{name} has {used} used and {available} available seats.", { name: first.name ?? t("A shift"), used: first.used ?? 0, available: first.available ?? 0 }),
                href: href(input.branchId, "seats"),
                count: fullShifts.length,
                sort: 70,
            });
        } else if (nearFullShifts.length > 0) {
            const first = nearFullShifts[0];
            notifications.push({
                id: "near-full-shifts",
                readKey: compactKeyParts([
                    "shift_near_full",
                    nearFullShifts.map(shift => compactKeyParts([
                        shift.name,
                        shift.used,
                        shift.available,
                        Math.round(shift.occupancyPercent ?? 0),
                    ])).sort().join("|"),
                ]),
                kind: "shift_near_full",
                severity: "info",
                title: language === "en" ? `${nearFullShifts.length} ${plural(nearFullShifts.length, "shift")} near capacity` : t("{count} shifts near capacity", { count: nearFullShifts.length }),
                message: t("{name} is at {percent}% occupancy.", { name: first.name ?? t("A shift"), percent: Math.round(first.occupancyPercent ?? 0) }),
                href: href(input.branchId, "seats"),
                count: nearFullShifts.length,
                sort: 60,
            });
        }
    }

    if (can(input.access, "staff_management") && (input.staffInvites?.length ?? 0) > 0) {
        const inviteCount = input.staffInvites?.length ?? 0;
        const nextInvite = nextExpiringInvite(input.staffInvites);
        const expires = formatDate(nextInvite?.expiresAt ?? null);

        notifications.push({
            id: "active-staff-invites",
            readKey: compactKeyParts([
                "active_invites",
                inviteCount,
                input.staffInvites
                    ?.map(invite => compactKeyParts([invite.id, invite.role, dateKey(invite.expiresAt)]))
                    .sort()
                    .join("|"),
            ]),
            kind: "active_invites",
            severity: "info",
            title: language === "en" ? `${inviteCount} active staff ${plural(inviteCount, "invite")}` : t("{count} active staff invites", { count: inviteCount }),
            message: expires ? t("Next invite expires {date}.", { date: expires }) : t("Review active invite links."),
            href: href(input.branchId, "staff"),
            count: inviteCount,
            sort: 40,
        });
    }

    return notifications.sort((a, b) => b.sort - a.sort || a.title.localeCompare(b.title));
}
