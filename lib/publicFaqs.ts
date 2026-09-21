import copy from "@/lib/marketingCopy.json";
import { publicBillingPlans } from "@/lib/billingPlans";

export type PublicFaq = { id: string; question: string; answer: string; href: string; link: string };
// The established homepage answers remain the single source for these five facts.
const homeLinks = [
  ["audience", "/about", "About Lab Lords"],
  ["trial", "/pricing#trial", "How the trial works"],
  ["imports", "/features#imports", "Student imports"],
  ["branches", "/pricing#branch-billing", "Understand branch billing"],
  ["staff", "/features#staff", "Staff access"],
] as const;
const homeAnswers: PublicFaq[] = copy.home.questions.items.map((item, index) => ({
  ...item, id: homeLinks[index][0], href: homeLinks[index][1], link: homeLinks[index][2],
}));

export const publicFaqs: PublicFaq[] = [
  ...homeAnswers,
  { id: "books", question: "Is this for a reading room or a book-lending library?", answer: "Lab Lords is for managing people, study seats, shifts and fee records. It does not provide book cataloguing, book loans or a full academic administration system.", href: "/software/library-management", link: "Reading-room library software" },
  { id: "shifts", question: "Can I set my own shifts?", answer: "Yes. Set the shift names, timings and fees used by your library. Assign seats for the appropriate period; overlapping seat and student assignments are checked before they are saved.", href: "/features#seats-shifts", link: "Seats and shifts" },
  { id: "fees", question: "Does recording a student fee collect money online?", answer: "No. A student fee record describes money your library charges or receives. Recording a payment is separate from collecting money through a payment gateway. Your Lab Lords subscription pays for the software; it is not a student fee.", href: "/software/student-fee-management", link: "Student fee records" },
  { id: "partial-payments", question: "Can I record part of a fee payment?", answer: "Yes. Choose the student's dues, enter the amount received and check the remaining balance. You can record the rest later. Choosing UPI as the payment method records how you received the money; it does not transfer or verify a bank payment.", href: "/features#fees", link: "Full and partial payments" },
  { id: "receipts", question: "Where can I find a receipt again?", answer: "Open the student's collection history to find a recorded payment and download or print its receipt again. Sharing depends on your device and does not confirm delivery. Historical imported payments do not get a new receipt.", href: "/features#fees", link: "Receipts and collection history" },
  { id: "follow-ups", question: "Can I keep track of fee follow-ups?", answer: "Yes. See today's fees, upcoming fee dates and pending amounts. Look ahead 3 or 7 days, and save a note, contact outcome and the next date to follow up. Expected fees are separate from recorded dues. A follow-up date does not move the fee date or renew a student's seat.", href: "/software/fee-reminder", link: "Fee follow-ups" },
  { id: "attendance", question: "Can staff use a student's QR code for attendance?", answer: "Yes. Staff scan the QR code, check the student's displayed name and confirm check-in or check-out. This is supervised scanning, not unattended self-check-in or identity verification. You can also find a student and record attendance manually. Attendance does not change fees or seat assignments.", href: "/features#attendance", link: "Attendance and staff-assisted QR" },
  { id: "ai", question: "Does AI make changes or send messages for me?", answer: "Standard includes AI reports and message drafting. Review the output against your records and check a draft before using it. A generated draft is not proof that a message was sent or that a student has paid.", href: "/features#ai-assistance", link: "AI assistance" },
  { id: "plans", question: "What do the plans cost?", answer: publicBillingPlans().map(plan => `${plan.shortName} is ${new Intl.NumberFormat("en-IN", { style: "currency", currency: plan.currency, maximumFractionDigits: 0 }).format(plan.amount ?? 0)} per billable branch per month`).join(". ") + ". Taxes, if applicable, are shown at checkout. Compare the included features before choosing a plan.", href: "/pricing#comparison", link: "Compare plans" },
  { id: "trial-end", question: "What happens when my trial ends?", answer: "Choose and authorize a paid subscription in organization billing settings to continue paid access. Selecting a plan during signup does not itself charge you. Without an active subscription after the trial, the workspace becomes read-only.", href: "/pricing#trial", link: "Trial and subscription steps" },
  { id: "cancel", question: "Can I cancel renewal?", answer: "The owner can cancel future renewal from organization billing settings. Cancellation takes effect at the end of the current paid period; paid access continues until then. Cancellation does not automatically refund the current period.", href: "/refund-policy", link: "Cancellation and Refund Policy" },
  { id: "refund", question: "How do I ask about an incorrect charge?", answer: "Contact support with your account email, organization, payment ID, charge date and amount, and a description of the issue. The refund policy sets out eligibility and the 7-calendar-day request window. Never include card details, passwords or authentication codes.", href: "/refund-policy", link: "Refund eligibility and request details" },
  { id: "prepare", question: "What should I prepare before setting up?", answer: "Have your library name, owner contact, first branch name and city ready. Prepare your seat count and numbering, shift timings and fees. If you have existing students, keep a spreadsheet ready to review in the import workflow after setup.", href: "/how-it-works", link: "Follow the setup walkthrough" },
  { id: "import-review", question: "Can I check an import before adding records?", answer: "Yes. The guided import workflow lets you map and review the source information, resolve flagged issues, and confirm before records are added. Check the result afterward for rows that need attention. Keep your original file for reference.", href: "/features#imports", link: "Reviewing imported information" },
  { id: "devices", question: "Can I use Lab Lords on a phone or laptop?", answer: "The website and workspace use responsive browser layouts. Open Lab Lords in your browser on a phone or laptop with an internet connection. Do not rely on offline access for saving records.", href: "/how-it-works", link: "Getting started" },
  { id: "language", question: "Can I check whether my preferred language is available?", answer: "Yes. Use the interface in English, Hindi or Hinglish, and choose receipt and report language separately. These choices are personal. Saved names, notes and existing AI-written text keep their own language. Provider-hosted screens and WhatsApp message language are separate; the public website is in English.", href: "/features#languages", link: "Language choices" },
  { id: "support", question: "How do I get help?", answer: "Use Contact for questions about fit, plans or getting started. Existing users can use Support for account, product and billing issues. Email actions open a draft in your email app for you to review and send.", href: "/support", link: "Get support" },
  { id: "privacy", question: "Where can I read about data handling?", answer: "The Privacy Policy explains what information Lab Lords handles and how to contact us about privacy requests. When asking for help, share only what is needed and remove student details from screenshots.", href: "/privacy", link: "Read the Privacy Policy" },
];

export const faqGroups = [
  { id: "general", title: "Who Lab Lords is for", ids: ["audience", "books"] },
  { id: "features", title: "Features and daily work", ids: ["shifts", "fees", "partial-payments", "receipts", "follow-ups", "attendance", "ai"] },
  { id: "plans", title: "Plans and trial", ids: ["plans", "trial", "trial-end", "cancel", "refund"] },
  { id: "setup", title: "Setup and imports", ids: ["prepare", "imports", "import-review"] },
  { id: "team", title: "Branches and staff", ids: ["branches", "staff"] },
  { id: "help", title: "Devices, language and support", ids: ["devices", "language", "support", "privacy"] },
];
export const homeFaqIds = homeAnswers.map(faq => faq.id);
export const featureFaqIds = ["shifts", "import-review", "fees", "partial-payments", "receipts", "follow-ups", "attendance", "language", "staff", "ai"];
export const pricingFaqIds = ["trial", "trial-end", "branches", "cancel", "refund"];

export function getPublicFaqs(ids: readonly string[]): PublicFaq[] {
  return ids.map(id => {
    const answer = publicFaqs.find(faq => faq.id === id);
    if (!answer) throw new Error(`Unknown public FAQ: ${id}`);
    return answer;
  });
}
