import { PrismaClient, PaymentStatus, StudentStatus, StaffRole } from '@prisma/client';
import { addDays, subDays, startOfMonth, endOfMonth } from 'date-fns';
import * as fs from 'fs';
import 'dotenv/config';
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
    })
});
const logStream = fs.createWriteStream('seed.log', { flags: 'a' });

function log(message: string) {
    console.log(message);
    logStream.write(message + '\n');
}

async function main() {
    log('🌱 Starting seed...');

    // 1. Cleanup
    log('🧹 Cleaning up existing data...');

    // NEW TABLES FIRST (Foreign Keys depend on older tables)
    try {
        await prisma.messageDraft.deleteMany();
    } catch (e) { } // Catch if table doesn't exist yet (though schema has it)
    try {
        await prisma.branchAIReport.deleteMany();
    } catch (e) { }

    // Existing Cleanup
    await prisma.payment.deleteMany();
    await prisma.seatAllocation.deleteMany();
    await prisma.student.deleteMany();
    await prisma.seat.deleteMany();
    await prisma.shift.deleteMany();
    await prisma.staff.deleteMany();
    await prisma.branch.deleteMany();
    await prisma.organization.deleteMany();
    await prisma.user.deleteMany();

    // 2. Create Users
    log('👤 Creating users...');

    const alice = await prisma.user.create({
        data: {
            id: 'user_alice',
            email: 'alice@example.com',
            name: 'Alice Admin',
        }
    });

    const bob = await prisma.user.create({
        data: {
            id: 'user_bob',
            email: 'bob@example.com',
            name: 'Bob Builder',
        }
    });

    // 3. Create Data for Alice
    await createWorldForUser(alice, 'Alice EduCorp', ['Downtown Library', 'Uptown Study Hall'], 'org_alice');

    // 4. Create Data for Bob
    await createWorldForUser(bob, "Bob's Coaching", ['Main Campus'], 'org_bob');

    log('✅ Seed completed successfully.');

    // Log valid URLs for developer convenience
    const branches = await prisma.branch.findMany({ include: { organization: true } });
    log('\n🔎 Valid Branch URLs:');
    branches.forEach(b => {
        log(`- ${b.name} (${b.organization.name}): http://localhost:3000/branch/${b.id}`);
    });
}

async function createWorldForUser(user: any, orgName: string, branchNames: string[], orgId?: string) {
    log(`Building world for ${user.name}...`);

    // Create Org
    const org = await prisma.organization.create({
        data: {
            id: orgId,
            name: orgName,
            ownerId: user.id,
        }
    });

    for (const branchName of branchNames) {
        const branch = await prisma.branch.create({
            data: {
                name: branchName,
                organizationId: org.id,
            }
        });

        // Create Staff (Owner as Manager)
        await prisma.staff.create({
            data: {
                userId: user.id,
                branchId: branch.id,
                role: StaffRole.MANAGER,
            }
        });

        // Create Shifts
        const shifts = [];
        const shiftData = [
            { name: 'Morning', startTime: '06:00', endTime: '12:00', price: 800 },
            { name: 'Evening', startTime: '12:00', endTime: '18:00', price: 800 },
            { name: 'Full Day', startTime: '08:00', endTime: '20:00', price: 1500 }
        ];
        for (const s of shiftData) {
            shifts.push(await prisma.shift.create({
                data: { ...s, branchId: branch.id }
            }));
        }

        // Create Seats
        const seats = [];
        for (let i = 1; i <= 20; i++) {
            seats.push(await prisma.seat.create({
                data: {
                    branchId: branch.id,
                    label: `${i}`
                }
            }));
        }

        // Create Students
        const students = [];
        for (let i = 1; i <= 15; i++) {
            const status = Math.random() > 0.2 ? StudentStatus.ACTIVE : StudentStatus.INACTIVE;
            const student = await prisma.student.create({
                data: {
                    branchId: branch.id,
                    name: `${user.name.split(' ')[0]} Student ${i}`,
                    phone: `555-01${i.toString().padStart(2, '0')}`,
                    status: status,
                    joinedAt: subDays(new Date(), Math.floor(Math.random() * 60)),
                }
            });
            students.push(student);
        }

        // Create Allocations (for active students)
        const activeStudents = students.filter(s => s.status === StudentStatus.ACTIVE);
        for (let i = 0; i < Math.min(activeStudents.length, 10); i++) {
            await prisma.seatAllocation.create({
                data: {
                    studentId: activeStudents[i].id,
                    seatId: seats[i].id, // Simple 1:1 allocation
                    shiftId: shifts[0].id, // Everyone in Morning shift for simplicity or random
                    startDate: subDays(new Date(), 10),
                }
            });
        }

        // Create Payments
        for (const student of students) {
            // Past payment (Paid)
            await prisma.payment.create({
                data: {
                    branchId: branch.id,
                    studentId: student.id,
                    amount: 1000,
                    status: PaymentStatus.PAID,
                    dueDate: subDays(new Date(), 30),
                    periodStart: startOfMonth(subDays(new Date(), 30)),
                    periodEnd: endOfMonth(subDays(new Date(), 30)),
                    paidAt: subDays(new Date(), 28),
                }
            });

            // Current payment (Due or Paid)
            const isPaid = Math.random() > 0.5;
            await prisma.payment.create({
                data: {
                    branchId: branch.id,
                    studentId: student.id,
                    amount: 1000,
                    status: isPaid ? PaymentStatus.PAID : PaymentStatus.DUE,
                    dueDate: new Date(),
                    periodStart: startOfMonth(new Date()),
                    periodEnd: endOfMonth(new Date()),
                    paidAt: isPaid ? new Date() : null,
                }
            });
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
