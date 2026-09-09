/** Manual copy text only. This is never an input to provider delivery. */
export function paymentReminderDraft(input: {
    studentName: string; amount: string; date: string; language: "EN" | "HI"; expected?: boolean;
}) {
    const { studentName, amount, date, language, expected } = input;
    if (expected) return language === "HI"
        ? `नमस्ते ${studentName}, आपकी अगली फीस ${date} को अनुमानित ${amount} है। कृपया विवरण की पुष्टि करें। धन्यवाद।`
        : `Hi ${studentName}, your next fee on ${date} is expected to be ${amount}. Please confirm the details. Thank you.`;
    return language === "HI"
        ? `नमस्ते ${studentName}, ${date} को देय ${amount} भुगतान अभी बाकी है। कृपया इसे जल्द जमा करें। धन्यवाद।`
        : `Hi ${studentName}, your ${amount} payment due on ${date} is pending. Please clear it at the earliest. Thank you.`;
}
export const MANUAL_REMINDER_COPIED = "Copied for manual sharing. Delivery is not confirmed.";
