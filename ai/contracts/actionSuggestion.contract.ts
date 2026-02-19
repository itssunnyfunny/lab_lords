export type AIActionType =
  | "FOLLOW_UP_OVERDUE_PAYMENTS"
  | "REVIEW_SEAT_UTILIZATION"
  | "REENGAGE_INACTIVE_STUDENTS"
  | "ADD_FIRST_STUDENT"

export interface AIActionSuggestion {
  action: AIActionType
  reason: string
  meta?: {
    relatedEntityIds?: string[]
  }
}
