export const MOCK_STUDENTS = [
    { id: "1", name: "Srinivas Suren", course: "UPSC", joined: "10 Oct", fee: 350, status: "Active", attendance: "92%", lastPayment: "Paid" },
    { id: "2", name: "Arin Walston", course: "JEE Mains", joined: "12 Oct", fee: 3000, status: "Active", attendance: "78%", lastPayment: "Paid" },
    { id: "3", name: "Christian Bar", course: "CA Inter", joined: "14 Oct", fee: 7000, status: "Active", attendance: "45%", lastPayment: "Due" },
    { id: "4", name: "Serina Walston", course: "NEET", joined: "15 Oct", fee: 3300, status: "Active", attendance: "12%", lastPayment: "Paid" },
    { id: "5", name: "Riya Patel", course: "UPSC", joined: "18 Oct", fee: 350, status: "Inactive", attendance: "0%", lastPayment: "Due" },
    { id: "6", name: "John Doe", course: "CAT", joined: "20 Oct", fee: 5000, status: "Active", attendance: "88%", lastPayment: "Paid" },
];

export const MOCK_PAYMENTS = [
    { id: "101", student: "Srinivas Suren", amount: 350, date: "24 Oct, 2023", status: "Paid", method: "UPI" },
    { id: "102", student: "Christian Bar", amount: 7000, date: "23 Oct, 2023", status: "Failed", method: "Card" },
    { id: "103", student: "Arin Walston", amount: 3000, date: "22 Oct, 2023", status: "Paid", method: "Cash" },
    { id: "104", student: "Serina Walston", amount: 3300, date: "21 Oct, 2023", status: "Paid", method: "UPI" },
    { id: "105", student: "Riya Patel", amount: 350, date: "20 Oct, 2023", status: "Pending", method: "-" },
];

export const MOCK_SEATS = [
    { id: "A1", status: "Occupied", student: "Srinivas Suren", type: "Standard" },
    { id: "A2", status: "Occupied", student: "Arin Walston", type: "Standard" },
    { id: "A3", status: "Available", student: null, type: "Standard" },
    { id: "B1", status: "Occupied", student: "Christian Bar", type: "Premium" },
    { id: "B2", status: "Maintenance", student: null, type: "Premium" },
    { id: "C1", status: "Available", student: null, type: "Standard" },
    { id: "C2", status: "Occupied", student: "Serina Walston", type: "Standard" },
];

export const MOCK_BRANCH_ANALYTICS = [
    { id: "1", branch: "Ashok Vihar", students: 120, revenue: 45000, expenses: 12000, util: "85%" },
    { id: "2", branch: "Rohini Sec 7", students: 85, revenue: 32000, expenses: 8000, util: "62%" },
    { id: "3", branch: "Pitampura", students: 210, revenue: 95000, expenses: 25000, util: "92%" },
];

export const MOCK_NOTIFICATIONS = [
    { id: 1, title: "Payment Failed", message: "Christian Bar's payment of $7000 failed.", time: "2m ago", type: "danger" },
    { id: 2, title: "New Admission", message: "John Doe joined Batch A.", time: "1h ago", type: "success" },
    { id: 3, title: "Seat Maintenance", message: "Seat B2 marked for repair.", time: "3h ago", type: "warning" },
];
