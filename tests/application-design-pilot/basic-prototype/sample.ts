// Deliberately synthetic UI state. This is not a fee ledger or billing policy.
export type Student = { id: string; name: string; phone: string; monthlyFee: number; seat: number | null; shiftId: string | null };
export type Shift = { id: string; name: string; start: string; end: string };
export type Receipt = { id: string; studentId: string; amount: number; method: string; date: string };
export type Library = { name: string; seatCount: number; monthlyFee: number };
export const sampleLibrary: Library = { name: "Saraswati Library", seatCount: 30, monthlyFee: 1200 };
export const sampleShifts: Shift[] = [
    { id: "morning", name: "Morning", start: "08:00", end: "12:00" },
    { id: "afternoon", name: "Afternoon", start: "12:00", end: "16:00" },
    { id: "evening", name: "Evening", start: "16:00", end: "22:00" },
];
export const sampleStudents: Student[] = [
    ["Aarav Mehta", "9876543210", 1, "morning"], ["Priya Sharma", "9876543211", 2, "morning"],
    ["Rohan Verma", "9876543212", 4, "morning"], ["Ananya Singh", "9876543213", 5, "morning"],
    ["Karan Patel", "9876543214", 8, "morning"], ["Meera Shah", "9876543215", 11, "morning"],
    ["Neha Gupta", "9876543216", 12, "morning"], ["Aditya Joshi", "9876543217", 14, "morning"],
    ["Isha Jain", "9876543218", 15, "morning"], ["Kabir Soni", "9876543219", 19, "morning"],
    ["Nisha Verma", "9876543220", 3, "afternoon"], ["Arjun Rao", "9876543221", 6, "afternoon"],
    ["Sana Khan", "9876543222", 2, "evening"], ["Dev Kapoor", "9876543223", 7, "evening"],
].map(([name, phone, seat, shiftId], index) => ({ id: `sample-${index + 1}`, name: String(name), phone: String(phone), monthlyFee: 1200, seat: Number(seat), shiftId: String(shiftId) }));
export const sampleReceipts: Receipt[] = sampleStudents.slice(0, 9).map((student, index) => ({
    id: `SAMPLE-${String(index + 1).padStart(3, "0")}`, studentId: student.id,
    amount: index === 1 ? 600 : 1200, method: index % 2 ? "UPI" : "Cash", date: "2026-10-05",
}));
export const money = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
export const seatName = (seat: number) => String(seat).padStart(2, "0");
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("");
export const time = (value: string) => { const [hour, minute] = value.split(":").map(Number); return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`; };
export const shiftTime = (shift: Shift) => `${time(shift.start)} – ${time(shift.end)}`;
