import type {
    ImportColumnMapping,
    ImportIssue,
    ImportNormalizedRow,
    ParsedImportRow,
} from "@/importing/contracts/import-session.contract";
import type { PaymentMethod, PaymentStatus } from "@/app/generated/prisma/enums";

export function compactImportText(value: unknown) {
    return value == null ? "" : String(value).trim().replace(/\s+/g, " ");
}

export function normalizeNameKey(value: unknown) {
    return compactImportText(value).toLocaleLowerCase("en-IN");
}

export function normalizePhoneKey(value: unknown) {
    return compactImportText(value).replace(/\D/g, "");
}

export function parseImportMoney(value: unknown): number | undefined {
    const text = compactImportText(value).replace(/[₹,\s]/g, "");
    if (!text) return undefined;
    const normalized = text.match(/^\d+(\.\d+)?$/) ? Number(text) : Number.NaN;
    if (!Number.isFinite(normalized)) return undefined;
    return Math.round(normalized);
}

export function parseImportDate(value: unknown): string | undefined {
    const text = compactImportText(value);
    if (!text) return undefined;
    const direct = new Date(text);
    if (!Number.isNaN(direct.getTime())) return direct.toISOString();

    const parts = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (!parts) return undefined;
    const day = Number(parts[1]);
    const month = Number(parts[2]) - 1;
    const year = Number(parts[3].length === 2 ? `20${parts[3]}` : parts[3]);
    const parsed = new Date(Date.UTC(year, month, day));
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
}

export function parsePaymentMethod(value: unknown): PaymentMethod | undefined {
    const text = compactImportText(value).toLowerCase();
    if (!text) return undefined;
    if (text.includes("upi") || text.includes("gpay") || text.includes("phonepe") || text.includes("paytm")) return "UPI";
    if (text.includes("bank") || text.includes("neft") || text.includes("imps") || text.includes("transfer")) return "BANK_TRANSFER";
    if (text.includes("cash")) return "CASH";
    return undefined;
}

export function classifyPaymentStatus(
    value: unknown,
    mapping?: { paidValues: string[]; unpaidValues: string[]; waivedValues: string[]; confirmed?: boolean }
): PaymentStatus | "UNCLEAR" | undefined {
    const raw = compactImportText(value);
    if (!raw) return undefined;
    const text = raw.toLowerCase();
    const contains = (values: string[]) => values.map(v => v.toLowerCase()).includes(text);

    if (mapping?.confirmed) {
        if (contains(mapping.paidValues)) return "PAID";
        if (contains(mapping.unpaidValues)) return "DUE";
        if (contains(mapping.waivedValues)) return "WAIVED";
        return "UNCLEAR";
    }

    if (["paid", "yes", "y", "done", "clear", "cleared", "received"].includes(text)) return "PAID";
    if (["unpaid", "no", "n", "due", "pending", "not paid"].includes(text)) return "DUE";
    if (["waived", "free", "skip"].includes(text)) return "WAIVED";
    return "UNCLEAR";
}

function setNestedValue(row: ImportNormalizedRow, target: string, value: string, issues: ImportIssue[]) {
    if (!value) return;

    switch (target) {
        case "student.name":
            row.student = { ...row.student, name: value };
            break;
        case "student.phone":
            row.student = { ...row.student, phone: value };
            break;
        case "student.joinedAt":
            row.student = { ...row.student, joinedAt: parseImportDate(value) ?? value };
            break;
        case "student.monthlyFee": {
            const amount = parseImportMoney(value);
            if (amount !== undefined) row.student = { ...row.student, monthlyFee: amount, feeSource: "UPLOADED" };
            else issues.push({ code: "INVALID_MONTHLY_FEE", field: target, message: "Monthly fee is not a whole number.", severity: "error" });
            break;
        }
        case "student.status": {
            const status = value.toLowerCase().includes("inactive") ? "INACTIVE" : "ACTIVE";
            row.student = { ...row.student, status };
            break;
        }
        case "student.feeSource":
            row.student = { ...row.student, feeSource: "UPLOADED" };
            break;
        case "student.feeLinkedShiftName":
            row.student = { ...row.student, feeLinkedShiftName: value };
            break;
        case "student.feeLinkedMultiShiftName":
            row.student = { ...row.student, feeLinkedMultiShiftName: value };
            break;
        case "seat.label":
        case "allocation.seatLabel":
            row.seat = { ...row.seat, label: value };
            row.allocation = { ...row.allocation, seatLabel: value };
            break;
        case "shift.name":
        case "allocation.shiftName":
            row.shift = { ...row.shift, name: value };
            row.allocation = { ...row.allocation, shiftName: value };
            break;
        case "shift.startTime":
            row.shift = { ...row.shift, startTime: value };
            break;
        case "shift.endTime":
            row.shift = { ...row.shift, endTime: value };
            break;
        case "multiShift.name":
        case "allocation.multiShiftName":
            row.multiShift = { ...row.multiShift, name: value };
            row.allocation = { ...row.allocation, multiShiftName: value };
            break;
        case "multiShift.componentShiftNames":
            row.multiShift = {
                ...row.multiShift,
                componentShiftNames: value.split(/[,+|]/).map(part => compactImportText(part)).filter(Boolean),
            };
            break;
        case "allocation.startDate":
            row.allocation = { ...row.allocation, startDate: parseImportDate(value) ?? value };
            break;
        case "payment.amount": {
            const amount = parseImportMoney(value);
            if (amount !== undefined) row.payment = { ...row.payment, amount };
            else issues.push({ code: "INVALID_PAYMENT_AMOUNT", field: target, message: "Payment amount is not a whole number.", severity: "error" });
            break;
        }
        case "payment.method":
            row.payment = { ...row.payment, method: parsePaymentMethod(value) };
            break;
        case "payment.referenceId":
            row.payment = { ...row.payment, referenceId: value };
            break;
        case "payment.period":
            row.payment = { ...row.payment, period: value };
            break;
        default:
            break;
    }
}

export function normalizeImportRow(
    rawData: ParsedImportRow,
    mappings: ImportColumnMapping[],
    paymentMapping?: { paidValues: string[]; unpaidValues: string[]; waivedValues: string[]; confirmed?: boolean }
) {
    const normalized: ImportNormalizedRow = {};
    const mappedData: Record<string, string> = {};
    const issues: ImportIssue[] = [];
    let confidenceTotal = 0;
    let confidenceCount = 0;

    for (const mapping of mappings) {
        if (mapping.targetField === "ignore") continue;
        const value = compactImportText(rawData[mapping.sourceColumn]);
        if (!value) continue;
        mappedData[mapping.targetField] = value;
        confidenceTotal += mapping.confidence;
        confidenceCount++;

        if (mapping.targetField === "payment.status") {
            normalized.payment = {
                ...normalized.payment,
                rawStatus: value,
                status: classifyPaymentStatus(value, paymentMapping),
            };
            continue;
        }

        setNestedValue(normalized, mapping.targetField, value, issues);
    }

    return {
        mappedData,
        normalizedData: normalized,
        issues,
        confidence: confidenceCount > 0 ? Math.round(confidenceTotal / confidenceCount) : null,
    };
}
