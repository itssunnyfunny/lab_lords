import { AIActionSuggestion } from "../contracts/actionSuggestion.contract"
import { AIMessageDraft } from "../contracts/messageDraft.contract"

export function draftMessagesForBranch(
  actions: AIActionSuggestion[],
  language: "en" | "hi" = "en"
): AIMessageDraft[] {
  return actions.map(action => {
    switch (action.action) {
      case "FOLLOW_UP_OVERDUE_PAYMENTS":
        return {
          language,
          message:
            language === "en"
              ? "Hello, this is a gentle reminder regarding a pending fee. Please let us know if you need any help. Thank you."
              : "नमस्ते, यह लंबित शुल्क के संबंध में एक विनम्र अनुस्मारक है। किसी सहायता की आवश्यकता हो तो कृपया बताएं। धन्यवाद।",
        }

      case "REVIEW_SEAT_UTILIZATION":
        return {
          language,
          message:
            language === "en"
              ? "We are reviewing seating availability. If you are interested in adjusting your study timing, please contact us."
              : "हम बैठने की उपलब्धता की समीक्षा कर रहे हैं। यदि आप अपने अध्ययन समय में बदलाव करना चाहते हैं, तो कृपया संपर्क करें।",
        }

      case "REENGAGE_INACTIVE_STUDENTS":
        return {
          language,
          message:
            language === "en"
              ? "We noticed you haven’t been attending recently. Let us know if you’d like to resume or need any support."
              : "हमने देखा कि आप हाल ही में उपस्थित नहीं हो पाए हैं। यदि आप फिर से शुरू करना चाहते हैं या सहायता चाहिए तो कृपया बताएं।",
        }
    }
  })
    .filter((draft): draft is AIMessageDraft => draft !== undefined)
}
