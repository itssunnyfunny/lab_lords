/** Shared facts for pricing, feature comparisons and FAQs. */
export const publicBranchBillingCopy = {
  intro: "Choose Basic, Standard or Pro for each branch.",
  branches: "You can choose a different plan for each branch. Each branch has its own records, subscription and invoices.",
  trialEnd: "The owner chooses and authorizes the paid plan for each branch in Account Billing. When the trial ends, a branch without confirmed access becomes read-only. Choosing a plan at signup does not charge you.",
  cancel: "The owner can cancel renewal for one branch in Account Billing. Check the effective date before confirming. Other branches keep their subscriptions. Cancelling renewal does not automatically refund the current period.",
  basic: "Basic includes student records, seat allocation, fees, partial payments and receipts. Staff can use the tools their branch permissions allow.",
  charges: "Your monthly total is the sum of your branch plans. Each branch has its own charge and invoice, and renewal dates can differ.",
  mixedLine: "One {plan} branch at ₹{amount} per month",
  mixedTotal: "Together these plans cost ₹{total} per month before tax. Each branch is billed separately.",
  eligibleReports: "Compare seat usage and fee collections across active Standard and Pro branches.",
  example: "Switch branches to see each location’s students, seats and fee records. One branch can use Basic for its front desk while another uses Pro for its team.",
} as const;
