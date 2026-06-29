import type { ImportBranchContext, ImportNormalizedRow } from "@/importing/contracts/import-session.contract";

export type ImportRowDraft = {
    studentName: string;
    phone: string;
    joinedAt: string;
    fee: string;
    seat: string;
    shift: string;
    multiShift: string;
    paymentAmount: string;
    paymentStatus: string;
    paymentMethod: string;
    referenceId: string;
};

type DraftRow = {
    normalizedData: ImportNormalizedRow | null;
};

type PaymentStatusDraft = NonNullable<ImportNormalizedRow["payment"]>["status"];
type PaymentMethodDraft = NonNullable<ImportNormalizedRow["payment"]>["method"];

function cloneNormalized(data: ImportNormalizedRow | null): ImportNormalizedRow {
    return data ? JSON.parse(JSON.stringify(data)) as ImportNormalizedRow : {};
}

function dateToIso(value: string) {
    if (!value.trim()) return undefined;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export function numberFromDraft(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

export function importNameKey(value: string | undefined | null) {
    return (value ?? "").trim().toLocaleLowerCase("en-IN");
}

export function findShift(context: ImportBranchContext | undefined, name: string) {
    const target = importNameKey(name);
    return context?.shifts.find(shift => importNameKey(shift.name) === target);
}

export function findMultiShift(context: ImportBranchContext | undefined, name: string) {
    const target = importNameKey(name);
    return context?.multiShifts.find(multiShift => importNameKey(multiShift.name) === target);
}

export function feeLooksAutoFilled(draft: ImportRowDraft, context: ImportBranchContext | undefined) {
    const fee = numberFromDraft(draft.fee);
    if (fee === undefined) return true;
    const shift = findShift(context, draft.shift);
    const multiShift = findMultiShift(context, draft.multiShift);
    return fee === shift?.price || fee === multiShift?.price || fee === (context?.defaultFee ?? 0);
}

export function feeFromSelection(draft: ImportRowDraft, context: ImportBranchContext | undefined) {
    const multiShift = findMultiShift(context, draft.multiShift);
    if (multiShift) return multiShift.price.toString();
    const shift = findShift(context, draft.shift);
    if (shift) return shift.price.toString();
    return draft.fee;
}

export function importRowFieldValue(row: DraftRow, field: keyof ImportRowDraft) {
    const data = row.normalizedData;
    if (!data) return "";
    if (field === "studentName") return data.student?.name ?? "";
    if (field === "phone") return data.student?.phone ?? "";
    if (field === "joinedAt") return data.student?.joinedAt?.slice(0, 10) ?? "";
    if (field === "fee") return data.student?.monthlyFee?.toString() ?? "";
    if (field === "seat") return data.allocation?.seatLabel ?? data.seat?.label ?? "";
    if (field === "shift") return data.allocation?.shiftName ?? data.shift?.name ?? "";
    if (field === "multiShift") return data.allocation?.multiShiftName ?? data.multiShift?.name ?? "";
    if (field === "paymentAmount") return data.payment?.amount?.toString() ?? "";
    if (field === "paymentStatus") return data.payment?.status ?? data.payment?.rawStatus ?? "";
    if (field === "paymentMethod") return data.payment?.method ?? "";
    if (field === "referenceId") return data.payment?.referenceId ?? "";
    return "";
}

export function draftFromImportRow(row: DraftRow): ImportRowDraft {
    return {
        studentName: importRowFieldValue(row, "studentName"),
        phone: importRowFieldValue(row, "phone"),
        joinedAt: importRowFieldValue(row, "joinedAt"),
        fee: importRowFieldValue(row, "fee"),
        seat: importRowFieldValue(row, "seat"),
        shift: importRowFieldValue(row, "shift"),
        multiShift: importRowFieldValue(row, "multiShift"),
        paymentAmount: importRowFieldValue(row, "paymentAmount"),
        paymentStatus: importRowFieldValue(row, "paymentStatus"),
        paymentMethod: importRowFieldValue(row, "paymentMethod"),
        referenceId: importRowFieldValue(row, "referenceId"),
    };
}

function removeEmptyObject<T extends Record<string, unknown>>(value: T) {
    return Object.values(value).some(item => item !== undefined) ? value : undefined;
}

export function normalizedFromImportDraft(
    row: DraftRow,
    draft: ImportRowDraft,
    context?: ImportBranchContext
): ImportNormalizedRow {
    const next = cloneNormalized(row.normalizedData);
    const studentName = draft.studentName.trim();
    const phone = draft.phone.trim();
    const joinedAt = dateToIso(draft.joinedAt);
    const monthlyFee = numberFromDraft(draft.fee);
    const seat = draft.seat.trim();
    const shift = draft.shift.trim();
    const multiShift = draft.multiShift.trim();
    const paymentAmount = numberFromDraft(draft.paymentAmount);
    const paymentStatus = draft.paymentStatus.trim();
    const paymentMethod = draft.paymentMethod.trim();
    const referenceId = draft.referenceId.trim();
    const shiftContext = findShift(context, shift);
    const multiShiftContext = findMultiShift(context, multiShift);
    const feeSource =
        monthlyFee !== undefined && multiShiftContext && monthlyFee === multiShiftContext.price
            ? "MULTI_SHIFT_PRICE"
            : monthlyFee !== undefined && shiftContext && monthlyFee === shiftContext.price
                ? "SHIFT_PRICE"
                : monthlyFee !== undefined
                    ? "UPLOADED"
                    : undefined;

    const student = { ...(next.student ?? {}) };
    if (studentName) student.name = studentName;
    else delete student.name;
    if (phone) student.phone = phone;
    else delete student.phone;
    if (joinedAt) {
        student.joinedAt = joinedAt;
        student.joinedAtSource = "UPLOADED";
    } else {
        delete student.joinedAt;
        delete student.joinedAtSource;
    }
    if (monthlyFee !== undefined) {
        student.monthlyFee = monthlyFee;
        student.feeSource = feeSource;
        student.feeLinkedShiftName = feeSource === "SHIFT_PRICE" ? shiftContext?.name ?? shift : undefined;
        student.feeLinkedMultiShiftName = feeSource === "MULTI_SHIFT_PRICE" ? multiShiftContext?.name ?? multiShift : undefined;
    } else {
        delete student.monthlyFee;
        delete student.feeSource;
        delete student.feeLinkedShiftName;
        delete student.feeLinkedMultiShiftName;
    }
    const nextStudent = removeEmptyObject(student);
    if (nextStudent) next.student = nextStudent;
    else delete next.student;

    if (seat) next.seat = { ...(next.seat ?? {}), label: seat };
    else delete next.seat;

    const allocation = { ...(next.allocation ?? {}) };
    if (seat) allocation.seatLabel = seat;
    else delete allocation.seatLabel;

    if (multiShift) {
        allocation.multiShiftName = multiShift;
        delete allocation.shiftName;
        next.multiShift = {
            ...(next.multiShift ?? {}),
            name: multiShift,
            ...(multiShiftContext?.componentShiftNames.length ? { componentShiftNames: multiShiftContext.componentShiftNames } : {}),
        };
        delete next.shift;
    } else if (shift) {
        allocation.shiftName = shift;
        delete allocation.multiShiftName;
        next.shift = { ...(next.shift ?? {}), name: shift };
        delete next.multiShift;
    } else {
        delete allocation.shiftName;
        delete allocation.multiShiftName;
        delete next.shift;
        delete next.multiShift;
    }

    const nextAllocation = removeEmptyObject(allocation);
    if (nextAllocation) next.allocation = nextAllocation;
    else delete next.allocation;

    const payment = { ...(next.payment ?? {}) };
    if (paymentAmount !== undefined) payment.amount = paymentAmount;
    else delete payment.amount;
    if (paymentStatus) {
        payment.status = paymentStatus as PaymentStatusDraft;
        payment.rawStatus = paymentStatus;
    } else {
        delete payment.status;
        delete payment.rawStatus;
    }
    if (paymentMethod) payment.method = paymentMethod as PaymentMethodDraft;
    else delete payment.method;
    if (referenceId) payment.referenceId = referenceId;
    else delete payment.referenceId;

    const nextPayment = removeEmptyObject(payment);
    if (nextPayment) next.payment = nextPayment;
    else delete next.payment;

    return next;
}
