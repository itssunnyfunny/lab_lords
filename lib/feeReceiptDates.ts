/** Receipt dates describe the recorded India billing calendar, independently
 * of the browser's timezone. Screen, copied text and PDF share this owner. */
export function receiptPeriodDate(value: string) {
    return new Date(value).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
}

export function receiptCollectedAt(value: string) {
    return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST";
}
