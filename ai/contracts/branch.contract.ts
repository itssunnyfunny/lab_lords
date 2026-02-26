// ai/contracts/branch.contract.ts

export interface AIBranchSnapshot {
  branchId: string
  branchName: string

  seats: {
    // Shift-slot based totals (e.g. 30 seats × 3 shifts = 90 total capacity)
    total: number         // totalShiftCapacity
    occupied: number      // totalUsedSlots
    available: number
    utilizationPercent: number
    shiftBreakdown: Array<{
      shiftName: string
      used: number
      capacity: number
      occupancyPercent: number
    }>
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
