import { StaffRole } from "./enums";

export type StaffAction =
    | "manage_org"
    | "manage_branch"
    | "students"
    | "seat_allocation"
    | "view_payments"
    | "generate_payments"
    | "mark_payment_paid"
    | "waive_payments"
    | "analytics"
    | "staff_management";

export type EntityPermissionMatrix = Record<StaffAction, StaffRole[]>;
