export {
    ImportCommitStatus,
    ImportQuestionStatus,
    ImportRowStatus,
    ImportSessionStatus,
    ImportSourceType,
    PaymentMethod,
    PaymentStatus,
    PaymentType,
    StaffPermissionAction,
    StaffRole,
    StudentStatus,
} from "@/app/generated/prisma/enums";

export type DueResolution = "PAID" | "WAIVED" | "KEEP";
