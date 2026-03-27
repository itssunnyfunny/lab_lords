export type CreateStudentDto = {
    name: string;
    phone?: string;
    /** Array of shift IDs to assign at enrollment time. Requires seatId. */
    shiftIds?: string[];
    /** @deprecated use shiftIds instead. Kept for backward-compat; converted to shiftIds=[shiftId] internally. */
    shiftId?: string;
    seatId?: string;
    monthlyFee?: number;
    admissionFee?: number;
};
