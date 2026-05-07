
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
    adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
    }),
});

async function main() {
    const branches = await prisma.branch.findMany({
        select: {
            id: true,
            name: true,
            organizationId: true
        }
    });

    console.table(branches);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
