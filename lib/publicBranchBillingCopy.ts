/** Used only for public pages advertising the active new-workspace enrollment model. */
export const publicBranchBillingCopy = {
  intro: "New workspaces can choose Basic, Standard or Pro for each branch.",
  branches: "New workspaces can choose a different plan for each branch. Each branch keeps its own records, subscription and invoices. Existing organizations can check their current billing arrangement in Account Billing.",
  trialEnd: "In a new workspace, the owner chooses and authorizes the paid plan for each branch in Account Billing. When the trial ends, a branch without confirmed access becomes read-only. Choosing a plan at signup does not charge you.",
  cancel: "With separate branch subscriptions, the owner can cancel renewal for one branch in Account Billing. Check the effective date before confirming. Other branches keep their subscriptions. Cancelling renewal does not automatically refund the current period.",
  basic: "Basic includes student records, seat allocation, fees, partial payments and receipts. Staff can use the tools their branch permissions allow.",
  charges: "In new workspaces, the monthly total is the sum of the branch plans. Each branch has its own charge and invoice, and renewal dates can differ. Existing organizations can check their billing arrangement in Account Billing.",
  mixedLine: "One {plan} branch at ₹{amount} per month",
  mixedTotal: "Together these plans cost ₹{total} per month before tax. Each branch is billed separately.",
  eligibleReports: "In workspaces with separate branch plans, compare seat usage and fee collections across active Standard and Pro branches.",
  example: "Switch branches to see each location’s students, seats and fee records. In a new workspace, one branch can use Basic for its front desk while another uses Pro for its team.",
} as const;
