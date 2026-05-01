import { prisma } from "@/lib/prisma"
import { callGemini } from "../llm/gemini.client"
import { format } from "date-fns"

export interface OverdueMessageDraft {
  studentId: string
  studentName: string
  dueDate: string        // ISO string
  language: "en" | "hi"
  message: string
  isOutdated?: boolean
}

const ACTION = "FOLLOW_UP_OVERDUE_PAYMENTS"

/**
 * Standalone function — independent from the AI reports pipeline.
 *
 * Logic:
 * 1. Fetch all DUE payments for the branch where dueDate < today (actual overdue).
 * 2. For each overdue payment, check if a MessageDraft already exists in DB.
 * 3. Return cached drafts immediately (skip Gemini).
 * 4. Batch the remaining students → call Gemini once with name + dueDate.
 * 5. Persist new drafts, return everything.
 */
export async function draftOverdueMessages(
  branchId: string,
  language: "en" | "hi" = "en"
): Promise<OverdueMessageDraft[]> {
  const today = new Date()

  // 1️⃣ Fetch all DUE payments that are actually overdue (dueDate < today)
  const overduePayments = await prisma.payment.findMany({
    where: {
      branchId,
      status: "DUE",
      dueDate: { lt: today }
    },
    include: {
      student: { select: { id: true, name: true } }
    },
    orderBy: { dueDate: "asc" }
  })

  if (overduePayments.length === 0) {
    return []
  }

  const results: OverdueMessageDraft[] = []
  const needsGeneration: Array<{ studentId: string; studentName: string; dueDate: Date; amount: number }> = []

  // Pre-fetch all existing drafts for these students to avoid N+1 queries
  const existingDrafts = await prisma.messageDraft.findMany({
    where: {
      branchId,
      action: ACTION,
      language,
      studentId: { in: overduePayments.map(p => p.studentId) }
    },
    include: { student: { select: { updatedAt: true } } }
  })
  const existingDraftsMap = new Map(existingDrafts.map(d => [d.studentId, d]))

  // 2️⃣ For each, check if draft already exists in DB
  for (const payment of overduePayments) {
    // De-duplicate: if same student has multiple overdue payments, only one draft per student per language
    const alreadyQueued = needsGeneration.some(n => n.studentId === payment.studentId)
    const alreadyInResults = results.some(r => r.studentId === payment.studentId)
    if (alreadyQueued || alreadyInResults) continue

    const existing = existingDraftsMap.get(payment.studentId)

    if (existing) {
      // 3️⃣ Return cached
      const isOutdated = existing.student
        ? existing.student.updatedAt > existing.createdAt
        : false

      results.push({
        studentId: payment.studentId,
        studentName: payment.student.name,
        dueDate: payment.dueDate.toISOString(),
        language: existing.language as "en" | "hi",
        message: existing.message,
        isOutdated
      })
    } else {
      // 4️⃣ Queue for generation
      needsGeneration.push({
        studentId: payment.studentId,
        studentName: payment.student.name,
        dueDate: payment.dueDate,
        amount: payment.amount
      })
    }
  }

  console.log(`[Messages] ${results.length} cached, generating for ${needsGeneration.length} student(s)`)

  // 5️⃣ Batch call Gemini for students without drafts
  if (needsGeneration.length > 0) {
    const studentList = needsGeneration.map(s => ({
      id: s.studentId,
      name: s.studentName,
      dueDate: format(s.dueDate, "dd MMM yyyy"),
      amount: `₹${s.amount}`
    }))

    const prompt = `
You are an assistant for a study hall manager.
Generate short, polite payment reminder messages for overdue students.
Language: ${language === "hi" ? "Hindi (Polite, Formal)" : "English (Polite, Professional)"}.
Every message MUST include ALL THREE of: the student's name, the due date, and the amount due.
Keep it SHORT — under 30 words per message.
Output ONLY a JSON array: [{ "studentId": "...", "message": "..." }]
Do NOT output markdown or code blocks.

Students:
${JSON.stringify(studentList)}
`

    try {
      const aiResponse = await callGemini(prompt)
      const clean = aiResponse?.replace(/```json/g, "").replace(/```/g, "").trim() || "[]"
      const generated: Array<{ studentId: string; message: string }> = JSON.parse(clean)

      const draftsToCreate: import('@prisma/client').Prisma.MessageDraftCreateManyInput[] = []

      for (const item of generated) {
        const meta = needsGeneration.find(n => n.studentId === item.studentId)
        if (!meta || !item.message) continue

        // Accumulate to persist to DB
        draftsToCreate.push({
          branchId,
          studentId: item.studentId,
          action: ACTION,
          language,
          message: item.message
        })

        results.push({
          studentId: item.studentId,
          studentName: meta.studentName,
          dueDate: meta.dueDate.toISOString(),
          language,
          message: item.message,
          isOutdated: false
        })
      }

      if (draftsToCreate.length > 0) {
        await prisma.messageDraft.createMany({ data: draftsToCreate })
      }
    } catch (err) {
      console.error("[Messages] Gemini call failed, using fallback", err)
      // Fallback — static message with student name
      const fallbackDraftsToCreate: import('@prisma/client').Prisma.MessageDraftCreateManyInput[] = []

      for (const meta of needsGeneration) {
        const fallback = language === "en"
          ? `Hi ${meta.studentName}, your payment of ₹${meta.amount} due on ${format(meta.dueDate, "dd MMM yyyy")} is pending. Please clear it at your earliest.`
          : `प्रिय ${meta.studentName}, ${format(meta.dueDate, "dd MMM yyyy")} का ₹${meta.amount} का भुगतान अभी बाकी है। कृपया जल्द से जल्द जमा करें।`

        // Persist fallback too so we don't call AI again
        fallbackDraftsToCreate.push({
          branchId,
          studentId: meta.studentId,
          action: ACTION,
          language,
          message: fallback
        })

        results.push({
          studentId: meta.studentId,
          studentName: meta.studentName,
          dueDate: meta.dueDate.toISOString(),
          language,
          message: fallback,
          isOutdated: false
        })
      }

      if (fallbackDraftsToCreate.length > 0) {
        await prisma.messageDraft.createMany({ data: fallbackDraftsToCreate })
      }
    }
  }

  return results
}
