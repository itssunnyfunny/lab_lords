/** Student fees use whole INR rupees (Prisma Int), not provider subunits. */
export type FeeBalance = { amount: number; status?: string; collectedAmount?: number; waivedAmount?: number; ledgerBacked?: boolean };
export function remainingFee(payment: FeeBalance): number {
    if (payment.status && payment.status !== "DUE") return 0;
    return Math.max(0, payment.amount - (payment.collectedAmount ?? 0) - (payment.waivedAmount ?? 0));
}

export function allocateCollection<T extends FeeBalance & { id: string; dueDate: Date | string }>(payments: T[], amount: number) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 2147483647) throw new Error("Enter a positive whole-rupee amount");
    if (amount > payments.reduce((sum, p) => sum + remainingFee(p), 0)) throw new Error("Amount exceeds the selected outstanding balance");
    let left = amount;
    return [...payments].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() || a.id.localeCompare(b.id))
        .flatMap(payment => {
            const applied = Math.min(left, remainingFee(payment));
            left -= applied;
            return applied ? [{ payment, amount: applied, remaining: remainingFee(payment) - applied }] : [];
        });
}
