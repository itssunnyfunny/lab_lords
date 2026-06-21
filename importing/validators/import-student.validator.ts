import { validatePhone } from "@/lib/formValidation";
import type { ImportNormalizedRow } from "@/importing/contracts/import-session.contract";
import { emptyValidatorResult, type ImportValidatorResult } from "./import-required-fields.validator";

export function validateImportStudent(
    normalized: ImportNormalizedRow,
    context: {
        branchDefaultFee: number;
        shiftsByName: Map<string, { price: number }>;
        multiShiftsByName: Map<string, { price: number }>;
    }
): ImportValidatorResult {
    const result = emptyValidatorResult();
    const student = normalized.student;

    if (!student) return result;

    if (!student.phone) {
        result.warnings.push({
            code: "MISSING_PHONE",
            field: "student.phone",
            message: "Phone is missing. The student can still be imported, but duplicate checks and follow-up will be weaker.",
            severity: "warning",
        });
    } else {
        const phoneResult = validatePhone(student.phone);
        if (!phoneResult.ok) {
            result.warnings.push({
                code: "INVALID_PHONE",
                field: "student.phone",
                message: phoneResult.error,
                severity: "warning",
            });
        } else {
            student.phone = phoneResult.value;
        }
    }

    if (!student.joinedAt) {
        student.joinedAt = new Date().toISOString();
        student.joinedAtSource = "TODAY_DEFAULT";
        result.warnings.push({
            code: "DEFAULT_JOINED_AT",
            field: "student.joinedAt",
            message: "Joined date is missing, so today's date will be used unless changed.",
            severity: "warning",
        });
    }

    if (student.feeLinkedShiftName) {
        const shift = context.shiftsByName.get(student.feeLinkedShiftName.toLowerCase());
        if (shift) {
            student.monthlyFee = shift.price;
            student.feeSource = "SHIFT_PRICE";
        }
    }

    if (student.feeLinkedMultiShiftName) {
        const multiShift = context.multiShiftsByName.get(student.feeLinkedMultiShiftName.toLowerCase());
        if (multiShift) {
            student.monthlyFee = multiShift.price;
            student.feeSource = "MULTI_SHIFT_PRICE";
        }
    }

    if (student.monthlyFee === undefined) {
        student.monthlyFee = context.branchDefaultFee;
        student.feeSource = "BRANCH_DEFAULT";
        result.warnings.push({
            code: "DEFAULT_MONTHLY_FEE",
            field: "student.monthlyFee",
            message: "Monthly fee is missing, so the branch default fee will be used.",
            severity: "warning",
        });
    }

    return result;
}
