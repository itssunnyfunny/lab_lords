// ai/contracts/payment.contract.ts

export interface AIPaymentSnapshot {
  branchId: string

  summary: {
    totalDue: number
    totalPaid: number
    totalOverdue: number
  }

  overdueBuckets: {
    days: number
    count: number
  }[]

  asOf: Date
}
