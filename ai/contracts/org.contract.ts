// ai/contracts/org.contract.ts

export interface AIOrgSnapshot {
  orgId: string
  orgName: string

  branches: {
    branchId: string
    branchName: string
    seatUtilizationPercent: number
    overduePayments: number
  }[]

  totals: {
    totalBranches: number
    totalStudents: number
    totalSeats: number
    totalOverduePayments: number
  }

  asOf: Date
}
