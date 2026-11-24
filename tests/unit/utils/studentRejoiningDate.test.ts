import { describe, expect, it } from "vitest";
import {
    firstStudentRejoiningDueDate,
    parseStudentRejoiningDate,
    studentRejoiningAnniversary,
    validateStudentRejoiningDate,
} from "@/utils/studentRejoiningDate";

describe("Student rejoining calendar", () => {
    it.each([
        ["2026-05-15", "2026-06-15", "2026-07-15"],
        ["2026-01-31", "2026-02-28", "2026-03-31"],
        ["2028-01-31", "2028-02-29", "2028-03-31"],
        ["2026-12-31", "2027-01-31", "2027-02-28"],
    ])("computes the dates following %s from the same anchor", (rejoinedOn, first, second) => {
        expect(firstStudentRejoiningDueDate(rejoinedOn)).toBe(first);
        expect(studentRejoiningAnniversary(parseStudentRejoiningDate(rejoinedOn)!, 2)).toEqual(new Date(`${second}T00:00:00Z`));
    });

    it("validates option dates against the branch's India calendar day", () => {
        expect(validateStudentRejoiningDate("2026-11-23", new Date("2026-11-22T18:29:59Z"))).toBeNull();
        expect(validateStudentRejoiningDate("2026-11-23", new Date("2026-11-22T18:30:00Z"))).toBe("2026-11-23");
        expect(parseStudentRejoiningDate("2026-02-29")).toBeNull();
        expect(parseStudentRejoiningDate("2028-02-29")).toEqual(new Date("2028-02-29T00:00:00Z"));
    });
});
