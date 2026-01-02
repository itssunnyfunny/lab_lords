export type AIRiskType =
  | "PAYMENT_OVERDUE"
  | "LOW_SEAT_UTILIZATION"
  | "HIGH_INACTIVE_STUDENTS"

export type AIRiskSeverity = "LOW" | "MEDIUM" | "HIGH"

export interface AIRisk {
  type: AIRiskType
  severity: AIRiskSeverity
  explanation: string
}
