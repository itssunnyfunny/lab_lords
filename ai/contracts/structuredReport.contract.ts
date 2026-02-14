export interface AIStructuredBranchReport {
    healthScore: 'LOW_RISK' | 'MODERATE_RISK' | 'CRITICAL_RISK' | 'HEALTHY'
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
    suggestedActions: string[]
    generatedAt: string // ISO Date string
}
