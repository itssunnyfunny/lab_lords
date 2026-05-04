
import { prisma } from "../lib/prisma";
import { SeatAllocationService } from "../services/seatAllocation.service";
import { StudentStatus } from "@prisma/client";

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

async function main() {
    console.log("🔍 STARTING ALLOCATION SAFETY AUDIT...");

    // SETUP
    const user = await prisma.user.create({
        data: { email: `audit-seat-${Date.now()}@test.com`, name: "Audit User" }
    });
    const org = await prisma.organization.create({
        data: { name: "Audit Org", ownerId: user.id }
    });
    const branch = await prisma.branch.create({
        data: { name: "Audit Branch", organizationId: org.id }
    });

    // Create Metadata
    const seat1 = await prisma.seat.create({ data: { branchId: branch.id, label: "S1" } });
    const shiftMorning = await prisma.shift.create({ data: { branchId: branch.id, name: "Morning", startTime: "08:00", endTime: "12:00" } });
    const shiftEvening = await prisma.shift.create({ data: { branchId: branch.id, name: "Evening", startTime: "16:00", endTime: "20:00" } });
    const shiftReserved = await prisma.shift.create({ data: { branchId: branch.id, name: "Full Day", isReserved: true } });

    const student1 = await prisma.student.create({ data: { branchId: branch.id, name: "Student 1", status: StudentStatus.ACTIVE } });
    const student2 = await prisma.student.create({ data: { branchId: branch.id, name: "Student 2", status: StudentStatus.ACTIVE } });

    console.log(`✅ Setup Complete.`);

    // ==========================================
    // TEST 1: Same Seat, Same Shift Conflict
    // ==========================================
    console.log("\n🧪 TEST 1: Same Seat, Same Shift Conflict");
    await SeatAllocationService.assignSeat(user.id, seat1.id, student1.id, shiftMorning.id);
    console.log("   Allocated S1 to Student 1 (Morning).");

    try {
        await SeatAllocationService.assignSeat(user.id, seat1.id, student2.id, shiftMorning.id);
        console.error("   ❌ FAILURE: Allowed conflict allocation!");
    } catch (e: unknown) {
        const message = errorMessage(e);
        if (message.includes("Seat is already assigned")) {
            console.log("   ✅ SUCCESS: Rejected conflict.");
        } else {
            console.error(`   ❌ Unexpected error: ${message}`);
        }
    }

    // ==========================================
    // TEST 2: Reserved Shift Blocks Other Shifts
    // ==========================================
    console.log("\n🧪 TEST 2: Reserved Shift vs Normal Shift");
    // S1 has Morning. Try to assign Reserved (Full Day).
    try {
        await SeatAllocationService.assignSeat(user.id, seat1.id, student2.id, shiftReserved.id);
        console.error("   ❌ FAILURE: Allowed Reserved allocation on occupied seat!");
    } catch (e: unknown) {
        const message = errorMessage(e);
        if (message.includes("Cannot allocate RESERVED shift")) {
            console.log("   ✅ SUCCESS: Rejected Reserved allocation.");
        } else {
            console.error(`   ❌ Unexpected error: ${message}`);
        }
    }

    // ==========================================
    // TEST 3: History Preservation
    // ==========================================
    console.log("\n🧪 TEST 3: History Preservation");
    // Unassign S1 from Morning
    const alloc = await prisma.seatAllocation.findFirst({ where: { seatId: seat1.id, studentId: student1.id, shiftId: shiftMorning.id } });
    if (!alloc) throw new Error("Alloc not found");

    await SeatAllocationService.unassignSeat(alloc.id);
    console.log("   Unassigned S1.");

    // Check it still exists in DB
    const historic = await prisma.seatAllocation.findUnique({ where: { id: alloc.id } });
    if (historic && historic.endDate) {
        console.log("   ✅ SUCCESS: Record exists with endDate " + historic.endDate);
    } else {
        console.error("   ❌ FAILURE: Record deleted or endDate missing.");
    }

    // Now assigning Reserved should work
    await SeatAllocationService.assignSeat(user.id, seat1.id, student2.id, shiftReserved.id);
    console.log("   ✅ SUCCESS: Assigned Reserved after freeing seat.");

    console.log("\n🏁 ALLOCATION AUDIT COMPLETE.");
}

main()
    .catch((e) => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
