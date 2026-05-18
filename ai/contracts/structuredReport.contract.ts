import { AIActionSuggestion } from "./actionSuggestion.contract"

export interface AIStructuredBranchReport {
    healthScore: 'LOW_RISK' | 'MODERATE_RISK' | 'CRITICAL_RISK' | 'HEALTHY'
    executiveSummary?: string
    priorityFocus?: string
    keyFindings?: string[]
    financialAnalysis: {
        observation: string
        riskLevel: 'LOW' | 'MODERATE' | 'CRITICAL'
    }
    utilizationAnalysis: {
        observation: string
        riskLevel: 'LOW' | 'MODERATE' | 'CRITICAL'
    }
    studentActivityAnalysis: {
        observation: string
        riskLevel: 'LOW' | 'MODERATE' | 'CRITICAL'
    }
    suggestedActions: AIActionSuggestion[]
    generatedAt: string // ISO Date string
}

export interface AIBranchReportSnapshot {
    branchName: string
    asOf: string
    seats: {
        total: number
        occupied: number
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
        overdueAmount: number
    }
}
