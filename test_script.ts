import { prisma } from "./lib/prisma"

async function test() {
  const branchId = 'test'
  const date = new Date()

  const seatedCount = await prisma.student.count({
    where: {
      branchId,
      status: "ACTIVE",
      seatAllocations: {
        some: {
          startDate: { lte: date },
          OR: [
            { endDate: null },
            { endDate: { gt: date } },
          ],
        }
      }
    }
  })
  console.log("Seated:", seatedCount)
}
test()
