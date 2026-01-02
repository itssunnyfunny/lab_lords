export type MessageLanguage = "en" | "hi"

export interface AIMessageDraft {
  language: MessageLanguage
  message: string
}
