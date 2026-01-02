export type AIActionType =
  | "FOLLOW_UP_OVERDUE_PAYMENTS"
  | "REVIEW_SEAT_UTILIZATION"
  | "REENGAGE_INACTIVE_STUDENTS"

export interface AIActionSuggestion {
  action: AIActionType
  reason: string
}
