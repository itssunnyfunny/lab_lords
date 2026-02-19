// ai/contracts/branch.contract.ts

export interface AIBranchSnapshot {
  branchId: string
  branchName: string

  seats: {
    total: number
    occupied: number
    available: number
    utilizationPercent: number
  }

  students: {
    total: number
    active: number
    inactive: number
  }

  payments: {
    dueCount: number
    paidCount: number
    overdueCount: number
    overduePayments: Array<{
      studentId: string
      amount: number
      dueDate: Date
    }>
  }

  asOf: Date
}
