import { AIActionSuggestion } from "../contracts/actionSuggestion.contract"
import { AIMessageDraft } from "../contracts/messageDraft.contract"
import { prisma } from "@/lib/prisma"
import { callGemini } from "../llm/gemini.client"

export async function draftMessagesForBranch(
  branchId: string,
  actions: AIActionSuggestion[],
  language: "en" | "hi" = "en"
): Promise<AIMessageDraft[]> {
  const drafts: AIMessageDraft[] = []

  for (const action of actions) {
    if (action.action === "FOLLOW_UP_OVERDUE_PAYMENTS") {
      // 1. Get relevant students
      const studentIds = action.meta?.relatedEntityIds || []

      // Filter out students who already have a draft for this action
      const studentsNeedingDrafts = [];
      for (const studentId of studentIds) {
        const existingDraft = await prisma.messageDraft.findFirst({
          where: { branchId, studentId, action: action.action, language },
          include: { student: { select: { updatedAt: true } } }
        });

        if (existingDraft) {
          const isOutdated = existingDraft.student
            ? existingDraft.student.updatedAt > existingDraft.createdAt
            : false;

          drafts.push({
            language: existingDraft.language as "en" | "hi",
            message: existingDraft.message,
            isOutdated
          });
        } else {
          studentsNeedingDrafts.push(studentId);
        }
      }

      if (studentsNeedingDrafts.length > 0) {
        // Fetch student details for the prompt
        const students = await prisma.student.findMany({
          where: { id: { in: studentsNeedingDrafts } },
          select: { id: true, name: true, monthlyFee: true }
        });

        // Generate Prompt
        const prompt = `
You are an assistant for a study hall manager.
Generate polite follow-up messages for overdue payments for the following students.
Language: ${language === 'hi' ? 'Hindi (Polite, Formal)' : 'English (Polite, Professional)'}.
Keep it short (under 20 words).
Output specifically a JSON array of objects: { "studentId": "...", "message": "..." }.
Do NOT output markdown.

Students:
${JSON.stringify(students.map(s => ({ id: s.id, name: s.name, due: s.monthlyFee })))}
`;

        try {
          const aiResponse = await callGemini(prompt);
          // Clean and parse
          const cleanJson = aiResponse?.replace(/```json/g, '').replace(/```/g, '').trim() || "[]";
          const generatedMessages = JSON.parse(cleanJson);

          for (const item of generatedMessages) {
            const msg = item.message;
            if (msg) {
              await prisma.messageDraft.create({
                data: {
                  branchId,
                  studentId: item.studentId,
                  action: action.action,
                  language,
                  message: msg
                }
              });
              drafts.push({ language, message: msg });
            }
          }
        } catch (error) {
          console.error("Failed to generate batch messages via Gemini", error);
          // Fallback to static if AI fails
          const fallbackMsg = language === "en" ? "Reminder: Payment is due." : "स्मरण: भुगतान देय है।";
          drafts.push({ language, message: fallbackMsg });
        }
      }
    } else {
      // For other actions, we might need different logic.
      // Current implementation only had static messages for seat util etc.
      // But the user requirement specifically emphasized overdue students.
      // We will keep the legacy static logic for others for now, but WITHOUT persistence if they are not student-specific.
      // Actually, let's just emit them as transient drafts if they are general.

      let message = ""
      switch (action.action) {
        case "REVIEW_SEAT_UTILIZATION":
          message = language === "en"
            ? "We are reviewing seating availability. If you are interested in adjusting your study timing, please contact us."
            : "हम बैठने की उपलब्धता की समीक्षा कर रहे हैं। यदि आप अपने अध्ययन समय में बदलाव करना चाहते हैं, तो कृपया संपर्क करें。"
          break
        case "REENGAGE_INACTIVE_STUDENTS":
          message = language === "en"
            ? "We noticed you haven’t been attending recently. Let us know if you’d like to resume or need any support."
            : "हमने देखा कि आप हाल ही में उपस्थित नहीं हो पाए हैं। यदि आप फिर से शुरू करना चाहते हैं या सहायता चाहिए तो कृपया बताएं。"
          break
      }

      if (message) {
        drafts.push({
          language,
          message
        })
      }
    }
  }

  return drafts
}
