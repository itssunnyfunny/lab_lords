import { publicBillingPlans } from "@/lib/billingPlans";
import type { PublicFaq } from "@/lib/publicFaqs";
import type { PublicTranslator } from "./translate";

export function publicFaqAnswer(faq: PublicFaq, t: PublicTranslator): string {
  if (faq.id !== "plans") return t(faq.answer);
  return publicBillingPlans().map(plan => t("{plan} is {price} per billable branch per month", {
    plan: plan.shortName,
    price: new Intl.NumberFormat("en-IN", { style: "currency", currency: plan.currency, maximumFractionDigits: 0 }).format(plan.amount ?? 0),
  })).join(". ") + ". " + t("Taxes, if applicable, are shown at checkout. Compare the included features before choosing a plan.");
}
