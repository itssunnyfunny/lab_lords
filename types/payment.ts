export interface BillingPeriod {
    periodStart: Date;
    periodEnd: Date;
    dueDate: Date;
}

export interface PaymentGenerationResult {
    generatedCount: number;
    skippedCount: number;
    totalStudents: number;
}
