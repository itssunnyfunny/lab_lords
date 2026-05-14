import type { ImportIssue, ImportNormalizedRow } from "@/importing/contracts/import-session.contract";
import { normalizeNameKey, normalizePhoneKey } from "./row-normalizer";

export type ExistingStudentLookup = {
    id: string;
    name: string;
    phone: string | null;
    joinedAt: Date;
    seatAllocations?: {
        seat: { label: string };
        shift: { name: string };
    }[];
};

export function detectDuplicateImportRows(rows: Array<{ id: string; rowNumber: number; normalizedData: ImportNormalizedRow }>) {
    const issuesByRow = new Map<string, ImportIssue[]>();
    const phones = new Map<string, string>();
    const nameJoined = new Map<string, string>();
    const nameSeatShift = new Map<string, string>();

    const add = (rowId: string, issue: ImportIssue) => {
        issuesByRow.set(rowId, [...(issuesByRow.get(rowId) ?? []), issue]);
    };

    for (const row of rows) {
        const student = row.normalizedData.student;
        const allocation = row.normalizedData.allocation;
        const phoneKey = normalizePhoneKey(student?.phone);
        const nameKey = normalizeNameKey(student?.name);
        const joinedKey = student?.joinedAt ? new Date(student.joinedAt).toISOString().slice(0, 10) : "";

        if (phoneKey) {
            const previous = phones.get(phoneKey);
            if (previous) add(row.id, { code: "DUPLICATE_PHONE_IN_FILE", field: "student.phone", message: "Another row in this file has the same phone.", severity: "warning" });
            else phones.set(phoneKey, row.id);
        }

        if (nameKey && joinedKey) {
            const key = `${nameKey}:${joinedKey}`;
            const previous = nameJoined.get(key);
            if (previous) add(row.id, { code: "DUPLICATE_NAME_JOINED_IN_FILE", field: "student.name", message: "Another row has the same name and joined date.", severity: "warning" });
            else nameJoined.set(key, row.id);
        }

        if (nameKey && allocation?.seatLabel && (allocation.shiftName || allocation.multiShiftName)) {
            const key = `${nameKey}:${normalizeNameKey(allocation.seatLabel)}:${normalizeNameKey(allocation.shiftName ?? allocation.multiShiftName)}`;
            const previous = nameSeatShift.get(key);
            if (previous) add(row.id, { code: "DUPLICATE_NAME_SEAT_SHIFT_IN_FILE", field: "allocation.seatLabel", message: "Another row has the same student, seat, and shift.", severity: "warning" });
            else nameSeatShift.set(key, row.id);
        }
    }

    return issuesByRow;
}

export function detectExistingStudentDuplicates(normalized: ImportNormalizedRow, existingStudents: ExistingStudentLookup[]) {
    const issues: ImportIssue[] = [];
    const phoneKey = normalizePhoneKey(normalized.student?.phone);
    const nameKey = normalizeNameKey(normalized.student?.name);
    const joinedKey = normalized.student?.joinedAt ? new Date(normalized.student.joinedAt).toISOString().slice(0, 10) : "";
    const seatKey = normalizeNameKey(normalized.allocation?.seatLabel);
    const shiftKey = normalizeNameKey(normalized.allocation?.shiftName ?? normalized.allocation?.multiShiftName);

    if (phoneKey && existingStudents.some(student => normalizePhoneKey(student.phone) === phoneKey)) {
        issues.push({ code: "DUPLICATE_EXISTING_PHONE", field: "student.phone", message: "An existing student in this branch has the same phone.", severity: "warning" });
    }

    if (nameKey && joinedKey && existingStudents.some(student =>
        normalizeNameKey(student.name) === nameKey &&
        student.joinedAt.toISOString().slice(0, 10) === joinedKey
    )) {
        issues.push({ code: "DUPLICATE_EXISTING_NAME_JOINED", field: "student.name", message: "An existing student has the same name and joined date.", severity: "warning" });
    }

    if (nameKey && seatKey && shiftKey && existingStudents.some(student =>
        normalizeNameKey(student.name) === nameKey &&
        (student.seatAllocations ?? []).some(allocation =>
            normalizeNameKey(allocation.seat.label) === seatKey &&
            normalizeNameKey(allocation.shift.name) === shiftKey
        )
    )) {
        issues.push({ code: "DUPLICATE_EXISTING_NAME_SEAT_SHIFT", field: "allocation.seatLabel", message: "An existing student has this name, seat, and shift.", severity: "warning" });
    }

    return issues;
}
