import { StaffRole } from "./enums";

export type StaffAction =
    | "manage_org"
    | "manage_branch"
    | "students"
    | "seat_allocation"
    | "generate_payments"
    | "mark_payment_paid"
    | "analytics"
    | "staff_management";

export type EntityPermissionMatrix = Record<StaffAction, StaffRole[]>;
